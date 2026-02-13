# Work Order: BottomNav FAB 확장 메뉴 + Duty 탭 구현

## 개요
BottomNav를 개편하여 가운데 FAB(Floating Action Button)를 추가하고, Crew 탭을 제거한 자리에 Duty(FAR 117) 탭을 배치한다. FAB를 누르면 네비 바가 위로 확장되며 바로가기 메뉴(Crew/Hotel, Schedule, Settings)가 나타난다.

## 변경 전후 비교

### Before
```
Dashboard | Schedule | Briefing | Crew | Settings
```

### After
```
Dashboard | Schedule | [+] | Briefing | Duty
                       ↑
              탭하면 nav bar 위로 확장
         ┌──────────────────────────────┐
         │ 👥 Crew/Hotel │ 📤 Schedule │ ⚙️ Settings │
         └──────────────────────────────┘
         Dashboard | Schedule | [×] | Briefing | Duty
```

---

## 작업 1: BottomNav.tsx 수정

**파일:** `frontend/src/components/layout/BottomNav.tsx`

### 변경 사항

1. navItems 배열 변경:
```typescript
const navItems = [
  { href: "/", label: "Dashboard", icon: "dashboard" },
  { href: "/schedule", label: "Schedule", icon: "calendar_month" },
  // 가운데 = FAB (index 2 위치에 삽입)
  { href: "/briefing", label: "Briefing", icon: "cloud" },
  { href: "/duty", label: "Duty", icon: "calculate" },
];
```

2. FAB 버튼 구현:
- 가운데 위치에 원형 버튼 (w-14 h-14, -mt-7로 네비 바 위로 돌출)
- 닫힌 상태: 파란 그라데이션 (`from-blue-600 to-blue-500`), + 아이콘
- 열린 상태: 빨간 그라데이션 (`from-red-600 to-red-500`), + 아이콘이 45도 회전하여 × 형태
- 그림자: `shadow-lg`, 파란/빨간 컬러 shadow
- 트랜지션: `transition-all duration-300`

3. 확장 패널:
- FAB 열림 시 nav bar 바로 위에 패널이 올라옴 (maxHeight 트랜지션)
- 패널 스타일: `bg-zinc-900 border-t border-x border-zinc-800 rounded-t-2xl`
- 내부 `grid grid-cols-3 gap-3`으로 3개 버튼 배치
- 각 버튼: `rounded-2xl bg-zinc-800/60 border border-zinc-700/50` 안에 아이콘 + 라벨
- 버튼 등장 시 staggered 애니메이션 (translateY + opacity, delay 50ms씩)
- 패널 바깥 클릭 시 닫힘 (backdrop: `fixed inset-0 bg-black/50 backdrop-blur-sm z-40`)

4. 확장 메뉴 아이템 (3개):
```typescript
const expandedMenuItems = [
  { id: "crew", label: "Crew/Hotel", icon: "group", color: "from-emerald-600 to-emerald-400" },
  { id: "schedule", label: "Schedule", icon: "event_note", color: "from-blue-600 to-blue-400" },
  { id: "settings", label: "Settings", icon: "settings", color: "from-zinc-500 to-zinc-400" },
];
```

5. 메뉴 아이템 클릭 동작:
- `crew` → Crew/Hotel 바텀시트 모달 열기 (아래 작업 2 참고)
- `schedule` → `router.push("/schedule")` 로 페이지 이동
- `settings` → `router.push("/settings")` 로 페이지 이동

6. z-index 구조:
- backdrop: z-40
- 확장 패널 + nav bar: z-50
- 모달: z-60, z-70

### 참고: 기존 BottomNav 전체 코드 (현재 40줄)
```typescript
// 현재 구조가 단순한 navItems.map() → Link 렌더링이므로
// FAB 관련 state와 확장 패널 JSX를 추가하는 형태.
// usePathname()은 그대로 유지, Link 대신 일부는 button으로 변경 가능.
```

---

## 작업 2: Crew/Hotel 바텀시트 모달

**신규 파일:** `frontend/src/components/quicktools/CrewHotelSheet.tsx`

### 동작
- FAB 메뉴에서 "Crew/Hotel" 탭 시 바텀시트(slide-up) 모달로 열림
- 기존 `app/crew/page.tsx`의 로직을 재사용 (scheduleStore에서 pairings 가져와서 crew + hotel 렌더링)
- 현재/다음 트립의 crew와 hotel 정보만 간략히 보여줌

