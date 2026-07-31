import { NextResponse } from "next/server";
import { buildSnapshot } from "@/lib/metrics";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** One-shot dashboard snapshot (status + market + series + events). */
export function GET() {
  return NextResponse.json(buildSnapshot());
}
