# Binance Realtime Dashboard

BTCUSDT · ETHUSDT의 실시간 거래 데이터를 안정적으로 수집하고, 운영 현황을 한눈에
파악할 수 있는 **실시간 운영 대시보드**입니다.

> 아리닷에이아이 과제 — "Binance 실시간 거래 데이터 수집 및 운영 대시보드 구현"

---

## 핵심 특징

- **실시간 수집** — Binance WebSocket 결합 스트림(`kline_1m`)으로 두 종목을 상시 수집
- **백필(단일 메커니즘)** — "최초 실행 시 과거 시세 없음"과 "서버 재시작 후 누락 구간"을
  **하나의 gap 탐지 + REST 채움** 로직으로 모두 처리
- **자가 치유** — 주기적 reconciler가 결측 캔들을 스캔·복구하여 데이터 완결성 보장
- **운영 관측성** — 수집 지연(lag), 결측/백필 건수, WS 연결 상태, 이벤트 로그를 대시보드에 노출
- **실시간 UI** — SSE(`/api/stream`)로 1초 주기 스냅샷 push
- **영속성** — SQLite(WAL) 파일 저장 → 재시작해도 데이터 유지, 별도 서버/도커 불필요

지표 선택 이유와 근거는 [`docs/metrics.md`](docs/metrics.md)에 정리했습니다.

---

## 아키텍처

```
┌────────────────────────┐        ┌──────────────────────────┐
│  Collector (상주)       │        │  Next.js Web (대시보드)   │
│  · startup backfill(REST)│       │  · /api/stream  (SSE)     │
│  · WS ingest (kline_1m) │──┐     │  · /api/klines  (조회)    │
│  · periodic reconciler  │  └───▶ │  · /api/health  (지표)    │
└────────────────────────┘  SQLite└──────────────────────────┘
                          data/market.db (WAL: 동시 read/write)
```

수집 파이프라인(장시간 상주)과 대시보드(요청 응답)를 **별도 프로세스로 분리**하고 SQLite로
연결했습니다. WAL 모드로 collector(write)와 web(read)이 잠금 없이 동시 접근합니다.

### 디렉터리

| 경로 | 설명 |
|------|------|
| `src/collector/` | 백필 · WS 수집 · reconciler (상주 프로세스) |
| `src/lib/` | 설정·DB·Binance 클라이언트·리포지토리·지표 계산 |
| `src/app/api/` | SSE / klines / health 라우트 |
| `src/app/`, `src/components/` | 대시보드 UI (Next.js App Router, shadcn/ui) |
| `docs/metrics.md` | 지표 정의 및 선택 근거 |

---

## 기술 스택

- **런타임/언어**: Node.js 20, TypeScript
- **웹**: Next.js 15 (App Router), React 19
- **UI**: shadcn/ui 스타일 컴포넌트 + Tailwind CSS, recharts, lucide-react
- **수집**: `ws`(WebSocket), Binance REST/WS 공개 API
- **저장**: SQLite (`better-sqlite3`, WAL)
- **기타**: zod(설정 검증), tsx, concurrently, dotenv

---

## 실행 방법

### 사전 요구사항
- Node.js **20 이상** (`better-sqlite3` 네이티브 빌드용 빌드툴 필요 시 자동 처리)

### 설치 & 실행

```bash
# 1) 의존성 설치
npm install

# 2) 환경변수 준비 (기본값으로도 동작 — 그대로 복사하면 됨)
cp .env.example .env

# 3) 수집기 + 대시보드 동시 실행
npm run dev
```

- 대시보드: <http://localhost:3000>
- 최초 실행 시 collector가 **3일치 과거 데이터를 백필**한 뒤 실시간 수집을 시작합니다.
  (백필 완료까지 수십 초 소요될 수 있습니다.)

### 개별 실행 스크립트

| 명령 | 설명 |
|------|------|
| `npm run dev` | collector + web 동시 실행 (concurrently) |
| `npm run dev:web` | 대시보드만 (Next dev) |
| `npm run dev:collector` | 수집기만 (파일 변경 감지) |
| `npm run collector` | 수집기만 (prod) |
| `npm run build` / `npm run start` | 프로덕션 빌드 / 실행 |
| `npm run typecheck` | 타입 체크 |

> **Binance API 키는 필요 없습니다.** 사용하는 klines REST와 kline WebSocket은 공개
> 마켓 데이터입니다.

---

## 환경변수

`.env.example` 참고. 모두 기본값이 있어 그대로도 동작합니다.

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

---

## 백필 동작 검증 (재시작 시나리오)

1. `npm run dev`로 실행 → 최초 백필 후 수집 시작
2. collector만 종료 (`npm run dev:collector` 창에서 Ctrl+C) 후 몇 분 대기
3. `npm run dev:collector`로 다시 실행 → 로그에 `restart-gap` 백필과 채운 캔들 수가 출력되고,
   대시보드의 **Backfilled / Gaps Filled** 값이 증가합니다.

---

## 대시보드 지표

- **운영(Ops)**: WS 연결 상태, 수집 지연(lag), 총 레코드, 백필 건수, 결측/채움, 에러, reconcile 시각, 이벤트 로그
- **시세(Market)**: 실시간가, 24h 변동률, 24h 거래량, 30분 변동성, 가격/거래량 차트, 최근 캔들 원자료

각 지표의 선택 이유는 [`docs/metrics.md`](docs/metrics.md)를 참고하세요.
