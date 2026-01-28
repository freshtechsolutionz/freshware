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

  // 1) Safely check auth (ignore refresh-token errors)
  let user: { id: string } | null = null;
  try {
    const { data } = await supabase.auth.getUser();
    user = (data?.user as any) ?? null;
  } catch {
    user = null;
  }

  const path = request.nextUrl.pathname;

  // 2) Protect all /dashboard routes (must be logged in)
  if (path.startsWith("/dashboard") && !user) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", path);
    return NextResponse.redirect(loginUrl);
  }

  // 3) Role gate ONLY the sales area
  const isSalesRoute = path === "/dashboard/sales" || path.startsWith("/dashboard/sales/");
  if (isSalesRoute && user) {
    const { data: profile, error } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    const role = profile?.role ?? "PENDING";
    const allowed = ["CEO", "ADMIN", "STAFF"];

    // If we can't read the profile (RLS / missing row), or role not allowed → kick them out
    if (error || !allowed.includes(role)) {
      const dashUrl = new URL("/dashboard", request.url);
      return NextResponse.redirect(dashUrl);
    }
  }

  return response;
}

export const config = {
  matcher: ["/dashboard/:path*"],
};
