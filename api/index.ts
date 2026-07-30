// Vercel 서버리스 함수 진입점.
// createApp()이 만든 Express 앱을 그대로 서버리스 핸들러로 노출한다.
// Vercel은 /api/* 요청을 이 파일 하나로 라우팅한다(vercel.json 참고).
//
// ⚠️ 주의: 이 방식이 동작하려면 인메모리 ProposalStore가 아니라
// SupabaseProposalStore를 써야 한다. 서버리스는 요청마다 다른 인스턴스일 수 있어
// 인메모리 상태가 요청 A(proposals)와 요청 B(generate) 사이에 유실된다.
// createApp이 환경변수로 Supabase 구현체를 선택하도록 되어 있어야 한다.

import { createApp } from '../server.js';

const app = createApp();

export default app;

// Vercel Node 런타임은 Express 앱(= (req,res)=>void 핸들러)을 그대로 받는다.
// bodyParser 등은 createApp 내부 express.json()이 처리한다.
