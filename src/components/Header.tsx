import React from 'react';
import { ShieldCheck, Database, History, Sparkles, Sliders, RefreshCw, Lock } from 'lucide-react';
import { ContextItem, ContextProfile } from '../types';

interface HeaderProps {
  activeTab: 'ask' | 'vault' | 'history';
  setActiveTab: (tab: 'ask' | 'vault' | 'history') => void;
  contexts: ContextItem[];
  profiles: ContextProfile[];
  activeProfileId: string;
  onSelectProfile: (id: string) => void;
  onCreateProfile: () => void;
  lang: 'ko' | 'en';
  setLang: (lang: 'ko' | 'en') => void;
  onResetToDefaults: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  contexts,
  profiles,
  activeProfileId,
  onSelectProfile,
  onCreateProfile,
  lang,
  setLang,
  onResetToDefaults,
}) => {
  const activeCount = contexts.filter((c) => c.isActive).length;
  const totalCount = contexts.length;

  return (
    <header className="sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b border-slate-200 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand Logo & Title */}
          <div className="flex items-center space-x-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-cyan-500 flex items-center justify-center text-white shadow-md shadow-indigo-200">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-bold text-lg text-slate-900 tracking-tight">Context Bridge</span>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                  <Lock className="w-3 h-3 mr-1 text-indigo-500" />
                  {lang === 'ko' ? '사용자 통제형 AI' : 'User-Controlled AI'}
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium">
                {lang === 'ko'
                  ? '내 데이터는 내가 승인한 질문에만 전달됩니다'
                  : 'Your context is shared only when explicitly approved'}
              </p>
            </div>
          </div>

          {/* Navigation Tabs */}
          <nav className="hidden md:flex items-center space-x-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
            <button
              onClick={() => setActiveTab('ask')}
              className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                activeTab === 'ask'
                  ? 'bg-white text-indigo-600 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
              }`}
            >
              <Sparkles className="w-4 h-4" />
              <span>{lang === 'ko' ? '질문 & 맞춤 답변' : 'Ask & Answer'}</span>
            </button>

            <button
              onClick={() => setActiveTab('vault')}
              className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                activeTab === 'vault'
                  ? 'bg-white text-indigo-600 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
              }`}
            >
              <Database className="w-4 h-4" />
              <span>{lang === 'ko' ? '개인 맥락 금고' : 'Context Vault'}</span>
              <span className="ml-1 px-1.5 py-0.5 text-xs rounded-md bg-indigo-100 text-indigo-800 font-bold">
                {activeCount}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('history')}
              className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                activeTab === 'history'
                  ? 'bg-white text-indigo-600 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
              }`}
            >
              <History className="w-4 h-4" />
              <span>{lang === 'ko' ? '통제 감사 기록' : 'Audit History'}</span>
            </button>
          </nav>

          {/* Language & Action Controls */}
          <div className="flex items-center space-x-2">
            <div className="hidden sm:flex items-center gap-1">
              <select
                value={activeProfileId}
                onChange={(event) => onSelectProfile(event.target.value)}
                className="max-w-40 px-2.5 py-1.5 text-xs font-bold rounded-lg border border-indigo-200 bg-indigo-50 text-indigo-800"
                title={lang === 'ko' ? '현재 상황 프로필' : 'Active profile'}
              >
                {profiles.map((profile) => (
                  <option key={profile.id} value={profile.id}>
                    {profile.icon} {profile.name}
                  </option>
                ))}
              </select>
              <button
                onClick={onCreateProfile}
                className="px-2 py-1.5 text-xs font-black rounded-lg border border-slate-200 hover:bg-slate-100"
                title={lang === 'ko' ? '새 상황 프로필' : 'New profile'}
              >
                +
              </button>
            </div>
            {/* Quick Vault Status pill */}
            <div className="hidden lg:flex items-center space-x-2 px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-xs font-medium text-slate-600">
              <Sliders className="w-3.5 h-3.5 text-indigo-600" />
              <span>
                {lang === 'ko' ? '보관중 맥락:' : 'Vault Items:'}{' '}
                <strong className="text-slate-900">{totalCount}개</strong> (활성 {activeCount}개)
              </span>
            </div>

            {/* Language Toggle */}
            <button
              onClick={() => setLang(lang === 'ko' ? 'en' : 'ko')}
              className="px-2.5 py-1.5 text-xs font-bold rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 transition-colors"
              title="언어 변경 / Change Language"
            >
              {lang === 'ko' ? 'EN' : '한글'}
            </button>

            {/* Reset Defaults */}
            <button
              onClick={onResetToDefaults}
              className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              title={lang === 'ko' ? '기본 샘플 맥락으로 초기화' : 'Reset to sample contexts'}
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Mobile Nav Tabs */}
        <div className="md:hidden flex items-center justify-around border-t border-slate-100 py-2">
          <button
            onClick={() => setActiveTab('ask')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold ${
              activeTab === 'ask' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>{lang === 'ko' ? '질문하기' : 'Ask'}</span>
          </button>

          <button
            onClick={() => setActiveTab('vault')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold ${
              activeTab === 'vault' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600'
            }`}
          >
            <Database className="w-3.5 h-3.5" />
            <span>{lang === 'ko' ? '맥락 금고' : 'Vault'} ({activeCount})</span>
          </button>

          <button
            onClick={() => setActiveTab('history')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold ${
              activeTab === 'history' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span>{lang === 'ko' ? '감사 기록' : 'Audit'}</span>
          </button>
        </div>
      </div>
    </header>
  );
};
