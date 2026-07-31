# Changelog

이 프로젝트의 주요 변경사항을 기록합니다. 형식은 [Keep a Changelog](https://keepachangelog.com/)를
따르고, 버전은 [Semantic Versioning](https://semver.org/)을 준수합니다.

## [v0.1.0] - 2026-07-31

최초 릴리즈. Binance 실시간 수집 파이프라인과 운영 대시보드.

### Added
- feat: Binance 실시간 수집 파이프라인 + 운영 대시보드 (cb35350)
  - WebSocket `kline_1m` 실시간 수집 (BTCUSDT·ETHUSDT), 지수 백오프 자동 재연결
  - 통합 백필: 최초 실행 + 재시작 누락 복구를 단일 메커니즘으로 처리
  - 주기적 reconciler로 결측 캔들 자가 치유
  - SQLite(WAL) 영속화, SSE(`/api/stream`) 1초 주기 실시간 대시보드
  - 운영 지표(WS 상태·수집 지연·gap/백필·에러) + 시세 지표(가격·24h 변동·거래량·변동성)

### Changed
- chore: git 워크플로우 커맨드 스킬(branch/commit/pr/release) 추가 (f5c1e11)
- docs: README를 오픈소스 스타일로 재작성 (88d8594)
