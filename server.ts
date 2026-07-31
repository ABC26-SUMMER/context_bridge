import express from 'express';
import cors from 'cors';
import { pathToFileURL } from 'node:url';
import { env, serverEnvStatus, assertServerEnv } from './backend/config/env.js';
import { GoogleGenAI } from '@google/genai';
import { ProposalStore } from './backend/server/core.js';
import {
  selectContexts,
  type SemanticRanker,
  type RankerOutput,
  type RankedCard,
} from './backend/server/selection.js';
import { SupabaseProposalStore } from './backend/server/supabaseProposalStore.js';
import type { IProposalStore } from './backend/server/proposalStore.types.js';
import { ExtractedMemory } from './backend/server/memory.js';
import { ContextItem, QueryAuditLog } from './backend/types.js';
import {
  authenticate,
  createProfile,
  deleteContext,
  loadProfiles,
  loadAuditLogs,
  persistAuditLog,
  saveContext,
  supabaseConfigured,
  updateProfile,
  userClient,
} from './backend/server/dataGateway.js';
import type {
  ContextCategory,
  CreateContextRequest,
  CreateProfileRequest,
  PrivacyLevel,
  UpdateContextRequest,
  UpdateProfileRequest,
} from './contracts/types.js';
import { validateAndRepairAnswer } from './backend/server/answerGuard.js';

const PORT = env.port;
const apiKey = env.geminiApiKey;
const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;
// GEMINI_MODELS는 쉼표 구분으로 덮어쓸 수 있다. 기본값은 현재 GA 모델만 사용한다.
const CANDIDATE_MODELS = env.geminiModels
  ? env.geminiModels.split(',').map((model) => model.trim()).filter(Boolean)
  : ['gemini-3.1-flash-lite', 'gemini-3.5-flash', 'gemini-flash-latest'];

export type Generate = (prompt: string) => Promise<string>;

// 스키마를 강제해 JSON을 받는 생성기. Gemini responseSchema를 쓴다.
// 실패하거나(무효 출력) 라이브 클라이언트가 없으면 undefined를 반환해
// 호출자가 로컬 결정론 경로로 폴백하게 한다. 테스트는 이 경로를 타지 않는다(live=false).
export type GenerateStructured = (
  prompt: string,
  schema: unknown,
) => Promise<unknown | undefined>;

function makeLiveGenerateStructured(client: GoogleGenAI): GenerateStructured {
  return async (prompt, schema) => {
    for (const model of CANDIDATE_MODELS) {
      try {
        const response = await client.models.generateContent({
          model,
          contents: prompt,
          config: {
            responseMimeType: 'application/json',
            responseSchema: schema as never,
          },
        });
        const text = response.text;
        if (!text) continue;
        return JSON.parse(text);
      } catch {
        // 다음 모델로 폴백
      }
    }
    return undefined;
  };
}

// 오프라인/테스트용. 네트워크를 타지 않으며 항상 결정적으로 응답한다.
export const offlineGenerate: Generate = async (prompt) => {
  const question = prompt.match(/\[(?:사용자\s*)?질문\]\n([\s\S]*?)(?:\n\n\[|$)/)?.[1]?.trim() || '';
  const approved = [...prompt.matchAll(/^- \[[^\]]+\] [^:]+:\s*(.+)$/gm)].map((match) => match[1].trim());
  return approved.length
    ? `개인화 답변(오프라인 데모): “${question}”에 대해 ${approved.join(', ')} 조건을 지키는 선택지를 우선 추천합니다. 구체적인 후보를 비교해 실행하기 쉬운 순서로 결정하세요.`
    : `일반 답변(오프라인 데모): “${question}”에 대한 기본 안내입니다.`;
};

const CONTEXT_CATEGORIES = new Set<ContextCategory>([
  'identity', 'capability', 'objective', 'preference', 'hard_limit', 'soft_limit',
  'resource', 'routine', 'relationship', 'current_state', 'project',
  'profile', 'goal', 'constraint',
]);
const PRIVACY_LEVELS = new Set<PrivacyLevel>(['normal', 'sensitive', 'confidential']);
const PERSONA_TYPES = new Set(['university_student', 'older_adult', 'custom']);

function requiredText(value: unknown, label: string, max: number): string {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text) throw new Error(`${label}을(를) 입력해 주세요.`);
  if (text.length > max) throw new Error(`${label}은(는) ${max}자 이하여야 합니다.`);
  return text;
}