### UI 구조
```
┌───────────────────────────┐
│         ── (handle)        │
│  👥 Crew / Hotel    [×]   │
│                            │
│  Day 1 · Feb 15 (Sat)     │
│  ┌─ CA  J. Smith  #10234 ─┐│
│  ├─ FO  You              ─┤│
│  └─ FA  M. Johnson #20567─┘│
│  🏨 Hilton Garden Inn      │
│     +1-310-555-0123        │
│                            │
│  Day 2 · Feb 16 (Sun)     │
│  ...                       │
└───────────────────────────┘
```

### 모달 스타일
- 배경: `fixed inset-0 bg-black/70 backdrop-blur-sm z-[60]` (클릭 시 닫힘)
- 시트: `fixed bottom-0 left-0 right-0 z-[70]`
- 컨테이너: `max-w-lg mx-auto bg-zinc-900 rounded-t-3xl border-t border-x border-zinc-700 max-h-[85vh] overflow-y-auto`
- 슬라이드업 애니메이션: `@keyframes slideUp { from { transform: translateY(100%); opacity: 0; } to { transform: translateY(0); opacity: 1; } }`
- 핸들: `w-10 h-1 bg-zinc-700 rounded-full` 상단 중앙
- 닫기 버튼: `w-9 h-9 rounded-xl bg-zinc-800` 우측 상단

### 데이터 소스
```typescript
import { useScheduleStore } from "@/stores/scheduleStore";
// 기존 crew/page.tsx의 useMemo 로직을 그대로 가져오거나,
// 공통 hook으로 추출: useCrewHotelData()
```

---

## 작업 3: Duty 페이지 (FAR 117)

**신규 파일:** `frontend/src/app/duty/page.tsx`

이 페이지는 3개 섹션으로 구성된다:
1. **FDP 현황** — 현재 on duty 상태일 때 실시간 FDP 표시
2. **누적 한도** — 28일/365일 비행시간 요약
3. **Pickup Simulator** — 추가 비행 수락 시 한도 초과 여부 판단 도구

### 페이지 전체 레이아웃
```
┌─────────────────────────────────────────┐
│ Duty                    §117 Table ▸    │
├─────────────────────────────────────────┤
│ FDP STATUS (on duty일 때만 표시)         │
│ 10h 48m / 12h max         1h 12m left  │
│ ████████████████████░░░░           90%  │
│ Est. Release 17:48 · Max 18:00         │
├─────────────────────────────────────────┤
│ CUMULATIVE                              │
│ 28d Flight Time  72h / 100h  ███████░░  │
│ 365d Flight Time 814h / 1000h ████████░ │
│ Last 56h+ rest: Feb 8 (4 days ago) ✅  │
├─────────────────────────────────────────┤
│ PICKUP SIMULATOR                        │
│ [Early 2] [Mid 3] [Late 3] [Red-eye]   │ ← 프리셋 칩
│                                         │
│ Report     Legs     Block               │ ← 스테퍼
│ [05:00]    [2]      [4:00]              │
│                                         │
│ ┌─ Result ─────────────────────────┐    │
│ │ FDP: 5h 00m / 12h max     ✅    │    │
│ │ 28d after: 76h / 100h           │    │
│ │ Rest gap: 18h (≥10h ✅)         │    │
│ │ Pickup OK                        │    │
│ └──────────────────────────────────┘    │
│                                         │
│ ⚠️ Reference only.                      │
└─────────────────────────────────────────┘
```

---

### 섹션 A: FDP 현황 (on duty)

- 스케줄 데이터에서 오늘이 duty day인 경우에만 표시
- 표시 항목: 현재 FDP 경과 시간, FDP 상한, 남은 시간, Est. Release, Max Release
- 프로그레스 바 + 색상 변화 (normal → warning → critical)
- on duty가 아니면 이 섹션은 숨기거나 "No active duty" 간단히 표시
- 딜레이 시뮬레이션은 여기에 간단히 포함:
  - 칩 버튼: +30m, +60m, +90m, +120m
  - 탭하면 FDP + delay로 재계산, 상한 초과 시 ⚠️/🚨 표시
  - §117.19 Unforeseen Circumstances 연장 (+2h) 안내

### 섹션 B: 누적 한도

- 28일 비행시간 / 100h — 프로그레스 바
- 365일 비행시간 / 1,000h — 프로그레스 바
- 최근 56h 연속 레스트 충족 여부 + 날짜
- 스케줄 데이터 기반. 스케줄 없으면 "Upload schedule to track" 표시

### 섹션 C: Pickup Simulator

핵심 도구. Off duty일 때 "이 트립 픽업하면 괜찮아?"를 판단.

