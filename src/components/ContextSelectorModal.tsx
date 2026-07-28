import React, { useState } from 'react';
import {
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Plus,
  ArrowRight,
  ShieldAlert,
  Sparkles,
  Lock,
  Eye,
  EyeOff,
  Sliders,
  HelpCircle,
  Info,
} from 'lucide-react';
import { EvaluatedContext, ContextItem } from '../types';

interface ContextSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  query: string;
  summaryReasoning: string;
  evaluations: EvaluatedContext[];
  onConfirmGenerate: (approvedIds: string[], tempNote?: string) => void;
  isGenerating: boolean;
  lang: 'ko' | 'en';
}

export const ContextSelectorModal: React.FC<ContextSelectorModalProps> = ({
  isOpen,
  onClose,
  query,
  summaryReasoning,
  evaluations,
  onConfirmGenerate,
  isGenerating,
  lang,
}) => {
  // Local approval state for each evaluation item
  const [approvalMap, setApprovalMap] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    evaluations.forEach((item) => {
      initial[item.contextId] =
        item.suggested &&
        item.context.privacyLevel === 'normal' &&
        !item.isStale;
    });
    return initial;
  });

  const [tempNote, setTempNote] = useState('');
  const [showAllExcluded, setShowAllExcluded] = useState(false);

  const toggleApproval = (contextId: string) => {
    setApprovalMap((prev) => ({
      ...prev,
      [contextId]: !prev[contextId],
    }));
  };

  const suggestedList = evaluations.filter((item) => item.suggested);
  const excludedList = evaluations.filter((item) => !item.suggested);

  // Calculate approved items list
  const approvedItems: ContextItem[] = evaluations
    .filter((item) => approvalMap[item.contextId])
    .map((item) => item.context);

  const approvedCount = approvedItems.length;
  const totalEvaluated = evaluations.length;
  const privacyProtectedCount = totalEvaluated - approvedCount;

  const handleConfirm = () => {
    onConfirmGenerate(
      approvedItems.map((item) => item.id),
      tempNote.trim() ? tempNote.trim() : undefined,
    );
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-3xl w-full my-8 shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="bg-slate-900 text-white p-6 relative overflow-hidden shrink-0">
          <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none" />

          <div className="relative z-10">
            <div className="flex items-center justify-between mb-3">
              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-400/30">
                <ShieldCheck className="w-3.5 h-3.5 mr-1.5 text-indigo-400" />
                {lang === 'ko' ? '2단계: 맥락 투명 승인 단계' : 'Step 2: Transparent Context Bridge'}
              </span>

              <button
                onClick={onClose}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors"
              >
                ✕
              </button>
            </div>

            <h3 className="text-xl font-extrabold text-white mb-2">
              {lang === 'ko'
                ? 'AI에 전달될 맥락을 검토하고 최종 승인하세요'
                : 'Inspect and approve context to be sent to AI'}
            </h3>

            <div className="bg-slate-800/80 p-3 rounded-xl border border-slate-700/60 text-xs text-slate-300 flex items-start space-x-2">
              <Sparkles className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <strong className="text-slate-100 block mb-0.5">
                  {lang === 'ko' ? '질문 내용:' : 'User Query:'} "{query}"
                </strong>
                <p className="text-slate-400 leading-relaxed">{summaryReasoning}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Body - Scrollable */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {/* Section 1: AI Suggested Contexts */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>
                  {lang === 'ko'
                    ? `AI 추천 승인 맥락 (${suggestedList.length}개)`
                    : `AI Suggested Contexts (${suggestedList.length})`}
                </span>
              </h4>
              <span className="text-xs text-slate-500">
                {lang === 'ko'
                  ? '체크 해제 시 AI에 전달되지 않습니다'
                  : 'Uncheck to exclude from AI prompt'}
              </span>
            </div>

            {suggestedList.length > 0 ? (
              <div className="space-y-3">
                {suggestedList.map((item) => {
                  const isApproved = !!approvalMap[item.contextId];
                  return (
                    <div
                      key={item.contextId}
                      onClick={() => toggleApproval(item.contextId)}
                      className={`p-4 rounded-xl border transition-all cursor-pointer select-none ${
                        isApproved
                          ? 'bg-indigo-50/40 border-indigo-200 shadow-xs'
                          : 'bg-slate-50 border-slate-200 opacity-60'
                      }`}
                    >
                      <div className="flex items-start space-x-3">
                        <input
                          type="checkbox"
                          checked={isApproved}
                          onChange={() => {}} // handled by div click
                          className="mt-1 w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500 shrink-0"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <span className="font-bold text-sm text-slate-900">
                              {item.context.title}
                            </span>
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-indigo-100 text-indigo-800 shrink-0">
                              연관도 {item.relevanceScore}%
                            </span>
                          </div>

                          <p className="text-xs text-slate-700 bg-white/70 p-2.5 rounded-lg border border-slate-200/60 font-mono mb-2">
                            "{item.context.content}"
                          </p>

                          {(item.context.privacyLevel === 'sensitive' || item.isStale) && (
                            <div className="flex flex-wrap gap-1.5 mb-2">
                              {item.context.privacyLevel === 'sensitive' && (
                                <span className="text-[10px] font-bold px-2 py-1 rounded bg-amber-100 text-amber-800">
                                  ⚠️ 민감 정보 · 기본 해제
                                </span>
                              )}
                              {item.isStale && (
                                <span className="text-[10px] font-bold px-2 py-1 rounded bg-orange-100 text-orange-800">
                                  ⏳ 90일 넘은 카드예요. 아직 맞나요? · 기본 해제
                                </span>
                              )}
                            </div>
                          )}

                          <p className="text-[11px] text-indigo-900/80 font-medium flex items-center">
                            <Info className="w-3 h-3 mr-1 text-indigo-500 shrink-0" />
                            {item.reason}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-slate-500 italic p-4 bg-slate-50 rounded-xl text-center">
                {lang === 'ko'
                  ? '질문과 직접적으로 관련된 추천 맥락이 없습니다.'
                  : 'No highly relevant contexts automatically suggested for this query.'}
              </p>
            )}
          </div>

          {/* Section 2: Excluded Contexts (Privacy Shielded) */}
          {excludedList.length > 0 && (
            <div className="border-t border-slate-100 pt-5">
              <button
                onClick={() => setShowAllExcluded(!showAllExcluded)}
                className="w-full flex items-center justify-between text-left p-3 rounded-xl bg-slate-100/80 hover:bg-slate-100 text-slate-700 text-xs font-bold transition-colors"
              >
                <span className="flex items-center space-x-2">
                  <Lock className="w-4 h-4 text-slate-500" />
                  <span>
                    {lang === 'ko'
                      ? `자동 차단/제외된 개인 맥락 (${excludedList.length}개)`
                      : `Privacy Filtered Contexts (${excludedList.length})`}
                  </span>
                </span>
                <span className="text-indigo-600 font-semibold underline">
                  {showAllExcluded
                    ? lang === 'ko'
                      ? '접기'
                      : 'Hide'
                    : lang === 'ko'
                    ? '목록 및 차단 사유 확인하기'
                    : 'Show Filtered Items'}
                </span>
              </button>

              {showAllExcluded && (
                <div className="mt-3 space-y-3 pl-2">
                  <p className="text-[11px] text-slate-500 mb-2">
                    {lang === 'ko'
                      ? '아래 맥락들은 질문과 무관하여 정보 노출 방지를 위해 자동 제외되었습니다. 필요한 경우 클릭하여 승인에 포함할 수 있습니다.'
                      : 'These items were automatically filtered out to prevent unnecessary context exposure. Click if you want to explicitly include them.'}
                  </p>

                  {excludedList.map((item) => {
                    const isApproved = !!approvalMap[item.contextId];
                    return (
                      <div
                        key={item.contextId}
                        onClick={() => item.valueVisible && toggleApproval(item.contextId)}
                        className={`p-3 rounded-xl border transition-all cursor-pointer select-none ${
                          isApproved
                            ? 'bg-amber-50 border-amber-200'
                            : `bg-slate-50/60 border-slate-200 opacity-70 ${item.valueVisible ? '' : 'cursor-not-allowed'}`
                        }`}
                      >
                        <div className="flex items-start space-x-3">
                          <input
                            type="checkbox"
                            checked={isApproved}
                            onChange={() => {}}
                            className="mt-1 w-4 h-4 text-amber-600 border-slate-300 rounded focus:ring-amber-500 shrink-0"
                          />
                          <div className="flex-1">
                            <div className="flex items-center justify-between gap-2 mb-1">
                              <span className="font-semibold text-xs text-slate-800">
                                {item.context.title}
                              </span>
                              <span className="text-[10px] text-slate-400 font-bold">
                                연관도 {item.relevanceScore}%
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-500 line-clamp-1 mb-1">
                            "{item.valueVisible ? item.context.content : '기밀 값은 표시하지 않습니다.'}"
                            </p>
                            <p className="text-[10px] text-slate-500 font-medium">
                              ⛔ 차단 사유: {item.reason}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Section 3: One-time Custom Temp Note */}
          <div className="border-t border-slate-100 pt-5">
            <label className="block text-xs font-bold text-slate-800 mb-1 flex items-center space-x-1.5">
              <Plus className="w-3.5 h-3.5 text-indigo-600" />
              <span>
                {lang === 'ko'
                  ? '이번 질문 전용 1회성 임시 맥락 추가 (선택사항)'
                  : 'Add Temporary One-off Context Note (Optional)'}
              </span>
            </label>
            <input
              type="text"
              value={tempNote}
              onChange={(e) => setTempNote(e.target.value)}
              placeholder={
                lang === 'ko'
                  ? '예: 오늘 저녁 8시까지 작성해야 함, 코드 길이는 50줄 이내로 제한 등'
                  : 'e.g., Keep response under 100 words, target audience is beginners'
              }
              className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-xs text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            />
          </div>
        </div>

        {/* Modal Footer & Stats */}
        <div className="bg-slate-50 p-6 border-t border-slate-200 shrink-0 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center space-x-3 text-xs">
            <div className="flex items-center space-x-1 text-indigo-700 font-bold bg-indigo-100/80 px-2.5 py-1 rounded-lg">
              <ShieldCheck className="w-4 h-4" />
              <span>
                {lang === 'ko'
                  ? `최종 승인 맥락: ${approvedCount}개`
                  : `Approved Contexts: ${approvedCount}`}
              </span>
            </div>

            <div className="flex items-center space-x-1 text-slate-600 font-medium bg-slate-200/60 px-2.5 py-1 rounded-lg">
              <Lock className="w-3.5 h-3.5 text-slate-500" />
              <span>
                {lang === 'ko'
                  ? `차단 보호됨: ${privacyProtectedCount}개`
                  : `Kept Private: ${privacyProtectedCount}`}
              </span>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={onClose}
              disabled={isGenerating}
              className="px-4 py-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-200 rounded-xl transition-colors"
            >
              {lang === 'ko' ? '돌아가기' : 'Cancel'}
            </button>

            <button
              onClick={handleConfirm}
              disabled={isGenerating}
              className="flex items-center space-x-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-md shadow-indigo-200 transition-all disabled:opacity-50"
            >
              {isGenerating ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>{lang === 'ko' ? '답변 생성 중...' : 'Generating...'}</span>
                </>
              ) : (
                <>
                  <span>
                    {lang === 'ko'
                      ? `승인 완료 및 AI 답변 생성 (${approvedCount}개 맥락 적용)`
                      : `Approve & Generate (${approvedCount} contexts)`}
                  </span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
