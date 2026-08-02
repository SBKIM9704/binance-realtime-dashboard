import { NextResponse } from "next/server";
import { config } from "@/lib/config";
import { getRecentKlines } from "@/lib/repositories/klines";
import { parseLimit, parseSymbol } from "@/lib/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Recent klines for a symbol: /api/klines?symbol=BTCUSDT&limit=500 */
export function GET(req: Request) {
  const { searchParams } = new URL(req.url);

  const parsed = parseSymbol(searchParams);
  if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const limit = parseLimit(searchParams, 500, 1500);
  return NextResponse.json(getRecentKlines(parsed.symbol, config.KLINE_INTERVAL, limit));
}
