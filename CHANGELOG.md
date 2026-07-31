# Changelog

이 프로젝트의 주요 변경사항을 기록합니다. 형식은 [Keep a Changelog](https://keepachangelog.com/)를
따르고, 버전은 [Semantic Versioning](https://semver.org/)을 준수합니다.

## [v0.2.0] - 2026-07-31

운영 도구 강화 · 1초봉 수집 · UI/UX 리디자인 릴리즈.

### Added
- feat: 1초봉 수집 — interval-safe 지표(SQL 24h 집계) · 보존 정책 · 스냅샷 공유 캐시 (#10)
- feat: 테마/언어 쿠키 영속화 — SSR 인식, 깜빡임 제거 (#9)
- feat(ui): 콤팩트 단일화면 + 하단 탭 레이아웃 (#8)
- feat(ui): 대시보드 정보 계층화(progressive disclosure) (#6)
- feat: 운영 도구급 대시보드 — System/Pipeline/Market 3-tier + 임계값 색상 (#5)
- feat(ui): 다크/라이트 테마 + 한/영 언어팩(한국어 기본) (#4)
- feat: Binance REST rate-limit 안전장치 + 사용량 분석 (#2)

### Changed
- style(ui): Pretendard 폰트 + 거래소 표준 용어로 교체 (#7)
- test: 코어 로직 유닛 테스트(vitest) 도입 (#3)

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
