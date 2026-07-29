/**
 * 백엔드 없이 프론트 UI를 개발하기 위한 초경량 mock 서버.
 * 의존성 0(내장 http만). 실행: node mock-server.mjs
 *
 * 실제 서버(context-bridge-v12)를 돌려 뽑은 mocks/*.json을 그대로 돌려준다.
 * 경로·응답이 실서버와 동일하므로, 프론트는 VITE_API_BASE_URL만 바꾸면 실서버로 전환된다.
 */
import http from 'node:http';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const load = (name) => JSON.parse(readFileSync(join(here, 'mocks', name), 'utf-8'));

const PORT = process.env.MOCK_PORT || 4000;

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const { pathname } = url;
  const method = req.method || 'GET';
  const auth = req.headers.authorization || '';

  // CORS (개발용 전체 허용)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type, Accept');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, PATCH, OPTIONS');
  if (method === 'OPTIONS') { res.writeHead(204).end(); return; }

  const send = (status, body) => {
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(body === undefined ? '' : JSON.stringify(body));
  };

  // 토큰 없으면 401 (실서버 동작 재현)
  const isDemoSenior = auth.includes('demo-senior');

  try {
    if (pathname === '/api/bootstrap' && method === 'GET') {
      if (!auth) return send(401, { error: '로그인이 필요합니다.' });
      return send(200, load(isDemoSenior ? 'bootstrap.senior.json' : 'bootstrap.success.json'));
    }
    if (pathname === '/api/proposals' && method === 'POST') {
      return send(200, load('proposal.success.json'));
    }
    if (/^\/api\/proposals\/[^/]+\/generate$/.test(pathname) && method === 'POST') {
      // 기억 후보를 보고 싶으면 answer.withMemory.json으로 바꿔서 테스트
      return send(200, load('answer.success.json'));
    }
    if (/^\/api\/memory-candidates\/[^/]+$/.test(pathname) && method === 'POST') {
      return send(200, load('memory.resolve.success.json'));
    }
    if (pathname === '/api/profiles' && method === 'POST') {
      const p = load('bootstrap.success.json').profiles[0];
      return send(200, { profile: p });
    }
    return send(404, { error: `mock 미정의 경로: ${method} ${pathname}` });
  } catch (e) {
    return send(500, { error: String(e) });
  }
});

server.listen(PORT, () => {
  console.log(`[mock] http://localhost:${PORT}  (토큰: demo-student / demo-senior)`);
});
