export type Lang = "ko" | "en";
export const LANGS: Lang[] = ["ko", "en"];
export const DEFAULT_LANG: Lang = "ko";

/** UI string dictionary. `ko` is the default; `en` is the fallback for missing keys. */
export const dict = {
  ko: {
    "header.title": "실시간 거래 수집",
    "header.stream": "스트림",
    "header.connected": "연결됨",
    "header.reconnecting": "재연결 중",
    "header.localTime": "로컬 시간",
    "header.theme": "테마",
    "header.language": "언어",

    "loading.title": "첫 스냅샷을 기다리는 중…",
    "loading.hint": "수집기가 실행 중인지 확인하세요",

    "footer.text": "Binance 공개 마켓 스트림에서 수집 · {time} 업데이트 · SSE 1초 push",

    "ops.wsLag": "WS / 지연",
    "ops.live": "라이브",
    "ops.down": "중단",
    "ops.totalRecords": "총 레코드",
    "ops.backfilled": "백필",
    "ops.gapsFilledSeen": "결측 채움 / 탐지",
    "ops.errors": "에러",
    "ops.lastReconcile": "마지막 정합",

    "market.volume": "24h 거래량 (기초자산)",
    "market.volatility": "변동성 (30m σ)",
    "asset.BTCUSDT": "비트코인",
    "asset.ETHUSDT": "이더리움",

    "chart.title": "가격 · 거래량",
    "chart.subtitle": "1분봉",

    "events.title": "운영 로그",
    "events.subtitle": "파이프라인 이벤트",
    "events.empty": "아직 이벤트가 없습니다.",
    "event.ws_connect": "WS 연결",
    "event.ws_disconnect": "WS 해제",
    "event.backfill_start": "백필 시작",
    "event.backfill_done": "백필 완료",
    "event.gap_filled": "결측 채움",
    "event.reconcile": "정합",
    "event.error": "에러",

    "table.title": "원자료 피드",
    "table.subtitle": "최근 캔들",
    "table.time": "시각",
    "table.open": "시가",
    "table.high": "고가",
    "table.low": "저가",
    "table.close": "종가",
    "table.volume": "거래량",
    "table.live": "실시간",
  },
  en: {
    "header.title": "Realtime Trade Collection",
    "header.stream": "Stream",
    "header.connected": "Connected",
    "header.reconnecting": "Reconnecting",
    "header.localTime": "Local Time",
    "header.theme": "Theme",
    "header.language": "Language",

    "loading.title": "Waiting for the first snapshot…",
    "loading.hint": "Make sure the collector is running",

    "footer.text": "Data from Binance public market streams · updated {time} · SSE push @ 1s",

    "ops.wsLag": "WS / Lag",
    "ops.live": "Live",
    "ops.down": "Down",
    "ops.totalRecords": "Total Records",
    "ops.backfilled": "Backfilled",
    "ops.gapsFilledSeen": "Gaps Filled / Seen",
    "ops.errors": "Errors",
    "ops.lastReconcile": "Last Reconcile",

    "market.volume": "24h Volume (base)",
    "market.volatility": "Volatility (30m σ)",
    "asset.BTCUSDT": "Bitcoin",
    "asset.ETHUSDT": "Ethereum",

    "chart.title": "Price · Volume",
    "chart.subtitle": "1-minute candles",

    "events.title": "Operations Log",
    "events.subtitle": "Pipeline events",
    "events.empty": "No events yet.",
    "event.ws_connect": "WS connect",
    "event.ws_disconnect": "WS disconnect",
    "event.backfill_start": "Backfill start",
    "event.backfill_done": "Backfill done",
    "event.gap_filled": "Gap filled",
    "event.reconcile": "Reconcile",
    "event.error": "Error",

    "table.title": "Raw Feed",
    "table.subtitle": "Recent candles",
    "table.time": "Time",
    "table.open": "Open",
    "table.high": "High",
    "table.low": "Low",
    "table.close": "Close",
    "table.volume": "Volume",
    "table.live": "live",
  },
} satisfies Record<Lang, Record<string, string>>;

export type TKey = keyof (typeof dict)["en"];

/** Translate `key` for `lang`, with optional `{placeholder}` interpolation. */
export function translate(lang: Lang, key: TKey, vars?: Record<string, string>): string {
  let s: string = dict[lang][key] ?? dict.en[key] ?? key;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, v);
  }
  return s;
}
