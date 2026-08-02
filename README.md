<div align="center">

# 📡 Market Desk

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
| ⚡ | **실시간 수집** | Binance WebSocket 결합 스트림(`kline_1s` + `bookTicker`)으로 BTCUSDT·ETHUSDT 상시 수집 |
| ⏮️ | **통합 백필** | "최초 실행 시 과거 시세 없음"과 "재시작 후 누락 구간"을 **하나의 gap 탐지 + REST 채움** 로직으로 처리 |
| 🔁 | **자가 치유** | 주기적 reconciler가 결측 캔들을 스캔·복구하여 데이터 완결성 보장 |
| 🔌 | **자동 재연결** | WebSocket 단절 시 지수 백오프 재연결 + 재연결 직후 누락분 백필 |
| 🗄️ | **다해상도 저장** | 1초봉(운영용, 7일)과 코스 히스토리 티어(1분봉 30일 · **1시간봉 2017년부터**)를 함께 보관 |
| 📊 | **캔들 차트** | lightweight-charts 캔들 + 거래량. **기간 프리셋 7종**(1시간~전체)과 단위별 시간 기준 선택 |
| 🧮 | **온디맨드 롤업** | 더 큰 봉은 수집하지 않고 **조회 시 SQL로 집계**. 인터벌을 추가해도 수집·스키마 불변 |
| 🎯 | **출처 인식 집계** | 24h 지표는 그 구간을 덮으면서 조밀한 티어를 자동 선택 → Binance 공표치 대비 오차 **0.03% 이내** |
| 🚨 | **낡은 데이터 방지** | SSE가 끊기면 상태를 위험으로 강제하고 수치를 흐리게 처리. **거짓 초록을 띄우지 않음** |
| 📈 | **운영 관측성** | 수집 지연(lag)·Msg/s·결측/복구율·WS 상태·에러·이벤트 로그를 `/ops`에 노출 |
| 🖥️ | **System 지표** | 수집기 프로세스 CPU/RAM/uptime + REST calls/Weight(x/6000)·429·5xx |
| 🚦 | **임계값 색상 코딩** | Lag·Recovery·Weight·Error Rate를 초록/노랑/빨강으로 즉시 판단. **임계값을 값 옆에 인쇄** |
| 📖 | **호가/심화 시세** | `@bookTicker` 실시간 Bid/Ask + 틱 단위 스프레드 + 호가 신선도 표시 |
| 🖥️ | **실시간 UI** | SSE(`/api/stream`)로 1초 주기 스냅샷 push — 스냅샷은 **매초 1회만 계산해 전 탭이 공유**(탭 수와 무관) |
| ♿ | **접근성** | 포커스 링·24px 터치 타깃·`aria-live` 상태 알림·색 단독 인코딩 금지·`prefers-reduced-motion` |
| 🧍 | **클라이언트 독립 수집** | 수집기는 브라우저와 분리된 **상주 프로세스** → 페이지를 몇 개 열든 지속 축적 |
| ♻️ | **보존 정책** | `RETENTION_DAYS` 지난 수집 인터벌 캔들/이벤트 자동 정리 (히스토리 티어는 보존) |
| 🌗 | **다크/라이트 · 한/영** | 헤더 토글, 쿠키 저장으로 SSR 첫 렌더부터 정확 (플리커 없음). **등락 색은 언어 관례를 따름** |
| 💾 | **영속성** | SQLite(WAL) 파일 저장 → 재시작해도 데이터 유지, 별도 DB 서버/도커 불필요 |

<br />

## 🏗 아키텍처

수집 파이프라인(장시간 상주)과 대시보드(요청-응답)를 **별도 프로세스로 분리**하고 SQLite 파일로 연결합니다.
WAL 모드 덕분에 collector(write)와 web(read)이 잠금 경합 없이 동시에 접근합니다.

