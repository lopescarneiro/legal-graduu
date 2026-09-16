import { NextResponse } from "next/server";
import { signOut } from "@/auth";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  await signOut({ redirect: false });
  return NextResponse.redirect(new URL("/login", req.url));
}
