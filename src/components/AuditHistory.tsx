import React, { useState } from 'react';
import {
  History,
  ShieldCheck,
  Lock,
  Download,
  Trash2,
  ChevronDown,
  ChevronUp,
  Clock,
  Sparkles,
  Info,
} from 'lucide-react';
import { QueryAuditLog } from '../types';

interface AuditHistoryProps {
  logs: QueryAuditLog[];
  onClearHistory: () => void;
  onDeleteLog: (id: string) => void;
  lang: 'ko' | 'en';
}

export const AuditHistory: React.FC<AuditHistoryProps> = ({
  logs,
  onClearHistory,
  onDeleteLog,
  lang,
}) => {
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

  const toggleExpand = (id: string) => {
    setExpandedLogId(expandedLogId === id ? null : id);
  };

  const exportAuditJSON = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(logs, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `context_bridge_audit_${new Date().toISOString().slice(0,10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  // Metrics
  const totalQueries = logs.length;
  const avgUsedContexts =
    totalQueries > 0
      ? (logs.reduce((acc, l) => acc + l.usedContextCount, 0) / totalQueries).toFixed(1)
      : '0';

  const totalBlockedContexts = logs.reduce((acc, l) => acc + l.privacySavedCount, 0);

  return (
    <div className="space-y-6">
      {/* Header & Privacy Impact Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center space-x-4">
          <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
            <History className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[10px] font-bold tracking-wider text-slate-400 uppercase block">
              {lang === 'ko' ? '총 맞춤 답변 생성 건수' : 'Total Queries Processed'}
            </span>
            <strong className="text-xl font-extrabold text-slate-900">{totalQueries}건</strong>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center space-x-4">
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[10px] font-bold tracking-wider text-slate-400 uppercase block">
              {lang === 'ko' ? '평균 적용 맥락 수' : 'Avg Approved Contexts'}
            </span>
            <strong className="text-xl font-extrabold text-slate-900">{avgUsedContexts}개 / 질문</strong>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center space-x-4">
          <div className="p-3 bg-indigo-900 text-white rounded-xl">
            <Lock className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[10px] font-bold tracking-wider text-slate-400 uppercase block">
              {lang === 'ko' ? '차단 및 보호된 맥락 총합' : 'Total Vault Contexts Protected'}
            </span>
            <strong className="text-xl font-extrabold text-indigo-950">{totalBlockedContexts}개 보호됨</strong>
          </div>
        </div>
      </div>

      {/* Control Actions */}
      <div className="flex items-center justify-between bg-white p-4 rounded-xl border border-slate-200">
        <h3 className="font-bold text-sm text-slate-900 flex items-center space-x-2">
          <ShieldCheck className="w-4 h-4 text-indigo-600" />
          <span>{lang === 'ko' ? '투명성 맥락 통제 이력' : 'Audit Transparency Log'}</span>
        </h3>

        <div className="flex items-center space-x-2">
          {logs.length > 0 && (
            <>
              <button
                onClick={exportAuditJSON}
                className="flex items-center space-x-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-lg transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                <span>{lang === 'ko' ? '감사 리포트 내보내기' : 'Export JSON Log'}</span>
              </button>

              <button
                onClick={onClearHistory}
                className="flex items-center space-x-1.5 px-3 py-1.5 text-rose-600 hover:bg-rose-50 font-semibold text-xs rounded-lg transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{lang === 'ko' ? '기록 전체 삭제' : 'Clear Log'}</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Log Items List */}
      <div className="space-y-3">
        {logs.map((log) => {
          const isExpanded = expandedLogId === log.id;
          const formattedTime = new Date(log.timestamp).toLocaleString(
            lang === 'ko' ? 'ko-KR' : 'en-US',
            {
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            }
          );

          return (
            <div
              key={log.id}
              className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden transition-all"
            >
              <div
                onClick={() => toggleExpand(log.id)}
                className="p-4 flex items-center justify-between cursor-pointer hover:bg-slate-50 transition-colors select-none"
              >
                <div className="flex items-center space-x-3 flex-1 min-w-0 pr-4">
                  <div className="p-2 rounded-lg bg-indigo-50 text-indigo-600 shrink-0">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h4 className="font-bold text-sm text-slate-900 truncate">
                      "{log.userQuery}"
                    </h4>
                    <div className="flex items-center space-x-3 text-[11px] text-slate-400 mt-0.5">
                      <span className="flex items-center">
                        <Clock className="w-3 h-3 mr-1" />
                        {formattedTime}
                      </span>
                      <span className="font-semibold text-indigo-600">
                        승인 적용: {log.usedContextCount}개
                      </span>
                      <span className="font-semibold text-slate-500">
                        차단/보호: {log.privacySavedCount}개
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center space-x-2 shrink-0">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteLog(log.id);
                    }}
                    className="p-1.5 text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                  {isExpanded ? (
                    <ChevronUp className="w-4 h-4 text-slate-400" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-slate-400" />
                  )}
                </div>
              </div>

              {/* Expanded Details */}
              {isExpanded && (
                <div className="bg-slate-50 p-5 border-t border-slate-100 space-y-4 text-xs animate-in fade-in duration-150">
                  {/* Evaluated Items Table */}
                  <div>
                    <h5 className="font-bold text-slate-800 mb-2 flex items-center space-x-1.5">
                      <ShieldCheck className="w-3.5 h-3.5 text-indigo-600" />
                      <span>{lang === 'ko' ? '맥락 평가 및 승인 상세' : 'Context Evaluation Details'}</span>
                    </h5>

                    <div className="space-y-2">
                      {log.evaluations.map((evalItem) => (
                        <div
                          key={evalItem.contextId}
                          className="p-3 bg-white rounded-lg border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                        >
                          <div className="flex items-start space-x-2">
                            <span
                              className={`mt-0.5 px-1.5 py-0.2 rounded text-[10px] font-bold shrink-0 ${
                                evalItem.approvedByUser
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-slate-100 text-slate-500'
                              }`}
                            >
                              {evalItem.approvedByUser ? '승인됨' : '차단/제외'}
                            </span>
                            <div>
                              <strong className="text-slate-900 block text-xs">
                                {evalItem.context.title}
                              </strong>
                              <p className="text-[11px] text-slate-500 line-clamp-1">
                                {evalItem.reason}
                              </p>
                            </div>
                          </div>

                          <span className="text-[10px] font-mono text-indigo-600 font-bold shrink-0 self-end sm:self-center">
                            연관도 {evalItem.relevanceScore}%
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Context Bridge Answer Preview */}
                  <div>
                    <h5 className="font-bold text-slate-800 mb-1">
                      {lang === 'ko' ? '생성된 맞춤 답변 미리보기' : 'Generated Answer Preview'}
                    </h5>
                    <div className="p-3 bg-white rounded-lg border border-slate-200 text-slate-700 text-xs leading-relaxed max-h-32 overflow-y-auto font-mono whitespace-pre-line">
                      {log.contextBridgeAnswer}
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {logs.length === 0 && (
          <div className="text-center py-12 bg-white rounded-2xl border border-dashed border-slate-300 p-8">
            <History className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <h3 className="text-sm font-bold text-slate-700">
              {lang === 'ko' ? '아직 수행된 맥락 승인 기록이 없습니다' : 'No audit records yet'}
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              {lang === 'ko'
                ? '질문 및 맞춤 답변 메뉴에서 질문을 던지고 맥락을 승인해보세요.'
                : 'Ask a question in the main view to generate transparency audit logs.'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
