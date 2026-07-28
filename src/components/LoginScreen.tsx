import React, { useState } from 'react';
import { ShieldCheck, UserRound, LockKeyhole } from 'lucide-react';
import { browserSupabaseConfigured, signIn } from '../services/supabase';

interface Props {
  onLogin: (token: string) => void;
}

const accounts = [
  { id: 'student', label: '🎓 전이현 — 대학생', email: 'student@contextbridge.demo', localToken: 'demo-student' },
  { id: 'senior', label: '👵 김영자 — 고령 사용자', email: 'senior@contextbridge.demo', localToken: 'demo-senior' },
];

export const LoginScreen: React.FC<Props> = ({ onLogin }) => {
  const [accountId, setAccountId] = useState('student');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const selected = accounts.find((item) => item.id === accountId)!;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    try {
      if (!browserSupabaseConfigured) {
        onLogin(selected.localToken);
        return;
      }
      if (!password) throw new Error('데모 계정 비밀번호를 입력하세요.');
      const session = await signIn(selected.email, password);
      if (!session) throw new Error('로그인 세션을 만들지 못했습니다.');
      onLogin(session.access_token);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '로그인에 실패했습니다.');
    }
  };

  return (
    <main className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-3xl p-7 shadow-2xl">
        <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center mb-5">
          <ShieldCheck className="w-7 h-7" />
        </div>
        <h1 className="text-2xl font-black">Context Bridge 로그인</h1>
        <p className="text-sm text-slate-500 mt-2 mb-6">
          계정을 바꾸면 백엔드가 해당 사용자의 DB 프로필만 조회합니다.
        </p>
        <form onSubmit={submit} className="space-y-4">
          <label className="block">
            <span className="text-xs font-bold text-slate-700 flex items-center gap-1 mb-1">
              <UserRound className="w-3.5 h-3.5" /> 대표 데모 계정
            </span>
            <select value={accountId} onChange={(event) => setAccountId(event.target.value)} className="w-full p-3 rounded-xl border bg-slate-50 font-bold">
              {accounts.map((account) => <option key={account.id} value={account.id}>{account.label}</option>)}
            </select>
          </label>
          {browserSupabaseConfigured && (
            <label className="block">
              <span className="text-xs font-bold text-slate-700 flex items-center gap-1 mb-1">
                <LockKeyhole className="w-3.5 h-3.5" /> 비밀번호
              </span>
              <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} className="w-full p-3 rounded-xl border" />
            </label>
          )}
          <div className="rounded-xl bg-indigo-50 p-3 text-xs text-indigo-900">
            {browserSupabaseConfigured
              ? `실제 Supabase Auth 로그인: ${selected.email}`
              : '로컬 데모 모드입니다. Supabase 환경값을 넣으면 동일 화면이 실제 Auth 로그인으로 전환됩니다.'}
          </div>
          {error && <p className="text-xs font-bold text-rose-600">{error}</p>}
          <button className="w-full py-3 rounded-xl bg-indigo-600 text-white font-black">이 계정으로 시작</button>
        </form>
        <p className="text-[11px] text-slate-400 mt-5">모든 이름과 프로필은 시연용 가상 데모 데이터입니다.</p>
      </div>
    </main>
  );
};
