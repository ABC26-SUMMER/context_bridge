type PromptComparisonProps = {
  plainInput: string;
  bridgePrompt: string;
  easy?: boolean;
};

export function PromptComparison({ plainInput, bridgePrompt, easy = false }: PromptComparisonProps) {
  return (
    <section className="mt-4 grid grid-cols-2 gap-4 max-lg:grid-cols-1">
      <PromptCard title={easy ? "내가 쓴 짧은 말" : "사용자 원문 입력"} body={plainInput || "아직 프롬프트가 생성되지 않았습니다."} easy={easy} />
      <PromptCard
        title={easy ? "AI에 넣을 문장" : "Context Bridge 고급 프롬프트"}
        body={bridgePrompt || "Context Preview에서 정보를 승인한 뒤 생성하세요."}
        bridge
        easy={easy}
      />
    </section>
  );
}

function PromptCard({ title, body, bridge = false, easy = false }: { title: string; body: string; bridge?: boolean; easy?: boolean }) {
  return (
    <div className="grid min-h-80 grid-rows-[auto_1fr] border border-line bg-white">
      <h3 className={`border-b border-line px-4 py-3 text-base font-black ${bridge ? "bg-[#eaf5f2] text-bridge-dark" : "bg-[#f8f7f2]"}`}>
        {title}
      </h3>
      <pre className={`whitespace-pre-wrap p-4 font-sans text-ink ${easy ? "text-lg leading-8" : "text-sm leading-7"}`}>{body}</pre>
    </div>
  );
}
