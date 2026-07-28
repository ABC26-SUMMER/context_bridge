import { ContextItem, PresetProfile } from '../types';

export const INITIAL_CONTEXTS: ContextItem[] = [
  {
    id: 'ctx-1',
    title: '개발 언어 및 프레임워크',
    category: 'profile',
    content: '주력 언어: TypeScript, React, Node.js / 백엔드 경험: Express, Python, PostgreSQL',
    tags: ['개발', '기술스택', '프로그래밍'],
    isActive: true,
    privacyLevel: 'normal',
    updatedAt: '2026-03-01T00:00:00.000Z',
  },
  {
    id: 'ctx-2',
    title: '코드 작성 원칙 (제약사항)',
    category: 'constraint',
    content: '1. 불필요한 설명 생략하고 완성된 코드 위주 제공\n2. TypeScript 타입 엄격 적용 및 any 사용 금지\n3. 함수형 컴포넌트 및 React Hooks 표준 준수',
    tags: ['클린코드', '코딩스타일', 'TypeScript'],
    isActive: true,
    privacyLevel: 'normal',
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'ctx-3',
    title: '답변 스타일 선호도',
    category: 'preference',
    content: '서론/결론의 형식적인 인사는 생략하고 핵심 요약 bullet point 위주로 작성할 것. 한국어로 친절하고 명확하게 답변.',
    tags: ['답변스타일', '커뮤니케이션'],
    isActive: true,
    privacyLevel: 'normal',
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'ctx-4',
    title: '식이 제한 및 생활 목표',
    category: 'constraint',
    content: '유당 불내증(Lactose intolerant)이 있음. 우유/치즈 제외 레시피 필요. 주 3회 헬스 진행 중.',
    tags: ['건강', '식단', '목표'],
    isActive: true,
    privacyLevel: 'sensitive',
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'ctx-5',
    title: '2026년 상반기 핵심 목표',
    category: 'goal',
    content: '사용자 통제형 개인화 AI 서비스 "Context Bridge" 성공적 구축 및 오픈소스 공개. 클라우드 비용 최적화.',
    tags: ['목표', '프로젝트', 'AI'],
    isActive: true,
    privacyLevel: 'normal',
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'ctx-6',
    title: '프로젝트 맥락 - Context Bridge',
    category: 'project',
    content: '사용자가 자신의 데이터/맥락을 주도적으로 통제하고, 질문할 때 필요한 정보만 선택적으로 승인하여 AI에 전달하는 차세대 통제형 AI 솔루션.',
    tags: ['ContextBridge', 'AI', '기획'],
    isActive: true,
    privacyLevel: 'confidential',
    updatedAt: new Date().toISOString(),
  }
];

export const PRESET_PROFILES: PresetProfile[] = [
  {
    id: 'preset-developer',
    name: '풀스택 개발자 프로필',
    description: 'TypeScript, Clean Code, 핵심 위주의 빠른 답변 설정',
    iconName: 'Code',
    items: [
      {
        title: '직무 및 기술 스택',
        category: 'profile',
        content: 'senior Full-stack Engineer (React, Next.js, TypeScript, Node.js, TailWindCSS)',
        tags: ['IT', '개발'],
        isActive: true,
        privacyLevel: 'normal'
      },
      {
        title: '코드 품질 제약조건',
        category: 'constraint',
        content: '타입 안전성 strict, 가독성 높은 리팩토링 및 엣지케이스 에러 핸들링 포함',
        tags: ['코드품질'],
        isActive: true,
        privacyLevel: 'normal'
      },
      {
        title: '간결한 톤앤매너',
        category: 'preference',
        content: '장황한 서론 생략, 코드와 핵심 원인 위주 명확하게 답변',
        tags: ['스타일'],
        isActive: true,
        privacyLevel: 'normal'
      }
    ]
  },
  {
    id: 'preset-product-manager',
    name: '기획자 & PM 프로필',
    description: '사용자 중심 사고, 구조화된 문서화, 데이터 기반 판단',
    iconName: 'Briefcase',
    items: [
      {
        title: '직무 역량',
        category: 'profile',
        content: 'Product Manager (IT SaaS, B2B/B2C 서비스 기획, 지표 분석)',
        tags: ['기획', 'PM'],
        isActive: true,
        privacyLevel: 'normal'
      },
      {
        title: '문서 작성 프레임워크',
        category: 'preference',
        content: 'PRD, 문제 정의(Problem Statement), 사용자 여정(User Journey) 포맷 적극 활용',
        tags: ['문서화'],
        isActive: true,
        privacyLevel: 'normal'
      },
      {
        title: '의사결정 기준',
        category: 'goal',
        content: 'ROI 및 사용자 리텐션을 최우선 지표로 고려한 의사결정안 제시',
        tags: ['지표'],
        isActive: true,
        privacyLevel: 'normal'
      }
    ]
  },
  {
    id: 'preset-fitness',
    name: '건강 & 웰니스 프로필',
    description: '식단 제약사항 및 운동 목표 관리',
    iconName: 'Activity',
    items: [
      {
        title: '식단 알레르기 및 제약',
        category: 'constraint',
        content: '유당 불내증, 유제품 및 정제당 섭취 최소화, 고단백 식이 선호',
        tags: ['건강', '식단'],
        isActive: true,
        privacyLevel: 'sensitive'
      },
      {
        title: '피트니스 루틴',
        category: 'goal',
        content: '주 4회 근력 운동, 매일 8000보 걷기, 체지방 감량 목표',
        tags: ['운동'],
        isActive: true,
        privacyLevel: 'normal'
      }
    ]
  }
];
