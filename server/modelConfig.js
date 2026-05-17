export function resolveModelConfig(requestConfig = {}, env = process.env) {
  const apiKey = String(requestConfig.apiKey || env.OPENAI_API_KEY || "").trim();
  const baseUrl = String(
    requestConfig.baseUrl || env.OPENAI_BASE_URL || "https://api.openai.com/v1",
  )
    .trim()
    .replace(/\/$/, "");
  const model = String(requestConfig.model || env.OPENAI_MODEL || "gpt-4o-mini").trim();

  return {
    apiKey,
    baseUrl,
    model,
    error: apiKey ? "" : "missing_api_key",
  };
}
