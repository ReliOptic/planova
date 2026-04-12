# Planova — Product Requirements Document

**Version:** 0.1
**Date:** 2026-04-13
**Author:** ReliqBit

---

## 1. Problem Statement

투두리스트 + 캘린더를 병행하는 개인 사용자는 **시간을 계획하지만 결과를 측정하지 않는다.**
계획과 실제의 차이가 보이지 않기 때문에, 같은 비효율을 반복하고, 피드백 루프 없이 도구를 이탈한다.

### 1.1 Evidence

- 타임트래킹 앱 1~2주 후 이탈 급증 (BJ Fogg 행동모델 — 동기 감소 + 마찰 유지)
- 지속 가능한 일일 입력 한계: 1~2 액션 (Hook Model)
- plan-vs-actual 편차를 실시간 보여주는 개인 생산성 도구: **없음** (제조업 OEE 대시보드만 존재)

### 1.2 Target User Persona

**김프리 (32세, 프리랜서 디자이너)**
- Google Calendar + Todoist 병행, 매일 아침 계획하지만 저녁에 "오늘 뭐 했지?" 느낌
- 시간 추적 앱(Toggl) 3번 시도, 3번 포기 — "타이머 누르는 걸 까먹어요"
- 원하는 것: "적게 입력하고, 내가 시간을 어떻게 쓰는지 알고 싶어요"

---

## 2. Solution: Zero-Friction Deviation Loop

### 2.1 Design Principle

```
입력 최소 → 실행 → 완료 → 즉시 편차 피드백
  ↑                              │
  └── 다음날 어제 기반 자동 제안 ──┘
```

### 2.2 Three Layers

| Layer | 이름 | 목적 | 사용자 입력 |
|-------|------|------|------------|
| 1 | Micro-Input | 작업 생성 마찰 제거 | 1줄 텍스트 |
| 2 | Instant Deviation | 완료 즉시 편차 표시 | 0 (자동) |
| 3 | Daily Pulse | 하루 끝 자동 요약 | 0 (자동) |

---

## 3. Feature Specifications

### 3.1 Instant Deviation Display (Layer 2) — P0

**우선순위:** 최고 (MVP 핵심)
**구현 난이도:** 낮음 (데이터 이미 존재)

#### 3.1.1 동작

- 사용자가 작업을 "완료"하면, 해당 블록에 계획 대비 실제 시간 편차를 즉시 표시
- 편차 = `실제 종료 시점 - startTime` vs `durationMinutes`

#### 3.1.2 편차 색상 체계

| 편차 범위 | 색상 | 라벨 |
|-----------|------|------|
| ±5분 이내 | 초록 (`green-500`) | 정확 |
| +6~30분 | 주황 (`amber-500`) | 약간 초과 |
| +30분 초과 | 빨강 (`red-500`) | 큰 초과 |
| 음수 (일찍 종료) | 파랑 (`blue-500`) | 일찍 완료 |

#### 3.1.3 UI 사양

- 완료된 블록 하단에 편차 배지 표시: `+23분 ▲` 또는 `-10분 ▼`
- 블록 배경색이 편차 색상으로 은은하게 전환 (opacity 10%)
- 완료된 블록은 빗금(hatching) 패턴으로 구분

#### 3.1.4 데이터 소스

- `TaskViewModel.durationMinutes` — 계획
- `TaskViewModel.blockDurationMinutes` — 실제 (ScheduleBlock endTime - startTime)
- 완료 시점 기록: 완료 클릭 시간을 endTime으로 갱신

#### 3.1.5 수용 기준

- [ ] 작업 완료 시 편차 배지가 블록에 즉시 나타남
- [ ] 4가지 색상 구간이 정확히 적용됨
- [ ] 완료되지 않은 블록에는 편차가 표시되지 않음
- [ ] 편차 계산이 분 단위로 정확함

---

### 3.2 Daily Pulse Card (Layer 3) — P0

**우선순위:** 최고 (MVP 핵심)
**구현 난이도:** 낮음~중간

#### 3.2.1 동작

- 해당 날짜에 완료된 작업이 1개 이상이면 Daily Pulse 카드 표시
- workHours 종료 시간 이후 자동 표시, 또는 수동으로 언제든 열 수 있음

#### 3.2.2 카드 콘텐츠

| 항목 | 계산 | 최소 데이터 |
|------|------|------------|
| 계획 정확도 (%) | `1 - abs(Σ편차) / Σ계획시간` | 완료 1개 |
| 총 계획 vs 총 실제 | `Σ durationMinutes` vs `Σ blockDurationMinutes` | 완료 1개 |
| 빈 시간 구간 | 스케줄 블록 사이 gap 탐지 | 완료 2개 |
| 가장 초과한 작업 | max 편차 작업 | 완료 1개 |
| 가장 정확한 작업 | min abs(편차) 작업 | 완료 2개 |
| 주간 정확도 추이 | 최근 7일 정확도 spark line | 3일 이상 |

#### 3.2.3 UI 사양

