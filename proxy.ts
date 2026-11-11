import { NextResponse, type NextRequest } from 'next/server';

// An optimistic check only: it sends people with no cookie to the sign-in page.
// The real session check runs on the server in lib/server/session.ts.
export function proxy(request: NextRequest) {
  if (request.cookies.has('epoch_session')) return NextResponse.next();
  return NextResponse.redirect(new URL('/login', request.url));
}

export const config = {
  matcher: ['/((?!login|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
