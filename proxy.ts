import { NextRequest, NextResponse } from "next/server";
import { readSessionToken, SESSION_COOKIE } from "@/lib/auth/session";

// Optimistic route guard. Pages re-verify through lib/auth/dal.ts.
export default async function proxy(req: NextRequest) {
  const path = req.nextUrl.pathname;
  const session = await readSessionToken(req.cookies.get(SESSION_COOKIE)?.value);
  const home = session ? (session.role === "admin" ? "/admin" : `/u/${session.sub}`) : "/login";

  if (path === "/login") {
    return session ? NextResponse.redirect(new URL(home, req.nextUrl)) : NextResponse.next();
  }

  if (!session) {
    const url = new URL("/login", req.nextUrl);
    if (path !== "/") url.searchParams.set("next", path);
    return NextResponse.redirect(url);
  }

  if (path === "/") return NextResponse.redirect(new URL(home, req.nextUrl));

  if (path.startsWith("/admin") && session.role !== "admin") {
    return NextResponse.redirect(new URL(home, req.nextUrl));
  }

  const member = path.match(/^\/u\/([^/]+)/);
  if (member && session.role !== "admin" && member[1].toLowerCase() !== session.sub) {
    return NextResponse.redirect(new URL(home, req.nextUrl));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:png|svg|jpg|webp|ico)$).*)"],
};
