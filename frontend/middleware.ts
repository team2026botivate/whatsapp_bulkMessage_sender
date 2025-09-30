import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const cookie = request.cookies.get("auth-token");

  console.log(cookie, "cookie");

  // Public routes
  const publicPaths = ["/login"];

  if (!cookie && !publicPaths.includes(path)) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Agar user already login hai aur login page kholne ki koshish kare
  if (cookie && path === "/login") {
    return NextResponse.redirect(new URL("/", request.url)); // home/dashboard bhej do
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|public/).*)",
    "/login",
    "/",
  ],
};
