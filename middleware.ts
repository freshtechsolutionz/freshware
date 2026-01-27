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

  // IMPORTANT: this refreshes the session cookie for server components
  await supabase.auth.getUser();

  return response;
}

export const config = {
  matcher: [
    /*
      Run middleware on all routes except:
      - _next/static
      - _next/image
      - favicon
    */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
