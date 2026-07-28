import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';
import { pathToFileURL } from 'node:url';
import { GoogleGenAI } from '@google/genai';
import { ProposalStore, selectableForRelevance } from './src/server/core.js';
import { ExtractedMemory } from './src/server/memory.js';
import { ContextItem, QueryAuditLog } from './src/types.js';
import {
  authenticate,
  createProfile,
  deleteContext,
  loadProfiles,
  loadAuditLogs,
  persistAnswerArtifacts,
  persistMemoryCandidate,
  persistMemoryStatus,
  persistProposal,
  saveContext,
  supabaseConfigured,
} from './src/server/dataGateway.js';

dotenv.config();

const PORT = Number(process.env.PORT || 3000);
const apiKey = process.env.GEMINI_API_KEY?.trim() || '';
const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;
// 최신 → 폴백 순. gemini-flash-latest는 GA Flash를 가리키는 별칭이라
// 모델 세대가 바뀌어도 코드 수정 없이 따라간다.
const CANDIDATE_MODELS = ['gemini-flash-latest', 'gemini-2.5-flash', 'gemini-2.5-flash-lite'];

export type Generate = (prompt: string) => Promise<string>;

// 오프라인/테스트용. 네트워크를 타지 않으며 항상 결정적으로 응답한다.
export const offlineGenerate: Generate = async (prompt) => {
  const question = prompt.match(/\[질문\]\n([\s\S]*?)(?:\n\n\[|$)/)?.[1]?.trim() || '';
  const count = (prompt.match(/^- /gm) || []).length;
  return count
    ? `개인화 답변(오프라인 데모): 승인한 ${count}개 맥락을 반영해 “${question}”에 답합니다.`
    : `일반 답변(오프라인 데모): “${question}”에 대한 기본 안내입니다.`;
};

function makeLiveGenerate(client: GoogleGenAI): Generate {
  return async (prompt) => {
    let lastError: unknown;
    for (const model of CANDIDATE_MODELS) {
      try {
        const response = await client.models.generateContent({ model, contents: prompt });
        return response.text || '답변을 생성하지 못했습니다.';
      } catch (error) {
        lastError = error;
      }
    }
    throw lastError instanceof Error ? lastError : new Error('모든 Gemini 모델 호출이 실패했습니다.');
  };
}

function parseJson<T>(text: string): T | null {
  const cleaned = text.replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim();
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    const match = cleaned.match(/[[{][\s\S]*[\]}]/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]) as T;
    } catch {
      return null;
    }
  }
}

/**
 * LLM 관련성 선별. confidential은 selectableForRelevance가 미리 제거하므로
 * 모델에는 기밀 카드의 값이 절대 전달되지 않는다. 실패하면 undefined를 돌려
 * 규칙 기반 relevance()로 폴백하게 한다(크래시 없음).
 */
async function scoreRelevance(
  query: string,
  contexts: ContextItem[],
  generate: Generate,
  live: boolean,
): Promise<Map<string, number> | undefined> {
  const selectable = selectableForRelevance(contexts);
  if (!live || selectable.length === 0) return undefined;
  const listing = selectable
    .map((c) => `- ${c.id}: [${c.category}] ${c.title} / 태그: ${c.tags.join(',')}`)
    .join('\n');
  const prompt =
    '아래 질문에 각 카드가 얼마나 관련되는지 0~100 점수로 판정해 JSON만 출력하라. ' +
    '형식: {"카드ID": 점수}. 값 텍스트는 주지 않았으니 제목·범주·태그로만 판단하라. 설명 금지.\n\n' +
    `질문: ${query}\n카드:\n${listing}`;
  try {
    const raw = await generate(prompt);
    const parsed = parseJson<Record<string, number>>(raw);
    if (!parsed) return undefined;
    const scores = new Map<string, number>();
    for (const c of selectable) {
      const value = Number(parsed[c.id]);
      if (Number.isFinite(value)) scores.set(c.id, Math.max(0, Math.min(100, value)));
    }
    return scores.size ? scores : undefined;
  } catch {
    return undefined;
  }
}

/**
 * LLM 기억 추출. 질문에서 새 개인 맥락을 뽑는다. 실패·무효 출력이면 빈 배열 →
 * core가 규칙 추출기로 폴백. LLM 결과와 규칙 결과는 core에서 라벨 기준 병합된다.
 */
