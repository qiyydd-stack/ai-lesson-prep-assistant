import test from "node:test";
import assert from "node:assert/strict";

import { resolveModelConfig } from "./modelConfig.js";

test("resolveModelConfig prefers request config over environment config", () => {
  const config = resolveModelConfig(
    {
      apiKey: "request-key",
      baseUrl: "https://example.test/v1/",
      model: "request-model",
    },
    {
      OPENAI_API_KEY: "env-key",
      OPENAI_BASE_URL: "https://env.test/v1",
      OPENAI_MODEL: "env-model",
    },
  );

  assert.equal(config.apiKey, "request-key");
  assert.equal(config.baseUrl, "https://example.test/v1");
  assert.equal(config.model, "request-model");
});

test("resolveModelConfig falls back to environment and defaults", () => {
  const config = resolveModelConfig({}, { OPENAI_API_KEY: "env-key" });

  assert.equal(config.apiKey, "env-key");
  assert.equal(config.baseUrl, "https://api.openai.com/v1");
  assert.equal(config.model, "gpt-4o-mini");
});

test("resolveModelConfig reports a missing API key", () => {
  const config = resolveModelConfig({}, {});

  assert.equal(config.apiKey, "");
  assert.equal(config.error, "missing_api_key");
});
