# Binance Realtime Dashboard — Project Guide

Binance BTCUSDT·ETHUSDT 실시간 거래 데이터를 수집하고 운영 현황을 보여주는 대시보드.

## Architecture

- **Collector** (`src/collector/`) — 상주 프로세스. 시작 시 백필(REST) → WebSocket 실시간 수집 →
  주기적 reconciler로 결측 구간 보정. gap 탐지 + REST 채움을 단일 메커니즘으로 구현하여
  최초 실행/서버 재시작 누락을 모두 커버. 별도로 **코스 히스토리 티어**(`HISTORY_TIERS`,
  기본 1분봉 30일 + 1시간봉 전체)를 백그라운드로 유지 — 1초봉으로는 실제 역사를 담을 수 없기 때문.
  백필 진행 상황은 `backfill_progress` 테이블에 기록되어 콘솔(`collector/progress.ts`)과
  대시보드 배너 양쪽이 같은 행을 읽는다.
- **Web** (`src/app/`) — Next.js(App Router) 대시보드. 두 라우트를 `(dash)` 셸이 감쌈:
  `/` 마켓(캔들 차트 + 시세 카드), `/ops` 운영 현황. SSE(`/api/stream`)로 1초 갱신.
  차트는 `/api/candles`에서 롤업된 캔들을 받음.
- **Storage** — SQLite(`better-sqlite3`, WAL). collector(write)/web(read) 동시 접근.
  `klines` PK가 `(symbol, interval, open_time)`이라 여러 해상도를 한 테이블에 보관.
  스키마·리포지토리는 `src/lib/`.

## Key invariants

- **큰 봉은 저장하지 않는다.** 조회 시 SQL로 롤업한다(`getAggregatedCandles`). 인터벌 추가가
  수집기·스키마를 건드리지 않게 하기 위함.
- **집계 소스는 밀도로 고른다.** 1초봉은 수집기가 돌아간 구간만 존재하므로, 24h 지표와 긴 기간
  차트는 `pickSourceInterval`이 고른 조밀한 티어에서 계산한다.
- **등락 색은 `src/lib/trend.ts` 한 곳에만 정의한다.** 캔버스와 DOM이 같은 정의를 읽는다.
- **낡은 프레임은 낡았다고 표시한다.** SSE가 끊기면 상태를 crit으로 강제하고 수치를 흐린다.
- **백필 진행률 계산은 `src/lib/backfill-progress.ts` 한 곳에만 있다.** 콘솔과 웹이 같은
  퍼센트를 말해야 하고, 잔여 작업은 페이지 수(시간 비용)로 센다.
- **`better-sqlite3`는 JS number를 REAL로 바인딩한다.** 정수 나눗셈이 필요하면 `CAST(... AS INTEGER)`.

## Commands

- `npm run dev` — collector + web 동시 실행 (concurrently)
- `npm run dev:collector` / `npm run dev:web` — 개별 실행
- `npm run collector` — collector만 (prod)
- `npm run typecheck` — 타입 체크
- `npm test` — 유닛 테스트 (vitest)

## Skills

커스텀 검증 및 유지보수 스킬은 `.claude/skills/`에 정의되어 있습니다.

**검증 스킬** (from [ai-skills](https://github.com/SBKIM9704/ai-skills))

| Skill | Purpose |
|-------|---------|
| `verify-implementation` | 프로젝트의 모든 verify 스킬을 순차 실행하여 통합 검증 보고서를 생성합니다 |
| `manage-skills` | 세션 변경사항을 분석하고, 검증 스킬을 생성/업데이트하며, CLAUDE.md를 관리합니다 |

**Git 워크플로우 커맨드** (from [claude-commands](https://github.com/SBKIM9704/claude-commands))

| Skill | Purpose |
|-------|---------|
| `branch` | develop 최신화 후 새 feature 브랜치 생성 (`/branch <name>`) |
| `commit` | 변경사항을 논리적 단위로 나눠 커밋 생성 (`/commit <메시지>`) |
| `pr` | 현재 브랜치로 develop PR 생성 → mergeable 확인 → squash merge (`/pr [제목]`) |
| `release` | develop → main 릴리즈 PR 생성·merge (버전 bump·CHANGELOG·태그) (`/release [version]`) |
