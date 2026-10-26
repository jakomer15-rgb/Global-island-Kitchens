import { NextResponse, type NextRequest } from "next/server";
import createIntlMiddleware from "next-intl/middleware";
import { routing } from "@/i18n/routing";

const intl = createIntlMiddleware(routing);

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (pathname === "/admin" || pathname.startsWith("/admin/")) {
    // Convenience only: without a session cookie, go straight to sign-in. Every admin page and
    // action still checks the session and permissions on the server (src/server/auth/session.ts).
    const hasSession = request.cookies.getAll().some((c) => c.name.endsWith("gik.session_token"));
    if (pathname !== "/admin/sign-in" && !hasSession) {
      const url = new URL("/admin/sign-in", request.url);
      url.searchParams.set("next", pathname + search);
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  // English has no /en prefix: send /en/... to the canonical unprefixed URL.
  if (pathname === "/en" || pathname.startsWith("/en/")) {
    const url = request.nextUrl.clone();
    url.pathname = pathname.slice(3) || "/";
    return NextResponse.redirect(url, 308);
  }
  return intl(request);
}

export const config = {
  // Everything except API routes, website images (/media), printable documents, Next internals and files with an extension.
  matcher: ["/((?!api|media/|documents/|_next|_vercel|.*\\..*).*)"],
};
