import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          // Update the request cookies (so downstream sees them)
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }

          // Update the response cookies (so the browser stores them)
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          });

          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    }
  );

  // IMPORTANT: this refreshes the auth session if needed
  await supabase.auth.getUser();

  return response;
}

export const config = {
  matcher: [
    /*
      Run middleware on:
      - dashboard + portal pages
      - api routes (so requireViewer can always read cookies)
      Exclude static assets
    */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