async function extractMemoriesLLM(
  query: string,
  generate: Generate,
  live: boolean,
): Promise<ExtractedMemory[]> {
  if (!live) return [];
  const prompt =
    '아래 질문에서 사용자가 새로 드러낸 "지속적인 개인 맥락"만 뽑아 JSON 배열로 출력하라. ' +
    '일회성 정보는 제외. 형식: ' +
    '[{"label":str,"title":str,"category":"profile|preference|goal|constraint|project",' +
    '"content":str,"tags":[str],"privacyLevel":"normal|sensitive|confidential","semanticGroup":str}]. ' +
    '건강·이동제약 등은 sensitive. 없으면 []. 설명 금지.\n\n질문: ' +
    query;
  try {
    const parsed = parseJson<ExtractedMemory[]>(await generate(prompt));
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((m) => m && m.label && m.content && m.category)
      .slice(0, 3)
      .map((m) => ({
        label: String(m.label),
        title: String(m.title || m.label),
        category: m.category,
        content: String(m.content),
        tags: Array.isArray(m.tags) ? m.tags.map(String).slice(0, 6) : [],
        privacyLevel: ['normal', 'sensitive', 'confidential'].includes(m.privacyLevel)
          ? m.privacyLevel
          : 'sensitive',
        semanticGroup: String(m.semanticGroup || m.category),
      }));
  } catch {
    return [];
  }
}

function promptFor(query: string, contexts: ContextItem[], tempNote?: string) {
  const approved = contexts
    .map((context) => `- ${context.title}: ${context.content}`)
    .concat(tempNote ? [`- 이번 질문 전용 메모: ${tempNote}`] : [])
    .join('\n');
  return approved
    ? `[질문]\n${query}\n\n[사용자가 승인한 맥락]\n${approved}\n\n[지시]\n승인된 맥락만 자연스럽게 반영하고, 목록에 없는 개인정보를 추측하지 마세요.`
    : `[질문]\n${query}\n\n승인된 개인 맥락이 없습니다. 일반적인 답변을 제공하세요.`;
}

export interface AppDeps {
  generate?: Generate;
  live?: boolean;
}