```
        ┌───────────────────────────────────┐      ┌───────────────────────────────────┐
        │   Collector  (Node, 상주)           │      │   Next.js Web  (대시보드)           │
        │                                    │      │                                    │
        │   ① startup backfill (REST)        │      │   GET /api/stream   (SSE 1s)       │
Binance │   ② WS ingest (kline_1s+bookTicker)│ write│   GET /api/candles  (롤업 캔들)      │  SSE
  API ──┼─▶ ③ periodic reconciler            │───┐  │   GET /api/klines   (원자료)         │──▶ Browser
        │   ④ history tiers (1m · 1h)        │   │  │   GET /api/health   (스냅샷)         │
        └───────────────────────────────────┘   │  └────────────────▲──────────────────┘
                                                 ▼          read     │
                            ┌──────────────────────────────────────────────┐
                            │   SQLite  ·  data/market.db (WAL)             │
                            │   klines(symbol, interval, open_time)         │
                            │   pipeline_status / pipeline_events / system  │
                            └──────────────────────────────────────────────┘
```

**데이터 흐름**

1. Collector가 부팅 시 **백필**로 과거/누락 구간을 채운다.
2. **WebSocket**으로 실시간 1초봉과 최우선 호가를 받아 SQLite에 upsert 한다.
3. **Reconciler**가 주기적으로 결측을 스캔·복구하고, **히스토리 티어**를 최신으로 유지한다.
4. Web은 SQLite를 읽어 지표를 계산하고 **SSE로 1초마다 브라우저에 push** 한다.
5. 차트는 `/api/candles`로 원하는 봉 크기를 요청하고, 서버는 **적합한 티어를 골라 SQL로 롤업**한다.

> `klines` 테이블의 기본키가 `(symbol, interval, open_time)`이라 여러 해상도를 **스키마 변경 없이**
> 같은 테이블에 담습니다.

<br />

## 🛠 기술 스택

| 영역 | 사용 기술 |
|------|-----------|
| **언어/런타임** | TypeScript, Node.js 20 |
| **웹 프레임워크** | Next.js 15 (App Router), React 19 |
| **UI** | Tailwind CSS 3, shadcn/ui 스타일 컴포넌트, lightweight-charts(캔들), lucide-react |
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

수집기는 기동 시 설정 요약 배너를 찍고, 백필이 끝나면 **방금 수집한 가격을 아스키 스파크라인으로**
그린 준비 완료 카드를 출력합니다.

```
  █▀▄▀█ ▄▀█ █▀█ █▄▀ █▀▀ ▀█▀   █▀▄ █▀▀ █▀ █▄▀
  █ ▀ █ █▀█ █▀▄ █ █ ██▄  █    █▄▀ ██▄ ▄█ █ █
  Binance realtime collector

  symbols   BTCUSDT · ETHUSDT
  interval  1s  (view roll-ups derived on read)
  history   1m:30 1h:all
  retention 7d  (live interval only)
  database  ./data/market.db

  ● ready  backfill 0.6s

  BTCUSDT    152,645 rows  ▃▃▂▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▄██████████████████████
           63,556.03  +0.02%   gaps 1597/1597 ✓
```

> 💡 **최초 실행**은 `BACKFILL_DAYS`(기본 3일)치 1초봉을 채운 뒤 실시간 수집을 시작합니다.
> 동시에 히스토리 티어를 백그라운드로 받습니다 — 기본 설정 기준 **약 80초, 250 REST 요청,
> 20MB**(2종목 합계)입니다. 티어 백필은 실시간 수집을 막지 않습니다.
> 색상은 TTY에서만 출력되므로 로그를 파일로 넘겨도 깨끗한 텍스트가 남습니다.

<br />

## ⚙️ 환경변수

모든 값은 기본값이 있어 `.env` 없이도 동작합니다. (`.env.example` 참고)

