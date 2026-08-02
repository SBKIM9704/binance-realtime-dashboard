# Changelog

이 프로젝트의 주요 변경사항을 기록합니다. 형식은 [Keep a Changelog](https://keepachangelog.com/)를
따르고, 버전은 [Semantic Versioning](https://semver.org/)을 준수합니다.

## [Unreleased]

### Added
- feat(collector): 코스 히스토리 티어(`HISTORY_TIERS`) — 1분봉 30일 + 1시간봉 상장일부터.
  1초봉으로는 담을 수 없는 긴 기간 차트와 24h 집계를 서빙 (70b0acb)
- feat(collector): 기동 배너 + 백필 완료 시 준비 완료 카드(아스키 스파크라인) (70b0acb)
- feat(api): `/api/candles` — 큰 봉을 저장하지 않고 조회 시 SQL 롤업. 구간·정수배·밀도로
  소스 티어 자동 선택(`source-interval.ts`) (51fca49)
- feat(ui): 캔들 차트(lightweight-charts) · 마켓/운영 2화면 분리 · 낡은 프레임 표시 · 접근성 (7e71e37)
- docs: 대시보드 스크린샷 2종 (ae2de4d)

### Changed
- fix(metrics): 24h 지표를 조밀 티어에서 집계 — 1초봉 기준 거래량 최대 60% 과소 집계 해소.
  변동성 bp, 스프레드 틱 단위로 표시 단위 변경 (1d860c9)
- fix(chart): 캔들 갱신을 SSE 틱에 연동 — 자체 타이머 제거로 시세 카드와 초 단위 일치,
  스트림이 끊기면 차트 폴링도 멈춤 (4a09a34)
- fix(api): 롤업 캐시 키에 매 요청 달라지는 `rangeStart`가 들어가 캐시가 한 번도
  적중하지 않고 무한히 증가하던 문제. 키를 버킷 경계로 스냅하고 캐시에 상한 추가
- chore: 런타임 의존성(`ws`·`dotenv`·`tsx`·`concurrently`)을 `dependencies`로 이동 —
  `npm ci --omit=dev` 환경에서 수집기가 기동하지 못하던 문제
- chore: 저장만 하고 화면·파생 어디에서도 읽지 않던 `messageCount`(프로세스 재시작마다
  리셋되는 인메모리 누적치)와 `errorCount`(reconcile 실패 시에만 증가, 같은 실패가
  `pipeline_events`에 이미 기록됨) 제거. 기존 DB의 컬럼은 그대로 두어 마이그레이션 불필요
- chore: recharts 제거, lightweight-charts 도입 (40f61ac)
- docs: README를 독자 동선 기준으로 재구성, 지표 선정 근거 문서 정리 (015efb1, 8ab0955, 0601289)

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
