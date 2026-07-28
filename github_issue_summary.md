# Context Bridge MVP 진행 상황

## 현재까지 진행한 작업

- Context Bridge의 핵심을 **답변 생성 AI가 아니라, 사용자의 짧은 자연어 입력을 고급 프롬프트로 바꾸는 입력 보조 서비스**로 재정의했습니다.
- 포용적 AI 관점에서 AI 활용 격차의 원인을 “모델 접근성”뿐 아니라 “좋은 입력을 만들 수 있는 능력의 차이”로 정리했습니다.
- `plan.md`, `mvp_spec.md`, `next_steps.md`에 기획, MVP 범위, 남은 작업을 정리했습니다.
- 초기 단일 파일 프로토타입은 `prototype.html`로 보존했습니다.
- Vite + React + TypeScript + Tailwind 구조로 앱을 전환했습니다.
- 주요 구조를 분리했습니다.
  - `src/data`: 사용자 프로필, 의도 규칙, 프롬프트 템플릿
  - `src/services`: 의도 분석, 맥락 선택, 프롬프트 생성, 품질 분석, UI 모드 판정
  - `src/components`: 화면 컴포넌트
- Prompt Quality 패널을 추가해서 원래 질문과 고급 프롬프트의 차이를 보이게 했습니다.
- 사용자 맞춤 UI 모드를 추가했습니다.
  - 쉬운 모드: 노인, 어린이, 비전공자처럼 큰 글씨와 단순한 흐름이 필요한 사용자
  - 기본 모드: 일반 사용자
  - 상세 모드: 발표/확장용으로 준비할 수 있는 고급 사용자 모드
- 접근성 방향에 맞춰 과한 그림자와 장식 배경을 제거하고, 흰 배경과 명확한 경계 중심의 깔끔한 UI로 정리했습니다.

## 배포

- Vercel 프로덕션 배포 완료
- 배포 URL: https://sleepabc.vercel.app
- 생성 URL: https://sleep-jwq3038dv-poreer0597-9440s-projects.vercel.app

## 검증

- `npm install` 완료
- `npm run build` 성공
- 브라우저 테스트로 다음 흐름을 확인했습니다.
  - 프로필 선택
  - 질문 분석
  - Context Preview
  - 고급 프롬프트 생성
  - Prompt Quality 표시
  - 쉬운 모드/기본 모드 전환
  - 프로필 관리, 사용 기록 화면 이동
- Vercel 배포 후 HTTP 200 응답을 확인했습니다.

## 다음 작업 후보

1. Prompt Quality를 점수만이 아니라 체크리스트 형태로 개선
2. 쉬운 모드 모바일 화면 추가 점검
3. 상세 모드 정의 및 발표용 표시 항목 구성
4. 실제 LLM API 기반으로 `intentAnalyzer`, `contextSelector`, `promptComposer` 교체
5. GitHub 이슈/README 기준으로 발표 자료 구조 정리

## 핵심 메시지

Context Bridge는 답을 대신 주는 AI가 아닙니다. AI를 잘 쓰는 사람이 직접 넣었을 법한 목적, 조건, 제약, 출력 형식을 보완해서 **사용자의 짧은 입력을 더 좋은 AI 명령문으로 바꾸는 포용적 AI 서비스**입니다.
