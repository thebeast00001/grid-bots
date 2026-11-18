import { createHash } from "node:crypto";
import http from "node:http";
import { resetDbForTests } from "../../db/client";
import { getSetting } from "../../settings";
import { useTempHome } from "../../test-home";
import { addProvider, listProviders, loadProvider } from "../providers-repo";
import {
  AUTHORIZE_URL,
  DYNAMIC_CLIENT,
  RESOURCE,
  SCOPES,
  TOKEN_URL,
  buildAuthorizeUrl,
  getAccessToken,
  pkcePair,
  startChatgptSignIn,
} from "./oauth";

useTempHome();
afterAll(() => resetDbForTests());
afterEach(() => vi.unstubAllGlobals());

const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString("base64url");
const fakeJwt = (claims: Record<string, unknown>) => `${b64({ alg: "RS256" })}.${b64(claims)}.sig`;

test("authorize URL carries PKCE, resource, scopes and host id on first sign-in", () => {
  const u = new URL(
    buildAuthorizeUrl({
      clientId: DYNAMIC_CLIENT,
      redirectUri: "http://127.0.0.1:1455/auth/callback",
      hostId: "urn:uuid:x",
      state: "s",
      nonce: "n",
      codeChallenge: "c",
      firstTime: true,
    }),
  );
  expect(u.origin + u.pathname).toBe(AUTHORIZE_URL);
  const expected = {
    response_type: "code",
    code_challenge_method: "S256",
    code_challenge: "c",
    resource: RESOURCE,
    scope: SCOPES,
    ext_agent_host_id: "urn:uuid:x",
    agent_name_hint: "Grid",
    client_id: DYNAMIC_CLIENT,
    redirect_uri: "http://127.0.0.1:1455/auth/callback",
    state: "s",
    nonce: "n",
  };
  for (const [k, v] of Object.entries(expected)) expect(u.searchParams.get(k)).toBe(v);
});

test("later sign-ins omit agent_name_hint and use the issued client id", () => {
  const u = new URL(
    buildAuthorizeUrl({ clientId: "oaiapp_1", redirectUri: "r", hostId: "urn:uuid:x", state: "s", nonce: "n", codeChallenge: "c", firstTime: false }),
  );
  expect(u.searchParams.get("client_id")).toBe("oaiapp_1");
  expect(u.searchParams.has("agent_name_hint")).toBe(false);
  expect(u.searchParams.get("ext_agent_host_id")).toBe("urn:uuid:x");
});

test("pkcePair challenge is base64url SHA-256 of verifier without padding", () => {
  const { verifier, challenge } = pkcePair();
  expect(challenge).toBe(createHash("sha256").update(verifier).digest("base64url"));
  expect(challenge).not.toContain("=");
  expect(verifier.length).toBeGreaterThanOrEqual(43);
});

function hit(url: string): Promise<{ status: number; location?: string }> {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      res.resume();
      resolve({ status: res.statusCode ?? 0, location: res.headers.location });
    }).on("error", reject);
  });
}

test("full loopback sign-in saves the provider and returns to the app", async () => {
  const tokenCalls: URLSearchParams[] = [];
  let nonce = "";
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      if (url === TOKEN_URL) {
        tokenCalls.push(new URLSearchParams(String(init?.body)));
        return Response.json({
          access_token: "acc-1",
          refresh_token: "ref-1",
          id_token: fakeJwt({ sub: "user-1", email: "a@b.c", nonce, aud: "oaiapp_9", exp: Date.now() / 1000 + 3600 }),
          expires_in: 3600,
          scope: SCOPES,
          token_type: "Bearer",
        });
      }
      if (url === "https://api.openai.com/v1/models") {
        return Response.json({ data: [{ slug: "gpt-plan", display_name: "GPT Plan", visibility: "list" }, { slug: "hidden", visibility: "hide" }] });
      }
      throw new Error(`unexpected fetch ${url}`);
    }),
  );

  const { authorizeUrl } = await startChatgptSignIn({ appOrigin: "http://127.0.0.1:3210" });
  const a = new URL(authorizeUrl);
  nonce = a.searchParams.get("nonce")!;
  const redirect = new URL(a.searchParams.get("redirect_uri")!);
  expect(redirect.hostname).toBe("127.0.0.1");
  expect(redirect.pathname).toBe("/auth/callback");

  const back = await hit(`${redirect}?code=the-code&state=${a.searchParams.get("state")}&client_id=oaiapp_9`);
  expect(back.status).toBe(302);
  expect(back.location).toBe("http://127.0.0.1:3210/settings/models?chatgpt=connected");

  expect(tokenCalls[0].get("grant_type")).toBe("authorization_code");
  expect(tokenCalls[0].get("client_id")).toBe("oaiapp_9");
  expect(tokenCalls[0].get("code")).toBe("the-code");
  expect(tokenCalls[0].get("resource")).toBe(RESOURCE);
  expect(tokenCalls[0].get("code_verifier")).toBeTruthy();
  expect(await getSetting("chatgptClientId")).toBe("oaiapp_9");

  const [p] = (await listProviders()).filter((x) => x.kind === "chatgpt");
  expect(p).toMatchObject({ kind: "chatgpt", hint: "a@b.c" });
  expect((await loadProvider(p.id)).secret).toMatchObject({ access: "acc-1", refresh: "ref-1", clientId: "oaiapp_9", sub: "user-1" });
});

test("a callback with the wrong state is refused", async () => {
  const { authorizeUrl } = await startChatgptSignIn({ appOrigin: "http://127.0.0.1:3210" });
  const redirect = new URL(new URL(authorizeUrl).searchParams.get("redirect_uri")!);
  const back = await hit(`${redirect}?code=x&state=wrong`);
  expect(back.location).toBe("http://127.0.0.1:3210/settings/models?chatgpt=error&reason=state");
});

async function chatgptProvider(expiresAt: number) {
  vi.stubGlobal("fetch", vi.fn(async () => Response.json({ data: [] })));
  return addProvider({ kind: "chatgpt", secret: { access: "old", refresh: "r-old", expiresAt, clientId: "oaiapp_9", sub: "u" } });
}

test("getAccessToken refreshes when expiring and stores the rotated refresh token", async () => {
  const p = await chatgptProvider(Date.now() + 10_000);
  const calls: URLSearchParams[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url: string, init?: RequestInit) => {
      calls.push(new URLSearchParams(String(init?.body)));
      return Response.json({ access_token: "new", refresh_token: "r-new", expires_in: 3600 });
    }),
  );
  expect(await getAccessToken(p.id)).toBe("new");
  expect(calls[0].get("grant_type")).toBe("refresh_token");
  expect(calls[0].get("refresh_token")).toBe("r-old");
  expect(calls[0].get("client_id")).toBe("oaiapp_9");
  expect((await loadProvider(p.id)).secret).toMatchObject({ access: "new", refresh: "r-new" });
});

test("getAccessToken reuses a fresh token without calling OpenAI", async () => {
  const p = await chatgptProvider(Date.now() + 3_600_000);
  const f = vi.fn();
  vi.stubGlobal("fetch", f);
  expect(await getAccessToken(p.id)).toBe("old");
  expect(f).not.toHaveBeenCalled();
});

test("getAccessToken turns refresh_token_reused into Reconnect ChatGPT", async () => {
  const p = await chatgptProvider(Date.now() - 1);
  vi.stubGlobal("fetch", vi.fn(async () => Response.json({ error: "refresh_token_reused" }, { status: 400 })));
  await expect(getAccessToken(p.id)).rejects.toMatchObject({ code: "auth", action: { label: "Reconnect ChatGPT", href: "/settings/models" } });
});
