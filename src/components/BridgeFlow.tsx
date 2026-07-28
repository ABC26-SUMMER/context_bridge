const steps = [
  {
    title: "짧은 자연어",
    body: "사용자는 생각나는 대로 짧게 말합니다. 좋은 프롬프트를 몰라도 시작할 수 있습니다.",
  },
  {
    title: "부족한 맥락 진단",
    body: "목적, 제약조건, 출력 형식처럼 AI 고급 사용자가 넣을 요소를 찾습니다.",
  },
  {
    title: "사용자 승인",
    body: "필요한 정보와 민감정보를 먼저 보여주고, 승인된 맥락만 사용합니다.",
  },
  {
    title: "고급 프롬프트",
    body: "다른 AI에 그대로 넣을 수 있는 역할, 조건, 형식이 갖춰진 명령문을 만듭니다.",
  },
];

export function BridgeFlow() {
  return (
    <section className="mt-5 grid grid-cols-4 gap-3 max-lg:grid-cols-1" aria-label="Context Bridge 입력 개선 흐름">
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
