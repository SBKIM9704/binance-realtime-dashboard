# Binance API 사용량 분석 & Rate Limit 안전장치

수집 파이프라인이 Binance API에 **과도한 부하를 주거나 IP 밴을 당하지 않도록** 하기 위한
사용량 분석과 코드 레벨 안전장치를 정리합니다.

## 1. 실측 한도 (2026-07 기준, 응답 헤더로 확인)

`/api/v3/exchangeInfo`의 `rateLimits`와 응답 헤더 `X-MBX-USED-WEIGHT-1M`로 실측했습니다.

| 한도 | 값 |
|------|-----|
| **REQUEST_WEIGHT** (IP당) | **6,000 weight / 분** |
| RAW_REQUESTS (IP당) | 300,000 / 5분 |
| `GET /api/v3/klines` (limit=1000) 1건 | **≈ 2 weight** |

> 즉 이론상 한 IP에서 분당 약 **3,000건**의 klines 요청까지 허용됩니다.
> WebSocket은 별도 한도(연결당 초당 5메시지 수신, IP당 5분에 300 connection)입니다.

## 2. 이 프로젝트의 실제 호출량

기본 설정(`KLINE_INTERVAL=1s`, `BACKFILL_DAYS=1`, `HISTORY_TIERS=1m:30,1h:0`, 2심볼) 실측입니다.

### 최초 실행 (1회성)

| 항목 | 봉 수 (심볼당) | 요청 수 | weight |
|------|---------------|---------|--------|
| 1초봉 백필 (1일치) | 86,400 | 87 × 2 = **174** | ≈ 348 |
| 1분봉 티어 (30일) | 43,200 | 44 × 2 = **88** | ≈ 176 |
| 1시간봉 티어 (상장일부터) | 78,405 | 79 × 2 = **158** | ≈ 316 |
| 초기 reconcile · 티어 top-up | — | **≈ 80** | ≈ 160 |
| **합계** | | **500건** | **≈ 1,000** |

54초 만에 `ready`에 도달하고 히스토리 티어는 그 뒤로도 백그라운드에서 이어집니다. 전체가
약 80초에 걸쳐 분산되므로 순간 사용량은 분당 약 **750 weight**, 한도의 **12% 수준**입니다.
`REST_THROTTLE_MS`(기본 250ms)가 페이지 요청 사이를 벌려 버스트를 막습니다.

`BACKFILL_DAYS`를 올리면 1초봉 요청이 하루당 87 페이지씩 선형으로 늘어납니다.

### 정상 운영 (지속)

| 상황 | 요청 수 | 비고 |
|------|---------|------|
| 1분봉 티어 top-up | 1건 × 2심볼 / 분 | 봉이 닫힐 때만 |
| 1시간봉 티어 top-up | 1건 × 2심볼 / 시간 | 봉이 닫힐 때만 |
| Reconciler | 결측 있을 때만 2페이지 × 2심볼 | 평상시 대부분 0 |
| 재시작 · WS 재연결 백필 | 누락 구간만 | 이벤트 발생 시 |

**정상 운영 시 분당 사용량은 한도(6,000)의 0.1% 수준**(약 4~8 weight/분)입니다.

## 3. 잠재적 위험과 방어

낮은 평상시 사용량과 별개로, **비정상 상황에서의 버스트**를 막기 위해 아래 안전장치를 두었습니다.

| 위험 | 방어 | 구현 |
|------|------|------|
| 큰 `BACKFILL_DAYS`/다심볼로 인한 순간 버스트 | 페이지네이션 요청 사이 **throttle** (`REST_THROTTLE_MS`, 기본 250ms) | `src/collector/backfill.ts` |
| 429(rate limit)/418(IP 밴) 응답 무시 | **`Retry-After` 준수** 후 재시도, 초과 시 중단 | `binanceFetch` in `src/lib/binance.ts` |
| 한도 근접 시에도 계속 호출 | `X-MBX-USED-WEIGHT-1M` 추적 → 소프트 임계치(`REST_WEIGHT_SOFT_PCT`, 기본 80%) 초과 시 분 경계까지 대기 | `binanceFetch` |
| 일시적 5xx | 지수 백오프 재시도 (`REST_MAX_RETRIES`, 기본 4회) | `binanceFetch` |
| WS 연결 flapping | 재연결에 **지수 백오프**(최대 30s) → REST 재호출 빈도 상한 | `src/collector/ingest.ts` |

### 핵심: `binanceFetch` 래퍼
모든 REST 호출(`fetchKlines`)은 `binanceFetch`를 거칩니다. 이 래퍼가
weight 추적 · 소프트 페이싱 · 429/418 `Retry-After` · 5xx 백오프를 **한 곳에서** 처리하므로,
호출부는 rate limit을 신경 쓰지 않아도 됩니다.

```
fetchKlines ─▶ binanceFetch ─▶ (weight 체크 → fetch → 헤더 반영 → 429/418/5xx 처리) ─▶ Response
```

> `binanceFetch`가 집계한 used-weight·재시도·429·5xx는 `system_metrics`에 저장되어
> 대시보드 **System 섹션**에 `Weight x/6000`(임계값 색상)으로 실시간 노출됩니다.
> → [`dashboard-metrics.md`](dashboard-metrics.md) 5절 "System 지표".

## 4. 관련 환경변수

| 변수 | 기본값 | 설명 |
|------|--------|------|
| `REST_THROTTLE_MS` | `250` | 백필 페이지 요청 사이 지연(ms) |
| `REST_MAX_RETRIES` | `4` | REST 호출당 최대 재시도 횟수 |
| `REST_WEIGHT_LIMIT` | `6000` | 분당 weight 예산 (Binance 실제값) |
| `REST_WEIGHT_SOFT_PCT` | `0.8` | 이 비율 초과 시 선제적 페이싱 |

## 5. 향후 확장 시 고려사항

- 심볼/인터벌을 크게 늘리면 최초 백필 요청 수가 선형 증가 → `REST_THROTTLE_MS`를 키우거나
  백필을 배치로 나눠 야간에 수행.
- 다중 인스턴스로 확장 시 weight는 **IP 단위**이므로, 같은 IP를 공유하면 예산을 합산 관리해야 함
  (프록시/게이트웨이에서 중앙 rate limiter 권장).
