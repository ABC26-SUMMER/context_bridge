import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { VaultManager } from './components/VaultManager';
import { QuestionInput } from './components/QuestionInput';
import { ContextSelectorModal } from './components/ContextSelectorModal';
import { AnswerViewer } from './components/AnswerViewer';
import { AuditHistory } from './components/AuditHistory';
import { LoginScreen } from './components/LoginScreen';
import {
  ContextItem,
  ContextProfile,
  EvaluatedContext,
  MemoryCandidate,
  QueryAuditLog,
} from './types';
import { INITIAL_CONTEXTS, PRESET_PROFILES } from './data/initialContexts';
import {
  analyzeQueryContext,
  generatePersonalizedAnswer,
  loadAccountData,
  persistContext,
  persistProfile,
  removeContext,
  resolveMemoryCandidate,
  setApiAccessToken,
} from './services/api';
import { currentSession, signOut } from './services/supabase';
import { ShieldCheck, Sparkles, Lock, ArrowRight, Database, History, AlertCircle } from 'lucide-react';

export function App() {
  const [lang, setLang] = useState<'ko' | 'en'>('ko');
  const [activeTab, setActiveTab] = useState<'ask' | 'vault' | 'history'>('ask');

  const [accessToken, setAccessToken] = useState('');
  const [accountMode, setAccountMode] = useState<'supabase' | 'local-demo'>('local-demo');
  const [accountEmail, setAccountEmail] = useState('');
  const [profiles, setProfiles] = useState<ContextProfile[]>([]);
  const [activeProfileId, setActiveProfileId] = useState('');
  const [loadingAccount, setLoadingAccount] = useState(true);
  const activeProfile = profiles.find((profile) => profile.id === activeProfileId) || profiles[0];
  const contexts = activeProfile?.contexts || [];

  // Audit Logs State
  const [auditLogs, setAuditLogs] = useState<QueryAuditLog[]>([]);

  useEffect(() => {
    void currentSession().then((session) => {
      if (session) void handleLogin(session.access_token);
      else setLoadingAccount(false);
    });
  }, []);

  // Query & Bridge Workflow State
  const [currentQuery, setCurrentQuery] = useState('');
  const [includeComparison, setIncludeComparison] = useState(true);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<{
    proposalId: string;
    summaryReasoning: string;
    evaluations: EvaluatedContext[];
  } | null>(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  const [activeAnswerData, setActiveAnswerData] = useState<{
    userQuery: string;
    contextBridgeAnswer: string;
    rawAnswer?: string;
    approvedContexts: ContextItem[];
    tempNote?: string;
  } | null>(null);

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [memoryCandidates, setMemoryCandidates] = useState<MemoryCandidate[]>([]);

  const handleLogin = async (token: string) => {
    setLoadingAccount(true);
    try {
      setApiAccessToken(token);
      const account = await loadAccountData();
      setAccessToken(token);
      setAccountMode(account.mode);
      setAccountEmail(account.user.email);
      setProfiles(account.profiles);
      setActiveProfileId(account.profiles[0]?.id || '');
      setAuditLogs(account.auditLogs);
    } catch (reason) {
      setErrorMessage(reason instanceof Error ? reason.message : '계정 정보를 불러오지 못했습니다.');
      setAccessToken('');
    } finally {
      setLoadingAccount(false);
    }
  };

  const handleLogout = async () => {
    await signOut();
    setAccessToken('');
    setProfiles([]);
    setActiveProfileId('');
    setActiveAnswerData(null);
  };

  const updateActiveContexts = (update: (items: ContextItem[]) => ContextItem[]) => {
    setProfiles((current) =>
      current.map((profile) =>
        profile.id === activeProfile.id
          ? { ...profile, contexts: update(profile.contexts) }
          : profile
      )
    );
  };

  const addContextToProfile = (profileId: string, context: ContextItem) => {
    setProfiles((current) =>
      current.map((profile) =>
        profile.id === profileId
          ? { ...profile, contexts: [context, ...profile.contexts] }
          : profile
      )
    );
  };

  // Handlers for Vault CRUD
  const handleAddContext = async (item: Omit<ContextItem, 'id' | 'updatedAt'>) => {
    const newItem: ContextItem = {
      ...item,
      id: `ctx-${Date.now()}`,
      updatedAt: new Date().toISOString(),
    };
    try {
      const saved = await persistContext(activeProfile.id, newItem);
      updateActiveContexts((prev) => [saved.context, ...prev]);
    } catch (reason) {
      setErrorMessage(reason instanceof Error ? reason.message : '카드 저장에 실패했습니다.');
    }
  };

  const handleUpdateContext = async (updated: ContextItem) => {
    try {
      const saved = await persistContext(activeProfile.id, {
        ...updated,
        updatedAt: new Date().toISOString(),
      });
      updateActiveContexts((prev) =>
        prev.map((c) => c.id === updated.id ? saved.context : c)
      );
    } catch (reason) {
      setErrorMessage(reason instanceof Error ? reason.message : '카드 수정에 실패했습니다.');
    }
  };

  const handleDeleteContext = async (id: string) => {
    try {
      await removeContext(activeProfile.id, id);
      updateActiveContexts((prev) => prev.filter((c) => c.id !== id));
    } catch (reason) {
      setErrorMessage(reason instanceof Error ? reason.message : '카드 삭제에 실패했습니다.');
    }
  };

  const handleResetToDefaults = async () => {
    if (
      window.confirm(
        lang === 'ko'
          ? '기본 샘플 맥락 금고 데이터로 초기화하시겠습니까?'
          : 'Reset vault to sample context items?'
      )
    ) {
      try {
        await Promise.all(contexts.map((item) => removeContext(activeProfile.id, item.id)));
        const saved = await Promise.all(
          INITIAL_CONTEXTS.map((item) =>
            persistContext(activeProfile.id, {
              ...item,
              id: crypto.randomUUID(),
              updatedAt: new Date().toISOString(),
            })
          )
        );
        updateActiveContexts(() => saved.map((item) => item.context));
      } catch (reason) {
        setErrorMessage(reason instanceof Error ? reason.message : '초기화에 실패했습니다.');
      }
    }
  };

  const handleLoadPreset = async (presetId: string) => {
    const preset = PRESET_PROFILES.find((p) => p.id === presetId);
    if (!preset) return;

    try {
      const created = await persistProfile({
        name: preset.name,
        description: preset.description,
        icon: preset.iconName === 'Activity' ? '🌿' : preset.iconName === 'Code' ? '💻' : '📋',
      });
      const cards = await Promise.all(preset.items.map((item) =>
        persistContext(created.profile.id, {
          ...item,
          id: crypto.randomUUID(),
          updatedAt: new Date().toISOString(),
        })
      ));
      const newProfile = { ...created.profile, contexts: cards.map((item) => item.context) };
      setProfiles((prev) => [...prev, newProfile]);
      setActiveProfileId(newProfile.id);
      setActiveTab('vault');
    } catch (reason) {
      setErrorMessage(reason instanceof Error ? reason.message : '프로필 생성에 실패했습니다.');
    }
  };

  const handleCreateProfile = async () => {
    const name = window.prompt('새 상황 프로필 이름을 입력하세요.');
    if (!name?.trim()) return;
    try {
      const { profile } = await persistProfile({
        name: name.trim(),
        description: '직접 만든 상황 프로필',
        icon: '✨',
      });
      setProfiles((prev) => [...prev, profile]);
      setActiveProfileId(profile.id);
      setActiveTab('vault');
    } catch (reason) {
      setErrorMessage(reason instanceof Error ? reason.message : '프로필 생성에 실패했습니다.');
    }
  };

  // Workflow Step 1: Analyze Context
  const handleAnalyzeAndBridge = async (query: string, comparison: boolean) => {
    setErrorMessage(null);
    setCurrentQuery(query);
    setIncludeComparison(comparison);
    setIsAnalyzing(true);

    try {
      const res = await analyzeQueryContext(query, activeProfile.id);
      setAnalysisResult({
        proposalId: res.proposalId,
        summaryReasoning: res.summaryReasoning,
        evaluations: res.evaluations,
      });
      setIsModalOpen(true);
    } catch (err: any) {
      console.error('Analysis error:', err);
      setErrorMessage(err.message || '맥락 분석 중 오류가 발생했습니다.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Workflow Step 2: Confirm Approved Contexts & Generate Answer
  const handleConfirmGenerate = async (
    approvedIds: string[],
    tempNote?: string
  ) => {
    setErrorMessage(null);
    setIsGenerating(true);

    try {
      const res = await generatePersonalizedAnswer(
        analysisResult!.proposalId,
        approvedIds,
        includeComparison,
        tempNote,
      );
      setAuditLogs((prev) => [res.auditLog, ...prev]);
      setMemoryCandidates(res.memoryCandidates);

      setActiveAnswerData({
        userQuery: currentQuery,
        contextBridgeAnswer: res.contextBridgeAnswer,
        rawAnswer: res.rawAnswer,
        approvedContexts: res.usedContexts,
        tempNote,
      });

      setIsModalOpen(false);
    } catch (err: any) {
      console.error('Answer generation error:', err);
      setErrorMessage(err.message || '답변 생성 중 오류가 발생했습니다.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleResetAnswer = () => {
    setActiveAnswerData(null);
    setAnalysisResult(null);
    setCurrentQuery('');
    setMemoryCandidates([]);
  };

  const handleMemory = async (candidate: MemoryCandidate, action: 'save' | 'ignore') => {
    try {
      const result = await resolveMemoryCandidate(candidate.id, action);
      if (result.context) addContextToProfile(result.profileId, result.context);
      setMemoryCandidates((items) => items.filter((item) => item.id !== candidate.id));
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '기억 후보 처리에 실패했습니다.');
    }
  };

  if (loadingAccount) {
    return <div className="min-h-screen bg-slate-950 text-white grid place-items-center font-bold">계정 데이터를 불러오는 중...</div>;
  }
  if (!accessToken) return <LoginScreen onLogin={handleLogin} />;
  if (!activeProfile) {
    return (
      <div className="min-h-screen bg-slate-50 grid place-items-center p-6">
        <div className="bg-white rounded-2xl border p-6 text-center">
          <h2 className="font-black">이 계정에 프로필이 없습니다.</h2>
          <p className="text-sm text-slate-500 my-3">데모 시드 스크립트를 실행한 뒤 다시 로그인하세요.</p>
          <button onClick={handleLogout} className="px-4 py-2 bg-slate-900 text-white rounded-lg">로그아웃</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans">
      {/* Top Header */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        contexts={contexts}
        profiles={profiles}
        activeProfileId={activeProfile.id}
        onSelectProfile={setActiveProfileId}
        onCreateProfile={handleCreateProfile}
        lang={lang}
        setLang={setLang}
        onResetToDefaults={handleResetToDefaults}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        <div className="flex items-center justify-between rounded-xl bg-indigo-50 border border-indigo-100 px-4 py-2 text-xs">
          <span>
            <strong>{activeProfile.displayName}</strong> · {accountEmail} ·
            {accountMode === 'supabase' ? ' Supabase Auth + RLS' : ' 로컬 데모 모드'}
          </span>
          <button onClick={handleLogout} className="font-bold text-indigo-700">로그아웃</button>
        </div>
        {/* Error Alert */}
        {errorMessage && (
          <div className="bg-rose-50 border border-rose-200 text-rose-800 px-4 py-3 rounded-xl text-xs font-semibold flex items-center justify-between shadow-xs">
            <div className="flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
              <span>{errorMessage}</span>
            </div>
            <button
              onClick={() => setErrorMessage(null)}
              className="text-rose-500 hover:text-rose-700"
            >
              ✕
            </button>
          </div>
        )}

        {/* Tab 1: Ask & Answer View */}
        {activeTab === 'ask' && (
          <div className="space-y-8">
            {/* Hero Concept Card */}
            {!activeAnswerData && (
              <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="space-y-2 max-w-2xl">
                  <div className="flex items-center space-x-2 text-indigo-600 font-bold text-xs uppercase tracking-wider">
                    <ShieldCheck className="w-4 h-4" />
                    <span>Context Bridge Philosophy</span>
                  </div>
                  <h1 className="text-2xl font-black text-slate-900 tracking-tight">
                    {lang === 'ko'
                      ? 'AI에게 모든 개인정보를 그냥 맡기시나요?'
                      : 'Control what AI knows before asking'}
                  </h1>
                  <p className="text-slate-600 text-xs sm:text-sm leading-relaxed">
                    {lang === 'ko'
                      ? 'Context Bridge는 질문마다 내 개인 맥락 금고에서 필요한 맥락만 투명하게 선별해 드립니다. 사용자 확인 및 승인을 거쳐 AI에 전달되므로 프라이버시 오남용 없이 극대화된 개인화 답변을 얻을 수 있습니다.'
                      : 'Context Bridge selectively pulls only relevant rules from your personal vault, showing you exactly what is sent for approval before generating an answer.'}
                  </p>
                </div>

                {/* Workflow Stepper Illustration */}
                <div className="flex items-center space-x-2 bg-slate-50 p-3 rounded-xl border border-slate-200 shrink-0 self-start md:self-center">
                  <div className="text-center px-2">
                    <Database className="w-5 h-5 text-indigo-600 mx-auto mb-1" />
                    <span className="text-[10px] font-bold text-slate-700 block">개인 금고</span>
                  </div>
                  <ArrowRight className="w-3.5 h-3.5 text-slate-300" />
                  <div className="text-center px-2">
                    <ShieldCheck className="w-5 h-5 text-emerald-600 mx-auto mb-1" />
                    <span className="text-[10px] font-bold text-slate-700 block">승인 스텝</span>
                  </div>
                  <ArrowRight className="w-3.5 h-3.5 text-slate-300" />
                  <div className="text-center px-2">
                    <Sparkles className="w-5 h-5 text-amber-500 mx-auto mb-1" />
                    <span className="text-[10px] font-bold text-slate-700 block">맞춤 답변</span>
                  </div>
                </div>
              </div>
            )}

            {/* Answer Display OR Question Input */}
            {activeAnswerData ? (
              <AnswerViewer
                userQuery={activeAnswerData.userQuery}
                contextBridgeAnswer={activeAnswerData.contextBridgeAnswer}
                rawAnswer={activeAnswerData.rawAnswer}
                approvedContexts={activeAnswerData.approvedContexts}
                tempNote={activeAnswerData.tempNote}
                onReset={handleResetAnswer}
                lang={lang}
              />
            ) : (
              <QuestionInput
                onAnalyzeAndBridge={handleAnalyzeAndBridge}
                isLoading={isAnalyzing}
                activeContextCount={contexts.filter((c) => c.isActive).length}
                lang={lang}
              />
            )}
            {activeAnswerData && memoryCandidates.length > 0 && (
              <section className="bg-white rounded-2xl border border-indigo-200 p-5 shadow-sm">
                <h3 className="font-extrabold text-slate-900">이번 질문에서 새로 알게 된 것</h3>
                <p className="text-xs text-slate-500 mt-1 mb-4">
                  자동으로 기억하지 않습니다. 저장을 눌러야 현재 프로필에 카드가 생깁니다.
                </p>
                {memoryCandidates.map((candidate) => (
                  <div key={candidate.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-indigo-50 p-4 rounded-xl">
                    <div>
                      <strong>📌 {candidate.label}</strong>
                      <span className="ml-2 text-xs text-amber-700">민감 정보</span>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => handleMemory(candidate, 'save')} className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-xs font-bold">현재 프로필에 저장</button>
                      <button onClick={() => handleMemory(candidate, 'ignore')} className="px-4 py-2 rounded-lg bg-white border text-xs font-bold">무시</button>
                    </div>
                  </div>
                ))}
              </section>
            )}
          </div>
        )}

        {/* Tab 2: Vault Manager View */}
        {activeTab === 'vault' && (
          <VaultManager
            contexts={contexts}
            onAddContext={handleAddContext}
            onUpdateContext={handleUpdateContext}
            onDeleteContext={handleDeleteContext}
            onLoadPreset={handleLoadPreset}
            lang={lang}
          />
        )}

        {/* Tab 3: Audit History View */}
        {activeTab === 'history' && (
          <AuditHistory
            logs={auditLogs}
            onClearHistory={() => setAuditLogs([])}
            onDeleteLog={(id) => setAuditLogs((prev) => prev.filter((l) => l.id !== id))}
            lang={lang}
          />
        )}
      </main>

      {/* Modal: Step 2 Context Bridge Approval */}
      {analysisResult && (
        <ContextSelectorModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          query={currentQuery}
          summaryReasoning={analysisResult.summaryReasoning}
          evaluations={analysisResult.evaluations}
          onConfirmGenerate={handleConfirmGenerate}
          isGenerating={isGenerating}
          lang={lang}
        />
      )}

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white py-6 mt-12 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center space-x-2">
            <Lock className="w-3.5 h-3.5 text-indigo-600" />
            <span className="font-semibold text-slate-700">Context Bridge</span>
            <span>— User-Controlled AI Middleware System</span>
          </div>
          <p className="text-slate-400">
            Powered by Google Gemini 3.6 Flash &bull; Server-Side Proxy Protected
          </p>
        </div>
      </footer>
    </div>
  );
}

export default App;
