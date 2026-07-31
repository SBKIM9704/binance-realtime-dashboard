import { NextResponse } from "next/server";
import { config } from "@/lib/config";
import { getRecentKlines } from "@/lib/repositories/klines";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Recent klines for a symbol: /api/klines?symbol=BTCUSDT&limit=500 */
export function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const symbol = (searchParams.get("symbol") ?? config.symbols[0]).toUpperCase();
  const limit = Math.min(Math.max(Number(searchParams.get("limit") ?? 500), 1), 1500);
  return NextResponse.json(getRecentKlines(symbol, config.KLINE_INTERVAL, limit));
}
