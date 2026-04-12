# Planova

오프라인-우선 비주얼 타임라인 스케줄러. Windows 11 데스크톱 앱. 로컬 저장, 로그인 없음.

## Features

- **15분 스냅 드래그앤드롭 타임라인** — 백로그에서 일정으로 작업을 드래그하고, 타임라인 위에서 위치 조정 및 리사이즈.
- **Task 4상태 라이프사이클** — Pending → Scheduled → In Progress → Completed.
- **블록 리사이즈 및 오버듀 감지** — 시작/종료 시간 드래그로 수정, 마감 지난 작업 자동 플래그.
- **계획 / 실제 분리** — `Task.durationMinutes`는 계획, `ScheduleBlock`은 실제 배치. 블록 리사이즈가 플랜을 덮어쓰지 않음.
- **현재 시간 마커** — 오늘의 타임라인에 빨간 선으로 현재 위치 표시.
- **100% 오프라인** — IndexedDB(WebView2 내부) 로컬 저장, 서버 없음, 로그인 없음.
- **네이티브 JSON Export/Import 백업** — OS 파일 다이얼로그로 데이터 내보내기 및 복원.
- **선택적 OpenRouter AI 통합** — 사용자 API 키로 모델 선택, 오프라인 시 자동 비활성.
- **주기성 기반 작업 추천** — 완료 히스토리에서 요일/시간 패턴을 로컬로 감지, 온라인일 때 LLM이 자연어 문장으로 포장.

## Tech Stack

- **Shell:** Tauri 2 (Rust) on Windows 11 WebView2
- **Frontend:** React 19 + TypeScript strict, Vite 6, Tailwind CSS v4
- **Storage:** Dexie (IndexedDB in WebView2 profile)
- **Drag & Drop:** dnd-kit
- **Animations:** Motion
- **Sanitization:** DOMPurify
- **Tests:** Vitest + happy-dom

## Prerequisites

- **Node.js** 20+
- **Rust** 1.77+ (install via https://rustup.rs)
- **Visual Studio Build Tools 2022** with the "Desktop development with C++" workload
- **WebView2 Runtime** — ships with Windows 11 by default
- (Optional) **WiX Toolset 3.14** or **NSIS** — Tauri's bundler will download these on first `tauri build` if absent

## Development

```bash
npm install
npm run tauri:dev     # boots Vite dev server + Tauri shell
```

On first run Rust downloads and compiles dependencies into `src-tauri/target/` — expect several minutes. Subsequent runs are fast.

## Build (MSI + NSIS installers)

```bash
npm run tauri:build
```

Artifacts land in `src-tauri/target/release/bundle/`:

- `msi/Planova_*_x64_en-US.msi`
- `nsis/Planova_*_x64-setup.exe`

### 코드 사이닝

현재 빌드는 **미서명**입니다. Windows SmartScreen이 첫 실행 시 경고를 표시할 수 있으며, "자세히 → 실행"으로 넘길 수 있습니다. 향후 Azure Trusted Signing 또는 OV 인증서로 서명할 계획입니다.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Vite dev server only (localhost:3000) — 보통 `tauri:dev`에서 간접 호출됨 |
| `npm run build` | Vite 프로덕션 번들 (`dist/`) — `tauri:build`가 전처리로 호출 |
| `npm run preview` | 브라우저에서 프로덕션 번들 프리뷰 (디버깅용) |
| `npm run lint` | TypeScript `tsc --noEmit` |
| `npm test` | Vitest 유닛·통합 스위트 |
| `npm run tauri:dev` | Tauri 데스크톱 앱 개발 실행 |
| `npm run tauri:build` | MSI + NSIS 인스톨러 빌드 |
| `npm run clean` | `dist/` 제거 |

## Data Location

모든 사용자 데이터는 Windows의 WebView2 프로필 내부 IndexedDB에 저장됩니다:

```
%LOCALAPPDATA%\com.planova.app\EBWebView\Default\IndexedDB\
```

앱 언인스톨러는 이 디렉터리를 삭제하지 않습니다. 완전히 지우려면 수동 삭제하세요.

## Backup / Restore

Settings → 백업 / 복원

- **내보내기** — 네이티브 저장 다이얼로그로 JSON 파일 저장
- **가져오기** — 네이티브 열기 다이얼로그에서 JSON 선택 → "교체" 또는 "병합"

백업 파일에는 Task + ScheduleBlock만 포함됩니다 (AI 키, 로그, 캐시 제외).

## AI Assistant (Optional)

Settings → AI 어시스턴트

- OpenRouter API 키와 원하는 모델 ID 입력
- 네트워크 연결 시에만 동작, 오프라인 시 자동 비활성
- 클라이언트 측 요청 제한 (10 req / 10 분) 및 24시간 응답 캐시
- **주기성 작업 추천**: 완료된 ScheduleBlock 4주분 이상 + 10건 이상 쌓이면 활성화

**경고**: API 키는 WebView2 프로필 내 IndexedDB에 평문 저장됩니다. 공용 PC에서는 사용하지 마세요. OS 키링 이전은 Phase 4 항목으로 연기되어 있습니다.

모델 예시: `mistralai/mistral-small-latest`, `google/gemini-2.0-flash-lite`, `openai/gpt-4o-mini`. OpenRouter 대시보드에서 사용량/비용 확인.

## Security

- Content Security Policy는 `src-tauri/tauri.conf.json`의 `app.security.csp`에서 관리.
- 외부 네트워크 연결은 `https://openrouter.ai`만 허용.
- Tauri capabilities(`src-tauri/capabilities/main.json`)에서 파일 시스템은 사용자의 Documents / Downloads / Desktop / Home 하위로 제한.
- 싱글 인스턴스 강제 (두 번째 실행 시 기존 창에 포커스).

## Project Layout

```
src/                 React 프런트엔드 (도메인/서비스/컴포넌트 계층)
  domain/            순수 타입 및 팩토리 (Task, ScheduleBlock, ExternalCalendarEvent 등)
  services/          애플리케이션 서비스 (view-model, backup, recommendation)
  infrastructure/    Dexie 리포지터리, OpenRouter 클라이언트, 로거
  hooks/             React 훅 (드래그, 리사이즈, CRUD)
  components/        UI 컴포넌트
src-tauri/           Tauri 2 Rust 셸
  src/lib.rs         싱글 인스턴스 + 파일 다이얼로그 플러그인
  tauri.conf.json    CSP, 번들 설정, 창 설정
  capabilities/      Tauri capability(권한) 정의
tests/unit/          Vitest 유닛 테스트
```