export function createApp(deps: AppDeps = {}) {
  // 기본은 실 Gemini(키 있으면)·오프라인(없으면). 테스트는 offlineGenerate를 주입해
  // GEMINI_API_KEY 유무와 무관하게 네트워크를 절대 타지 않는다(결정적 테스트).
  const generate: Generate = deps.generate ?? (ai ? makeLiveGenerate(ai) : offlineGenerate);
  const live = deps.live ?? Boolean(ai && !deps.generate);
  const store = new ProposalStore();
  const app = express();
  app.use(cors());
  app.use(express.json({ limit: '1mb' }));

  app.get('/api/bootstrap', async (req, res) => {
    try {
      const user = await authenticate(req.headers.authorization);
      return res.json({
        user: { id: user.id, email: user.email },
        profiles: await loadProfiles(user),
        auditLogs: await loadAuditLogs(user),
        mode: supabaseConfigured ? 'supabase' : 'local-demo',
      });
    } catch (error) {
      return res.status(401).json({ error: error instanceof Error ? error.message : '로그인이 필요합니다.' });
    }
  });

  app.post('/api/profiles/:profileId/contexts', async (req, res) => {
    try {
      const user = await authenticate(req.headers.authorization);
      return res.json({
        context: await saveContext(user, req.params.profileId, req.body.context),
      });
    } catch (error) {
      return res.status(400).json({ error: error instanceof Error ? error.message : '저장에 실패했습니다.' });
    }
  });

  app.post('/api/profiles', async (req, res) => {
    try {
      const user = await authenticate(req.headers.authorization);
      return res.json({ profile: await createProfile(user, req.body) });
    } catch (error) {
      return res.status(400).json({ error: error instanceof Error ? error.message : '프로필 생성에 실패했습니다.' });
    }
  });

  app.delete('/api/profiles/:profileId/contexts/:contextId', async (req, res) => {
    try {
      const user = await authenticate(req.headers.authorization);
      await deleteContext(user, req.params.profileId, req.params.contextId);
      return res.status(204).end();
    } catch (error) {
      return res.status(400).json({ error: error instanceof Error ? error.message : '삭제에 실패했습니다.' });
    }
  });

  // 외부 AI를 호출하지 않는다. 카드 값은 이 서버의 Proposal에만 고정된다.
  app.post('/api/proposals', async (req, res) => {
    const { query, profileId } = req.body as {
      query?: string;
      profileId?: string;
    };
    if (!query?.trim() || !profileId) {
      return res.status(400).json({ error: '질문과 프로필이 필요합니다.' });
    }
    try {
      const user = await authenticate(req.headers.authorization);
      const profiles = await loadProfiles(user);
      const profile = profiles.find((item) => item.id === profileId);
      if (!profile) return res.status(404).json({ error: '이 계정의 프로필을 찾을 수 없습니다.' });
      // LLM이 있으면 관련성 점수를 위임하고, 없거나 실패하면 규칙 기반으로 폴백한다.
      const scores = await scoreRelevance(query.trim(), profile.contexts, generate, live);
      const proposal = store.create(
        user.id,
        profileId,
        query.trim(),
        profile.contexts,
        new Date(),
        scores,
      );
      await persistProposal(user, {
        id: proposal.id,
        profileId,
        question: proposal.query,
        candidateIds: proposal.evaluations
          .filter((item) => item.suggested)
          .map((item) => item.contextId),
      });
      return res.json({
        proposalId: proposal.id,
        query: proposal.query,
        evaluations: proposal.evaluations,
        selectionMode: scores ? 'llm' : 'rules',
        summaryReasoning: scores
          ? '백엔드가 카드 제목·태그만(값 제외) AI에 보내 관련성을 선별했습니다. 카드 값은 승인 전까지 전달되지 않습니다.'
          : '백엔드가 로그인 계정의 DB 카드만 조회해 규칙으로 선별했습니다. 카드 값은 아직 외부 AI에 보내지 않았습니다.',
      });
    } catch (error) {
      return res.status(401).json({ error: error instanceof Error ? error.message : '로그인이 필요합니다.' });
    }
  });

  app.post('/api/proposals/:proposalId/generate', async (req, res) => {
    const { proposalId } = req.params;
    const {
      approvedIds = [],
      includeRawComparison = true,
      tempNote,
    } = req.body as {
      approvedIds?: string[];
      includeRawComparison?: boolean;
      tempNote?: string;
    };
    try {
      const user = await authenticate(req.headers.authorization);
      const pending = store.inspect(proposalId, user.id);
      // 일반 비교 호출에는 개인 맥락이 전혀 필요하지 않으며, 실패하면
      // Proposal은 승인 전 상태로 남아 같은 Preview에서 재시도할 수 있다.
      const rawAnswer = includeRawComparison
        ? await generate(promptFor(pending.query, []))
        : undefined;
      const { proposal, approved, snapshotHash } = store.approve(
        proposalId,
        user.id,
        approvedIds,
      );
      const contextBridgeAnswer = await generate(
        promptFor(proposal.query, approved, tempNote?.trim()),
      );
      store.complete(proposalId);
      const llmMemories = await extractMemoriesLLM(proposal.query, generate, live);
      const memoryCandidates = store.extractMemories(proposal, llmMemories);
      const auditLog: QueryAuditLog = {
        id: `${user.id}:${crypto.randomUUID()}`,
        timestamp: new Date().toISOString(),
        userQuery: proposal.query,
        evaluations: proposal.evaluations,
        contextBridgeAnswer,
        rawAnswer,
        totalVaultCount: proposal.contexts.length,
        usedContextCount: approved.length,
        privacySavedCount: proposal.contexts.length - approved.length,
        snapshotHash,
        profileId: proposal.profileId,
        usedContexts: approved,
      };
      await persistAnswerArtifacts(user, {
        proposalId,
        profileId: proposal.profileId,
        approved,
        snapshotHash,
        audit: auditLog,
      });
      for (const candidate of memoryCandidates) {
        await persistMemoryCandidate(user, proposalId, proposal.profileId, candidate);
      }
      return res.json({
        contextBridgeAnswer,
        rawAnswer,
        usedContexts: approved,
        usedContextsCount: approved.length,
        snapshotHash,
        memoryCandidates,
        auditLog,
      });
    } catch (error) {
      store.fail(proposalId);
      return res.status(400).json({
        error: error instanceof Error ? error.message : '답변 생성에 실패했습니다.',
      });
    }
  });

  app.post('/api/memory-candidates/:candidateId', async (req, res) => {
    try {
      const { action } = req.body as {
        action?: 'save' | 'ignore';
      };
      if (action !== 'save' && action !== 'ignore') {
        return res.status(400).json({ error: 'save 또는 ignore가 필요합니다.' });
      }
      const user = await authenticate(req.headers.authorization);
      const result = store.resolveMemory(req.params.candidateId, user.id, action);
      if (result.context) await saveContext(user, result.candidate.profileId, result.context);
      await persistMemoryStatus(
        user,
        req.params.candidateId,
        action === 'save' ? 'SAVED' : 'IGNORED',
      );
      return res.json({ ...result, profileId: result.candidate.profileId });
    } catch (error) {
      return res.status(403).json({
        error: error instanceof Error ? error.message : '기억 후보 처리에 실패했습니다.',
      });
    }
  });

  // 감사 로그는 /api/bootstrap이 Supabase에서 로드한다. 과거의 인메모리 /api/audit는
  // 프론트가 호출하지 않는 죽은 경로였고 서버 재시작 시 소실돼 제거했다.

  return app;
}

export async function startServer() {
  const app = createApp();
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: 'spa' });
    app.use(vite.middlewares);
  } else {
    app.use(express.static('dist'));
    app.get('*', (_req, res) => res.sendFile('dist/index.html', { root: '.' }));
  }
  return app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Context Bridge] http://0.0.0.0:${PORT}`);
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await startServer();
}
