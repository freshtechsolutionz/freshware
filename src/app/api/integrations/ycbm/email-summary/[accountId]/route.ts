import { NextRequest, NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({ ok: true, route: "email-summary" }, { status: 200 });
}

export async function POST(req: NextRequest) {
  const bodyText = await req.text();
  return NextResponse.json(
    { ok: true, method: "POST", got: bodyText?.slice(0, 200) ?? "" },
    { status: 200 }
  );
}