#### 입력 방식 (3단계 우선순위)

**1순위: 스케줄 자동 채우기**
- scheduleStore에 pairings가 있으면, 다음 예정 duty의 값을 기본값으로 세팅
- 유저가 변경 가능

**2순위: 프리셋 칩**
- 스테퍼 바로 위에 수평 한 줄로 배치
- Briefing Day 탭 버튼과 동일한 크기/스타일
- 탭하면 스테퍼 값이 해당 프리셋으로 채워짐 (값만 바뀌고 계산 즉시 반영)

```typescript
const PRESETS = [
  { label: "Early 2", reportH: 5, reportM: 0, legs: 2, blockH: 4, blockM: 0 },
  { label: "Mid 3",   reportH: 7, reportM: 0, legs: 3, blockH: 6, blockM: 0 },
  { label: "Late 3",  reportH: 14, reportM: 0, legs: 3, blockH: 5, blockM: 0 },
  { label: "Red-eye", reportH: 22, reportM: 0, legs: 2, blockH: 4, blockM: 0 },
];
```

프리셋 칩 스타일:
```
- 비활성: bg-zinc-800 text-zinc-400 hover:bg-zinc-700
- 활성 (선택됨): bg-blue-600 text-white
- 크기: px-3 py-1.5 rounded-lg text-xs font-bold
- 한 줄에 수평 배치, 4개 이하이므로 overflow 불필요. flex gap-2.
```

**3순위: 스테퍼 수동 조정**
- Report Time — 30분 단위 +/- (기존과 동일)
- Legs — 1-9 (기존과 동일)
- Block Time — 15분 단위 +/- (기존과 동일)

#### 계산 및 결과 표시

Pickup 시뮬레이션은 단순 FDP 계산이 아니라 **3가지를 동시에 체크**:

1. **FDP 체크** — 입력한 report time + legs → Table B 룩업 → 예상 FDP가 상한 이내인지
2. **28일 누적 체크** — 현재 28일 비행시간 + 픽업 block time → 100h 이내인지
3. **레스트 간격 체크** — 마지막 release ~ 픽업 report 사이 레스트가 10h 이상인지

결과 카드:
```
┌────────────────────────────────────────┐
│ FDP      5h 00m / 12h         ✅       │
│ 28d      76h / 100h           ✅       │
│ Rest gap 18h (≥10h)           ✅       │
│                                        │
│          ✅ Pickup OK                  │
└────────────────────────────────────────┘
```

또는 한 항목이라도 실패하면:
```
┌────────────────────────────────────────┐
│ FDP      5h 00m / 12h         ✅       │
│ 28d      97h / 100h           ⚠️       │
│ Rest gap 8h (<10h)            🚨       │
│                                        │
│          🚨 Cannot Pick Up             │
│  Minimum 10h rest not met              │
└────────────────────────────────────────┘
```

결과 카드 스타일:
- 모두 통과: `bg-emerald-950/20 border-emerald-800/30`
- 경고 있음: `bg-amber-950/20 border-amber-800/30`
- 불가: `bg-red-950/20 border-red-800/30`

#### 스케줄 없는 유저 대응

- FDP 체크: 항상 가능 (입력값만으로 계산)
- 28일 누적: "Schedule required" 표시, 이 항목은 스킵
- 레스트 간격: "Schedule required" 표시, 이 항목은 스킵
- 즉, 스케줄 없으면 FDP 결과만 보여주고 나머지는 비활성

### FDP Table B 참조 데이터 (하드코딩)

```typescript
const FDP_TABLE = [
  { range: [0, 3],   limits: [9, 9, 9, 9, 9, 9] },
  { range: [4, 4],   limits: [10, 10, 10, 9, 9, 9] },
  { range: [5, 5],   limits: [12, 12, 11, 11, 10, 9] },
  { range: [6, 6],   limits: [13, 13, 12, 12, 11, 10] },
  { range: [7, 12],  limits: [14, 14, 13, 13, 12, 11] },
  { range: [13, 16], limits: [13, 13, 12, 12, 11, 10] },
  { range: [17, 21], limits: [12, 12, 11, 11, 10, 9] },
  { range: [22, 23], limits: [11, 11, 10, 10, 9, 9] },
];
// 행: report hour (acclimated local), 열: [1-2legs, 3legs, 4legs, 5legs, 6legs, 7+legs]
```

### Table B 뷰어 (접이식)