| 변수 | 기본값 | 설명 |
|------|--------|------|
| `BINANCE_REST_BASE` | `https://api.binance.com` | REST 베이스 URL |
| `BINANCE_WS_BASE` | `wss://stream.binance.com:9443` | WebSocket 베이스 URL |
| `SYMBOLS` | `BTCUSDT,ETHUSDT` | 수집 종목 (쉼표 구분) |
| `KLINE_INTERVAL` | `1s` | 수집·저장할 캔들 간격 (`1s`·`1m`·`3m`·`5m`·`15m`·`30m`·`1h`·`4h`) |
| `BACKFILL_DAYS` | `3` | 최초 실행 시 백필할 기간(일) |
| `HISTORY_TIERS` | `1m:30,1h:0` | 함께 보관할 **코스 히스토리 티어** (`인터벌:일수`, `0`=상장일부터). 긴 기간 차트의 데이터 원천 |
| `RECONCILE_INTERVAL_MS` | `60000` | reconciler 실행 주기(ms) |
| `RECONCILE_WINDOW_MS` | `1800000` | 결측 스캔 윈도우(ms, 기본 30분) |
| `RETENTION_DAYS` | `7` | 이보다 오래된 캔들/이벤트 정리. **수집 인터벌에만 적용**되고 히스토리 티어는 보존 |
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
│   │   ├── index.ts            #   진입점: 배너 → 백필 → WS 수집 → reconciler → 히스토리 티어
│   │   ├── backfill.ts         #   최초/재시작 백필 + 코스 히스토리 티어 백필
│   │   ├── ingest.ts           #   WebSocket 수집 + 자동 재연결
│   │   ├── reconcile.ts        #   주기적 결측 스캔·복구
│   │   ├── banner.ts           #   기동 배너 · 준비 완료 카드(아스키 스파크라인)
│   │   └── logger.ts
│   ├── lib/                    # 🧩 공유 도메인 로직
│   │   ├── config.ts           #   zod 기반 환경변수 검증 + 히스토리 티어 파싱
│   │   ├── db.ts               #   SQLite 연결 + 마이그레이션 (WAL)
│   │   ├── binance.ts          #   Binance REST/WS 클라이언트·파서
│   │   ├── metrics.ts          #   지표 계산 + 대시보드 스냅샷 빌더
│   │   ├── intervals.ts        #   인터벌 표 · 기간 프리셋 · 단위 그룹핑
│   │   ├── source-interval.ts  #   롤업에 쓸 저장 티어 선택(범위·정수배·밀도 검사)
│   │   ├── cache.ts            #   공용 TTL 메모 (스냅샷·캔들 응답 공유)
│   │   ├── trend.ts            #   등락 색 관례 단일 정의 (한: 빨강/파랑, 영: 초록/빨강)
│   │   ├── thresholds.ts       #   임계값 + 화면에 인쇄할 임계 라벨
│   │   ├── market-meta.ts      #   심볼별 틱 사이즈
│   │   ├── request.ts          #   API 라우트 공용 쿼리 파싱
│   │   ├── format.ts / types.ts / i18n.ts / utils.ts
│   │   └── repositories/       #   klines · pipeline · system 데이터 접근 계층
│   ├── app/
│   │   ├── (dash)/             # 🖥 대시보드 셸 (헤더 + 상태 리본 + SSE 구독)
│   │   │   ├── page.tsx        #   `/`      마켓 — 캔들 차트 + 종목 카드
│   │   │   └── ops/page.tsx    #   `/ops`   운영 현황 — 핵심 4지표 · System · Pipeline · 로그 · 캔들
│   │   ├── api/                # 🔗 stream(SSE) · candles · klines · health
│   │   └── layout.tsx / globals.css
│   ├── components/
│   │   ├── dashboard/          # 📊 차트 · 카드 · 패널 · 토글 · 리본 · 타임라인
│   │   ├── snapshot-provider.tsx  #   단일 SSE 구독 + 낡음 판정 + 심볼 선택 공유
│   │   └── ui/                 #   shadcn/ui 스타일 프리미티브
│   └── hooks/useSnapshot.ts    #   SSE 구독 훅 (프레임 수신 시각 포함)
├── docs/
│   ├── metrics.md              # 📄 지표 선택 이유·근거 (과제 요구 문서)
│   └── rate-limits.md          #   REST 사용량 분석·방어
├── PRODUCT.md                  # 🎯 제품 맥락 (사용자·목적·원칙)
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
- **주기적 reconciler** — `RECONCILE_INTERVAL_MS`마다 최근 윈도우의 결측 캔들을 스캔해 REST로 채움

