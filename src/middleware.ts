import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Hard redirect any signup attempt to Request Access
  if (pathname === "/signup" || pathname.startsWith("/signup/")) {
    const url = req.nextUrl.clone();
    url.pathname = "/request-access";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/signup", "/signup/:path*"],
};
