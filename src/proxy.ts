import { NextResponse, type NextRequest } from "next/server";
import { COOKIE_SESION, sesionValida } from "@/lib/sesion";

/** Todo el panel requiere sesión. El webhook de WhatsApp y el login quedan abiertos. */
export function proxy(req: NextRequest) {
  if (sesionValida(req.cookies.get(COOKIE_SESION)?.value, process.env.SESION_SECRETO)) return NextResponse.next();
  const url = req.nextUrl.clone();
  url.pathname = "/ingresar";
  url.search = "";
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!ingresar|api/whatsapp|_next/static|_next/image|favicon.ico).*)"],
};
