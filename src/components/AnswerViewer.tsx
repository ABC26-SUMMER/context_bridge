import React, { useState } from 'react';
import {
  Sparkles,
  ShieldCheck,
  Copy,
  Check,
  ThumbsUp,
  ThumbsDown,
  Tag,
  Columns,
  RefreshCw,
  Lock,
} from 'lucide-react';
import { ContextItem } from '../types';

interface AnswerViewerProps {
  userQuery: string;
  contextBridgeAnswer: string;
  rawAnswer?: string;
  approvedContexts: ContextItem[];
  tempNote?: string;
  onReset: () => void;
  lang: 'ko' | 'en';
}

export const AnswerViewer: React.FC<AnswerViewerProps> = ({
  userQuery,
  contextBridgeAnswer,
  rawAnswer,
  approvedContexts,
  tempNote,
  onReset,
  lang,
}) => {
  const [copiedBridge, setCopiedBridge] = useState(false);
  const [copiedRaw, setCopiedRaw] = useState(false);
  const [userRating, setUserRating] = useState<'up' | 'down' | null>(null);
  const [viewMode, setViewMode] = useState<'bridge' | 'side-by-side'>(
    rawAnswer ? 'side-by-side' : 'bridge'
  );

  const handleCopy = (text: string, isBridge: boolean) => {
    navigator.clipboard.writeText(text);
    if (isBridge) {
      setCopiedBridge(true);
      setTimeout(() => setCopiedBridge(false), 2000);
    } else {
      setCopiedRaw(true);
      setTimeout(() => setCopiedRaw(false), 2000);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
      {/* Top Banner with Approved Context Pills */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <span className="text-[10px] font-bold tracking-wider text-indigo-600 uppercase block">
              {lang === 'ko' ? '질문 및 승인된 맥락' : 'Query & Approved Contexts'}
            </span>
            <h3 className="text-base font-extrabold text-slate-900">"{userQuery}"</h3>
          </div>

          {/* View Mode Toggle Button */}
          {rawAnswer && (
            <div className="flex items-center space-x-1 bg-slate-100 p-1 rounded-xl shrink-0 self-start sm:self-center">
              <button
                onClick={() => setViewMode('bridge')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  viewMode === 'bridge'
                    ? 'bg-white text-indigo-600 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {lang === 'ko' ? '맞춤 답변만' : 'Context Answer'}
              </button>
              <button
                onClick={() => setViewMode('side-by-side')}
                className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  viewMode === 'side-by-side'
                    ? 'bg-white text-indigo-600 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Columns className="w-3.5 h-3.5" />
                <span>{lang === 'ko' ? '비교 보기' : 'Compare Raw vs Context'}</span>
              </button>
            </div>
          )}
        </div>

        {/* Applied Pills */}
        <div className="pt-3 border-t border-slate-100 flex items-center flex-wrap gap-2">
          <span className="text-xs font-bold text-slate-500 flex items-center mr-1">
            <ShieldCheck className="w-3.5 h-3.5 text-indigo-600 mr-1" />
            {lang === 'ko' ? '적용된 맥락:' : 'Applied Contexts:'}
          </span>

          {approvedContexts.map((ctx) => (
            <span
              key={ctx.id}
              className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium bg-indigo-50 text-indigo-800 border border-indigo-200"
            >
              <Tag className="w-3 h-3 mr-1 text-indigo-500" />
              <strong className="mr-1">{ctx.title}:</strong> {ctx.content.slice(0, 30)}...
            </span>
          ))}

          {tempNote && (
            <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium bg-amber-50 text-amber-800 border border-amber-200">
              ⚡ 1회성 노트: {tempNote}
            </span>
          )}

          {approvedContexts.length === 0 && !tempNote && (
            <span className="text-xs text-slate-400 italic">
              {lang === 'ko' ? '승인된 맥락 없음 (기본 일반 답변)' : 'No context applied'}
            </span>
          )}
        </div>
      </div>

      {/* Answer Output Cards */}
      {viewMode === 'side-by-side' && rawAnswer ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Card 1: Raw AI Answer */}
          <div className="bg-slate-50 rounded-2xl border border-slate-200 p-6 flex flex-col justify-between space-y-4">
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-4">
                <div className="flex items-center space-x-2">
                  <div className="p-1.5 rounded-lg bg-slate-200 text-slate-600">
                    <Lock className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-slate-800">
                      {lang === 'ko' ? '일반 AI 답변 (맥락 미반영)' : 'Raw AI Answer (No Context)'}
                    </h4>
                    <span className="text-[10px] text-slate-400">
                      {lang === 'ko'
                        ? '개인 성향/제약조건을 알지 못하는 표준 응답'
                        : 'Standard answer without user background'}
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => handleCopy(rawAnswer, false)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-lg transition-colors text-xs flex items-center space-x-1"
                >
                  {copiedRaw ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedRaw ? '복사됨' : '복사'}</span>
                </button>
              </div>

              <div className="prose prose-xs max-w-none text-slate-700 leading-relaxed whitespace-pre-line">
                {rawAnswer}
              </div>
            </div>
          </div>

          {/* Card 2: Context Bridge Personalized Answer */}
          <div className="bg-white rounded-2xl border-2 border-indigo-500/80 p-6 shadow-xl flex flex-col justify-between space-y-4 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full blur-2xl pointer-events-none" />

            <div className="relative z-10">
              <div className="flex items-center justify-between pb-3 border-b border-indigo-100 mb-4">
                <div className="flex items-center space-x-2">
                  <div className="p-1.5 rounded-lg bg-indigo-600 text-white shadow-xs">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-indigo-950 flex items-center space-x-1.5">
                      <span>{lang === 'ko' ? 'Context Bridge 승인 맞춤 답변' : 'Context Bridge Personalized Answer'}</span>
                      <span className="px-1.5 py-0.2 rounded-md bg-indigo-100 text-indigo-800 text-[10px] font-bold">
                        {lang === 'ko' ? '승인 적용됨' : 'Approved'}
                      </span>
                    </h4>
                    <span className="text-[10px] text-indigo-600 font-medium">
                      {lang === 'ko'
                        ? `${approvedContexts.length}개 개인 맥락 완벽 준수`
                        : `Tailored using ${approvedContexts.length} approved context blocks`}
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => handleCopy(contextBridgeAnswer, true)}
                  className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors text-xs flex items-center space-x-1 font-semibold"
                >
                  {copiedBridge ? (
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                  <span>{copiedBridge ? '복사됨' : '복사'}</span>
                </button>
              </div>

              <div className="prose prose-sm max-w-none text-slate-800 leading-relaxed whitespace-pre-line font-normal">
                {contextBridgeAnswer}
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* Single Bridge Answer Mode */
        <div className="bg-white rounded-2xl border-2 border-indigo-500/80 p-8 shadow-xl relative overflow-hidden">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-6">
            <div className="flex items-center space-x-3">
              <div className="p-2 rounded-xl bg-gradient-to-tr from-indigo-600 to-indigo-500 text-white shadow-sm">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-extrabold text-lg text-slate-900">
                  {lang === 'ko' ? 'Context Bridge 개인 맞춤 답변' : 'Context Bridge Personalized Answer'}
                </h4>
                <p className="text-xs text-slate-500">
                  {lang === 'ko'
                    ? '사용자가 검토 및 승인한 개인 맥락만을 바탕으로 생성되었습니다.'
                    : 'Generated using strictly user-approved context blocks.'}
                </p>
              </div>
            </div>

            <button
              onClick={() => handleCopy(contextBridgeAnswer, true)}
              className="flex items-center space-x-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs rounded-lg transition-colors"
            >
              {copiedBridge ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
              <span>{copiedBridge ? '복사 완료' : '답변 복사'}</span>
            </button>
          </div>

          <div className="prose prose-slate max-w-none text-slate-800 leading-relaxed whitespace-pre-line">
            {contextBridgeAnswer}
          </div>
        </div>
      )}

      {/* Rating & Ask Next Question Action Bar */}
      <div className="bg-slate-900 text-white p-4 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-lg">
        <div className="flex items-center space-x-3">
          <span className="text-xs font-semibold text-slate-300">
            {lang === 'ko' ? '맞춤 답변 평가하기:' : 'Rate personalized answer:'}
          </span>
          <div className="flex items-center space-x-1">
            <button
              onClick={() => setUserRating('up')}
              className={`p-1.5 rounded-lg border transition-all ${
                userRating === 'up'
                  ? 'bg-emerald-500 text-white border-emerald-400'
                  : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white'
              }`}
            >
              <ThumbsUp className="w-4 h-4" />
            </button>
            <button
              onClick={() => setUserRating('down')}
              className={`p-1.5 rounded-lg border transition-all ${
                userRating === 'down'
                  ? 'bg-rose-500 text-white border-rose-400'
                  : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white'
              }`}
            >
              <ThumbsDown className="w-4 h-4" />
            </button>
          </div>
        </div>

        <button
          onClick={onReset}
          className="flex items-center justify-center space-x-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl shadow-sm transition-all"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>{lang === 'ko' ? '새 질문 작성하기' : 'Ask Another Question'}</span>
        </button>
      </div>
    </div>
  );
};
