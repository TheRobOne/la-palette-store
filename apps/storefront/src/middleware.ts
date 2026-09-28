import { NextRequest, NextResponse } from "next/server"

/**
 * Bootstraps the `_medusa_cache_id` cookie used to scope Next's fetch cache
 * per visitor (see lib/data/cookies.ts → getCacheOptions). The store is
 * single-region/single-language, so there is no locale/country detection or
 * redirect here (feature 002-remove-locale-prefix).
 */
export async function middleware(request: NextRequest) {
  if (request.nextUrl.pathname.includes(".")) {
    return NextResponse.next()
  }

  const cacheIdCookie = request.cookies.get("_medusa_cache_id")

  if (cacheIdCookie) {
    return NextResponse.next()
  }

  const response = NextResponse.next()
  response.cookies.set("_medusa_cache_id", crypto.randomUUID(), {
    maxAge: 60 * 60 * 24,
  })
  return response
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|images|assets|png|svg|jpg|jpeg|gif|webp).*)",
  ],
}