- 페이지 상단 우측 "§117 Table" 버튼 탭 시 접이식(collapsible)으로 Table B 전체 표시
- 현재 스테퍼에 입력된 report hour + legs에 해당하는 셀 하이라이트 (bg-blue-900/20 text-blue-300)
- 닫은 상태가 기본

### 면책 조항

- 페이지 최하단: "⚠️ Reference only. Does not replace official duty time calculations. Augmented crew, split duty, and UOC extensions may apply."

---

## 작업 4: Dashboard FDP 요약 카드

**파일:** `frontend/src/app/page.tsx` (Dashboard)

### 변경 사항
기존 대시보드 카드들 사이에 FDP STATUS 카드 추가. 위치는 Block Hours 카드 아래, Next Flight 카드 위.

### 카드 UI
```
┌─────────────────────────────────────────┐
│ FDP STATUS              ✅ Within Limits │
│ 6h 30m / 13h                6h 30m left │
│ ████████░░░░░░░░░░░░░░            50%   │
│ 3 legs · Report 07:00   Tap for more → │
└─────────────────────────────────────────┘
```

### 스타일
- `bg-gradient-to-r from-blue-900/20 to-zinc-900 rounded-xl p-4 border border-blue-800/20`
- 탭 시 `/duty` 페이지로 이동 (Link 컴포넌트)
- 스케줄 데이터 없으면 이 카드 자체를 숨기거나, "Upload schedule to see FDP" 표시

### 데이터
- 지금은 스케줄 데이터에서 오늘의 report time, legs 수, block time을 가져와서 계산
- scheduleStore의 pairings에서 오늘 날짜 day를 찾아서 추출
- FDP 계산 로직은 Duty 페이지와 동일한 함수를 공유 (lib/far117.ts로 분리 권장)

---

## 작업 5: FDP 계산 유틸리티

**신규 파일:** `frontend/src/lib/far117.ts`

### 공유 함수들
```typescript
// ── 데이터 ──
export const FDP_TABLE = [...];

export const PICKUP_PRESETS = [
  { label: "Early 2", reportH: 5, reportM: 0, legs: 2, blockH: 4, blockM: 0 },
  { label: "Mid 3",   reportH: 7, reportM: 0, legs: 3, blockH: 6, blockM: 0 },
  { label: "Late 3",  reportH: 14, reportM: 0, legs: 3, blockH: 5, blockM: 0 },
  { label: "Red-eye", reportH: 22, reportM: 0, legs: 2, blockH: 4, blockM: 0 },
];

// ── FDP 계산 ──

// report hour + legs → FDP 상한 (시간)
export function getFdpLimit(reportHour: number, numLegs: number): number;

// 시간 포맷: 6.5 → "6h 30m"
export function formatFdpTime(hours: number): string;

// 시간 더하기: "07:00" + 6.5h → "13:30"
export function addHoursToTime(timeStr: string, hours: number): string;

// FDP 상태 판단
export type FdpStatus = "normal" | "warning" | "extend" | "critical";
export function getFdpStatus(currentFdp: number, fdpLimit: number): FdpStatus;

// ── Pickup Simulator ──

export interface PickupInput {
  reportH: number;
  reportM: number;
  legs: number;
  blockH: number;
  blockM: number;
}

export interface PickupResult {
  // FDP 체크
  fdpHours: number;      // 예상 FDP (block + 1h)
  fdpLimit: number;      // Table B 상한
  fdpOk: boolean;

  // 28일 누적 (스케줄 있을 때만)
  flight28d: number | null;      // 현재 28일 누적
  flight28dAfter: number | null; // 픽업 후 28일 누적
  flight28dOk: boolean | null;   // null = 스케줄 없음

  // 레스트 간격 (스케줄 있을 때만)
  restGapHours: number | null;   // 마지막 release ~ 픽업 report
  restGapOk: boolean | null;     // null = 스케줄 없음

  // 종합
  canPickup: boolean;    // 모든 체크 통과 (null 항목은 스킵)
  warnings: string[];
}

// 픽업 시뮬레이션 실행
export function simulatePickup(
  input: PickupInput,
  scheduleData?: {
    flightTime28d: number;     // 현재 28일 누적 비행시간
    lastReleaseUtc: string;    // 마지막 release 시각 (ISO)
  }
): PickupResult;

// ── 스케줄에서 현재 상태 추출 ──

// pairings에서 오늘의 duty 정보 추출
export function getTodayDuty(pairings: Pairing[]): {
  reportTime: string | null;  // "07:00"
  releaseTime: string | null;
  legs: number;
  blockHours: number;
  isOnDuty: boolean;
} | null;

// pairings에서 누적 비행시간 계산
export function getCumulativeFlightTime(
  pairings: Pairing[],
  windowDays: number  // 28 or 365
): number;

// pairings에서 마지막 release 시각 가져오기
export function getLastRelease(pairings: Pairing[]): string | null;
```

