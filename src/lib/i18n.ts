export type Lang = "ko" | "en";
export const LANGS: Lang[] = ["ko", "en"];

/** UI string dictionary. `ko` is the default; `en` is the fallback for missing keys. */
export const dict = {
  ko: {
    "header.title": "실시간 마켓 대시보드",
    "header.stream": "실시간 피드",
    "header.connected": "연결됨",
    "header.reconnecting": "재연결 중",
    "header.localTime": "현재 시각",
    "header.theme": "테마",
    "header.language": "언어",

    "nav.market": "마켓",
    "nav.ops": "운영 현황",
    "nav.marketHint": "시세 · 캔들 차트",
    "nav.opsHint": "수집 상태 · 이벤트 로그 · 캔들 데이터",

    "loading.title": "실시간 데이터를 불러오는 중…",
    "loading.hint": "수집기가 실행 중인지 확인하세요",
    "ops.live": "실시간",
    "ops.down": "끊김",
    "ops.totalRecords": "총 레코드",
    "ops.liveRecords": "실시간 {n}",
    "ops.backfilled": "백필",
    "ops.lastReconcile": "마지막 정합",
    "time.ago": "{age} 전",

    "pipeline.title": "수집 상태",
    "pipeline.ws": "WS",
    "pipeline.lag": "지연",
    "pipeline.msgRate": "수신/초",
    "pipeline.lastMessage": "마지막 수신",
    "pipeline.recoveryRate": "복구율",
    "pipeline.detectedRecovered": "탐지 / 복구",
    "pipeline.reconnect": "재연결",
    "pipeline.errorsPerMin": "에러/분",

    "system.title": "시스템",
    "system.cpu": "CPU",
    "system.ram": "메모리",
    "system.uptime": "업타임",
    "system.restRate": "REST 호출/분",
    "system.weight": "REST Weight",
    "system.retry": "REST 재시도",
    "system.rateLimited": "429 제한",
    "system.serverErr": "5xx 에러",

    "ribbon.status": "상태",
    "ribbon.healthy": "정상",
    "ribbon.degraded": "주의",
    "ribbon.critical": "위험",
    "ribbon.disconnected": "연결 끊김 · 마지막 수신 {age} 전",

    "market.volume": "24시간 거래량",
    "market.volatility": "변동성 ({window})",
    "market.ticks": "{n}틱",
    "market.bid": "매수호가",
    "market.ask": "매도호가",
    "market.spread": "스프레드",
    "market.vwap": "VWAP",
    "market.high24h": "24시간 고가",
    "market.low24h": "24시간 저가",
    "asset.BTCUSDT": "비트코인",
    "asset.ETHUSDT": "이더리움",

    "chart.title": "가격 · 거래량",
    "chart.candles": "캔들",
    "chart.empty": "이 구간에 저장된 캔들이 없습니다",
    "chart.emptyFrom": "{date}부터 데이터가 있습니다",
    "chart.emptyHint": "수집기가 실행 중인지 확인하세요",
    "interval.s": "{n}초",
    "interval.m": "{n}분",
    "interval.h": "{n}시간",
    "interval.d": "{n}일",
    "interval.w": "{n}주",
    "interval.unit.s": "초",
    "interval.unit.m": "분",
    "interval.unit.h": "시간",
    "interval.unit.d": "일",
    "interval.unit.w": "주",
    "interval.period": "시간 기준",
    "range.label": "기간",
    "range.1h": "1시간",
    "range.6h": "6시간",
    "range.1d": "1일",
    "range.1w": "1주",
    "range.1M": "1개월",
    "range.1y": "1년",
    "range.all": "전체",
    "range.source": "{interval} 데이터 기준",









    "events.title": "이벤트 로그",
    "events.empty": "아직 이벤트가 없습니다.",
    "event.ws_connect": "WS 연결",
    "event.ws_disconnect": "WS 해제",
    "event.backfill_start": "백필 시작",
    "event.backfill_done": "백필 완료",
    "event.gap_filled": "결측 채움",
    "event.error": "에러",

    "table.title": "캔들 데이터",
    "table.time": "시간",
    "table.open": "시가",
    "table.high": "고가",
    "table.low": "저가",
    "table.close": "종가",
    "table.volume": "거래량",
    "table.state": "상태",
    "table.live": "실시간",
  },
  en: {
    "header.title": "Realtime Market Dashboard",
    "header.stream": "Live Feed",
    "header.connected": "Connected",
    "header.reconnecting": "Reconnecting",
    "header.localTime": "Local Time",
    "header.theme": "Theme",
    "header.language": "Language",

    "nav.market": "Market",
    "nav.ops": "Operations",
    "nav.marketHint": "Prices · candle chart",
    "nav.opsHint": "Ingestion · event log · candle data",

    "loading.title": "Loading market data…",
    "loading.hint": "Make sure the collector is running",
    "ops.live": "Live",
    "ops.down": "Down",
    "ops.totalRecords": "Total Records",
    "ops.liveRecords": "live {n}",
    "ops.backfilled": "Backfilled",
    "ops.lastReconcile": "Last Reconcile",
    "time.ago": "{age} ago",

    "pipeline.title": "Pipeline Health",
    "pipeline.ws": "WS",
    "pipeline.lag": "Lag",
    "pipeline.msgRate": "Msg/s",
    "pipeline.lastMessage": "Last Update",
    "pipeline.recoveryRate": "Recovery Rate",
    "pipeline.detectedRecovered": "Detected / Recovered",
    "pipeline.reconnect": "Reconnect",
    "pipeline.errorsPerMin": "Errors/min",

    "system.title": "System",
    "system.cpu": "CPU",
    "system.ram": "Memory",
    "system.uptime": "Uptime",
    "system.restRate": "REST calls/min",
    "system.weight": "REST Weight",
    "system.retry": "REST Retry",
    "system.rateLimited": "429 Limited",
    "system.serverErr": "5xx Errors",

    "ribbon.status": "Status",
    "ribbon.healthy": "Healthy",
    "ribbon.degraded": "Degraded",
    "ribbon.critical": "Critical",
    "ribbon.disconnected": "Disconnected · last frame {age} ago",

    "market.volume": "24h Volume",
    "market.volatility": "Volatility ({window})",
    "market.ticks": "{n} tick",
    "market.bid": "Bid",
    "market.ask": "Ask",
    "market.spread": "Spread",
    "market.vwap": "VWAP",
    "market.high24h": "24h High",
    "market.low24h": "24h Low",
    "asset.BTCUSDT": "Bitcoin",
    "asset.ETHUSDT": "Ethereum",

    "chart.title": "Price · Volume",
    "chart.candles": "candles",
    "chart.empty": "No candles stored for this range",
    "chart.emptyFrom": "Data starts {date}",
    "chart.emptyHint": "Check that the collector is running",
    "interval.s": "{n}s",
    "interval.m": "{n}m",
    "interval.h": "{n}h",
    "interval.d": "{n}d",
    "interval.w": "{n}w",
    "interval.unit.s": "Sec",
    "interval.unit.m": "Min",
    "interval.unit.h": "Hour",
    "interval.unit.d": "Day",
    "interval.unit.w": "Week",
    "interval.period": "Period",
    "range.label": "Range",
    "range.1h": "1H",
    "range.6h": "6H",
    "range.1d": "1D",
    "range.1w": "1W",
    "range.1M": "1M",
    "range.1y": "1Y",
    "range.all": "All",
    "range.source": "from {interval} data",









    "events.title": "Event Log",
    "events.empty": "No events yet.",
    "event.ws_connect": "WS connect",
    "event.ws_disconnect": "WS disconnect",
    "event.backfill_start": "Backfill start",
    "event.backfill_done": "Backfill done",
    "event.gap_filled": "Gap filled",
    "event.error": "Error",

    "table.title": "Candles",
    "table.time": "Time",
    "table.open": "Open",
    "table.high": "High",
    "table.low": "Low",
    "table.close": "Close",
    "table.volume": "Volume",
    "table.state": "State",
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