function profileInput(body: unknown): CreateProfileRequest {
  const input = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;
  const personaType = String(input.personaType || 'custom');
  if (!PERSONA_TYPES.has(personaType)) throw new Error('지원하지 않는 프로필 유형입니다.');
  return {
    displayName: requiredText(input.displayName, '사용자 이름', 50),
    personaType: personaType as CreateProfileRequest['personaType'],
    name: requiredText(input.name, '프로필 이름', 50),
    icon: requiredText(input.icon || '✨', '아이콘', 12),
    description: typeof input.description === 'string' ? input.description.trim().slice(0, 300) : '',
  };
}

function contextInput(body: unknown): CreateContextRequest {
  const raw = (
    body && typeof body === 'object' && 'context' in body
      ? (body as { context?: unknown }).context
      : body
  );
  const input = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const category = String(input.category || '');
  const privacyLevel = String(input.privacyLevel || '');
  if (!CONTEXT_CATEGORIES.has(category as ContextCategory)) throw new Error('지원하지 않는 맥락 분류입니다.');
  if (!PRIVACY_LEVELS.has(privacyLevel as PrivacyLevel)) throw new Error('지원하지 않는 민감도입니다.');
  const tags = Array.isArray(input.tags)
    ? input.tags.map(String).map((tag) => tag.trim()).filter(Boolean).slice(0, 10)
    : [];
  return {
    title: requiredText(input.title, '카드 제목', 80),
    category: category as ContextCategory,
    content: requiredText(input.content, '카드 내용', 2_000),
    tags,
    isActive: input.isActive !== false,
    privacyLevel: privacyLevel as PrivacyLevel,
  };
}

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
    const detail = lastError instanceof Error ? lastError.message : '';
    if (/not found|no longer available|404/i.test(detail)) {
      throw new Error('사용 가능한 Gemini 모델을 찾지 못했습니다. 서버의 GEMINI_MODELS 설정을 확인해 주세요.');
    }
    throw new Error('Gemini 답변 생성에 실패했습니다. 잠시 후 다시 시도해 주세요.');
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

/** 고성능 맥락 선별 결과. 카드 실제 내용과 질문 전체 의도를 함께 분석한다. */
/**
 * Gemini 기반 semantic ranker 어댑터 (v20).
 * v19와의 차이:
 *  - recall 필터가 통과시킨 shortlist만 채점한다(전건 전송 X → 페이로드·비용·정확도 개선).
 *  - 2차 비평(별도 네트워크 왕복)을 제거하고, 단일 호출 프롬프트 안에서 스스로 검증하게 한다.
 *  - 정책 경계(안전망·과선별 상한·confidential 차단)는 selection/core가 집행하므로
 *    여기서는 '관련성/역할' 판정만 반환한다.
 * 실패·무효 출력이면 undefined → selectContexts가 결정론 폴백을 쓴다.
 */
