import React, { useState } from 'react';
import { Sparkles, ArrowRight, ShieldCheck, HelpCircle, Columns, Lightbulb } from 'lucide-react';
import { ContextItem } from '../types';

interface QuestionInputProps {
  onAnalyzeAndBridge: (query: string, includeComparison: boolean) => void;
  isLoading: boolean;
  activeContextCount: number;
  lang: 'ko' | 'en';
}

const SAMPLE_PROMPTS_KO = [
  '이번 주말 식단과 레시피 추천해줘',
  '사용자 권한 관리 기능 리팩토링 코드를 작성해줘',
  '프로젝트 발표 자료 서론 및 핵심 요약 구성안 작성',
  '무릎이 안 좋아서 오래 못 걸어요. 내일 친구와 뭐 할까요?',
];

const SAMPLE_PROMPTS_EN = [
  'Suggest a weekend meal plan with recipes',
  'Write refactored TypeScript code for user permissions',
  'Draft an intro summary for my project presentation',
  'Recommend post-workout high-protein meals',
];

export const QuestionInput: React.FC<QuestionInputProps> = ({
  onAnalyzeAndBridge,
  isLoading,
  activeContextCount,
  lang,
}) => {
  const [query, setQuery] = useState('');
  const [includeComparison, setIncludeComparison] = useState(true);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim() || isLoading) return;
    onAnalyzeAndBridge(query.trim(), includeComparison);
  };

  const samplePrompts = lang === 'ko' ? SAMPLE_PROMPTS_KO : SAMPLE_PROMPTS_EN;

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-lg p-6 relative overflow-hidden">
      {/* Glow accent */}
      <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-50/50 rounded-full blur-3xl pointer-events-none" />

      <form onSubmit={handleSubmit} className="relative z-10 space-y-4">
        {/* Header Title */}
        <div className="flex items-center justify-between flex-wrap gap-2">
          <label className="flex items-center space-x-2 text-slate-900 font-bold text-base">
            <Sparkles className="w-5 h-5 text-indigo-600" />
            <span>
              {lang === 'ko'
                ? '질문 입력 (Context Bridge AI)'
                : 'Ask Your Question (Context Bridge AI)'}
            </span>
          </label>

          <div className="flex items-center space-x-2 text-xs font-semibold text-slate-500 bg-slate-50 px-3 py-1 rounded-full border border-slate-200">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>
              {lang === 'ko'
                ? `금고 내 ${activeContextCount}개 활성 맥락 분석 대기중`
                : `${activeContextCount} active context blocks ready for screening`}
            </span>
          </div>
        </div>

        {/* Text Area Input */}
        <div className="relative">
          <textarea
            required
            rows={4}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={
              lang === 'ko'
                ? '질문이나 요청 사항을 입력하세요... (예: 식단 추천, 코드 리팩토링, 문서 작성 등)'
                : 'Type your question or task here...'
            }
            className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all shadow-inner placeholder-slate-400"
          />
        </div>

        {/* Sample Prompt Chips */}
        <div>
          <div className="flex items-center space-x-1 text-xs font-semibold text-slate-500 mb-2">
            <Lightbulb className="w-3.5 h-3.5 text-amber-500" />
            <span>{lang === 'ko' ? '예시 질문 클릭해보기:' : 'Try sample prompt:'}</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {samplePrompts.map((sample, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setQuery(sample)}
                className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 text-slate-600 text-xs font-medium border border-slate-200 transition-all text-left"
              >
                "{sample}"
              </button>
            ))}
          </div>
        </div>

        {/* Options & CTA Row */}
        <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          {/* Side-by-Side Comparison Switch */}
          <label className="flex items-center space-x-2.5 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={includeComparison}
              onChange={(e) => setIncludeComparison(e.target.checked)}
              className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500"
            />
            <span className="text-xs font-semibold text-slate-700 flex items-center">
              <Columns className="w-3.5 h-3.5 mr-1 text-indigo-500" />
              {lang === 'ko'
                ? '일반 AI vs Context Bridge 답변 비교 보기'
                : 'Show Side-by-Side Comparison (Raw vs Context Bridge)'}
            </span>
          </label>

          {/* Primary Submit Button */}
          <button
            type="submit"
            disabled={isLoading || !query.trim()}
            className="flex items-center justify-center space-x-2 px-6 py-3 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white font-bold text-sm rounded-xl shadow-md shadow-indigo-200 hover:shadow-indigo-300 transition-all disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
          >
            {isLoading ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>{lang === 'ko' ? '맥락 분석 중...' : 'Analyzing Context...'}</span>
              </>
            ) : (
              <>
                <ShieldCheck className="w-4 h-4 text-indigo-200" />
                <span>
                  {lang === 'ko'
                    ? '1단계: 필요한 맥락 선별 및 확인하기'
                    : 'Step 1: Screen & Filter Context'}
                </span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};
