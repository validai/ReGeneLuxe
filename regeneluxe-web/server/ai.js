import { getAiSecret } from "./secrets.js";

function stripSecrets(value) {
  if (!value || typeof value !== "object") return value;
  const clone = Array.isArray(value) ? [...value] : { ...value };
  ["apiKey", "accessToken", "refreshToken", "token", "secret", "password"].forEach((key) => {
    delete clone[key];
  });
  Object.keys(clone).forEach((key) => {
    if (clone[key] && typeof clone[key] === "object") clone[key] = stripSecrets(clone[key]);
  });
  return clone;
}

export async function complete(payload) {
  const secret = getAiSecret();
  if (!secret.apiKey || secret.provider === "none") {
    return { status: 412, body: { ok: false, unavailable: true, error: "No AI provider configured" } };
  }

  const context = stripSecrets(payload?.context || {});
  const prompt = [
    "Return only JSON for a ReGeneLuxe campaign plan.",
    "Shape: { objective, channelRoles, duration, contentPillars, contentIdeas, cadence, successMetrics, testingHypotheses, calendar }",
    "contentIdeas items: { title, concept, format, caption, hook, cta }",
    "Do not invent analytics. Use only the supplied context.",
    JSON.stringify(context),
  ].join("\n");

  try {
    const plan = await callProvider(secret, prompt);
    return { status: 200, body: { ok: true, plan } };
  } catch (error) {
    return { status: 502, body: { ok: false, error: error.message || "AI provider failed" } };
  }
}

async function callProvider(secret, prompt) {
  if (secret.provider === "anthropic") {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": secret.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 2000,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error?.message || "Anthropic request failed");
    return parseJson(data.content?.[0]?.text || "");
  }

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${secret.apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      response_format: { type: "json_object" },
      messages: [{ role: "user", content: prompt }],
    }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error?.message || "OpenAI request failed");
  return parseJson(data.choices?.[0]?.message?.content || "");
}

function parseJson(text) {
  const match = String(text).match(/\{[\s\S]*\}/);
  if (!match) throw new Error("Provider did not return JSON");
  return JSON.parse(match[0]);
}
