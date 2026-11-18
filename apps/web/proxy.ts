import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { checkRequest } from "./lib/guard";

export function proxy(request: NextRequest) {
  const port = Number(process.env.PORT) || Number(request.nextUrl.port) || 80;
  const result = checkRequest({ method: request.method, headers: request.headers, port });
  if (!result.ok) {
    return NextResponse.json({ error: { code: "forbidden", message: `Blocked (${result.reason})` } }, { status: 403 });
  }
  return NextResponse.next();
}

export const config = { matcher: "/api/:path*" };
