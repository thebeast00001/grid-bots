import { createHash, randomBytes } from "node:crypto";
import { getSetting, hostId, setSetting } from "../../settings";
import { GridModelError, toGridError } from "../errors";
import { addProvider, listProviders, loadProvider, updateProviderSecret } from "../providers-repo";
import { RECONNECT } from "./errors";
import { listenOnce, type Loopback } from "./loopback";

/**
 * Sign in with ChatGPT, plan usage for open-source / locally hosted apps.
 * Docs: https://developers.openai.com/siwc/token-sharing-open-source
 * Not documented there (decided here): the refresh request body follows standard
 * OAuth (grant_type, refresh_token, client_id); the ID token arrives straight
 * from the token endpoint over TLS, so we check its nonce/aud/exp claims rather
 * than its signature (OIDC Core §3.1.3.7).
 */

export const AUTHORIZE_URL = "https://auth.openai.com/api/accounts/authorize";
export const TOKEN_URL = "https://auth.openai.com/api/accounts/oauth/token";
export const SCOPES = "openid profile email offline_access resource.invoke chatgpt.tokens.use.direct";
export const RESOURCE = "https://api.openai.com/v1";
export const DYNAMIC_CLIENT = "dynamic_agent_client";
export const APP_NAME = "Grid";
const PORTS = [1455, 1456, 1457, 1458, 1459, 1460];
const PLAN_SCOPE = "chatgpt.tokens.use.direct";

export type ChatgptSecret = { access: string; refresh: string; expiresAt: number; clientId: string; sub: string; email?: string };

const rand = () => randomBytes(24).toString("base64url");

export function pkcePair(): { verifier: string; challenge: string } {
  const verifier = randomBytes(32).toString("base64url");
  return { verifier, challenge: createHash("sha256").update(verifier).digest("base64url") };
}

export function buildAuthorizeUrl(p: {
  clientId: string;
  redirectUri: string;
  hostId: string;
  state: string;
  nonce: string;
  codeChallenge: string;
  firstTime: boolean;
}): string {
  const u = new URL(AUTHORIZE_URL);
  const q = u.searchParams;
  q.set("response_type", "code");
  q.set("client_id", p.clientId);
  q.set("redirect_uri", p.redirectUri);
  q.set("scope", SCOPES);
  q.set("resource", RESOURCE);
  q.set("state", p.state);
  q.set("nonce", p.nonce);
  q.set("code_challenge", p.codeChallenge);
  q.set("code_challenge_method", "S256");
  q.set("ext_agent_host_id", p.hostId);
  if (p.firstTime) q.set("agent_name_hint", APP_NAME);
  return u.toString();
}

function decodeJwt(token: string): Record<string, unknown> {
  const part = token.split(".")[1];
  if (!part) throw new GridModelError("auth", "ChatGPT sent an unreadable sign-in token.");
  return JSON.parse(Buffer.from(part, "base64url").toString("utf8")) as Record<string, unknown>;
}

async function postForm(params: Record<string, string>): Promise<Response> {
  return fetch(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(params).toString(),
  });
}

async function finishSignIn(p: { code: string; clientId: string; verifier: string; redirectUri: string; nonce: string }) {
  const res = await postForm({
    grant_type: "authorization_code",
    client_id: p.clientId,
    code: p.code,
    code_verifier: p.verifier,
    redirect_uri: p.redirectUri,
    resource: RESOURCE,
  });
  if (!res.ok) throw new GridModelError("auth", "ChatGPT sign-in failed. Try again.");
  const tok = (await res.json()) as { access_token: string; refresh_token: string; id_token?: string; expires_in?: number; scope?: string };

  let sub = "";
  let email: string | undefined;
  if (tok.id_token) {
    const claims = decodeJwt(tok.id_token);
    if (claims.nonce !== p.nonce) throw new GridModelError("auth", "ChatGPT sign-in didn't match. Try again.");
    if (typeof claims.exp === "number" && claims.exp * 1000 < Date.now()) throw new GridModelError("auth", "ChatGPT sign-in expired. Try again.");
    sub = String(claims.sub ?? "");
    const profile = claims["https://api.openai.com/profile"] as { email?: string } | undefined;
    email = typeof claims.email === "string" ? claims.email : profile?.email;
  }
  if (tok.scope && !tok.scope.split(" ").includes(PLAN_SCOPE)) {
    throw new GridModelError("unsupported", "This ChatGPT plan can't be used in other apps.");
  }

  const secret: ChatgptSecret = {
    access: tok.access_token,
    refresh: tok.refresh_token,
    expiresAt: Date.now() + (tok.expires_in ?? 3600) * 1000,
    clientId: p.clientId,
    sub,
    email,
  };
  const existing = (await listProviders()).find((x) => x.kind === "chatgpt");
  if (existing) await updateProviderSecret(existing.id, secret);
  else await addProvider({ kind: "chatgpt", secret });
}

