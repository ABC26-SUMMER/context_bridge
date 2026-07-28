import React, { useState } from 'react';
import {
  Plus,
  Trash2,
  Edit2,
  CheckCircle2,
  XCircle,
  Tag,
  Shield,
  ShieldAlert,
  ShieldCheck,
  User,
  SlidersHorizontal,
  Target,
  AlertTriangle,
  FolderKanban,
  Download,
  Search,
  Sparkles,
} from 'lucide-react';
import { ContextItem, ContextCategory, PrivacyLevel } from '../types';
import { PRESET_PROFILES } from '../data/initialContexts';

interface VaultManagerProps {
  contexts: ContextItem[];
  onAddContext: (item: Omit<ContextItem, 'id' | 'updatedAt'>) => void;
  onUpdateContext: (item: ContextItem) => void;
  onDeleteContext: (id: string) => void;
  onLoadPreset: (presetId: string) => void;
  lang: 'ko' | 'en';
}

const CATEGORY_ICONS: Record<ContextCategory, React.ReactNode> = {
  profile: <User className="w-4 h-4" />,
  preference: <SlidersHorizontal className="w-4 h-4" />,
  goal: <Target className="w-4 h-4" />,
  constraint: <AlertTriangle className="w-4 h-4" />,
  project: <FolderKanban className="w-4 h-4" />,
};

const CATEGORY_LABELS_KO: Record<ContextCategory, string> = {
  profile: '기본 프로필/신원',
  preference: '답변 스타일/선호도',
  goal: '목표 및 관심사',
  constraint: '제약사항/규칙',
  project: '진행중 프로젝트',
};

const CATEGORY_LABELS_EN: Record<ContextCategory, string> = {
  profile: 'Profile & Identity',
  preference: 'Preferences & Style',
  goal: 'Goals & Interests',
  constraint: 'Constraints & Rules',
  project: 'Active Projects',
};