---

## 파일 변경 요약

| 파일 | 작업 |
|:---|:---|
| `components/layout/BottomNav.tsx` | FAB + 확장 패널로 전면 개편 |
| `components/quicktools/CrewHotelSheet.tsx` | **신규** — 바텀시트 모달 |
| `app/duty/page.tsx` | **신규** — FDP 현황 + 누적 한도 + Pickup Simulator |
| `app/page.tsx` (Dashboard) | FDP STATUS 카드 추가 |
| `lib/far117.ts` | **신규** — FDP 계산 + Pickup 시뮬 + 스케줄 데이터 추출 유틸 |
| `app/crew/page.tsx` | **유지** (바텀시트와 병존, 추후 제거 가능) |
| `app/settings/page.tsx` | **변경 없음** (FAB에서 라우팅으로 접근) |
| `components/layout/AppShell.tsx` | **변경 없음** |

## 구현 순서 권장

1. `lib/far117.ts` — 공유 유틸 먼저 (다른 작업에서 import)
2. `BottomNav.tsx` — FAB + 확장 패널 (앱 전체 네비 구조 변경)
3. `app/duty/page.tsx` — Duty 페이지 (Pickup Simulator 포함)
4. `app/page.tsx` — Dashboard FDP 카드 추가
5. `components/quicktools/CrewHotelSheet.tsx` — 바텀시트 모달

## 스타일 규칙 (기존 앱과 통일)

- 다크 모드 기본: `bg-zinc-900`, `border-zinc-800`, `text-zinc-400/500`
- 액센트: `text-blue-400`, `bg-blue-600`
- 카드: `bg-zinc-900 rounded-xl p-4 border border-zinc-800`
- 강조 카드: `bg-gradient-to-r from-blue-900/40 to-zinc-900 border-blue-800/30`
- 폰트: 숫자/시간은 `font-mono font-bold`, 라벨은 `text-xs text-zinc-500`
- 버튼: `rounded-xl`, active 시 `active:scale-95` 또는 `active:bg-zinc-800`
- 라이트 모드: globals.css에 CSS 변수로 자동 전환되므로 별도 처리 불필요
- Material Icons 사용 (`<span className="material-icons">아이콘명</span>`)

## 프로토타입 참고

아래 파일들이 동작과 로직을 보여주는 참고 자료이다. 디자인과 인터랙션을 참고하되, MFA의 기존 구조(Next.js App Router, TypeScript, scheduleStore 등)에 맞게 적용할 것.

- `docs/work_order/fab-expanding-nav.jsx` — BottomNav FAB + 확장 패널 + 모달 인터랙션 프로토타입
- `docs/work_order/far117-reference.py` — FAR 117 백엔드 계산 로직 (Python). FDP Table B, 딜레이 시뮬, 픽업 시뮬 로직 참고. 프론트 유틸(`lib/far117.ts`)로 TypeScript 변환 시 이 로직을 기반으로 할 것.

## 주의사항

1. **Crew 페이지 라우트는 유지** — `/crew`로 직접 접근하는 유저가 있을 수 있으니 당장 삭제하지 말 것. BottomNav에서만 빠지면 됨.
2. **FDP 계산은 프론트 온리** — 백엔드 API 호출 없음. 모든 계산이 클라이언트에서 수행됨.
3. **스케줄 없는 유저 대응** — Dashboard FDP 카드와 Duty 페이지 모두 스케줄 데이터 없이도 수동 입력으로 동작해야 함. Pickup Simulator의 28d 누적, 레스트 간격 체크는 스케줄 없으면 "Schedule required"로 비활성.
4. **라이트 모드 호환** — globals.css의 CSS 변수 체계를 따르면 자동으로 적용됨. 하드코딩된 색상(예: 그라데이션) 외에는 특별히 신경 쓸 것 없음.
5. **FAB 확장 패널 높이** — 아이템 3개 한 줄이므로 패널 높이는 약 120-140px. maxHeight 트랜지션으로 열고 닫기.
6. **Pickup 프리셋 값은 잠정적** — SkyWest CRJ 기준 추정값이므로, 파일럿 피드백 후 조정될 수 있음. PRESETS 배열을 수정하기 쉽게 `lib/far117.ts`에 분리해둘 것.
