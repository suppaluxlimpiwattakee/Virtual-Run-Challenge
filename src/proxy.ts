import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

const PUBLIC_PATHS = ['/login', '/auth/callback', '/privacy'];

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    // Misconfigured deployment: don't 500 every route — let pages render and
    // surface the problem in the logs instead.
    console.error(
      '[config] Missing NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY. ' +
        'Set them in the hosting environment and REBUILD (NEXT_PUBLIC_* vars are inlined at build time).'
    );
    return response;
  }

  const supabase = createServerClient(
    url,
    anonKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Refresh the session (required for Server Components to see it).
  // A transient auth-service failure shouldn't 500 the whole site.
  let user = null;
  try {
    ({
      data: { user },
    } = await supabase.auth.getUser());
  } catch (err) {
    console.error('[auth] session refresh failed:', err);
    return response;
  }

  const { pathname } = request.nextUrl;
  const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p));

  if (!user && !isPublic && pathname !== '/') {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  // Admin routes additionally verify profiles.is_admin server-side in the
  // admin layout and every /api/admin/* route (DB check, not just auth).
  return response;
}

export const config = {
  matcher: [
    // Everything except static assets
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
