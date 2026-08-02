---
target: dashboard (/ and /ops)
total_score: 20
max_score: 40
na_heuristics: 
p0_count: 2
p1_count: 2
timestamp: 2026-08-02T03-30-35Z
slug: src-app-dash-page-tsx
---
Method: dual-agent (A: 디자인 리뷰 · B: 디텍터 + 브라우저 증거) — 두 평가는 서로의 결과를 보지 못한 채 병렬 실행됨

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 2 | SSE가 끊겨도 마지막 프레임이 100% 불투명하게 계속 렌더링됨. 리본이 낡은 프레임을 근거로 "정상"을 표시할 수 있음 |
| 2 | Match System / Real World | 3 | 국내 거래소 관례(상승=빨강, 시가/고가/저가/종가, 단위별 주기 묶음)는 제대로 지킴. 다만 `fmtClock`이 `en-GB` 고정, `fmtTimeAgo`가 " ago" 고정 |
| 3 | User Control and Freedom | 2 | URL 상태가 전혀 없음 — 심볼/기간/봉이 전부 React state라 북마크·공유·새로고침 유지 불가 |
| 4 | Consistency and Standards | 3 | `Panel`/`Stat`/`ToggleGroup`이 실제로 하나의 시스템. 단 `Panel`은 제목 10px / 부제 14px 세미볼드로 위계가 뒤집힘 |
| 5 | Error Prevention | 2 | 기간=1시간 + 봉=1주 조합이 두 번 클릭으로 도달 가능하고 캔들 1개만 그려짐. 두 컨트롤 모두 선택 상태로 표시됨 |
| 6 | Recognition Rather Than Recall | 2 | `/ops`의 23개 타일이 동일 가중치. 임계값(5초/30초, 70%/90%)이 화면 어디에도 없어 색을 외워야 함 |
| 7 | Flexibility and Efficiency | 2 | 키보드 단축키 없음, 딥링크 없음, BTC/ETH 나란히 보기 없음. 가격축 드래그 스케일링은 코드로 비활성화됨 |
| 8 | Aesthetic and Minimalist Design | 2 | 차트 툴바에 컨트롤 21개가 한 띠에. 마켓 카드는 `grid-cols-3`에 `MiniStat` 5개라 6번째 칸이 비어 있음 |
| 9 | Error Recovery | 1 | UI에 에러 상태가 존재하지 않음. `catch { return null }`, `.catch(() => {})`, 빈 응답 → 메시지 없는 빈 캔버스 |
| 10 | Help and Documentation | 1 | 변동성이 "60캔들 로그수익률 표준편차"인데 24시간 지표들 옆에 "변동성"으로만 표기. 임계값 표는 README에만 존재 |
| **Total** | | **20/40** | **Acceptable — 사용자가 만족하기 전에 상당한 개선 필요** |

`n/a` 없음. Operate 모드 대시보드라 10개 모두 적용됨.

## Design Specificity Verdict

**결론: 스킨은 이 제품의 것, 구조는 교체 가능.**

**LLM 평가.** 진짜로 이 제품을 위해 만들어진 것들이 있습니다 — `lib/trend.ts`의 한/영 등락 색 반전(캔버스와 DOM이 하나의 정의를 공유), `interval-picker.tsx`의 국내 거래소 주기 바 관용구(단위를 한 번 쓰고 숫자를 고르는 방식), 앰버 터미널 팔레트와 `.grain` 노이즈·30px 스캔라인, 그리고 차트가 "1분 데이터 기준"이라고 스스로 밝히는 `range.source` 표시. 이 중 어느 것도 컴포넌트 라이브러리에서 나오지 않습니다.

반대로 그대로 들어내 다른 제품에 붙일 수 있는 것들 — `/ops`는 동일 가중치 `Stat` 23개가 `gap-px` 격자에 깔린 기본형 메트릭 월이고, 마켓 카드는 표준 시세 티커(심볼/큰 가격/% 알약/스파크라인/미니스탯)이며, 레이아웃(헤더 → 리본 → 2:1 차트+카드)은 트레이딩 대시보드의 기본 배치입니다.

