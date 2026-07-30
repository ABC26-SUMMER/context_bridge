import { env, serverEnvStatus, assertServerEnv } from '../backend/config/env.js';

const browserUrl = (process.env.VITE_SUPABASE_URL || '').trim();
const serverUrl = (process.env.SUPABASE_URL || '').trim();
const apiBase = (process.env.VITE_API_BASE_URL || '').trim();
const missingServer = assertServerEnv();
const browserMissing: string[] = [];

if (!browserUrl) browserMissing.push('VITE_SUPABASE_URL');
if (!(process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_ANON_KEY)) {
  browserMissing.push('VITE_SUPABASE_PUBLISHABLE_KEY 또는 VITE_SUPABASE_ANON_KEY');
}

let failed = false;
console.log('\n[Context Bridge 환경변수 점검]');
console.log(`- 브라우저 Supabase: ${browserMissing.length ? '미완료' : '완료'}`);
console.log(`- 서버 Supabase: ${missingServer.length ? '미완료' : '완료'}`);
console.log(`- Gemini: ${serverEnvStatus.aiConfigured ? '연결 예정' : '미설정 — 오프라인 폴백 사용'}`);
console.log(`- API 연결 방식: ${apiBase ? '분리 주소 사용' : '통합 서버 상대경로 /api 사용'}`);

if (browserMissing.length) {
  failed = true;
  console.error(`  누락: ${browserMissing.join(', ')}`);
}
if (missingServer.length) {
  failed = true;
  console.error(`  누락: ${missingServer.join(', ')}`);
}
if (browserUrl && serverUrl && browserUrl !== serverUrl) {
  failed = true;
  console.error('  오류: 브라우저와 서버가 서로 다른 Supabase URL을 사용합니다.');
}
if (apiBase && /localhost:4000\/?$/i.test(apiBase)) {
  console.warn('  주의: 통합 npm run dev는 3000번 포트입니다. Mock 서버를 쓰지 않으면 VITE_API_BASE_URL을 비우세요.');
}
if (!Number.isFinite(env.port) || env.port <= 0) {
  failed = true;
  console.error('  오류: PORT가 올바른 숫자가 아닙니다.');
}

if (failed) {
  console.error('\n환경변수 점검 실패. .env.local을 수정한 뒤 다시 실행하세요.\n');
  process.exitCode = 1;
} else {
  console.log('\n환경변수 점검 통과. 키 값은 출력하지 않았습니다.\n');
}
