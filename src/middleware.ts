import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

function isMarketingHost(host: string) {
  const h = host.split(":")[0].toLowerCase();
  return h === "coreextract.app" || h === "www.coreextract.app";
}

export function middleware(request: NextRequest) {
  const host = request.headers.get("host") || "";
  if (!isMarketingHost(host)) return NextResponse.next();

  const { pathname } = request.nextUrl;
  if (
    pathname.startsWith("/try") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/pdf.worker") ||
    pathname.startsWith("/wasm")
  ) {
    return NextResponse.next();
  }

  if (pathname === "/") {
    const url = request.nextUrl.clone();
    url.pathname = "/try";
    return NextResponse.rewrite(url);
  }

  const url = request.nextUrl.clone();
  url.pathname = "/try";
  return NextResponse.rewrite(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
