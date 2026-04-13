const API_KEY = process.env.MINIMAX_API_KEY ?? process.env.OPENAI_API_KEY ?? "";
const ENDPOINT = "https://api.theclawbay.com/backend-api/codex";

export async function callMiniMaxLLM(params: {
  prompt: string;
  system?: string;
  maxTokens?: number;
  temperature?: number;
}): Promise<string> {
  const { prompt, system, maxTokens = 600, temperature = 0.5 } = params;
  const messages: Array<{ role: "system" | "user"; content: string }> = [];
  if (system) messages.push({ role: "system", content: system });
  messages.push({ role: "user", content: prompt });
  try {
    const resp = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(API_KEY ? { "Authorization": `Bearer ${API_KEY}` } : {}) },
      body: JSON.stringify({ model: "MiniMax-M2.2", messages, max_tokens: maxTokens, temperature }),
    });
    if (!resp.ok) throw new Error(`API ${resp.status}`);
    const data = await resp.json() as any;
    return data.choices?.[0]?.message?.content ?? data.response ?? "";
  } catch (e) { console.error("[nlp] LLM call failed:", e); return ""; }
}
