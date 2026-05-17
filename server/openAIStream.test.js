import test from "node:test";
import assert from "node:assert/strict";

import { extractDeltaContent } from "./openAIStream.js";

test("extractDeltaContent reads content from OpenAI stream event lines", () => {
  const chunk = [
    'data: {"choices":[{"delta":{"content":"# A"}}]}',
    "",
    'data: {"choices":[{"delta":{"content":" lesson"}}]}',
    "",
  ].join("\n");

  assert.deepEqual(extractDeltaContent(chunk), ["# A", " lesson"]);
});

test("extractDeltaContent ignores done and malformed lines", () => {
  const chunk = ["data: [DONE]", "data: not-json", "event: ping"].join("\n");

  assert.deepEqual(extractDeltaContent(chunk), []);
});
