const API_URL = "https://api.typesafe.ai/preview/evaluation";
const MODEL = "speed_latest";
const MAX_DOCUMENT_LENGTH = 2000;

export interface TypeSafePrompt {
  key: string;
  type: "noul" | "choice" | "score";
  instructions: string;
  options?: { option: string; description: string | null }[];
  levels?: Record<number, string>;
}

export interface TypeSafeResponseItem {
  key: string;
  type: "noul" | "choice" | "score";
  probability?: number;
  chosen?: string;
  probabilities?: { option: string; probability: number }[];
  expectation?: number;
  confidence?: number;
}

export interface TypeSafeResponse {
  model: string;
  responses: TypeSafeResponseItem[];
  usage: { billing_units: number };
}

function buildRequestBody(document: string, prompts: TypeSafePrompt[]) {
  const truncated = document.slice(0, MAX_DOCUMENT_LENGTH);

  return {
    model: MODEL,
    document: truncated,
    prompts: prompts.map((p) => {
      if (p.type === "score" && p.levels) {
        return {
          key: p.key,
          type: p.type,
          instructions: p.instructions,
          levels: Object.entries(p.levels).map(([level, description]) => ({
            level: Number(level),
            description,
          })),
        };
      }
      if (p.type === "noul") {
        return {
          key: p.key,
          type: p.type,
          instructions: p.instructions,
        };
      }
      return {
        key: p.key,
        type: p.type,
        instructions: p.instructions,
        ...(p.options ? { options: p.options } : {}),
      };
    }),
  };
}

export async function typesafeEvaluate(
  document: string,
  prompts: TypeSafePrompt[],
): Promise<TypeSafeResponse> {
  const apiKey = process.env.TYPESAFE_API_KEY;
  if (!apiKey) throw new Error("TYPESAFE_API_KEY not set");

  const res = await fetch(API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(buildRequestBody(document, prompts)),
  });

  if (!res.ok) {
    throw new Error(`TypeSafe API error: ${res.status} ${res.statusText}`);
  }

  return (await res.json()) as TypeSafeResponse;
}

export function getNoul(resp: TypeSafeResponse, key: string): number {
  const item = resp.responses.find((r) => r.key === key && r.type === "noul");
  return item?.probability ?? 0;
}

export function getChosen(resp: TypeSafeResponse, key: string): string {
  const item = resp.responses.find((r) => r.key === key && r.type === "choice");
  return item?.chosen ?? "unknown";
}

export function getScore(resp: TypeSafeResponse, key: string): number {
  const item = resp.responses.find((r) => r.key === key && r.type === "score");
  return item?.expectation ?? 0;
}

export function getConfidence(resp: TypeSafeResponse, key: string): number {
  const item = resp.responses.find((r) => r.key === key);
  return item?.confidence ?? 0;
}
