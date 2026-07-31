<div align="center">

# 📡 Binance Realtime Dashboard

**BTCUSDT · ETHUSDT 실시간 거래 데이터를 안정적으로 수집하고,
운영 현황을 한눈에 파악하는 실시간 운영 대시보드**

[![Next.js](https://img.shields.io/badge/Next.js-15-000000?logo=next.js&logoColor=white)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![SQLite](https://img.shields.io/badge/SQLite-WAL-003B57?logo=sqlite&logoColor=white)](https://www.sqlite.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-3-06B6D4?logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![Binance API](https://img.shields.io/badge/Binance-REST%20%2B%20WebSocket-F0B90B?logo=binance&logoColor=black)](https://binance-docs.github.io/apidocs/spot/en/)

</div>

---

> **아리닷에이아이 과제** — "Binance 실시간 거래 데이터 수집 및 운영 대시보드 구현"
>
> 암호화폐 거래 데이터를 수집·분석하는 내부 운영 팀 관점에서, 데이터가 **끊김 없이·지연 없이·완결성 있게**
> 들어오는지를 실시간으로 감시하고, 동시에 시장 현황을 파악하는 것을 목표로 합니다.

이 프로젝트는 두 개의 독립적인 구성요소로 이루어집니다.

- **Collector** — Binance에서 실시간 데이터를 수집하고 누락 구간을 백필하는 상주 프로세스
- **Dashboard** — 수집된 데이터를 실시간으로 시각화하는 Next.js 웹 애플리케이션

<br />

## 📑 목차

- [주요 기능](#-주요-기능)
- [아키텍처](#-아키텍처)
- [기술 스택](#-기술-스택)
- [시작하기](#-시작하기)
- [환경변수](#-환경변수)
- [npm 스크립트](#-npm-스크립트)
- [프로젝트 구조](#-프로젝트-구조)
- [백필 동작 원리](#-백필-동작-원리)
- [API 사용량 & Rate Limit](#-api-사용량--rate-limit-안전장치)
- [대시보드 지표](#-대시보드-지표)
- [설계 결정 & 트레이드오프](#-설계-결정--트레이드오프)
- [동작 검증](#-동작-검증)
- [향후 확장](#-향후-확장)

<br />

## ✨ 주요 기능

| | 기능 | 설명 |
|:--:|------|------|
| ⚡ | **실시간 수집** | Binance WebSocket 결합 스트림(`kline_1m`)으로 BTCUSDT·ETHUSDT 상시 수집 |
| ⏮️ | **통합 백필** | "최초 실행 시 과거 시세 없음"과 "재시작 후 누락 구간"을 **하나의 gap 탐지 + REST 채움** 로직으로 처리 |
| 🔁 | **자가 치유** | 주기적 reconciler가 결측 캔들을 스캔·복구하여 데이터 완결성 보장 |
| 🔌 | **자동 재연결** | WebSocket 단절 시 지수 백오프 재연결 + 재연결 직후 누락분 백필 |
| 📈 | **운영 관측성** | 수집 지연(lag)·결측/백필·WS 상태·에러·이벤트 로그를 대시보드에 노출 |
| 🖥️ | **실시간 UI** | SSE(`/api/stream`)로 1초 주기 스냅샷 push |
| 💾 | **영속성** | SQLite(WAL) 파일 저장 → 재시작해도 데이터 유지, 별도 DB 서버/도커 불필요 |

<br />

## 🏗 아키텍처

수집 파이프라인(장시간 상주)과 대시보드(요청-응답)를 **별도 프로세스로 분리**하고 SQLite 파일로 연결합니다.
WAL 모드 덕분에 collector(write)와 web(read)이 잠금 경합 없이 동시에 접근합니다.

```
        ┌──────────────────────────────┐         ┌──────────────────────────────┐
        │   Collector  (Node, 상주)      │         │   Next.js Web  (대시보드)      │
        │                               │         │                               │
        │   ① startup backfill (REST)   │         │   GET /api/stream  (SSE 1s)   │
Binance │   ② WS ingest (kline_1m)      │  write  │   GET /api/klines  (조회)      │  SSE
  API ──┼─▶ ③ periodic reconciler       │────┐    │   GET /api/health  (지표)      │──▶ Browser
        └──────────────────────────────┘    │    └───────────────▲──────────────┘
                                             ▼            read     │
                                    ┌────────────────────────────────────┐
                                    │   SQLite  ·  data/market.db (WAL)    │
                                    │   klines / pipeline_status / events  │
                                    └────────────────────────────────────┘
```

**데이터 흐름**

1. Collector가 부팅 시 **백필**로 과거/누락 구간을 채운다.
2. **WebSocket**으로 실시간 1분봉을 받아 SQLite에 upsert 한다.
3. **Reconciler**가 주기적으로 결측을 스캔·복구한다.
4. Web은 SQLite를 읽어 지표를 계산하고 **SSE로 1초마다 브라우저에 push** 한다.

<br />

## 🛠 기술 스택

| 영역 | 사용 기술 |
|------|-----------|
| **언어/런타임** | TypeScript, Node.js 20 |
| **웹 프레임워크** | Next.js 15 (App Router), React 19 |
| **UI** | Tailwind CSS 3, shadcn/ui 스타일 컴포넌트, Recharts, lucide-react |
| **데이터 수집** | `ws` (WebSocket), Binance REST/WS 공개 API |
| **저장소** | SQLite (`better-sqlite3`, WAL 모드) |
| **설정/도구** | `zod`(설정 검증), `tsx`, `concurrently`, `dotenv` |

<br />

## 🚀 시작하기

### 사전 요구사항

- **Node.js 20 이상** (`better-sqlite3` 네이티브 모듈 빌드/프리빌드 자동 처리)
- Binance **API 키 불필요** — 사용하는 klines REST와 kline WebSocket은 모두 공개 마켓 데이터입니다.

### 설치 및 실행

```bash
# 1) 저장소 클론
git clone https://github.com/SBKIM9704/binance-realtime-dashboard.git
cd binance-realtime-dashboard

# 2) 의존성 설치
npm install

# 3) 환경변수 준비 (기본값으로 동작 — 그대로 복사하면 됩니다)
cp .env.example .env

# 4) 수집기 + 대시보드 동시 실행
npm run dev
```

실행 후 브라우저에서 **<http://localhost:3000>** 으로 접속합니다.

> 💡 최초 실행 시 collector가 **3일치 과거 데이터를 백필**한 뒤 실시간 수집을 시작합니다.
> 백필이 끝나면(수십 초) 대시보드 카드·차트가 채워집니다.

<br />

## ⚙️ 환경변수

모든 값은 기본값이 있어 `.env` 없이도 동작합니다. (`.env.example` 참고)

| 변수 | 기본값 | 설명 |
|------|--------|------|
| `BINANCE_REST_BASE` | `https://api.binance.com` | REST 베이스 URL |
| `BINANCE_WS_BASE` | `wss://stream.binance.com:9443` | WebSocket 베이스 URL |
| `SYMBOLS` | `BTCUSDT,ETHUSDT` | 수집 종목 (쉼표 구분) |
| `KLINE_INTERVAL` | `1m` | 캔들 간격 |
| `BACKFILL_DAYS` | `3` | 최초 실행 시 백필할 기간(일) |
| `RECONCILE_INTERVAL_MS` | `60000` | reconciler 실행 주기(ms) |
| `RECONCILE_WINDOW_MS` | `21600000` | 결측 스캔 윈도우(ms, 기본 6시간) |
| `DB_PATH` | `./data/market.db` | SQLite 파일 경로 |
| `REST_THROTTLE_MS` | `250` | 백필 페이지 요청 사이 지연(ms) — 버스트 방지 |
| `REST_MAX_RETRIES` | `4` | REST 호출당 최대 재시도(429/418/5xx) |
| `REST_WEIGHT_LIMIT` | `6000` | 분당 weight 예산 (Binance IP 한도) |
| `REST_WEIGHT_SOFT_PCT` | `0.8` | 이 비율 초과 시 선제적 페이싱 |

<br />

## 📜 npm 스크립트

| 명령 | 설명 |
|------|------|
| `npm run dev` | **collector + web 동시 실행** (concurrently) |
| `npm run dev:web` | 대시보드만 실행 (Next dev) |
| `npm run dev:collector` | 수집기만 실행 (파일 변경 감지) |
| `npm run collector` | 수집기만 실행 (prod) |
| `npm run build` | 프로덕션 빌드 |
| `npm run start` | 프로덕션 실행 (collector + web) |
| `npm run typecheck` | 타입 체크 (`tsc --noEmit`) |
| `npm test` | 유닛 테스트 실행 (vitest) |
| `npm run test:watch` | 유닛 테스트 watch 모드 |

<br />

## 🗂 프로젝트 구조

```
binance-realtime-dashboard/
├── src/
│   ├── collector/              # 📥 수집 파이프라인 (상주 프로세스)
│   │   ├── index.ts            #   진입점: 백필 → WS 수집 → reconciler 오케스트레이션
│   │   ├── backfill.ts         #   최초/재시작 백필 (통합 메커니즘)
│   │   ├── ingest.ts           #   WebSocket 수집 + 자동 재연결
│   │   ├── reconcile.ts        #   주기적 결측 스캔·복구
│   │   └── logger.ts
│   ├── lib/                    # 🧩 공유 도메인 로직
│   │   ├── config.ts           #   zod 기반 환경변수 검증
│   │   ├── db.ts               #   SQLite 연결 + 마이그레이션 (WAL)
│   │   ├── binance.ts          #   Binance REST/WS 클라이언트·파서
│   │   ├── metrics.ts          #   지표 계산 + 대시보드 스냅샷 빌더
│   │   ├── types.ts            #   공용 타입
│   │   ├── format.ts           #   표시용 포매터
│   │   └── repositories/       #   klines · pipeline 데이터 접근 계층
│   ├── app/
│   │   ├── api/                # 🔗 stream(SSE) · klines · health 라우트
│   │   ├── layout.tsx / page.tsx / globals.css
│   ├── components/
│   │   ├── dashboard/          # 📊 카드 · 차트 · 테이블 · 타임라인
│   │   └── ui/                 #   shadcn/ui 스타일 프리미티브
│   └── hooks/useSnapshot.ts    #   SSE 구독 훅
├── docs/metrics.md             # 📄 지표 선택 이유·근거 문서
├── .env.example
└── README.md
```

<br />

## 🔄 백필 동작 원리

> **핵심: "최초 실행"과 "재시작 누락"을 별개 기능이 아닌 하나의 메커니즘으로 처리합니다.**

collector 부팅 시 심볼별로 다음을 수행합니다.

```
저장된 마지막 캔들 시각(MAX open_time) 조회
   ├─ 없음(최초 실행)  → 최근 BACKFILL_DAYS 일치 전체 백필
   └─ 있음(재시작)    → 마지막 캔들 ~ 현재 구간만 백필  (다운타임 복구)
```

여기에 더해 두 겹의 안전장치가 데이터 완결성을 보장합니다.

- **재연결 백필** — WS가 끊겼다 붙을 때마다 위 로직을 재실행
- **주기적 reconciler** — `RECONCILE_INTERVAL_MS`마다 최근 윈도우의 결측 1분봉을 스캔해 REST로 채움

### 🧪 재시작 시나리오 직접 확인하기

```bash
# 1) 실행
npm run dev
# 2) 수집기만 종료 (dev:collector 창에서 Ctrl+C) 후 몇 분 대기
# 3) 수집기 재실행
npm run dev:collector
```

로그에 `restart-gap` 백필과 채운 캔들 수가 출력되고, 대시보드의 **Backfilled / Gaps Filled** 값이 증가합니다.

<br />

## 🛡 API 사용량 & Rate Limit 안전장치

Binance API에 **과부하나 IP 밴을 유발하지 않도록** 사용량을 분석하고 코드 레벨 방어를 두었습니다.
(전체 분석은 👉 **[`docs/rate-limits.md`](docs/rate-limits.md)**)

**실측 요약** — IP 한도는 **6,000 weight/분**, `klines(limit=1000)` 1건 ≈ **2 weight**.
이 프로젝트의 정상 운영 사용량은 **분당 한도의 0.1% 미만**입니다.

| 위험 | 방어 |
|------|------|
| 대량 백필 순간 버스트 | 페이지 요청 사이 **throttle**(`REST_THROTTLE_MS`) |
| 429 / 418 응답 | **`Retry-After` 준수** 후 재시도, 초과 시 중단 |
| 한도 근접 | `X-MBX-USED-WEIGHT-1M` 추적 → 소프트 임계치 초과 시 분 경계까지 대기 |
| 일시적 5xx | 지수 백오프 재시도(`REST_MAX_RETRIES`) |
| WS 연결 flapping | 재연결 지수 백오프(최대 30s)로 REST 재호출 상한 |

모든 REST 호출은 `src/lib/binance.ts`의 **`binanceFetch` 래퍼** 한 곳을 거치므로, 위 정책이
일관되게 적용됩니다.

<br />

## 📊 대시보드 지표

운영(Ops)과 시세(Market) 지표를 **균형 있게** 배치했습니다. 각 지표의 정의와 선택 근거는
👉 **[`docs/metrics.md`](docs/metrics.md)** 에 정리되어 있습니다.

| 구분 | 지표 |
|------|------|
| **운영 (Ops)** | WS 연결 상태 · 수집 지연(lag) · 총 레코드 · 백필 건수 · 결측/채움 · 에러 · reconcile 시각 · 이벤트 로그 |
| **시세 (Market)** | 실시간가 · 24h 변동률 · 24h 거래량 · 30분 변동성 · 가격/거래량 차트 · 최근 캔들 원자료 |

> 모든 시세 지표는 외부 티커 API 재호출 없이 **직접 수집·저장한 데이터에서 계산**합니다.
> 즉 수집 품질이 곧 지표 품질로 이어지며, 그래서 운영 지표를 1급 시민으로 다룹니다.

<br />

## 🧭 설계 결정 & 트레이드오프

| 결정 | 이유 |
|------|------|
| **수집기 / 웹 프로세스 분리** | 장시간 상주 WS와 요청-응답 웹은 성격이 달라, 분리 시 각각 독립적으로 재시작·확장 가능 |
| **SQLite (WAL)** | 제로 셋업으로 재시작 후 영속성 확보. WAL로 동시 read/write. 확장 필요 시 리포지토리 계층만 교체하면 Postgres/TimescaleDB로 이전 가능 |
| **kline(1분봉) 수집** | 개별 트레이드와 달리 **REST로 과거 구간을 정확히 백필**할 수 있어 "재시작 백필" 요구와 정합. 시세/거래량/변동성 지표에도 최적 |
| **SSE (WebSocket 아님)** | 서버 → 클라이언트 단방향 push만 필요하므로 SSE가 더 단순하고, 브라우저 자동 재연결 내장 |
| **zod 설정 검증** | 잘못된 환경변수를 부팅 시점에 즉시 실패시켜 런타임 오류 예방 |

<br />

## ✅ 동작 검증

실제 Binance 엔드포인트를 대상으로 검증한 결과입니다.

| 항목 | 결과 |
|------|------|
| 최초 백필 | BTC/ETH 각 **4,319 캔들**(≈3일치 1분봉) 적재 확인 |
| WS 실시간 수집 | 현재 캔들 `is_final=0` 로 실시간 갱신 확인 |
| `/api/health` | status · market · series(120) · events 정상 응답 |
| `/api/klines` | OHLCV 원자료 조회 정상 |
| `npm run build` | 성공 (4 routes) |
| `npm run typecheck` | 통과 |
| `npm test` | **16 tests 통과** (gap 계산 · 지표 계산 · Binance 파서) |

> 테스트는 네트워크·DB 없이 순수 도메인 로직만 결정론적으로 검증합니다
> (`src/lib/*.test.ts`). "표면은 최소, 코어는 테스트" 원칙으로 고가치 로직에 집중했습니다.

<br />

## 🗺 향후 확장

- [ ] `docker-compose`로 원커맨드 실행 + Postgres/TimescaleDB 옵션
- [ ] `@aggTrade` 스트림으로 실시간 체결 흐름/틱 지표 추가
- [x] 백필 gap 계산·지표 계산 유닛 테스트
- [ ] 다중 인터벌(5m/1h) 및 심볼 동적 추가
- [ ] 알림(수집 지연·연속 결측 임계치 초과 시)

<br />

---

<div align="center">
<sub>Built for the ariai.ai take-home assignment · Data from Binance public market streams</sub>
</div>
