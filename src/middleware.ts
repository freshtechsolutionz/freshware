import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  let user: { id: string } | null = null;

  try {
    const { data } = await supabase.auth.getUser();
    user = (data?.user as any) ?? null;
  } catch {
    user = null;
  }

  const path = request.nextUrl.pathname;

  // Root handling: logged-in users land in dashboard, everyone else sees homepage.
  if (path === "/") {
    if (user) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
    return response;
  }

  // Protect dashboard
  if (path.startsWith("/dashboard") && !user) {
    const loginUrl = new URL("/portal", request.url);
    loginUrl.searchParams.set("next", path);
    return NextResponse.redirect(loginUrl);
  }

  // Protect admin
  if (path.startsWith("/admin") && !user) {
    const loginUrl = new URL("/portal", request.url);
    loginUrl.searchParams.set("next", path);
    return NextResponse.redirect(loginUrl);
  }

  response.headers.set("x-freshware-path", path);
  return response;
}

export const config = {
  matcher: ["/", "/dashboard/:path*", "/admin/:path*"],
};