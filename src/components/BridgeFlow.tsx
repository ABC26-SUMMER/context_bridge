const steps = [
  {
    title: "계정 프로필 저장",
    body: "사용자 정보는 코드 상수 대신 Supabase 프로필 데이터로 관리할 수 있게 준비합니다.",
  },
  {
    title: "백엔드 의도 분석",
    body: "질문 키워드로 학습 계획, 외출 추천, 사용 방법 안내 같은 의도를 판정합니다.",
  },
  {
    title: "규칙 매칭·필터링",
    body: "질문에 필요한 정보만 고르고, 민감할 수 있는 정보는 기본 제외합니다.",
  },
  {
    title: "사용자 승인 후 전달",
    body: "사용자가 체크한 정보만 최종 프롬프트에 포함해 LLM에 전달합니다.",
  },
];

export function BridgeFlow() {
  return (
    <section className="mt-5 grid grid-cols-4 gap-3 max-lg:grid-cols-1" aria-label="Context Bridge 처리 흐름">
      {steps.map((step, index) => (
        <div key={step.title} className="relative grid min-h-28 content-start gap-2 border border-line bg-white p-4">
          <div className="grid h-7 w-7 place-items-center bg-bridge text-xs font-black text-white">{index + 1}</div>
          <strong className="text-sm text-bridge-dark">{step.title}</strong>
          <span className="text-sm leading-6 text-muted">{step.body}</span>
        </div>
      ))}
    </section>
  );
}
