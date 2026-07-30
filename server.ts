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
// 理쒖떊 ???대갚 ?? gemini-flash-latest??GA Flash瑜?媛由ы궎??蹂꾩묶?대씪
// 紐⑤뜽 ?몃?媛 諛붾뚯뼱??肄붾뱶 ?섏젙 ?놁씠 ?곕씪媛꾨떎.
const CANDIDATE_MODELS = ['gemini-flash-latest', 'gemini-2.5-flash', 'gemini-2.5-flash-lite'];

export type Generate = (prompt: string) => Promise<string>;

// ?ㅽ궎留덈? 媛뺤젣??JSON??諛쏅뒗 ?앹꽦湲? Gemini responseSchema瑜??대떎.
// ?ㅽ뙣?섍굅??臾댄슚 異쒕젰) ?쇱씠釉??대씪?댁뼵?멸? ?놁쑝硫?undefined瑜?諛섑솚??
// ?몄텧?먭? 濡쒖뺄 寃곗젙濡?寃쎈줈濡??대갚?섍쾶 ?쒕떎. ?뚯뒪?몃뒗 ??寃쎈줈瑜??吏 ?딅뒗??live=false).
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
        // ?ㅼ쓬 紐⑤뜽濡??대갚
      }
    }
    return undefined;
  };
}

// ?ㅽ봽?쇱씤/?뚯뒪?몄슜. ?ㅽ듃?뚰겕瑜??吏 ?딆쑝硫???긽 寃곗젙?곸쑝濡??묐떟?쒕떎.
export const offlineGenerate: Generate = async (prompt) => {
  const question = prompt.match(/\[(?:?ъ슜??s*)?吏덈Ц\]\n([\s\S]*?)(?:\n\n\[|$)/)?.[1]?.trim() || '';
  const approved = [...prompt.matchAll(/^- \[[^\]]+\] [^:]+:\s*(.+)$/gm)].map((match) => match[1].trim());
  return approved.length
    ? `媛쒖씤???듬?(?ㅽ봽?쇱씤 ?곕え): ??{question}?앹뿉 ???${approved.join(', ')} 議곌굔??吏?ㅻ뒗 ?좏깮吏瑜??곗꽑 異붿쿇?⑸땲?? 援ъ껜?곸씤 ?꾨낫瑜?鍮꾧탳???ㅽ뻾?섍린 ?ъ슫 ?쒖꽌濡?寃곗젙?섏꽭??`
    : `?쇰컲 ?듬?(?ㅽ봽?쇱씤 ?곕え): ??{question}?앹뿉 ???湲곕낯 ?덈궡?낅땲??`;
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
  if (!text) throw new Error(`${label}??瑜? ?낅젰??二쇱꽭??`);
  if (text.length > max) throw new Error(`${label}?(?? ${max}???댄븯?ъ빞 ?⑸땲??`);
  return text;
}

