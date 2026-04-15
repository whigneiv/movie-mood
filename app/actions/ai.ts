"use server";

const DEFAULT_OLLAMA_GENERATE =
  "http://localhost:11434/api/generate";

const GENERATE_TIMEOUT_MS = 90_000;

export type AIRecommendationResult =
  | { ok: true; title: string }
  | {
      ok: false;
      error: "offline" | "timeout" | "parse" | "empty" | "http";
      message: string;
    };

function parseTitleFromModelText(text: string): string | null {
  const trimmed = text.trim();
  if (!trimmed) return null;
  try {
    const jsonMatch = trimmed.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]) as { title?: unknown };
      if (typeof parsed.title === "string" && parsed.title.trim()) {
        return parsed.title.trim();
      }
    }
  } catch {
    /* fall through */
  }
  const line = trimmed.split(/\r?\n/).find((l) => l.trim().length > 0);
  if (!line) return null;
  const cleaned = line
    .replace(/^["']|["']$/g, "")
    .replace(/^(title|filme|movie)\s*[:.\-]\s*/i, "")
    .trim();
  return cleaned.length > 0 ? cleaned.slice(0, 200) : null;
}

function buildPrompt(quizSummary: string, avoidTitles: string[]): string {
  const avoid =
    avoidTitles.length > 0
      ? `\nDo NOT recommend any of these titles (already suggested or skipped): ${avoidTitles.slice(0, 15).join("; ")}.`
      : "";
  return `You are a concise movie curator for Brazilian viewers.

User preferences (Portuguese context is fine to read; answer in English for the film database):
${quizSummary}
${avoid}

Reply with ONE JSON object only, no markdown fences, no extra text:
{"title":"<official English release title of ONE well-known theatrical movie>"}

Rules: theatrical feature film only (no TV series, no documentaries unless the user clearly wants them). Pick something that fits the mood and constraints.`;
}

/**
 * Calls a local Ollama /api/generate endpoint (default: llama3 on localhost).
 * Set OLLAMA_GENERATE_URL if your server listens elsewhere (e.g. Docker).
 */
export async function getAIRecommendation(input: {
  quizSummary: string;
  avoidTitles?: string[];
}): Promise<AIRecommendationResult> {
  const url =
    process.env.OLLAMA_GENERATE_URL?.trim() || DEFAULT_OLLAMA_GENERATE;
  const prompt = buildPrompt(
    input.quizSummary.trim() || "(no details)",
    input.avoidTitles ?? []
  );

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), GENERATE_TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "llama3",
        prompt,
        stream: false,
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      return {
        ok: false,
        error: "http",
        message: `Ollama respondeu com status ${res.status}. Verifique se o modelo "llama3" está instalado.`,
      };
    }

    const data = (await res.json()) as { response?: string };
    const raw = typeof data.response === "string" ? data.response : "";
    const title = parseTitleFromModelText(raw);
    if (!title) {
      return {
        ok: false,
        error: "parse",
        message:
          "A IA não retornou um título reconhecível. Tente de novo ou use o modo TMDB.",
      };
    }
    return { ok: true, title };
  } catch (e) {
    const aborted =
      e instanceof Error && e.name === "AbortError";
    if (aborted) {
      return {
        ok: false,
        error: "timeout",
        message: "Ollama demorou demais. Tente de novo.",
      };
    }
    return {
      ok: false,
      error: "offline",
      message:
        "Não foi possível falar com o Ollama (localhost:11434). Inicie o servidor e o modelo llama3.",
    };
  } finally {
    clearTimeout(timeoutId);
  }
}