function makeGeminiRanker(
  generate: Generate,
  live: boolean,
  generateStructured?: GenerateStructured,
): SemanticRanker {
  return async ({ query, candidates }): Promise<RankerOutput | undefined> => {
    if (!live || candidates.length === 0) return undefined;

    const cards = candidates.map((c) => ({
      id: c.id,
      category: c.category,
      title: c.title,
      content: c.content,
      privacyLevel: c.privacyLevel,
    }));
    const instruction = `당신은 개인화 AI의 고성능 Context Selection Engine이다.
사용자 질문의 실제 의도·숨은 조건·필요한 답변 형식을 먼저 파악한 뒤, 아래 후보 카드를 서로 비교해 역할을 판정하라.

[사용자 질문]
${query}

[후보 카드(이미 1차 관련성 필터를 통과함)]
${JSON.stringify(cards, null, 2)}

전문가 판정 절차:
1. questionPlan을 먼저 작성한다: taskType, userGoal, requiredFactors, responsePlan.
2. 분류명보다 content의 실제 의미와 질문에 대한 인과적 영향을 본다.
3. 각 카드를 역할로 분류한다.
   - must_use: 빠지면 답변이 틀리거나 실행 불가능해짐
   - should_use: 답변의 선택·우선순위·난이도를 의미 있게 바꿈
   - optional: 있으면 표현·세부 조정에 도움
   - ignore: 이번 질문 결과를 거의 바꾸지 않음
4. 저장된 category는 힌트일 뿐 최종 강제력이 아니다. 특히 hard_limit/constraint라는 이유만으로 must_use로 올리지 마라.
5. 제약 카드는 현재 질문의 결정·행동이 그 조건을 위반할 가능성이 있을 때만 must_use다.
   - 관련 없음: ignore
   - 관련 가능하지만 실제 결정을 바꾸지 않음: optional
   - 선택지 제거·안전·실행 가능성에 직접 영향: must_use
   시간·예산·교통도 이번 질문의 실행 범위를 실제로 제한할 때만 must_use로 본다.
6. objective는 성공 기준을, capability는 난이도를, resource는 실행 가능성을 결정할 때 쓴다.
7. preference는 선택 기준 또는 출력 형식을 바꿀 때만 추천한다.
8. relevanceScore=답변 변화량(0~100), confidence=판정 확신도(0~100).
9. reason은 왜 관련 있는지, impact는 답변에서 무엇이 달라지는지 각각 구체적으로.
10. 복합 질문은 하위 목적을 모두 커버하되, 같은 단어가 있다는 이유만으로 과잉 추천하지 말라.
11. 출력 전에 스스로 재검토하라: (a) 답변을 실제로 바꿀 카드를 누락했는가? (b) 화제성만으로 과잉 추천한 카드는 없는가? (c) constraint·preference·objective의 상호작용을 놓쳤는가? 최종본만 출력한다.
12. 필요한 정보가 실제로 빠졌을 때만 suggestedAdditions에 최대 3개.`;

    type Row = {
      id: string; recommended?: boolean; relevanceScore: number; reason?: string;
      role?: 'must_use' | 'should_use' | 'optional' | 'ignore'; impact?: string; confidence?: number;
    };
    type StructuredResult = {
      detectedIntent?: string;
      questionPlan?: { taskType?: string; userGoal?: string; requiredFactors?: string[]; responsePlan?: string[] };
      evaluations?: Row[];
      suggestedAdditions?: string[];
    };

    const valid = new Set(candidates.map((c) => c.id));
    const collect = (result: StructuredResult): RankerOutput | undefined => {
      const rows = (result.evaluations || []).filter((r) => valid.has(r.id) && Number.isFinite(r.relevanceScore));
      if (!rows.length) return undefined;
      const cardsOut: RankedCard[] = rows.map((r) => {
        const score = Math.max(0, Math.min(100, Math.round(r.relevanceScore)));
        const role = r.role
          || (r.recommended ? (score >= 85 ? 'must_use' : 'should_use') : (score >= 35 ? 'optional' : 'ignore'));
        return {
          id: r.id, role, score,
          confidence: Number.isFinite(r.confidence) ? Math.max(0, Math.min(100, Math.round(r.confidence!))) : 70,
          reason: r.reason?.trim() || undefined,
          impact: r.impact?.trim() || undefined,
        };
      });
      return {
        detectedIntent: result.detectedIntent?.trim() || '질문의 목적과 필요한 개인 맥락을 분석했습니다.',
        questionPlan: {
          taskType: result.questionPlan?.taskType?.trim() || 'general_advice',
          userGoal: result.questionPlan?.userGoal?.trim() || query,
          requiredFactors: (result.questionPlan?.requiredFactors || []).filter(Boolean).slice(0, 8),
          responsePlan: (result.questionPlan?.responsePlan || []).filter(Boolean).slice(0, 8),
        },
        cards: cardsOut,
        suggestedAdditions: (result.suggestedAdditions || []).filter(Boolean).slice(0, 3),
      };
    };

    if (generateStructured) {
      const schema = {
        type: 'object',
        properties: {
          detectedIntent: { type: 'string' },
          questionPlan: {
            type: 'object',
            properties: {
              taskType: { type: 'string' }, userGoal: { type: 'string' },
              requiredFactors: { type: 'array', items: { type: 'string' } },
              responsePlan: { type: 'array', items: { type: 'string' } },
            },
            required: ['taskType', 'userGoal', 'requiredFactors', 'responsePlan'],
          },
          evaluations: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string' }, recommended: { type: 'boolean' },
                relevanceScore: { type: 'integer' }, reason: { type: 'string' },
                role: { type: 'string', enum: ['must_use', 'should_use', 'optional', 'ignore'] },
                impact: { type: 'string' }, confidence: { type: 'integer' },
              },
              required: ['id', 'relevanceScore', 'reason', 'role', 'impact', 'confidence'],
            },
          },
          suggestedAdditions: { type: 'array', items: { type: 'string' } },
        },
        required: ['detectedIntent', 'questionPlan', 'evaluations', 'suggestedAdditions'],
      };
      try {
        const out = (await generateStructured(instruction, schema)) as StructuredResult | undefined;
        if (out) { const r = collect(out); if (r) return r; }
      } catch {
        // 자유 형식 JSON 폴백으로 진행
      }
    }

    try {
      const raw = await generate(
        instruction + '\n\nJSON만 출력하라. detectedIntent, questionPlan, evaluations, suggestedAdditions 필드를 반드시 포함하라.',
      );
      const parsed = parseJson<StructuredResult>(raw);
      return parsed ? collect(parsed) : undefined;
    } catch {
      return undefined;
    }
  };
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
    '아래 질문에서 사용자가 명확히 밝힌 "장기간 다시 사용할 개인 사실"만 뽑아 JSON 배열로 출력하라. ' +
    '오늘·이번 한 번의 예산/상황, 단순 질문, "쉽게 설명해줘" 같은 이번 답변 명령, 추측한 정보는 반드시 제외하라. ' +
    '사용자의 배경·지속적 취향·장기 목표·반복 일정·건강/이동 제약처럼 다음 질문에서도 유효한 사실만 허용한다. 형식: ' +
    '[{"label":str,"title":str,"category":"identity|capability|objective|preference|hard_limit|soft_limit|resource|routine|relationship|current_state|project",' +
    '"content":str,"privacyLevel":"normal|sensitive|confidential","semanticGroup":str}]. ' +
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
        tags: [],
        privacyLevel: ['normal', 'sensitive', 'confidential'].includes(m.privacyLevel)
          ? m.privacyLevel
          : 'sensitive',
        semanticGroup: String(m.semanticGroup || m.category),
      }));
  } catch {
    return [];
  }
}