let pending: Loopback | null = null;

/** Opens a one-shot loopback listener and returns the URL to open in the browser. */
export async function startChatgptSignIn({ appOrigin }: { appOrigin: string }): Promise<{ authorizeUrl: string }> {
  pending?.close();
  const savedClient = await getSetting<string>("chatgptClientId");
  const { verifier, challenge } = pkcePair();
  const state = rand();
  const nonce = rand();
  const host = await hostId();
  const back = (q: string) => `${appOrigin}/settings/models?${q}`;
  let redirectUri = "";

  pending = await listenOnce(PORTS, "/auth/callback", async (url) => {
    if (url.searchParams.get("state") !== state) return back("chatgpt=error&reason=state");
    const error = url.searchParams.get("error");
    if (error) return back(`chatgpt=error&reason=${encodeURIComponent(error)}`);
    const code = url.searchParams.get("code");
    const issued = url.searchParams.get("client_id");
    if (savedClient && issued && issued !== savedClient) return back("chatgpt=error&reason=client");
    const clientId = savedClient ?? issued;
    if (!code || !clientId) return back("chatgpt=error&reason=code");
    try {
      await finishSignIn({ code, clientId, verifier, redirectUri, nonce });
      if (!savedClient) await setSetting("chatgptClientId", clientId);
      return back("chatgpt=connected");
    } catch (e) {
      return back(`chatgpt=error&reason=${encodeURIComponent(toGridError(e).code)}`);
    }
  });
  redirectUri = `http://127.0.0.1:${pending.port}/auth/callback`;

  return {
    authorizeUrl: buildAuthorizeUrl({
      clientId: savedClient ?? DYNAMIC_CLIENT,
      redirectUri,
      hostId: host,
      state,
      nonce,
      codeChallenge: challenge,
      firstTime: !savedClient,
    }),
  };
}

const inflight = new Map<string, Promise<string>>();

async function refreshIfNeeded(providerId: string): Promise<string> {
  const p = await loadProvider(providerId);
  const s = p.secret as ChatgptSecret | null;
  if (!s?.refresh) throw new GridModelError("auth", "Sign in with ChatGPT again.", { action: RECONNECT });
  if (s.expiresAt - Date.now() > 60_000) return s.access;

  const res = await postForm({ grant_type: "refresh_token", refresh_token: s.refresh, client_id: s.clientId });
  if (!res.ok) {
    if (res.status >= 500) throw new GridModelError("unavailable", "ChatGPT sign-in is unavailable right now. Try again in a moment.");
    throw new GridModelError("auth", "Your ChatGPT sign-in expired.", { action: RECONNECT });
  }
  const tok = (await res.json()) as { access_token: string; refresh_token?: string; expires_in?: number };
  const next: ChatgptSecret = {
    ...s,
    access: tok.access_token,
    refresh: tok.refresh_token ?? s.refresh,
    expiresAt: Date.now() + (tok.expires_in ?? 3600) * 1000,
  };
  await updateProviderSecret(providerId, next);
  return next.access;
}

/** A valid access token, refreshed (and the rotated refresh token saved) when within a minute of expiry. */
export function getAccessToken(providerId: string): Promise<string> {
  let p = inflight.get(providerId);
  if (!p) {
    p = refreshIfNeeded(providerId).finally(() => inflight.delete(providerId));
    inflight.set(providerId, p);
  }
  return p;
}
