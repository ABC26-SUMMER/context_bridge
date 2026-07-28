import type { VercelRequest, VercelResponse } from "@vercel/node";
import { analyzeContext } from "../src/services/contextSelector";
import { detectIntent } from "../src/services/intentAnalyzer";
import type { UserProfile } from "../src/types";

export default function handler(request: VercelRequest, response: VercelResponse) {
  if (request.method !== "POST") {
    response.status(405).json({ error: "Method not allowed" });
    return;
  }

  const { profile, question } = request.body as { profile?: UserProfile; question?: string };

  if (!profile || !question) {
    response.status(400).json({ error: "profile and question are required" });
    return;
  }

  const intent = detectIntent(question);
  const analysis = analyzeContext(profile, intent, "backend");

  response.status(200).json(analysis);
}