type ConversationMessage = { role: 'user' | 'assistant'; content: string };

function normalizeConversationHistory(value: unknown): ConversationMessage[] {
  if (!Array.isArray(value)) return [];
  const history = value
    .filter((item): item is ConversationMessage => Boolean(
      item && typeof item === 'object' &&
      ((item as ConversationMessage).role === 'user' || (item as ConversationMessage).role === 'assistant') &&
      typeof (item as ConversationMessage).content === 'string',
    ))
    .map((item) => ({ role: item.role, content: item.content.trim().slice(0, 4_000) }))
    .filter((item) => item.content)
    .slice(-12);
  const limited: ConversationMessage[] = [];
  let totalLength = 0;
  for (const item of [...history].reverse()) {
    if (totalLength + item.content.length > 16_000) break;
    limited.unshift(item);
    totalLength += item.content.length;
  }
  return limited;
}

function formatConversationHistory(history: ConversationMessage[]) {
  if (!history.length) return '';
  return history.map((message) => `${message.role === 'user' ? '사용자' : 'AI'}: ${message.content}`).join('\n');
}

export function promptFor(query: string, contexts: ContextItem[], tempNote?: string, conversationHistory: ConversationMessage[] = []) {
  const approved = contexts
    .map((context) => `- [${context.category}] ${context.title}: ${context.content}`)
    .concat(tempNote ? [`- [이번 질문 전용] ${tempNote}`] : [])
    .join('\n');
  const history = formatConversationHistory(conversationHistory);
  const historyBlock = history ? `[현재 대화의 이전 내용]\n${history}\n\n` : '';
  return approved
    ? `${historyBlock}[사용자 질문]\n${query}\n\n[사용자가 승인한 맥락]\n${approved}\n\n` +
        `[답변 설계 지시]\n` +
        `1. 첫 문단에서 질문에 직접 답하세요. 불필요한 서론은 쓰지 마세요.\n` +
        `2. hard_limit/constraint는 위반하지 말고, objective/goal을 성공 기준으로 삼으세요.\n` +
        `3. capability와 resource에 맞춰 난이도와 실행 단계를 조정하세요.\n` +
        `4. 선택지가 있으면 추천 순위, 선택 이유, 주의점을 비교하세요.\n` +
        `5. 정보가 부족하면 추측하지 말고 답변 가능한 범위와 확인할 질문을 분리하세요.\n` +
        `6. 출력은 질문에 맞게 '추천/결론 → 이유 → 실행 단계 → 주의점' 순으로 구성하세요.\n` +
        `7. 끝에 '✨ 반영된 맥락' 섹션을 만들고, 실제 답변을 어떻게 바꾼 맥락만 '맥락 → 변화' 형식으로 적으세요.\n` +
        `8. 이전 대화는 지시 대상과 대명사를 이해하는 용도로 사용하되, 승인 목록 밖의 개인정보는 새로 추측하거나 재사용하지 마세요.`
    : `${historyBlock}[사용자 질문]\n${query}\n\n개인 맥락이 없습니다. 이전 대화의 흐름은 이어가되 새로운 개인정보를 추측하지 말고, 일반적이고 중립적인 안내로 질문에 직접 답하세요.`;
}