- 타임라인 뷰 하단 또는 오버레이 카드
- 닫기 가능, History 탭에서도 재확인 가능
- 빈 시간 구간은 타임라인에 시각적으로 하이라이트

#### 3.2.4 수용 기준

- [ ] 완료 작업 1개 이상일 때 카드가 표시됨
- [ ] 정확도 %가 올바르게 계산됨
- [ ] 빈 시간 구간이 정확히 감지됨
- [ ] 카드를 닫아도 History에서 재확인 가능

---

### 3.3 Inline Quick Add (Layer 1) — P1

**우선순위:** 높음 (PMF 가속)
**구현 난이도:** 중간

#### 3.3.1 자연어 파서 규칙

```
패턴: "[제목] [시간] [우선순위?]"

시간 토큰:
  30m, 30min   → 30분
  1h, 1hr      → 60분
  1h30m, 1.5h  → 90분
  숫자만 (30)  → 30분으로 해석

우선순위 토큰 (선택):
  high, h, 높음  → High
  low, l, 낮음   → Low
  (없으면)       → Medium

예시:
  "회의 30m"           → {title: "회의", duration: 30, priority: "Medium"}
  "보고서 작성 2h high" → {title: "보고서 작성", duration: 120, priority: "High"}
  "점심"               → {title: "점심", duration: 60, priority: "Medium"}
```

#### 3.3.2 입력 위치

- 타임라인 빈 슬롯 클릭 시 인라인 input 표시
- TopBar에 상시 Quick Add 입력 필드
- 키보드 단축키: `N` (기존) → 인라인 포커스

#### 3.3.3 수용 기준

- [ ] 1줄 입력으로 작업 생성됨
- [ ] 파싱 결과 실시간 프리뷰 표시
- [ ] 파싱 실패 시 전체를 제목으로, duration 기본 60분
- [ ] 타임라인 슬롯 클릭 시 해당 시간에 바로 배치

---

### 3.4 Yesterday Ghosts (Layer 1) — P2

**우선순위:** 중간 (리텐션 향상)
**구현 난이도:** 중간

#### 3.4.1 동작

- 오늘 타임라인에 어제(또는 지난 같은 요일)의 블록을 옅은 고스트로 표시
- 고스트 클릭 → 오늘 블록으로 실체화 (입력 0, 클릭 1)
- pattern-detector의 weekday-time 데이터 활용

#### 3.4.2 수용 기준

- [ ] 어제 데이터 1개부터 고스트 표시
- [ ] 고스트 클릭 시 오늘 블록으로 변환
- [ ] 고스트는 시각적으로 구분 (투명도 30%, 점선 border)

---

### 3.5 Streak & Weekly Trend — P2

**우선순위:** 중간
**구현 난이도:** 낮음

#### 3.5.1 Streak 규칙

- 1일 = 1개 이상 작업 완료
- Streak Freeze: 1일 빠져도 streak 유지 (Duolingo 검증 — +0.38% 리텐션)
- 강조점은 streak 길이가 아니라 **정확도 추이**

---

## 4. Out of Scope (하지 않을 것)

| 항목 | 이유 |
|------|------|
| 팀 협업 기능 | 니치는 개인 사용자 |
| 모바일 앱 | PMF 확인 전 절대 착수 안 함 |
| 자동 타임 트래킹 | 앱 수준 추적은 프라이버시 이슈. 블록 기반 암묵 추적으로 충분 |
| Gantt / 프로젝트 관리 | PM 도구와 경쟁하지 않음 |
| 소셜 기능 / 리더보드 | 시간 관리는 개인적 행위 |
| AI 고도화 | 현재 heuristic-recommender로 충분. LLM은 보조 |

---

## 5. Implementation Roadmap

### Week 1: Core Loop (MVP)

```
Day 1-2: Instant Deviation Display
  - timeline-block.tsx 수정
  - 편차 배지 컴포넌트
  - 색상 체계 적용

Day 3-5: Daily Pulse Card
  - DailyPulse 컴포넌트
  - ScheduleBlock 집계 서비스
  - 빈 시간 gap 감지 로직
```

### Week 2: Input Reduction

```
Day 1-3: Inline Quick Add
  - 자연어 파서 (parse-task-input.ts)
  - 타임라인 인라인 입력 UI
  - TopBar Quick Add

Day 4-5: Weekly Trend
  - 7일 정확도 집계
  - Spark line 미니 차트
```

### Week 3+: PMF 검증 후 결정

```
- Yesterday Ghosts
- Streak + Streak Freeze
- PWA 배포
- 랜딩페이지
```

---

## 6. Success Metrics

| 지표 | 목표 | 측정 방법 |
|------|------|----------|
| 첫 편차 표시까지 시간 | < 5분 | 첫 작업 완료 시점 |
| 7일 리텐션 | > 30% | Daily Pulse 확인 유무 |
| 주간 정확도 개선 | Week 2 > Week 1 | 정확도 % 추이 |
| Quick Add 사용 비율 | > 50% (모달 대비) | 작업 생성 경로 |