function profileInput(body: unknown): CreateProfileRequest {
  const input = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;
  const personaType = String(input.personaType || 'custom');
  if (!PERSONA_TYPES.has(personaType)) throw new Error('吏?먰븯吏 ?딅뒗 ?꾨줈???좏삎?낅땲??');
  return {
    displayName: requiredText(input.displayName, '?ъ슜???대쫫', 50),
    personaType: personaType as CreateProfileRequest['personaType'],
    name: requiredText(input.name, '?꾨줈???대쫫', 50),
    icon: requiredText(input.icon || '??, '?꾩씠肄?, 12),
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
  if (!CONTEXT_CATEGORIES.has(category as ContextCategory)) throw new Error('吏?먰븯吏 ?딅뒗 留λ씫 遺꾨쪟?낅땲??');
  if (!PRIVACY_LEVELS.has(privacyLevel as PrivacyLevel)) throw new Error('吏?먰븯吏 ?딅뒗 誘쇨컧?꾩엯?덈떎.');
  const tags = Array.isArray(input.tags)
    ? input.tags.map(String).map((tag) => tag.trim()).filter(Boolean).slice(0, 10)
    : [];
  return {
    title: requiredText(input.title, '移대뱶 ?쒕ぉ', 80),
    category: category as ContextCategory,
    content: requiredText(input.content, '移대뱶 ?댁슜', 2_000),
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
        return response.text || '?듬????앹꽦?섏? 紐삵뻽?듬땲??';
      } catch (error) {
        lastError = error;
      }
    }
    throw lastError instanceof Error ? lastError : new Error('紐⑤뱺 Gemini 紐⑤뜽 ?몄텧???ㅽ뙣?덉뒿?덈떎.');
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

/** 怨좎꽦??留λ씫 ?좊퀎 寃곌낵. 移대뱶 ?ㅼ젣 ?댁슜怨?吏덈Ц ?꾩껜 ?섎룄瑜??④퍡 遺꾩꽍?쒕떎. */
/**
 * Gemini 湲곕컲 semantic ranker ?대뙌??(v20).
 * v19???李⑥씠:
 *  - recall ?꾪꽣媛 ?듦낵?쒗궓 shortlist留?梨꾩젏?쒕떎(?꾧굔 ?꾩넚 X ???섏씠濡쒕뱶쨌鍮꾩슜쨌?뺥솗??媛쒖꽑).
 *  - 2李?鍮꾪룊(蹂꾨룄 ?ㅽ듃?뚰겕 ?뺣났)???쒓굅?섍퀬, ?⑥씪 ?몄텧 ?꾨＼?꾪듃 ?덉뿉???ㅼ뒪濡?寃利앺븯寃??쒕떎.
 *  - ?뺤콉 寃쎄퀎(?덉쟾留씲룰낵?좊퀎 ?곹븳쨌confidential 李⑤떒)??selection/core媛 吏묓뻾?섎?濡?
 *    ?ш린?쒕뒗 '愿?⑥꽦/??븷' ?먯젙留?諛섑솚?쒕떎.
 * ?ㅽ뙣쨌臾댄슚 異쒕젰?대㈃ undefined ??selectContexts媛 寃곗젙濡??대갚???대떎.
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
    const instruction = `?뱀떊? 媛쒖씤??AI??怨좎꽦??Context Selection Engine?대떎.
?ъ슜??吏덈Ц???ㅼ젣 ?섎룄쨌?⑥? 議곌굔쨌?꾩슂???듬? ?뺤떇??癒쇱? ?뚯븙???? ?꾨옒 ?꾨낫 移대뱶瑜??쒕줈 鍮꾧탳????븷???먯젙?섎씪.

[?ъ슜??吏덈Ц]
${query}

[?꾨낫 移대뱶(?대? 1李?愿?⑥꽦 ?꾪꽣瑜??듦낵??]
${JSON.stringify(cards, null, 2)}

?꾨Ц媛 ?먯젙 ?덉감:
1. questionPlan??癒쇱? ?묒꽦?쒕떎: taskType, userGoal, requiredFactors, responsePlan.
2. 遺꾨쪟紐낅낫??content???ㅼ젣 ?섎?? 吏덈Ц??????멸낵???곹뼢??蹂몃떎.
3. 媛?移대뱶瑜???븷濡?遺꾨쪟?쒕떎.
   - must_use: 鍮좎?硫??듬????由ш굅???ㅽ뻾 遺덇??ν빐吏?
   - should_use: ?듬????좏깮쨌?곗꽑?쒖쐞쨌?쒖씠?꾨? ?섎? ?덇쾶 諛붽퓞
   - optional: ?덉쑝硫??쒗쁽쨌?몃? 議곗젙???꾩?
   - ignore: ?대쾲 吏덈Ц 寃곌낵瑜?嫄곗쓽 諛붽씀吏 ?딆쓬
4. ??λ맂 category???뚰듃??肉?理쒖쥌 媛뺤젣?μ씠 ?꾨땲?? ?뱁엳 hard_limit/constraint?쇰뒗 ?댁쑀留뚯쑝濡?must_use濡??щ━吏 留덈씪.
5. ?쒖빟 移대뱶???꾩옱 吏덈Ц??寃곗젙쨌?됰룞??洹?議곌굔???꾨컲??媛?μ꽦???덉쓣 ?뚮쭔 must_use??
   - 愿???놁쓬: ignore
   - 愿??媛?ν븯吏留??ㅼ젣 寃곗젙??諛붽씀吏 ?딆쓬: optional
   - ?좏깮吏 ?쒓굅쨌?덉쟾쨌?ㅽ뻾 媛?μ꽦??吏곸젒 ?곹뼢: must_use
   ?쒓컙쨌?덉궛쨌援먰넻???대쾲 吏덈Ц???ㅽ뻾 踰붿쐞瑜??ㅼ젣濡??쒗븳???뚮쭔 must_use濡?蹂몃떎.
6. objective???깃났 湲곗??? capability???쒖씠?꾨?, resource???ㅽ뻾 媛?μ꽦??寃곗젙?????대떎.
7. preference???좏깮 湲곗? ?먮뒗 異쒕젰 ?뺤떇??諛붽? ?뚮쭔 異붿쿇?쒕떎.
8. relevanceScore=?듬? 蹂?붾웾(0~100), confidence=?먯젙 ?뺤떊??0~100).
9. reason? ??愿???덈뒗吏, impact???듬??먯꽌 臾댁뾿???щ씪吏?붿? 媛곴컖 援ъ껜?곸쑝濡?
10. 蹂듯빀 吏덈Ц? ?섏쐞 紐⑹쟻??紐⑤몢 而ㅻ쾭?섎릺, 媛숈? ?⑥뼱媛 ?덈떎???댁쑀留뚯쑝濡?怨쇱엵 異붿쿇?섏? 留먮씪.
11. 異쒕젰 ?꾩뿉 ?ㅼ뒪濡??ш??좏븯?? (a) ?듬????ㅼ젣濡?諛붽? 移대뱶瑜??꾨씫?덈뒗媛? (b) ?붿젣?깅쭔?쇰줈 怨쇱엵 異붿쿇??移대뱶???녿뒗媛? (c) constraint쨌preference쨌objective???곹샇?묒슜???볦낀?붽?? 理쒖쥌蹂몃쭔 異쒕젰?쒕떎.
12. ?꾩슂???뺣낫媛 ?ㅼ젣濡?鍮좎죱???뚮쭔 suggestedAdditions??理쒕? 3媛?`;

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
        detectedIntent: result.detectedIntent?.trim() || '吏덈Ц??紐⑹쟻怨??꾩슂??媛쒖씤 留λ씫??遺꾩꽍?덉뒿?덈떎.',
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
        // ?먯쑀 ?뺤떇 JSON ?대갚?쇰줈 吏꾪뻾
      }
    }

    try {
      const raw = await generate(
        instruction + '\n\nJSON留?異쒕젰?섎씪. detectedIntent, questionPlan, evaluations, suggestedAdditions ?꾨뱶瑜?諛섎뱶???ы븿?섎씪.',
      );
      const parsed = parseJson<StructuredResult>(raw);
      return parsed ? collect(parsed) : undefined;
    } catch {
      return undefined;
    }
  };
}

/**
 * LLM 湲곗뼲 異붿텧. 吏덈Ц?먯꽌 ??媛쒖씤 留λ씫??戮묐뒗?? ?ㅽ뙣쨌臾댄슚 異쒕젰?대㈃ 鍮?諛곗뿴 ??
 * core媛 洹쒖튃 異붿텧湲곕줈 ?대갚. LLM 寃곌낵? 洹쒖튃 寃곌낵??core?먯꽌 ?쇰꺼 湲곗? 蹂묓빀?쒕떎.
 */
async function extractMemoriesLLM(
  query: string,
  generate: Generate,
  live: boolean,
): Promise<ExtractedMemory[]> {
  if (!live) return [];
  const prompt =
    '?꾨옒 吏덈Ц?먯꽌 ?ъ슜?먭? 紐낇솗??諛앺엺 "?κ린媛??ㅼ떆 ?ъ슜??媛쒖씤 ?ъ떎"留?戮묒븘 JSON 諛곗뿴濡?異쒕젰?섎씪. ' +
    '?ㅻ뒛쨌?대쾲 ??踰덉쓽 ?덉궛/?곹솴, ?⑥닚 吏덈Ц, "?쎄쾶 ?ㅻ챸?댁쨾" 媛숈? ?대쾲 ?듬? 紐낅졊, 異붿륫???뺣낫??諛섎뱶???쒖쇅?섎씪. ' +
    '?ъ슜?먯쓽 諛곌꼍쨌吏?띿쟻 痍⑦뼢쨌?κ린 紐⑺몴쨌諛섎났 ?쇱젙쨌嫄닿컯/?대룞 ?쒖빟泥섎읆 ?ㅼ쓬 吏덈Ц?먯꽌???좏슚???ъ떎留??덉슜?쒕떎. ?뺤떇: ' +
    '[{"label":str,"title":str,"category":"identity|capability|objective|preference|hard_limit|soft_limit|resource|routine|relationship|current_state|project",' +
    '"content":str,"privacyLevel":"normal|sensitive|confidential","semanticGroup":str}]. ' +
    '嫄닿컯쨌?대룞?쒖빟 ?깆? sensitive. ?놁쑝硫?[]. ?ㅻ챸 湲덉?.\n\n吏덈Ц: ' +
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

export function promptFor(query: string, contexts: ContextItem[], tempNote?: string) {
  const approved = contexts
    .map((context) => `- [${context.category}] ${context.title}: ${context.content}`)
    .concat(tempNote ? [`- [?대쾲 吏덈Ц ?꾩슜] ${tempNote}`] : [])
    .join('\n');
  return approved
    ? `[?ъ슜??吏덈Ц]\n${query}\n\n[?ъ슜?먭? ?뱀씤??留λ씫]\n${approved}\n\n` +
        `[?듬? ?ㅺ퀎 吏??\n` +
        `1. 泥?臾몃떒?먯꽌 吏덈Ц??吏곸젒 ?듯븯?몄슂. 遺덊븘?뷀븳 ?쒕줎? ?곗? 留덉꽭??\n` +
        `2. hard_limit/constraint???꾨컲?섏? 留먭퀬, objective/goal???깃났 湲곗??쇰줈 ?쇱쑝?몄슂.\n` +
        `3. capability? resource??留욎떠 ?쒖씠?꾩? ?ㅽ뻾 ?④퀎瑜?議곗젙?섏꽭??\n` +
        `4. ?좏깮吏媛 ?덉쑝硫?異붿쿇 ?쒖쐞, ?좏깮 ?댁쑀, 二쇱쓽?먯쓣 鍮꾧탳?섏꽭??\n` +
        `5. ?뺣낫媛 遺議깊븯硫?異붿륫?섏? 留먭퀬 ?듬? 媛?ν븳 踰붿쐞? ?뺤씤??吏덈Ц??遺꾨━?섏꽭??\n` +
        `6. 異쒕젰? 吏덈Ц??留욊쾶 '異붿쿇/寃곕줎 ???댁쑀 ???ㅽ뻾 ?④퀎 ??二쇱쓽?? ?쒖쑝濡?援ъ꽦?섏꽭??\n` +
        `7. ?앹뿉 '??諛섏쁺??留λ씫' ?뱀뀡??留뚮뱾怨? ?ㅼ젣 ?듬????대뼸寃?諛붽씔 留λ씫留?'留λ씫 ??蹂?? ?뺤떇?쇰줈 ?곸쑝?몄슂.\n` +
        `8. ?뱀씤 紐⑸줉 諛뽰쓽 媛쒖씤?뺣낫??異붿륫?섏? 留덉꽭??`
    : `[?ъ슜??吏덈Ц]\n${query}\n\n媛쒖씤 留λ씫???놁뒿?덈떎. ?쇰컲?곸씠怨?以묐┰?곸씤 ?덈궡濡? 吏덈Ц??吏곸젒 ?듯븯怨??꾩슂??媛?뺤? 紐낆떆?섎ŉ ?ㅽ뻾 媛?ν븳 ?ㅼ쓬 ?④퀎瑜??쒖떆?섏꽭??`;
}

export interface AppDeps {
  generate?: Generate;
  live?: boolean;
  store?: IProposalStore;   // ?뚯뒪???뱀닔 諛곗꽑?? ?놁쑝硫??붿껌蹂꾨줈 ?먮룞 ?좏깮.
}

export function createApp(deps: AppDeps = {}) {
  // 湲곕낯? ??Gemini(???덉쑝硫?쨌?ㅽ봽?쇱씤(?놁쑝硫?. ?뚯뒪?몃뒗 offlineGenerate瑜?二쇱엯??
  // GEMINI_API_KEY ?좊Т? 臾닿??섍쾶 ?ㅽ듃?뚰겕瑜??덈? ?吏 ?딅뒗??寃곗젙???뚯뒪??.
  const generate: Generate = deps.generate ?? (ai ? makeLiveGenerate(ai) : offlineGenerate);
  const live = deps.live ?? Boolean(ai && !deps.generate);
  // structured output? ??Gemini + ?뚯뒪?멸? generate瑜?二쇱엯?섏? ?딆? 寃쎌슦?먮쭔.
  const generateStructured: GenerateStructured | undefined =
    ai && !deps.generate ? makeLiveGenerateStructured(ai) : undefined;
  const semanticRanker = makeGeminiRanker(generate, live, generateStructured);

  // store?????덈꺼???꾨땲???붿껌(?ъ슜??蹂꾨줈 留뚮뱺??
  // - ?곕え/濡쒖뺄(user.local): ?몃찓紐⑤━ ProposalStore (?ъ떆?????щ씪?몃룄 臾대갑???곕え)
  // - Supabase: 洹??ъ슜???좏겙???ㅻ┛ client濡?SupabaseProposalStore ??RLS 寃⑸━ + ?곸냽
  // ?뚯뒪?몃뒗 deps.store瑜?二쇱엯???몃찓紐⑤━ ?⑥씪 ?몄뒪?댁뒪瑜??ъ궗?⑺븳???곹깭 怨듭쑀 ?꾩슂).
  const storeFor = (user: Awaited<ReturnType<typeof authenticate>>): IProposalStore => {
    if (deps.store) return deps.store;                 // ?뚯뒪??二쇱엯(怨듭쑀 ?몄뒪?댁뒪)
    if (user.local || !supabaseConfigured) return sharedMemoryStore;
    return new SupabaseProposalStore(userClient(user.token));
  };
  // ?곕え 紐⑤뱶?먯꽌 ?붿껌 媛?proposal???좎??섎룄濡??깅떦 ?섎굹???몃찓紐⑤━ store瑜?怨듭쑀?쒕떎.
  // (Supabase 紐⑤뱶?먯꽑 ?곗씠吏 ?딆쓬 ??洹몄そ? DB媛 ?곹깭瑜??ㅺ퀬 ?덉쑝誘濡??붿껌蹂?store濡?異⑸텇)
  const sharedMemoryStore = new ProposalStore();

  const app = express();
  app.use(cors({
    origin(origin, callback) {
      const configured = (process.env.CORS_ALLOWED_ORIGINS || '')
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean);
      if (!origin || env.nodeEnv !== 'production' || configured.includes(origin)) return callback(null, true);
      return callback(new Error('?덉슜?섏? ?딆? Origin?낅땲??'));
    },
  }));
  app.use(express.json({ limit: '1mb' }));

  // ??媛믪? ?덈? 諛섑솚?섏? ?딄퀬 ?곌껐 以鍮??곹깭留??쒓났?쒕떎.
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
      return res.status(401).json({ error: error instanceof Error ? error.message : '濡쒓렇?몄씠 ?꾩슂?⑸땲??' });
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
      return res.status(400).json({ error: error instanceof Error ? error.message : '??μ뿉 ?ㅽ뙣?덉뒿?덈떎.' });
    }
  });

  app.post('/api/profiles', async (req, res) => {
    try {
      const user = await authenticate(req.headers.authorization);
      return res.status(201).json({ profile: await createProfile(user, profileInput(req.body)) });
    } catch (error) {
      return res.status(400).json({ error: error instanceof Error ? error.message : '?꾨줈???앹꽦???ㅽ뙣?덉뒿?덈떎.' });
    }
  });

  app.patch('/api/profiles/:profileId', async (req, res) => {
    try {
      const user = await authenticate(req.headers.authorization);
      const input = profileInput(req.body) as UpdateProfileRequest;
      return res.json({ profile: await updateProfile(user, req.params.profileId, input) });
    } catch (error) {
      return res.status(400).json({ error: error instanceof Error ? error.message : '?꾨줈???섏젙???ㅽ뙣?덉뒿?덈떎.' });
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
      return res.status(400).json({ error: error instanceof Error ? error.message : '移대뱶 ?섏젙???ㅽ뙣?덉뒿?덈떎.' });
    }
  });

  app.delete('/api/profiles/:profileId/contexts/:contextId', async (req, res) => {
    try {
      const user = await authenticate(req.headers.authorization);
      await deleteContext(user, req.params.profileId, req.params.contextId);
      return res.status(204).end();
    } catch (error) {
      return res.status(400).json({ error: error instanceof Error ? error.message : '??젣???ㅽ뙣?덉뒿?덈떎.' });
    }
  });

  app.post('/api/context/structure', async (req, res) => {
    try {
      await authenticate(req.headers.authorization);
      const text = String(req.body?.text || '').trim();
      if (!text) return res.status(400).json({ error: '遺꾨쪟???댁슜???낅젰??二쇱꽭??' });

      const categories = ['identity', 'capability', 'objective', 'preference', 'hard_limit', 'soft_limit', 'resource', 'routine', 'relationship', 'current_state', 'project'];
      const prompt = `?ъ슜?먭? ?낅젰??媛쒖씤 ?뺣낫瑜?媛쒖씤??AI媛 ?ъ궗?⑺븯湲?醫뗭? ?먯옄 ?⑥쐞 ?ъ떎濡?遺꾪빐?섎씪.

[?낅젰]
${text}

[遺꾨쪟 湲곗?]
identity=?대쫫쨌吏곸뾽쨌嫄곗＜ 吏??룹＜嫄?諛??앺솢 ?섍꼍泥섎읆 鍮꾧탳???ㅻ옒 ?좎??섎뒗 湲곕낯 諛곌꼍,
capability=?꾩옱 ?λ젰쨌寃쏀뿕, objective=?대（怨??띠? 寃곌낵,
preference=?좏깮 湲곗? ?먮뒗 ?듬? ?뺤떇 ?좏샇, hard_limit=諛섎뱶???꾨컲?섎㈃ ???섎뒗 議곌굔,
soft_limit=?덉땐 媛?ν븳 議곌굔, resource=?쒓컙쨌?덉궛쨌?꾧뎄쨌援먰넻 ??媛???먯썝,
routine=諛섎났 ?쇱젙쨌?듦?, relationship=?숉뻾?먃룰?怨? current_state=?꾩옱留??좏슚???곹깭,
project=吏꾪뻾 以묒씤 ?묒뾽.

洹쒖튃:
- ??移대뱶?먮뒗 ?섎굹???ъ떎留??ｋ뒗??
- ?쒕ぉ? 12???덊뙉, content???먮쑜??蹂댁〈??紐낇솗??臾몄옣?쇰줈 ?대떎.
- ?⑥닚??遺?뺤쟻?대씪???댁쑀濡?hard_limit???ｌ? 留먭퀬, ?듬???諛섎뱶??吏耳쒖빞 ???뚮쭔 ?ъ슜?쒕떎.
- ?쒓컙쨌?덉궛쨌援먰넻? resource, 諛섎났 ?쇱젙? routine?쇰줈 遺꾨━?쒕떎.
- ?쑣룰뎄쨌???섏???嫄곗＜ 吏??낵 '?以묎탳?듭씠 ?몃━??, '怨듭썝??媛源뚯?' 媛숈? ?앺솢 ?섍꼍? identity濡?遺꾨쪟?쒕떎.
- 踰덉?쨌?숉샇??媛숈? ?곸꽭 二쇱냼, 嫄닿컯쨌?μ븷쨌媛議??뺣낫??sensitive, 洹??몃뒗 蹂댄넻 normal?대떎.
- 理쒕? 8媛? 媛숈? ?ъ떎? ?⑹튇??`;
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
          title: String(draft.title || '?섏쓽 ?뺣낫').trim(),
          category: String(draft.category),
          content: String(draft.content).trim(),
          privacyLevel: ['normal', 'sensitive', 'confidential'].includes(String(draft.privacyLevel)) ? String(draft.privacyLevel) : 'normal',
          rationale: String(draft.rationale || '?낅젰 臾몄옣???섎????곕씪 遺꾨쪟?덉뒿?덈떎.'),
        }));
      if (drafts.length) return res.json({ drafts });
      return res.json({ drafts: [{ title: '?섏쓽 ?뺣낫', category: 'identity', content: text, privacyLevel: 'normal', rationale: 'AI 遺꾨쪟瑜??ъ슜?????놁뼱 湲곕낯 ?뺣낫濡???ν빀?덈떎.' }] });
    } catch (error) {
      return res.status(400).json({ error: error instanceof Error ? error.message : '?뺣낫 遺꾨쪟???ㅽ뙣?덉뒿?덈떎.' });
    }
  });

  // 吏덈Ц怨?紐⑤뱺 留λ씫???ㅼ젣 ?댁슜??鍮꾧탳??Proposal??留뚮뱺??
  app.post('/api/proposals' , async (req, res) => {
    const { query, profileId } = req.body as {
      query?: string;
      profileId?: string;
    };
    if (!query?.trim() || !profileId) {
      return res.status(400).json({ error: '吏덈Ц怨??꾨줈?꾩씠 ?꾩슂?⑸땲??' });
    }
    if (query.trim().length > 4_000) {
      return res.status(400).json({ error: '吏덈Ц? 4,000???댄븯?ъ빞 ?⑸땲??' });
    }
    try {
      const user = await authenticate(req.headers.authorization);
      const profiles = await loadProfiles(user);
      const profile = profiles.find((item) => item.id === profileId);
      if (!profile) return res.status(404).json({ error: '??怨꾩젙???꾨줈?꾩쓣 李얠쓣 ???놁뒿?덈떎.' });
      // ?좊퀎 LLM??吏덈Ц怨??덉슜??移대뱶 ?댁슜??鍮꾧탳?쒕떎. confidential? ?ъ쟾 ?쒖쇅?섍퀬,
      // 理쒖쥌 ?듬? LLM?먮뒗 ?댄썑 ?ъ슜?먭? ?뱀씤??移대뱶留??꾨떖?쒕떎.
      const selection = await selectContexts(query.trim(), profile.contexts, semanticRanker);
      const store = storeFor(user);
      // store.create媛 ??κ퉴吏 ?대떦?쒕떎(Supabase硫?DB insert, ?몃찓紐⑤━硫?留듭뿉 蹂닿?).
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
        diagnostics: selection.diagnostics, // vault/shortlist ?ш린, ?덉쟾留씲룰낵?좊퀎 媛쒖엯 ?잛닔
        summaryReasoning:
          `吏덈Ц 援ъ“? ?ㅼ젣 移대뱶 ?댁슜??鍮꾧탳??${selection.diagnostics.shortlistCount}媛??댄븯???꾨낫瑜??먯젙?덉뒿?덈떎. 理쒖쥌 ?듬??먮뒗 ?ъ슜?먭? ?뱀씤??移대뱶留??ъ슜?⑸땲??`,
      });
    } catch (error) {
      return res.status(401).json({ error: error instanceof Error ? error.message : '濡쒓렇?몄씠 ?꾩슂?⑸땲??' });
    }
  });

  app.post('/api/proposals/:proposalId/answers', async (req, res) => {
    const proposalId = String(req.params.proposalId);
    const {
      approvedContextIds,
      includeRawComparison = true,
      temporaryNote,
      bypassAll = false,
    } = req.body as {
      approvedContextIds?: string[];
      includeRawComparison?: boolean;
      temporaryNote?: string;
      bypassAll?: boolean;
    };
    const approvedIds = approvedContextIds ?? [];
    const tempNote = temporaryNote;
    if (!Array.isArray(approvedIds) || approvedIds.some((id) => typeof id !== 'string')) {
      return res.status(400).json({ error: 'approvedContextIds??臾몄옄??ID 諛곗뿴?댁뼱???⑸땲??' });
    }
    if (typeof tempNote === 'string' && tempNote.length > 2_000) {
      return res.status(400).json({ error: '?대쾲 吏덈Ц 硫붾え??2,000???댄븯?ъ빞 ?⑸땲??' });
    }
    try {
      const user = await authenticate(req.headers.authorization);
      const store = storeFor(user);
      const pending = await store.inspect(proposalId, user.id);
      // ?쇰컲 鍮꾧탳 ?몄텧?먮뒗 媛쒖씤 留λ씫???꾪? ?꾩슂?섏? ?딆쑝硫? ?ㅽ뙣?섎㈃
      // Proposal? ?뱀씤 ???곹깭濡??⑥븘 媛숈? Preview?먯꽌 ?ъ떆?꾪븷 ???덈떎.
      const rawAnswer = includeRawComparison
        ? await generate(promptFor(pending.query, []))
        : undefined;
      const { proposal, approved, snapshotHash } = await store.approve(
        proposalId,
        user.id,
        bypassAll ? [] : approvedIds,   // bypassAll?대㈃ ?꾨Т 留λ씫???뱀씤?섏? ?딅뒗??
      );
      // bypassAll: ?ъ슜?먭? "紐⑤뱺 媛쒖씤 留λ씫 ?꾧퀬 ?쇰컲 ?듬?"??紐낆떆?곸쑝濡??좏깮??寃쎌슦.
      const draft = await generate(
        promptFor(proposal.query, bypassAll ? [] : approved, bypassAll ? undefined : tempNote?.trim()),
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
      await store.complete(proposalId, user.id);
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
      // store媛 proposal ?곹깭쨌?ㅻ깄?력룰린?듯썑蹂대? ?대? ?곸냽?쒕떎.
      // 媛먯궗 濡쒓렇(audit_logs)留?蹂꾨룄濡???ν븳?? ?몃찓紐⑤━(?곕え)???대??먯꽌 no-op.
      await persistAuditLog(user, {
        proposalId,
        profileId: proposal.profileId,
        snapshotHash,
        audit: auditLog,
      });
      return res.json({
        contextBridgeAnswer,
        rawAnswer,
        usedContexts: approved,
        usedContextsCount: approved.length,
        bypassed: bypassAll,
        snapshotHash,
        memoryCandidates,
        auditLog,
      });
    } catch (error) {
      try {
        const user = await authenticate(req.headers.authorization);
        await storeFor(user).fail(proposalId, user.id);
      } catch {
        /* ?몄쬆 ?ㅽ뙣 ?깆? 臾댁떆 ?????ㅻ쪟瑜?洹몃?濡?諛섑솚 */
      }
      const status = (error as { status?: number }).status === 409 ? 409 : 400;
      return res.status(status).json({
        error: error instanceof Error ? error.message : '?듬? ?앹꽦???ㅽ뙣?덉뒿?덈떎.',
      });
    }
  });

  app.post('/api/memory-candidates/:candidateId', async (req, res) => {
    try {
      const { action } = req.body as {
        action?: 'save' | 'ignore';
      };
      if (action !== 'save' && action !== 'ignore') {
        return res.status(400).json({ error: 'save ?먮뒗 ignore媛 ?꾩슂?⑸땲??' });
      }
      const user = await authenticate(req.headers.authorization);
      const store = storeFor(user);
      const result = await store.resolveMemory(req.params.candidateId, user.id, action);
      // store.resolveMemory媛 ?꾨낫 ?곹깭瑜??대? 媛깆떊?쒕떎(Supabase硫?DB, ?몃찓紐⑤━硫?留?.
      // save?????앹꽦??移대뱶留???ν븳??
      if (result.context) await saveContext(user, result.candidate.profileId, result.context);
      return res.json({ ...result, profileId: result.candidate.profileId });
    } catch (error) {
      return res.status(403).json({
        error: error instanceof Error ? error.message : '湲곗뼲 ?꾨낫 泥섎━???ㅽ뙣?덉뒿?덈떎.',
      });
    }
  });

  // 媛먯궗 濡쒓렇??/api/bootstrap??Supabase?먯꽌 濡쒕뱶?쒕떎. 怨쇨굅???몃찓紐⑤━ /api/audit??
  // ?꾨줎?멸? ?몄텧?섏? ?딅뒗 二쎌? 寃쎈줈?怨??쒕쾭 ?ъ떆?????뚯떎???쒓굅?덈떎.

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
    console.log(`[Context Bridge] http://0.0.0.0:${PORT}`);
    const missing = assertServerEnv();
    if (missing.length) {
      console.warn(`[?섍꼍?ㅼ젙] Supabase ?쒕쾭 ?곌껐 誘몄셿猷? ${missing.join(', ')}`);
      console.warn('[?섍꼍?ㅼ젙] 濡쒖뺄?먯꽌???꾨줈?앺듃 猷⑦듃??.env.local???뺤씤?섏꽭??');
    } else {
      console.log('[?섍꼍?ㅼ젙] Supabase ?쒕쾭 ?곌껐 以鍮??꾨즺');
    }
    console.log(`[?섍꼍?ㅼ젙] AI ?묐떟 紐⑤뱶: ${serverEnvStatus.aiConfigured ? 'Gemini' : '?ㅽ봽?쇱씤 ?대갚'}`);
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await startServer();
}