### 📚 코스 히스토리 티어

수집 인터벌(1초봉)로는 **실제 역사를 담을 수 없습니다** — BTCUSDT 9년치 1초봉은 약 2억 8천만 개,
25GB입니다. 그래서 긴 기간 차트는 별도의 코스 티어에서 서빙합니다.

| 티어 | 보관 | 용도 | 실측 |
|------|------|------|------|
| `1s` (수집 인터벌) | 7일 | 운영 감시 · 짧은 기간 차트 | — |
| `1m` | 30일 | 1일~1개월 차트 · **24h 지표 집계** | 심볼당 43,199행 |
| `1h` | **2017-08-17부터 전체** | 1년 · 전체 차트 | 심볼당 78,398행 (79요청, 7MB) |

티어는 `HISTORY_TIERS`로 조정합니다. 조회 시에는 **요청한 봉 크기를 정수배로 나누면서 그 구간을
덮고, 충분히 조밀한 가장 정밀한 티어**가 자동 선택됩니다(`src/lib/source-interval.ts`).
밀도 검사가 필요한 이유는 1초봉이 7일 전까지 닿더라도 **수집기가 멈춰 있던 구멍**이 있을 수
있기 때문입니다 — 그 경우 조밀한 상위 티어로 자동 강등됩니다.

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

운영자 시선 흐름(**System → Pipeline → Market**)에 맞춘 3-tier 구성이며, 각 지표는
임계값 기반 **초록/노랑/빨강 색상 코딩**됩니다. 정의·선택 근거·임계값 표는
👉 **[`docs/metrics.md`](docs/metrics.md)** 에 정리되어 있습니다.

화면은 두 개입니다.

| 화면 | 답하는 질문 | 내용 |
|------|------------|------|
| **`/` 마켓** | "지금 시장은?" | 캔들 차트(기간·시간 기준 선택) · 종목별 시세 카드 |
| **`/ops` 운영 현황** | "수집이 정상인가?" | 핵심 4지표 히어로 · System · Pipeline · 이벤트 로그 · 캔들 데이터 |

**상태 리본은 셸에 있어 두 화면 모두에 항상 표시됩니다** — 운영자의 첫 질문은 클릭 없이 답해야 합니다.

| 구분 | 지표 |
|------|------|
| **System** | CPU · RAM · Uptime · REST calls/min · **REST Weight x/6000** · Retry · 429 · 5xx |
| **Pipeline** | WS 상태 · **Msg/s** · Lag · **Last Message** · **Recovery Rate** · 탐지/복구 · reconnect · errors/min · 총 레코드 · 이벤트 로그 |
| **Market** | 실시간가 · 24h 변동률 · 거래량 · **변동성(bp)** · **Bid/Ask** · **스프레드(틱)** · **VWAP** · **24h High/Low** · 캔들 차트 · 최근 캔들 |

> 시세 지표는 대부분 **직접 수집·저장한 데이터에서 계산**하고(Bid/Ask는 `@bookTicker` 실시간 스트림),
> 수집 품질이 곧 지표 품질로 이어지므로 System·Pipeline 건강 지표를 1급 시민으로 다룹니다.

### 임계값(색상) 요약

| 지표 | 🟢 정상 | 🟡 경고 | 🔴 위험 |
|------|--------|--------|--------|
| Lag | < 5초 | 5–30초 | > 30초 |
| Recovery Rate | 100% | 95–99% | < 95% |
| REST Weight | < 70% | 70–90% | > 90% |
| Error Rate | 0/min | 1–5/min | > 5/min |

<br />

## 🧭 설계 결정 & 트레이드오프

