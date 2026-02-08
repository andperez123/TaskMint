import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  // TODO: handle Mini App webhook events (notifications, etc.)
  const body = await req.json();
  console.log("[webhook]", body);
  return NextResponse.json({ ok: true });
}