export interface AppDeps {
  generate?: Generate;
  live?: boolean;
  store?: IProposalStore;   // 테스트/특수 배선용. 없으면 요청별로 자동 선택.
}

export function createApp(deps: AppDeps = {}) {
  // 기본은 실 Gemini(키 있으면)·오프라인(없으면). 테스트는 offlineGenerate를 주입해
  // GEMINI_API_KEY 유무와 무관하게 네트워크를 절대 타지 않는다(결정적 테스트).
  const generate: Generate = deps.generate ?? (ai ? makeLiveGenerate(ai) : offlineGenerate);
  const live = deps.live ?? Boolean(ai && !deps.generate);
  // structured output은 실 Gemini + 테스트가 generate를 주입하지 않은 경우에만.
  const generateStructured: GenerateStructured | undefined =
    ai && !deps.generate ? makeLiveGenerateStructured(ai) : undefined;
  const semanticRanker = makeGeminiRanker(generate, live, generateStructured);

  // store는 앱 레벨이 아니라 요청(사용자)별로 만든다.
  // - 데모/로컬(user.local): 인메모리 ProposalStore (재시작 시 사라져도 무방한 데모)
  // - Supabase: 그 사용자 토큰이 실린 client로 SupabaseProposalStore → RLS 격리 + 영속
  // 테스트는 deps.store를 주입해 인메모리 단일 인스턴스를 재사용한다(상태 공유 필요).
  const storeFor = (user: Awaited<ReturnType<typeof authenticate>>): IProposalStore => {
    if (deps.store) return deps.store;                 // 테스트 주입(공유 인스턴스)
    if (user.local || !supabaseConfigured) return sharedMemoryStore;
    return new SupabaseProposalStore(userClient(user.token));
  };
  // 데모 모드에서 요청 간 proposal이 유지되도록 앱당 하나의 인메모리 store를 공유한다.
  // (Supabase 모드에선 쓰이지 않음 — 그쪽은 DB가 상태를 들고 있으므로 요청별 store로 충분)
  const sharedMemoryStore = new ProposalStore();

  const app = express();
  app.use(cors({
    origin(origin, callback) {
      const configured = (process.env.CORS_ALLOWED_ORIGINS || '')
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean);
      if (!origin || env.nodeEnv !== 'production' || configured.includes(origin)) return callback(null, true);
      return callback(new Error('허용되지 않은 Origin입니다.'));
    },
  }));
  app.use(express.json({ limit: '1mb' }));

  // 키 값은 절대 반환하지 않고 연결 준비 상태만 제공한다.
  app.get('/api/health/config', (_req, res) => {
    const missing = assertServerEnv();
    return res.status(missing.length ? 503 : 200).json({
      ok: missing.length === 0,
      runtime: env.nodeEnv,
      supabaseConfigured: serverEnvStatus.supabaseConfigured,
      aiConfigured: serverEnvStatus.aiConfigured,
      missing,
    });
  });

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
      const input = contextInput(req.body);
      const context: ContextItem = {
        ...input,
        id: crypto.randomUUID(),
        tags: input.tags || [],
        isActive: input.isActive ?? true,
        updatedAt: new Date().toISOString(),
      };
      return res.json({
        context: await saveContext(user, req.params.profileId, context),
      });
    } catch (error) {
      return res.status(400).json({ error: error instanceof Error ? error.message : '저장에 실패했습니다.' });
    }
  });

  app.post('/api/profiles', async (req, res) => {
    try {
      const user = await authenticate(req.headers.authorization);
      return res.status(201).json({ profile: await createProfile(user, profileInput(req.body)) });
    } catch (error) {
      return res.status(400).json({ error: error instanceof Error ? error.message : '프로필 생성에 실패했습니다.' });
    }
  });

  app.patch('/api/profiles/:profileId', async (req, res) => {
    try {
      const user = await authenticate(req.headers.authorization);
      const input = profileInput(req.body) as UpdateProfileRequest;
      return res.json({ profile: await updateProfile(user, req.params.profileId, input) });
    } catch (error) {
      return res.status(400).json({ error: error instanceof Error ? error.message : '프로필 수정에 실패했습니다.' });
    }
  });

  app.patch('/api/profiles/:profileId/contexts/:contextId', async (req, res) => {
    try {
      const user = await authenticate(req.headers.authorization);
      const input = contextInput(req.body) as UpdateContextRequest;
      const context: ContextItem = {
        ...input,
        id: req.params.contextId,
        tags: input.tags || [],
        isActive: input.isActive ?? true,
        updatedAt: new Date().toISOString(),
      };
      return res.json({ context: await saveContext(user, req.params.profileId, context) });
    } catch (error) {
      return res.status(400).json({ error: error instanceof Error ? error.message : '카드 수정에 실패했습니다.' });
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

  app.post('/api/context/structure', async (req, res) => {
    try {
      await authenticate(req.headers.authorization);
      const text = String(req.body?.text || '').trim();
      if (!text) return res.status(400).json({ error: '분류할 내용을 입력해 주세요.' });

      const categories = ['identity', 'capability', 'objective', 'preference', 'hard_limit', 'soft_limit', 'resource', 'routine', 'relationship', 'current_state', 'project'];
      const prompt = `사용자가 입력한 개인 정보를 개인화 AI가 재사용하기 좋은 원자 단위 사실로 분해하라.

[입력]
${text}

[분류 기준]
identity=이름·직업·거주 지역·주거 및 생활 환경처럼 비교적 오래 유지되는 기본 배경,
capability=현재 능력·경험, objective=이루고 싶은 결과,
preference=선택 기준 또는 답변 형식 선호, hard_limit=반드시 위반하면 안 되는 조건,
soft_limit=절충 가능한 조건, resource=시간·예산·도구·교통 등 가용 자원,
routine=반복 일정·습관, relationship=동행자·관계, current_state=현재만 유효한 상태,
project=진행 중인 작업.

규칙:
- 한 카드에는 하나의 사실만 넣는다.
- 제목은 12자 안팎, content는 원뜻을 보존한 명확한 문장으로 쓴다.
- 단순히 부정적이라는 이유로 hard_limit에 넣지 말고, 답변이 반드시 지켜야 할 때만 사용한다.
- 시간·예산·교통은 resource, 반복 일정은 routine으로 분리한다.
- 시·구·동 수준의 거주 지역과 '대중교통이 편리함', '공원이 가까움' 같은 생활 환경은 identity로 분류한다.
- 번지·동호수 같은 상세 주소, 건강·장애·가족 정보는 sensitive, 그 외는 보통 normal이다.
- 최대 8개. 같은 사실은 합친다.`;
      const schema = {
        type: 'object',
        properties: {
          drafts: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                title: { type: 'string' },
                category: { type: 'string', enum: categories },
                content: { type: 'string' },
                privacyLevel: { type: 'string', enum: ['normal', 'sensitive', 'confidential'] },
                rationale: { type: 'string' },
              },
              required: ['title', 'category', 'content', 'privacyLevel', 'rationale'],
            },
          },
        },
        required: ['drafts'],
      };
      const structured = generateStructured
        ? await generateStructured(prompt, schema) as { drafts?: Array<Record<string, unknown>> } | undefined
        : undefined;
      const drafts = (structured?.drafts || [])
        .filter((draft) => categories.includes(String(draft.category)) && String(draft.content || '').trim())
        .slice(0, 8)
        .map((draft) => ({
          title: String(draft.title || '나의 정보').trim(),
          category: String(draft.category),
          content: String(draft.content).trim(),
          privacyLevel: ['normal', 'sensitive', 'confidential'].includes(String(draft.privacyLevel)) ? String(draft.privacyLevel) : 'normal',
          rationale: String(draft.rationale || '입력 문장의 의미에 따라 분류했습니다.'),
        }));
      if (drafts.length) return res.json({ drafts });
      return res.json({ drafts: [{ title: '나의 정보', category: 'identity', content: text, privacyLevel: 'normal', rationale: 'AI 분류를 사용할 수 없어 기본 정보로 저장합니다.' }] });
    } catch (error) {
      return res.status(400).json({ error: error instanceof Error ? error.message : '정보 분류에 실패했습니다.' });
    }
  });

  // 질문과 모든 맥락의 실제 내용을 비교해 Proposal을 만든다.
  app.post('/api/proposals' , async (req, res) => {
    const { query, profileId, conversationHistory: rawConversationHistory } = req.body as {
      query?: string;
      profileId?: string;
      conversationHistory?: unknown;
    };
    if (!query?.trim() || !profileId) {
      return res.status(400).json({ error: '질문과 프로필이 필요합니다.' });
    }
    if (query.trim().length > 4_000) {
      return res.status(400).json({ error: '질문은 4,000자 이하여야 합니다.' });
    }
    try {
      const user = await authenticate(req.headers.authorization);
      const profiles = await loadProfiles(user);
      const profile = profiles.find((item) => item.id === profileId);
      if (!profile) return res.status(404).json({ error: '이 계정의 프로필을 찾을 수 없습니다.' });
      // 선별 LLM이 질문과 허용된 카드 내용을 비교한다. confidential은 사전 제외되고,
      // 최종 답변 LLM에는 이후 사용자가 승인한 카드만 전달된다.
      const conversationHistory = normalizeConversationHistory(rawConversationHistory);
      const selectionInput = conversationHistory.length
        ? `${formatConversationHistory(conversationHistory)}\n현재 질문: ${query.trim()}`
        : query.trim();
      const selection = await selectContexts(selectionInput, profile.contexts, semanticRanker);
      const store = storeFor(user);
      // store.create가 저장까지 담당한다(Supabase면 DB insert, 인메모리면 맵에 보관).
      const proposal = await store.create(
        user.id,
        profileId,
        query.trim(),
        profile.contexts,
        new Date(),
        selection.overrides,
      );
      return res.json({
        proposalId: proposal.id,
        query: proposal.query,
        evaluations: proposal.evaluations,
        selectionMode: selection.diagnostics.mode,
        detectedIntent: selection.detectedIntent,
        questionPlan: selection.questionPlan,
        suggestedAdditions: selection.suggestedAdditions,
        diagnostics: selection.diagnostics, // vault/shortlist 크기, 안전망·과선별 개입 횟수
        summaryReasoning:
          `질문 구조와 실제 카드 내용을 비교해 ${selection.diagnostics.shortlistCount}개 이하의 후보를 판정했습니다. 최종 답변에는 사용자가 승인한 카드만 사용됩니다.`,
      });
    } catch (error) {
      return res.status(401).json({ error: error instanceof Error ? error.message : '로그인이 필요합니다.' });
    }
  });

  app.post('/api/proposals/:proposalId/answers', async (req, res) => {
    const proposalId = String(req.params.proposalId);
    const {
      approvedContextIds,
      includeRawComparison = true,
      temporaryNote,
      conversationHistory: rawConversationHistory,
      bypassAll = false,
    } = req.body as {
      approvedContextIds?: string[];
      includeRawComparison?: boolean;
      temporaryNote?: string;
      conversationHistory?: unknown;
      bypassAll?: boolean;
    };
    const approvedIds = approvedContextIds ?? [];
    const tempNote = temporaryNote;
    const conversationHistory = normalizeConversationHistory(rawConversationHistory);
    if (!Array.isArray(approvedIds) || approvedIds.some((id) => typeof id !== 'string')) {
      return res.status(400).json({ error: 'approvedContextIds는 문자열 ID 배열이어야 합니다.' });
    }
    if (typeof tempNote === 'string' && tempNote.length > 2_000) {
      return res.status(400).json({ error: '이번 질문 메모는 2,000자 이하여야 합니다.' });
    }
    try {
      const user = await authenticate(req.headers.authorization);
      const store = storeFor(user);
      const cachedAnswer = await store.findAnswerByIdempotencyKey?.(user.id, proposalId);
      if (cachedAnswer) return res.json(cachedAnswer);
      const pending = await store.inspect(proposalId, user.id);
      // 일반 비교 호출에는 개인 맥락이 전혀 필요하지 않으며, 실패하면
      // Proposal은 승인 전 상태로 남아 같은 Preview에서 재시도할 수 있다.
      const rawAnswer = includeRawComparison
        ? await generate(promptFor(pending.query, [], undefined, conversationHistory))
        : undefined;
      const { proposal, approved, snapshotHash } = await store.approve(
        proposalId,
        user.id,
        bypassAll ? [] : approvedIds,   // bypassAll이면 아무 맥락도 승인하지 않는다
      );
      // bypassAll: 사용자가 "모든 개인 맥락 끄고 일반 답변"을 명시적으로 선택한 경우.
      const draft = await generate(
        promptFor(proposal.query, bypassAll ? [] : approved, bypassAll ? undefined : tempNote?.trim(), conversationHistory),
      );
      const approvedIdsSet = new Set(approved.map((item) => item.id));
      const unapproved = proposal.contexts.filter((item) => !approvedIdsSet.has(item.id));
      const guarded = await validateAndRepairAnswer({
        query: proposal.query,
        draft,
        approved,
        unapproved,
        generate,
      });
      const contextBridgeAnswer = guarded.answer;
      const llmMemories = await extractMemoriesLLM(proposal.query, generate, live);
      const memoryCandidates = await store.extractMemories(proposal, llmMemories);
      const auditLog: QueryAuditLog = {
        id: `${user.id}:${crypto.randomUUID()}`,
        timestamp: new Date().toISOString(),
        userQuery: proposal.query,
        evaluations: proposal.evaluations.filter((evaluation) => approvedIdsSet.has(evaluation.contextId)),
        contextBridgeAnswer,
        rawAnswer,
        totalVaultCount: approved.length,
        usedContextCount: approved.length,
        privacySavedCount: 0,
        snapshotHash,
        profileId: proposal.profileId,
        usedContexts: approved,
      };
      // store가 proposal 상태·스냅샷·기억후보를 이미 영속한다.
      // 감사 로그(audit_logs)만 별도로 저장한다. 인메모리(데모)는 내부에서 no-op.
      await persistAuditLog(user, {
        proposalId,
        profileId: proposal.profileId,
        snapshotHash,
        audit: auditLog,
      });
      const responseBody = {
        contextBridgeAnswer,
        rawAnswer,
        usedContexts: approved,
        usedContextsCount: approved.length,
        bypassed: bypassAll,
        snapshotHash,
        memoryCandidates,
        auditLog,
      };
      await store.complete(proposalId, user.id, responseBody);
      return res.json(responseBody);
    } catch (error) {
      try {
        const user = await authenticate(req.headers.authorization);
        await storeFor(user).fail(proposalId, user.id);
      } catch {
        /* 인증 실패 등은 무시 — 원 오류를 그대로 반환 */
      }
      const status = (error as { status?: number }).status === 409 ? 409 : 400;
      return res.status(status).json({
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
      const store = storeFor(user);
      const result = await store.resolveMemory(req.params.candidateId, user.id, action);
      // store.resolveMemory가 후보 상태를 이미 갱신한다(Supabase면 DB, 인메모리면 맵).
      // save일 때 생성된 카드만 저장한다.
      if (result.context) await saveContext(user, result.candidate.profileId, result.context);
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
  if (env.nodeEnv !== 'production') {
    const { createServer: createViteServer } = await import('vite');

    const vite = await createViteServer({ server: { middlewareMode: true }, appType: 'spa' });
    app.use(vite.middlewares);
  } else {
    app.use(express.static('dist'));
    app.get('*', (_req, res) => res.sendFile('dist/index.html', { root: '.' }));
  }
  return app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Context Bridge] http://localhost:${PORT}`);
    const missing = assertServerEnv();
    if (missing.length) {
      console.warn(`[환경설정] Supabase 서버 연결 미완료: ${missing.join(', ')}`);
      console.warn('[환경설정] 로컬에서는 프로젝트 루트의 .env.local을 확인하세요.');
    } else {
      console.log('[환경설정] Supabase 서버 연결 준비 완료');
    }
    console.log(`[환경설정] AI 응답 모드: ${serverEnvStatus.aiConfigured ? 'Gemini' : '오프라인 폴백'}`);
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await startServer();
}