export const VaultManager: React.FC<VaultManagerProps> = ({
  contexts,
  onAddContext,
  onUpdateContext,
  onDeleteContext,
  onLoadPreset,
  lang,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<ContextCategory | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form State
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<ContextCategory>('preference');
  const [content, setContent] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [privacyLevel, setPrivacyLevel] = useState<PrivacyLevel>('normal');

  const resetForm = () => {
    setTitle('');
    setCategory('preference');
    setContent('');
    setTagsInput('');
    setPrivacyLevel('normal');
    setIsAdding(false);
    setEditingId(null);
  };

  const handleStartEdit = (item: ContextItem) => {
    setEditingId(item.id);
    setTitle(item.title);
    setCategory(item.category);
    setContent(item.content);
    setTagsInput(item.tags.join(', '));
    setPrivacyLevel(item.privacyLevel);
    setIsAdding(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) return;

    const tags = tagsInput
      .split(',')
      .map((t) => t.trim())
      .filter((t) => t.length > 0);

    if (editingId) {
      const existing = contexts.find((c) => c.id === editingId);
      if (existing) {
        onUpdateContext({
          ...existing,
          title: title.trim(),
          category,
          content: content.trim(),
          tags,
          privacyLevel,
          updatedAt: new Date().toISOString(),
        });
      }
    } else {
      onAddContext({
        title: title.trim(),
        category,
        content: content.trim(),
        tags,
        isActive: true,
        privacyLevel,
      });
    }

    resetForm();
  };

  const filteredContexts = contexts.filter((ctx) => {
    const matchesCategory = selectedCategory === 'all' || ctx.category === selectedCategory;
    const matchesSearch =
      searchQuery === '' ||
      ctx.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ctx.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ctx.tags.some((t) => t.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesCategory && matchesSearch;
  });

  const getPrivacyBadge = (level: PrivacyLevel) => {
    switch (level) {
      case 'confidential':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
            <ShieldAlert className="w-3 h-3 mr-1 text-rose-500" />
            {lang === 'ko' ? '기밀' : 'Confidential'}
          </span>
        );
      case 'sensitive':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            <Shield className="w-3 h-3 mr-1 text-amber-500" />
            {lang === 'ko' ? '민감' : 'Sensitive'}
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
            <ShieldCheck className="w-3 h-3 mr-1 text-slate-500" />
            {lang === 'ko' ? '일반' : 'Normal'}
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Info Banner & Preset Loader */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-2xl p-6 shadow-xl border border-indigo-900/40 relative overflow-hidden">
        <div className="absolute top-0 right-0 translate-x-8 -translate-y-8 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="max-w-2xl">
            <div className="flex items-center space-x-2 text-indigo-400 font-semibold text-xs tracking-wider uppercase mb-2">
              <ShieldCheck className="w-4 h-4" />
              <span>{lang === 'ko' ? '개인 맥락 금고 (Personal Context Vault)' : 'Personal Context Vault'}</span>
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">
              {lang === 'ko'
                ? '내 성향·목표·제약조건을 한곳에서 안전하게 관리'
                : 'Manage your preferences, rules & profile in one place'}
            </h2>
            <p className="text-slate-300 text-sm leading-relaxed">
              {lang === 'ko'
                ? '금고에 저장된 정보는 자동으로 AI에 전송되지 않습니다. 질문을 던지면 Context Bridge가 필요한 맥락만 추천하며, 사용자가 직접 확인 및 승인한 맥락만 AI에게 전달됩니다.'
                : 'Items in your vault are never sent automatically. Context Bridge suggests relevant context for each question, which you explicitly inspect and approve before sending.'}
            </p>
          </div>

          {/* Quick Presets Dropdown/Buttons */}
          <div className="bg-white/10 backdrop-blur-md p-4 rounded-xl border border-white/10 flex flex-col space-y-3 min-w-[280px]">
            <span className="text-xs font-bold text-indigo-200 flex items-center">
              <Sparkles className="w-3.5 h-3.5 mr-1.5 text-amber-300" />
              {lang === 'ko' ? '사전 정의 프로필 불러오기' : 'Load Preset Profiles'}
            </span>
            <div className="grid grid-cols-1 gap-2">
              {PRESET_PROFILES.map((preset) => (
                <button
                  key={preset.id}
                  onClick={() => onLoadPreset(preset.id)}
                  className="flex items-center justify-between px-3 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-xs text-white font-medium transition-colors text-left group"
                >
                  <div className="truncate pr-2">
                    <div className="font-semibold">{preset.name}</div>
                    <div className="text-[10px] text-slate-300 truncate">{preset.description}</div>
                  </div>
                  <Download className="w-3.5 h-3.5 shrink-0 text-indigo-300 group-hover:translate-y-0.5 transition-transform" />
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Action Bar & Controls */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
        {/* Search Input */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={
              lang === 'ko'
                ? '제목, 내용, 태그로 검색...'
                : 'Search title, content, or tags...'
            }
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all"
          />
        </div>

        {/* Add Context Button */}
        <button
          onClick={() => {
            resetForm();
            setIsAdding(true);
          }}
          className="flex items-center justify-center space-x-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-lg shadow-sm transition-all shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>{lang === 'ko' ? '새 개인 맥락 추가' : 'Add New Context'}</span>
        </button>
      </div>

      {/* Category Tabs */}
      <div className="flex items-center space-x-1 overflow-x-auto pb-2 scrollbar-none">
        <button
          onClick={() => setSelectedCategory('all')}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
            selectedCategory === 'all'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
          }`}
        >
          {lang === 'ko' ? '전체 보기' : 'All Items'} ({contexts.length})
        </button>

        {(['profile', 'preference', 'goal', 'constraint', 'project'] as ContextCategory[]).map(
          (cat) => {
            const count = contexts.filter((c) => c.category === cat).length;
            const labels = lang === 'ko' ? CATEGORY_LABELS_KO : CATEGORY_LABELS_EN;
            return (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                  selectedCategory === cat
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                }`}
              >
                {CATEGORY_ICONS[cat]}
                <span>{labels[cat]}</span>
                <span
                  className={`px-1.5 py-0.2 rounded-md text-[10px] ${
                    selectedCategory === cat ? 'bg-indigo-500 text-white' : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          }
        )}
      </div>

      {/* Add / Edit Context Modal Form */}
      {isAdding && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center space-x-2">
              <ShieldCheck className="w-5 h-5 text-indigo-600" />
              <span>
                {editingId
                  ? lang === 'ko'
                    ? '개인 맥락 수정'
                    : 'Edit Context Block'
                  : lang === 'ko'
                  ? '새 개인 맥락 블록 등록'
                  : 'Add New Context Block'}
              </span>
            </h3>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {lang === 'ko' ? '맥락 제목' : 'Context Title'} *
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={
                    lang === 'ko'
                      ? '예: 선호하는 답변 스타일, 유당불내증 식단 제약 등'
                      : 'e.g., Coding Style Rule, Dietary Restriction'
                  }
                  className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {lang === 'ko' ? '카테고리' : 'Category'}
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as ContextCategory)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-medium text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-none bg-white"
                  >
                    <option value="profile">기본 프로필 (Profile)</option>
                    <option value="preference">선호도/스타일 (Preference)</option>
                    <option value="goal">목표/관심사 (Goal)</option>
                    <option value="constraint">제약사항/규칙 (Constraint)</option>
                    <option value="project">진행 프로젝트 (Project)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {lang === 'ko' ? '보안 등급' : 'Privacy Level'}
                  </label>
                  <select
                    value={privacyLevel}
                    onChange={(e) => setPrivacyLevel(e.target.value as PrivacyLevel)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-medium text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-none bg-white"
                  >
                    <option value="normal">일반 (Normal)</option>
                    <option value="sensitive">민감 정보 (Sensitive)</option>
                    <option value="confidential">기밀 정보 (Confidential)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {lang === 'ko' ? '맥락 구체적 내용' : 'Detailed Content'} *
                </label>
                <textarea
                  required
                  rows={4}
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder={
                    lang === 'ko'
                      ? 'AI가 질의 답변 시 구체적으로 준수해야 하거나 참고할 원칙 및 정보 내용을 적어주세요.'
                      : 'Provide details, instructions, or rules for AI to follow when this context applies.'
                  }
                  className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {lang === 'ko' ? '태그 (쉼표 구분)' : 'Tags (comma separated)'}
                </label>
                <input
                  type="text"
                  value={tagsInput}
                  onChange={(e) => setTagsInput(e.target.value)}
                  placeholder="예: 개발, 클린코드, TypeScript"
                  className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-xs text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end space-x-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  {lang === 'ko' ? '취소' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm transition-all"
                >
                  {editingId
                    ? lang === 'ko'
                      ? '수정 완료'
                      : 'Update Context'
                    : lang === 'ko'
                    ? '금고에 저장'
                    : 'Save to Vault'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Vault Items Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredContexts.map((ctx) => {
          const categoryLabel =
            lang === 'ko' ? CATEGORY_LABELS_KO[ctx.category] : CATEGORY_LABELS_EN[ctx.category];

          return (
            <div
              key={ctx.id}
              className={`rounded-xl border transition-all duration-200 flex flex-col justify-between p-5 relative bg-white ${
                ctx.isActive
                  ? 'border-slate-200 shadow-sm hover:border-indigo-300 hover:shadow-md'
                  : 'border-slate-200 opacity-60 bg-slate-50'
              }`}
            >
              <div>
                {/* Header Row */}
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center space-x-2">
                    <span className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600">
                      {CATEGORY_ICONS[ctx.category]}
                    </span>
                    <div>
                      <span className="text-[10px] font-bold tracking-wider text-slate-400 uppercase block">
                        {categoryLabel}
                      </span>
                      <h4 className="font-bold text-slate-900 text-sm leading-snug">{ctx.title}</h4>
                      {Date.now() - Date.parse(ctx.updatedAt) >= 90 * 86_400_000 && (
                        <span className="inline-flex mt-1 text-[10px] font-bold px-2 py-0.5 rounded bg-orange-100 text-orange-800">
                          ⏳ 90일 넘음 · 아직 맞나요?
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Active Toggle Switch */}
                  <button
                    onClick={() =>
                      onUpdateContext({ ...ctx, isActive: !ctx.isActive })
                    }
                    className={`shrink-0 p-1 rounded-full transition-colors ${
                      ctx.isActive ? 'text-indigo-600 hover:text-indigo-800' : 'text-slate-400 hover:text-slate-600'
                    }`}
                    title={
                      ctx.isActive
                        ? lang === 'ko'
                          ? '현재 활성화됨 (AI 선별 대상)'
                          : 'Active (In Vault Pool)'
                        : lang === 'ko'
                        ? '현재 비활성화됨 (완전 차단)'
                        : 'Inactive (Blocked)'
                    }
                  >
                    {ctx.isActive ? (
                      <CheckCircle2 className="w-5 h-5 fill-indigo-100" />
                    ) : (
                      <XCircle className="w-5 h-5" />
                    )}
                  </button>
                </div>

                {/* Content */}
                <p className="text-slate-700 text-xs leading-relaxed my-3 whitespace-pre-line line-clamp-4">
                  {ctx.content}
                </p>
              </div>

              {/* Card Footer */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-between mt-2">
                <div className="flex items-center space-x-1.5 flex-wrap gap-y-1">
                  {getPrivacyBadge(ctx.privacyLevel)}
                  {ctx.tags.map((tag, i) => (
                    <span
                      key={i}
                      className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-medium bg-slate-100 text-slate-600"
                    >
                      <Tag className="w-2.5 h-2.5 mr-0.5 text-slate-400" />
                      {tag}
                    </span>
                  ))}
                </div>

                <div className="flex items-center space-x-1 shrink-0">
                  <button
                    onClick={() => handleStartEdit(ctx)}
                    className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors"
                    title={lang === 'ko' ? '수정' : 'Edit'}
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => onDeleteContext(ctx.id)}
                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors"
                    title={lang === 'ko' ? '삭제' : 'Delete'}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {filteredContexts.length === 0 && (
        <div className="text-center py-12 bg-white rounded-2xl border border-dashed border-slate-300 p-8">
          <Shield className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-sm font-bold text-slate-700">
            {lang === 'ko' ? '검색/선택된 개인 맥락 항목이 없습니다' : 'No context items found'}
          </h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            {lang === 'ko'
              ? '상단의 "새 개인 맥락 추가" 버튼 또는 "사전 정의 프로필 불러오기"를 통해 새로운 맥락을 등록해보세요.'
              : 'Add a new context block or load sample presets to build your personal vault.'}
          </p>
        </div>
      )}
    </div>
  );
};
