/**
 * 백엔드 없이 프론트 UI를 개발하기 위한 초경량 mock 서버.
 * 의존성 0(내장 http만). 실행: node mock-server.mjs
 */
import http from "node:http";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  buildAnswer,
  buildProposal,
  publicProposal,
  resolvePersona,
} from "./mock-engine.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const load = (name) => JSON.parse(readFileSync(join(here, "mocks", name), "utf-8"));
const studentBootstrap = load("bootstrap.success.json");
const seniorBootstrap = load("bootstrap.senior.json");
const memoryResolution = load("memory.resolve.success.json");
const proposals = new Map();
const PORT = process.env.MOCK_PORT || 4000;

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const { pathname } = url;
  const method = req.method || "GET";
  const auth = req.headers.authorization || "";

  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type, Accept");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, PATCH, OPTIONS");
  if (method === "OPTIONS") {
    res.writeHead(204).end();
    return;
  }

  const send = (status, body) => {
    res.writeHead(status, { "Content-Type": "application/json" });
    res.end(body === undefined ? "" : JSON.stringify(body));
  };

  if (!auth) return send(401, { error: "로그인이 필요합니다." });

  try {
    const persona = resolvePersona(auth);
    const bootstrap = persona === "senior" ? seniorBootstrap : studentBootstrap;
    const profile = bootstrap.profiles[0];

    if (pathname === "/api/bootstrap" && method === "GET") {
      return send(200, bootstrap);
    }

    if (pathname === "/api/proposals" && method === "POST") {
      const body = await readBody(req);
      if (!body.profileId || !body.query?.trim()) {
        return send(400, { error: "profileId와 query가 필요합니다." });
      }

      const proposal = buildProposal({
        profile,
        profileId: body.profileId,
        query: body.query,
      });
      proposals.set(proposal.proposalId, proposal);
      return send(200, publicProposal(proposal));
    }

    const generateMatch = pathname.match(/^\/api\/proposals\/([^/]+)\/generate$/);
    if (generateMatch && method === "POST") {
      const proposal = proposals.get(decodeURIComponent(generateMatch[1]));
      if (!proposal) return send(404, { error: "Mock proposal을 찾을 수 없습니다. 질문을 다시 분석해 주세요." });

      const body = await readBody(req);
      if (!Array.isArray(body.approvedIds)) {
        return send(400, { error: "approvedIds 배열이 필요합니다." });
      }
      return send(200, buildAnswer(proposal, body.approvedIds));
    }

    if (/^\/api\/memory-candidates\/[^/]+$/.test(pathname) && method === "POST") {
      return send(200, memoryResolution);
    }

    if (pathname === "/api/profiles" && method === "POST") {
      return send(200, { profile });
    }

    return send(404, { error: `mock 미정의 경로: ${method} ${pathname}` });
  } catch (error) {
    return send(500, { error: error instanceof Error ? error.message : String(error) });
  }
});

server.listen(PORT, () => {
  console.log(`[mock] http://localhost:${PORT} (요청 기반 동적 fixture)`);
});

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  if (chunks.length === 0) return {};
  return JSON.parse(Buffer.concat(chunks).toString("utf-8"));
}