**가장 중요한 지적**: 이 제품을 다른 시세 대시보드와 다르게 만드는 단 하나 — *여기 모든 시세 숫자는 구멍 있는 파이프라인에서 유도됐다* — 가 화면 구성에 전혀 표현되지 않습니다. 55% 밀도의 1초봉 테이블에서 집계돼 35~60% 과소한 `volume24h`가, 라이브 스트림에서 바로 오는 `lastPrice`와 **완전히 동일한 활자 권위**로 렌더링됩니다. PRODUCT.md는 "수집 품질이 곧 지표 품질"이라 선언하지만, 인터페이스는 개별 숫자 앞에서 그 말을 한 번도 하지 않습니다.

**결정론적 스캔.** `detect.mjs`를 4가지 스코프로 실행, 전부 **exit 0 / findings 0**. B는 이 clean 결과를 검증했습니다 — 의도적으로 나쁜 `.tsx`(bounce easing, Comic Sans, 11px #777, 무거운 그림자)를 만들어 스캔했더니 `[bounce-easing]`을 잡고 exit 2를 반환했습니다. 즉 디텍터는 이 스코프의 `.tsx`를 실제로 파싱합니다. **다만 시드한 4개 문제 중 1개만 잡았으므로, clean은 "레지스트리의 어떤 룰도 매칭되지 않았다"는 뜻이지 "문제가 없다"는 뜻이 아닙니다.** `.impeccable/` 설정 디렉터리가 없어 억제된 룰도 없습니다.

디텍터가 침묵한 자리에서 B의 정적 증거가 A와 독립적으로 같은 결론에 도달했습니다:
- **포커스 표시자 0개** — `src/` 전체에서 `focus-visible:`/`focus:`/`ring-` 검색 결과 **모든 파일에서 0**. `--ring` 토큰은 두 테마에 정의되고 `tailwind.config.ts:11`에 매핑됐는데 **어떤 컴포넌트도 참조하지 않음**. A가 P0로 올린 것과 정확히 일치.
- **터치 타깃**: `ToggleGroup` plain 변형(기간 7개 + 봉 14개 버튼)이 `px-2 py-0.5 text-[11px]` → **약 17~18px 높이**. WCAG 2.5.8(AA) 최소는 24×24px. A는 이걸 놓쳤고 B가 수치로 잡았습니다.
- **`prefers-reduced-motion` 0건** — `pulse-dot`이 1.4초 `infinite`로 opacity·transform을 동시에 애니메이션하며 리본 + 심볼당 `LiveDot`에서 동시 실행.
- **`aria-live` 0건** — 리본 정상→위험, WS 배지 실시간→끊김, 헤더 연결됨→재연결 중. 이 제품이 알리려고 존재하는 모든 상태 변화가 스크린리더에 무음.
- **`SymbolTabs`가 `ariaLabel` 없이 `ToggleGroup`을 호출** → `role="group"`에 `aria-label={undefined}`. `ops/page.tsx:35`와 `price-chart.tsx:369`에서 이름 없는 그룹으로 렌더링. A가 놓친 부분.
- **차트 컨테이너에 대체 텍스트 없음** — lightweight-charts가 `role`/`aria-label` 없는 빈 `<div>`에 렌더링. `Legend`는 `pointer-events-none`이라 키보드로 도달 불가. 데이터 포인트를 읽는 유일한 방법이 마우스 호버.

**Visual overlays: 사용 불가.** 브라우저 자동화를 1회 시도했고 정확한 실패 사유는 다음과 같습니다:

```
Failed to launch the browser process: Code: 127
/home/sbkim/.cache/puppeteer/chrome/linux-148.0.7778.97/chrome-linux64/chrome:
error while loading shared libraries: libnspr4.so: cannot open shared object file
```

live-server를 띄우지 않았고, 스크립트 주입도 하지 않았으며, **브라우저에 표시되는 오버레이는 존재하지 않습니다.** 렌더된 DOM이 필요한 룰(실측 대비, 오버플로, 계산된 크기)은 이번 회차에서 **실행되지 않았습니다.** 아래 대비비 수치는 A가 토큰에서 계산한 값이며 실제 렌더링에서 측정한 값이 아닙니다.

## Overall Impression

기술적 기반은 이 리뷰가 지적하는 문제 대부분보다 앞서 있습니다. 소스 품질은 좋고, 디자인 시스템은 실재하며, 문화적 관례 처리는 모범적입니다. **문제는 인터페이스가 자기 제품의 논지를 배신한다는 것입니다.**

가장 큰 기회는 새 기능이 아니라 **정직함의 시각화**입니다. `/api/candles`는 이미 `from`(저장된 데이터가 어디까지 거슬러 가는지)을 반환하고 있고, `tickerUpdatedAt`은 이미 클라이언트까지 도달하며, `source`(어느 티어가 답했는지)는 이미 화면에 한 번 나타납니다. **이 제품이 진실을 말하는 데 필요한 데이터는 전부 이미 클라이언트에 있고, UI가 그걸 버리고 있습니다.**

## What's Working

**1. `lib/trend.ts` — 하나의 정의, 두 개의 렌더러.** `TREND_TOKENS`가 언어 → 시맨틱 토큰을 매핑하고, `trendVar()`가 캔버스용 CSS 변수로, `trendText()`/`trendBg()`가 DOM용 Tailwind 클래스로 해석합니다. 이게 좋은 이유는 막아주는 실패가 파국이 되기 전까지 보이지 않기 때문입니다 — 초록 상승 캔들 옆에 빨강 상승 퍼센트가 붙으면 한국 독자는 시장을 거꾸로 읽습니다. 문화적 관례를 색 상수가 아니라 조회 테이블로 인코딩한 건 정확한 추상화 수준입니다.

**2. `RANGE_PRESETS` + `viewIntervalsFor()`.** 두 가지 좋은 판단이 들어 있습니다. `preset()`이 기간과 봉 크기를 한 쌍으로 묶고 `points`를 산술로 유도합니다 — "얼마나 멀리"와 "얼마나 조밀하게"를 하나의 결정으로 다루는 게 맞습니다. 그리고 `viewIntervalsFor()`가 기준봉 이상이면서 정수배인 버킷만 남기므로, 메뉴가 저장된 데이터로 만들 수 없는 롤업을 제안하는 일이 구조적으로 불가능합니다. UI의 선택지가 수집기의 현실에서 유도됩니다.

**3. `source` 공개 — `price-chart.tsx:387-391`.** 답한 저장 티어가 수집 인터벌과 다를 때 툴바가 "1분 데이터 기준"이라고 밝힙니다. 어느 티어가 질의에 답했는지 인정하는 대시보드는 거의 없습니다. "수집 품질이 곧 지표 품질"이 픽셀에 닿는 유일한 지점이고, 이 제품 최대 문제의 해법의 씨앗입니다.

## Priority Issues

### [P0] 얼어붙은 스냅샷이 라이브 데이터로 렌더링됨
**Why it matters.** `useSnapshot.ts:29`는 에러 시 `connected=false`만 세팅하고 그 외에는 아무것도 하지 않습니다. `snapshot` 객체는 마지막 값을 유지하고, 모든 `Stat`·가격·`StatusRibbon`이 100% 불투명하게 계속 렌더링됩니다. `AppHeader`의 독립 1초 시계는 계속 돌아가며 **라이브라는 착각을 능동적으로 강화합니다.** 데이터가 멈춘 것을 감지하는 게 직무인 사용자를 위한 모니터링 제품이, 정확히 그 실패 상황에서 그럴듯한 초록 대시보드를 보여줍니다. 거짓 초록은 깨진 화면보다 나쁩니다.

**Fix.** `useSnapshot`에서 수신 프레임마다 타임스탬프를 찍고 `staleMs`를 노출. `!connected || staleMs > 3000`이면 (a) `StatusRibbon`의 `overall`을 보유값과 무관하게 `crit`으로 강제, (b) 상태 텍스트를 `연결 끊김 · 마지막 수신 {N}초 전`으로 교체, (c) 셸 레벨에서 모든 수치 표시에 `opacity-50 saturate-50` 적용, (d) `status-ribbon.tsx:53`의 `overall !== "crit"` 가드를 제거해 위험할 때 점이 다시 뛰게 함(현재는 **가장 심각할 때 애니메이션이 멈춥니다**).

**Suggested command**: `/impeccable harden`

### [P0] 애플리케이션 전체에 포커스 표시자가 0개
**Why it matters.** A와 B가 독립적으로 확인했습니다. 영향 범위: 봉 14개 + 기간 7개 + 심볼 탭 2개(`ToggleGroup`), 네비 링크 2개, 언어 버튼 2개, 테마 버튼 1개 — **전체 인터랙티브 요소의 100%.** 키보드 사용자가 차트 툴바를 탭으로 지나가면 21번의 정차 동안 자기 위치를 알 수 없습니다. PRODUCT.md에 명시적 접근성 섹션을 둔 제품에서의 WCAG 2.4.7 실패입니다. 토큰(`--ring`)은 이미 정의돼 있고 아무도 쓰지 않을 뿐입니다.

**Fix.** `ToggleGroup`·`Controls` 버튼과 `AppHeader` 네비 링크에 `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background` 추가. 컴포넌트 4개, 각 1회 수정. 동시에 plain 토글의 히트 영역을 17~18px에서 최소 24px로 올릴 것(`py-0.5` → `py-1.5` 또는 `min-h-6`).

**Suggested command**: `/impeccable audit`

### [P1] "0.00%"와 "0.000%"가 미구현 지표로 읽힘
**Why it matters.** `market-card.tsx:106`의 `(volatility * 100).toFixed(2)`는 원값 ~4e-5에 대해 `0.00%`를 렌더링합니다. `market-card.tsx:71`의 `spreadPct.toFixed(3)`는 항상 정확히 1틱인 값에 대해 `0.000%`/`0.001%`를 렌더링합니다. 둘 다 `format.ts`를 우회한 인라인 `toFixed`입니다. README가 열거한 10개 Market 지표 중 2개가 서로 구분도 안 되는 0으로 나오고, 기본 라우트에 있으며, 3초 안에 보입니다. **체크리스트를 확인하는 1순위 페르소나에게 0은 산술이 타당하든 말든 "미구현"으로 읽힙니다.** 값은 맞고 표현이 값을 파괴합니다.

**Fix.** 변동성은 라벨에 창을 넣어 bp로 — `변동성 (60초)` / `4.1 bp`. 스프레드는 틱과 병기 — `1틱 · 0.001%`. 두 포맷터를 `format.ts`로 옮겨(`fmtBps`, `fmtSpread`) 컴포넌트가 정밀도를 손으로 정하는 일이 없게 할 것.

**Suggested command**: `/impeccable clarify`

### [P1] 차트 툴바: 컨트롤 21개, 숨은 결합, 빈 상태 없음
**Why it matters.** `selectRange()`는 기간과 봉을 함께 세팅하지만 `IntervalPicker`의 `onSelect={setInterval_}`은 봉만 세팅합니다. 그래서 기간=1시간 + 봉=1주가 두 번 클릭으로 도달 가능하고, **두 버튼 모두 선택 상태로 강조된 채 캔들 1개가 그려집니다.** 그리고 `PriceChart`에는 빈 상태가 없습니다 — `paint([])`가 두 시리즈를 비우고 `Legend`가 `null`을 반환해, 제목만 있는 패널 안에 메시지 없는 빈 캔버스가 남습니다. 차트는 기본 라우트의 주인공이자 화면 최대 요소인데, 두 번의 클릭으로 설명 없는 빈 주인공이 됩니다. 한 결정 지점의 동시 선택지 21개는 이 제품 최악의 인지 부하 위반입니다.

**Fix.** (a) 기간을 단독 1차 컨트롤로 두고, `IntervalPicker`는 "세부 설정" 디스클로저 뒤로 강등. (b) 활성 기간에서 100~600봉이 나오는 버킷으로 봉 선택지를 클램프해 결합을 권고가 아닌 구조로 만들 것. (c) `/api/candles`가 이미 반환하는 `from`을 소비해 데이터보다 오래된 프리셋을 비활성화하고 사유를 컨트롤에 표기. (d) 차트 본문에 실제 빈 상태 렌더링.

**Suggested command**: `/impeccable distill`

### [P2] 평가자의 3분: `/ops`에 위계가 없고, 필수 지표가 없다고 오해될 위치에 있음
**Why it matters.** PRODUCT.md 15행: "요구된 지표가 화면에 존재하고 찾을 수 있는지가 곧 평가 결과가 된다." **최근 캔들**(README의 Market 티어)은 `/`에 없고 `/ops`의 `캔들 데이터` 패널에 있는데, `/ops`의 네비 힌트는 `수집 상태 · 이벤트 · 진단`이라 캔들을 언급하지 않습니다. Market 아래를 찾던 평가자는 캔들 테이블이 미구현이라 결론 내립니다. 마찬가지로 Bid/Ask/Spread는 마켓 카드에서 `text-[11px] text-muted-foreground`로 **카드에서 가장 작은 텍스트**인데, README는 이를 "호가/심화 시세"로 따로 내세웁니다. 그리고 `/ops`는 23개 타일이 동일 가중치이고 섹션 제목이 `<h2>`가 아닌 `<div className="label">`입니다.

**Fix.** (a) WS / 지연 / 복구율 / REST Weight를 `/ops` 상단 4-up 히어로 밴드로 승격(약 2배 활자), 나머지 19개는 낮은 가중치의 2차 밴드로. `SystemStrip`/`OpsStrip`/`Panel` 제목을 실제 `<h2>`로 전환. (b) 색상 계약을 화면에서 검증 가능하게 임계값을 값 옆에 병기(`0.8s` `<5s`). (c) 캔들 테이블을 `/`의 마켓 카드 아래로 올리거나, 최소한 네비 힌트를 `수집 상태 · 이벤트 · 캔들 데이터`로 수정. (d) Bid/Ask를 `MiniStat` 격자(비어 있는 6번째 칸이 정확히 그 자리)로 승격하고 `tickerUpdatedAt` 경과 시간을 병기.

**Suggested command**: `/impeccable layout`

## Persona Red Flags

**Alex (파워 유저).** URL 상태가 어디에도 없음 — `range`/`interval`은 `PriceChart`의 `useState`, `symbol`은 `SnapshotProvider`의 `useState`. "ETH · 1시간"을 북마크할 수 없고, BTC와 ETH를 두 탭에서 다른 봉으로 열 수 없으며, 새로고침마다 뷰를 잃습니다. 켜두라고 만든 모니터링 화면에서 가장 큰 효율 실패입니다. 키보드 단축키 없음 + 포커스 링 없음(P0)이라 21버튼 툴바가 실질적으로 마우스 전용. 두 심볼을 나란히 볼 수 없음 — 제품이 정확히 2개 종목을 다루면서 한 번도 나란히 놓지 않습니다. `handleScale.axisPressedMouseMove.price: false`로 가격축 드래그 스케일링이 **의도적으로 비활성화**돼 있음. 두 개의 독립된 1초 시계(SSE 스냅샷 + 차트 폴링)가 비동기라 카드 가격과 차트 마지막 봉이 최대 1초 어긋나 보이며 멈추거나 맞출 방법이 없음. `viewCache`는 모듈 레벨 무한 `Map`(최대 2×14×7=196 엔트리 × ~700캔들)으로 **Alex가 열어두는 바로 그 장수 탭에서 절대 비워지지 않음**.

**Sam (접근성 의존).** 모든 컨트롤에 포커스 표시자 없음(P0) — 제품 전체 키보드 조작 차단. 제목 구조 없음: `<h1>` 1개(`app-header.tsx:45`), `<h2>`/`<h3>` 0개. `/ops`의 23개 지표를 제목 탐색으로 도달할 수 없고 선형 순회만 가능. `Stat`(`stat.tsx:37-42`)은 라벨-값 프로그래밍적 연결이 없음(형제 `<div>` 2개, `<dl>/<dt>/<dd>` 아님, `aria-labelledby` 없음) — 보조기술은 `/ops`를 "CPU 0.4% 메모리 84MB 업타임 2h 10m 429 제한 0 …"의 미분화된 흐름으로 읽습니다. `aria-live` 0건. `prefers-reduced-motion` 가드 0건. **PRODUCT.md 72행 "상태를 색 단독으로 인코딩하지 않는다"가 세 곳에서 위반**: `status-ribbon.tsx:71`(심볼별 건강 점 — Market 라우트의 유일한 심볼별 건강 표시인데 라벨·숫자·`aria-label` 없음), `events-timeline.tsx:9-17`(`DOT` 맵이 색으로만 이벤트 종류를 인코딩하며 `ws_disconnect`와 `error`가 동일한 `--danger`, `backfill_start`와 `reconcile`이 동일한 `--muted-foreground`), `recent-table.tsx:63`(종가 셀이 `trendText`만 받고 부호·화살표 없음 — 상승/하락이 색 단독). 계산된 대비 실패(렌더링 실측 아님): 초/분/시간 단위 라벨 `text-[10px] text-muted-foreground/70` **3.18:1**, `range.source` 공개 문구 동일 **3.18:1**, 이벤트 로그 `detail` 본문 `text-muted-foreground/80` **3.79:1** — 모두 AA 미달.

**과제 평가자 (프로젝트 고유 페르소나).** `/`에 착륙 → **최근 캔들**이 Market 뷰에 없고 네비 힌트가 언급하지 않는 곳에 숨어 있음 → 미구현으로 결론. **변동성 `0.00%`와 스프레드 `0.000%`**가 3초 안에 시야에 들어옴 → 체크리스트 2항목이 0으로 읽힘. **24시간 거래량에 단위가 없고**(`fmtCompact` → `1.23K` — BTC? USDT?) Binance 공표치보다 35~60% 낮음 — *데이터 수집* 과제이므로 평가자는 교차 검증할 가능성이 높고, 틀린 값을 발견하며, 그것이 부분 구간의 로컬 수집 캔들에서 집계됐다는 설명을 화면에서 찾지 못합니다. **임계값 계약이 비가시**: README가 4행 표로 색상 코딩을 광고하는데 화면의 초록 `0.8s`는 `<5s`라고 말하지 않음. 어디에도 "기준 시각"이나 커버리지 문구가 없음 — `footer.text`가 양쪽 사전에 존재하는데 렌더링하는 컴포넌트가 없음.

## Minor Observations

- **죽은 i18n 키 9개**(양쪽 사전에서 확인): `footer.text`, `diagnostics.hint`/`show`/`hide`, `ops.wsLag`, `ops.gapsFilledSeen`, `ops.errors`, `events.subtitle`, `table.subtitle`. `table.subtitle`은 "최근 1분봉"인데 `KLINE_INTERVAL` 기본값은 `1s`라 렌더링됐다면 틀린 문구였을 것.
- `status-ribbon.tsx:21` 독스트링이 아직 "접이식 Diagnostics 패널"을 언급 — 그 패널은 존재하지 않음.
- `format.ts:69` `fmtTimeAgo`가 영어 접미사 `" ago"` 고정 → 한국어 UI의 "마지막 정합"에 "5.2s ago"로 표시. `format.ts:59` `fmtClock`은 `en-GB` 고정.
- `panel.tsx:31-36` 제목 10px `.label` / 부제 `text-sm font-semibold` — 차트 패널에서 "5분 캔들"이 "가격 · 거래량"보다 큼.
- `market-card.tsx:99` `grid-cols-3`에 `MiniStat` 5개 → 6번째 칸이 비어 있음(Bid/Ask가 들어갈 자리).
- `sparkline.tsx:37` `gradId`가 `spark-${Math.round(min)}-${data.length}` — 반올림 최솟값과 길이가 같은 두 카드가 그라디언트 ID를 공유. 세 번째 심볼이 추가되면 드러날 잠복 버그.
- `sparkline.tsx`가 `preserveAspectRatio="none"`으로 `width=340`을 가변 높이 박스에 늘림 → 같은 가격 시계열이 창 높이에 따라 잔잔하거나 격렬하게 보임.
- 호가가 `·` 하나로 구분된 한 줄이고 매수/매도 시각적 구분이 없으며 잔량이 없음 — 수량 없는 가격 쌍.
- `useSnapshot` 독스트링이 스트림 에러 시 `/api/health` 원샷 폴백을 약속하지만 훅에 그런 fetch가 없음.
- `tailwind.config.ts`가 `ticker` 키프레임을 정의하는데 사용하는 컴포넌트가 없음.
- `app/layout.tsx:17` `metadata.description`이 한국어 고정이라 `lang` 쿠키와 무관하게 영어 사용자에게도 한국어로 노출.
- `price-chart.tsx:119` `Vol `과 `:114` `O/H/L/C`가 i18n 사전을 우회한 영어 리터럴.

## Questions to Consider

1. 제품의 차별점이 "수집 품질이 1급 시민"이라면, 55% 밀도 로컬 테이블에서 집계된 `volume24h`가 왜 라이브 스트림에서 직행하는 `lastPrice`와 같은 활자·크기·색으로 렌더링됩니까? 모든 숫자가 자기 출처를 지니는 마켓 카드는 어떤 모습입니까?
2. 리본은 여섯 개의 민감한 신호의 최악값으로 종합 건강을 계산합니다 — 복구율 99.9%는 주의, 한 샘플링 창의 0 msg/s는 위험. 이 대시보드는 정상적인 하루 중 몇 퍼센트를 "정상"이 아닌 상태로 보내며, 그것이 운영자에게 리본을 어떻게 다루도록 학습시킵니까?
3. README와 PRODUCT는 정보 구조가 System → Pipeline → Market이며 이를 배신하지 않겠다고 선언합니다. 라우트는 `/`에 Market을, 나머지 두 티어를 클릭 뒤에 둡니다. 무엇이 거짓입니까 — 문서입니까 내비게이션입니까?
4. 변동성은 60캔들 로그수익률의 표준편차인데 24시간 고가 / 24시간 저가 / VWAP / 24시간 거래량 줄에 앉아 있습니다. 독자는 이걸 어느 창으로 이해하겠습니까?
5. 운영자의 진짜 첫 질문이 "뭔가 잘못됐나"라면, 왜 그 답이 이동해야만 도달하는 페이지의 동일 크기 숫자 23개 안에 있습니까?
6. `/api/candles`는 이미 `from`을 반환합니다 — 저장된 데이터가 실제로 어디까지 거슬러 가는지. 이 인터페이스가 자기 커버리지에 대해 진실을 말할 수 있게 해주는 유일한 필드를, 왜 UI가 유일하게 버리는 필드로 두었습니까?