| 결정 | 이유 |
|------|------|
| **수집기 / 웹 프로세스 분리** | 장시간 상주 WS와 요청-응답 웹은 성격이 달라, 분리 시 각각 독립적으로 재시작·확장 가능 |
| **SQLite (WAL)** | 제로 셋업으로 재시작 후 영속성 확보. WAL로 동시 read/write. 확장 필요 시 리포지토리 계층만 교체하면 Postgres/TimescaleDB로 이전 가능 |
| **kline 수집 (개별 체결 아님)** | 캔들은 **REST로 과거 구간을 정확히 백필**할 수 있어 "재시작 백필" 요구와 정합. 개별 체결은 과거 재구성이 어렵고 저장량이 폭증 |
| **1초봉을 기본 수집 단위로** | 가장 정밀한 단위로 저장하면 그 위의 모든 봉을 유도할 수 있음. 반대 방향은 불가능 |
| **큰 봉은 저장하지 않고 조회 시 롤업** | 인터벌을 추가해도 수집기·스키마가 불변. 캐시로 닫힌 버킷을 재사용해 1시간 뷰 113ms → 0.18ms |
| **다해상도 티어 (1s/1m/1h)** | 1초봉은 정밀하지만 얕고(보존 7일), 코스 티어는 그 반대. 둘을 함께 두면 "정밀한 최근"과 "완결된 역사"를 모두 서빙 |
| **24h 집계를 조밀 티어에서** | 1초봉은 수집기가 돌아간 구간만 존재 → 거래량이 최대 60% 과소 집계됨. 집계에 필요한 건 정밀도가 아니라 **완결성** |
| **낡은 프레임을 명시적으로 표시** | 모니터링 제품이 멈춘 데이터를 라이브처럼 보여주면, 감지해야 할 바로 그 장애에서 거짓 초록을 띄움 |
| **SSE (WebSocket 아님)** | 서버 → 클라이언트 단방향 push만 필요하므로 SSE가 더 단순하고, 브라우저 자동 재연결 내장 |
| **zod 설정 검증** | 잘못된 환경변수를 부팅 시점에 즉시 실패시켜 런타임 오류 예방 |

<br />

## ✅ 동작 검증

실제 Binance 엔드포인트를 대상으로 검증한 결과입니다.

| 항목 | 결과 |
|------|------|
| 최초/재시작 백필 | `first-run` · `restart-gap` 양쪽 동작 확인 (실측 재시작 백필 0.6초) |
| WS 실시간 수집 | 현재 캔들 `is_final=0` 로 실시간 갱신 확인 |
| 히스토리 백필 | 1분봉 30일 + **1시간봉 2017-08-17부터** 적재 (심볼당 43,199 + 78,398행, 78초) |
| 24h 지표 정확도 | Binance 공표치 대비 거래량 오차 **−0.03% / −0.01%**, 고가·저가·VWAP 일치 |
| `/api/health` | status · market · series · events 정상 응답 |
| `/api/candles` | 기간 프리셋 7종 전부 정상 (`전체` → 2017-08-17부터 468봉) |
| `/api/klines` | OHLCV 원자료 조회 정상 |
| `npm run build` | 성공 (2 페이지 + 4 API 라우트) |
| `npm run typecheck` | 통과 |
| `npm test` | **48 tests 통과** (gap · 지표 · Binance 파서 · SQL 롤업 · 티어 선택 · 스파크라인) |

> 테스트는 네트워크·DB 없이 순수 도메인 로직만 결정론적으로 검증합니다
> (`src/lib/*.test.ts`). "표면은 최소, 코어는 테스트" 원칙으로 고가치 로직에 집중했습니다.

<br />

## 🗺 향후 확장

- [ ] `docker-compose`로 원커맨드 실행 + Postgres/TimescaleDB 옵션
- [ ] `@aggTrade` 스트림으로 실시간 체결 흐름/틱 지표 추가
- [x] 백필 gap 계산·지표 계산 유닛 테스트
- [x] 다중 인터벌 뷰(초~시간봉) — SQL 롤업으로 구현
- [ ] 심볼 동적 추가
- [ ] 알림(수집 지연·연속 결측 임계치 초과 시)
- [ ] 롤업 결과 물리화(심볼이 수십 개로 늘어날 때)

<br />

---

<div align="center">
<sub>Built for the ariai.ai take-home assignment · Data from Binance public market streams</sub>
</div>
