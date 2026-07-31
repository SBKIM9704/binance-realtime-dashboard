# Binance Realtime Dashboard — Project Guide

Binance BTCUSDT·ETHUSDT 실시간 거래 데이터를 수집하고 운영 현황을 보여주는 대시보드.

## Architecture

- **Collector** (`src/collector/`) — 상주 프로세스. 시작 시 백필(REST) → WebSocket 실시간 수집 →
  주기적 reconciler로 결측 구간 보정. gap 탐지 + REST 채움을 단일 메커니즘으로 구현하여
  최초 실행/서버 재시작 누락을 모두 커버.
- **Web** (`src/app/`) — Next.js(App Router) 대시보드. SSE(`/api/stream`)로 실시간 갱신.
- **Storage** — SQLite(`better-sqlite3`, WAL). collector(write)/web(read) 동시 접근.
  스키마·리포지토리는 `src/lib/`.

## Commands

- `npm run dev` — collector + web 동시 실행 (concurrently)
- `npm run dev:collector` / `npm run dev:web` — 개별 실행
- `npm run collector` — collector만 (prod)
- `npm run typecheck` — 타입 체크

## Skills

커스텀 검증 및 유지보수 스킬은 `.claude/skills/`에 정의되어 있습니다.

| Skill | Purpose |
|-------|---------|
| `verify-implementation` | 프로젝트의 모든 verify 스킬을 순차 실행하여 통합 검증 보고서를 생성합니다 |
| `manage-skills` | 세션 변경사항을 분석하고, 검증 스킬을 생성/업데이트하며, CLAUDE.md를 관리합니다 |
