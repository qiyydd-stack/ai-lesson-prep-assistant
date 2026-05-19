import test from "node:test";
import assert from "node:assert/strict";

import { cleanModelOutput, looksLikeMissingImageResponse } from "./modelOutput.js";

test("cleanModelOutput removes think blocks", () => {
  const cleaned = cleanModelOutput("<think>internal reasoning</think>\n# 教学目标\n理解方程");

  assert.equal(cleaned, "# 教学目标\n理解方程");
});

test("cleanModelOutput removes unfinished think prefix", () => {
  const cleaned = cleanModelOutput("<think>The user asks for OCR\n</think>\n题目：解方程");

  assert.equal(cleaned, "题目：解方程");
});

test("looksLikeMissingImageResponse detects failed image recognition", () => {
  assert.equal(looksLikeMissingImageResponse("I don't see any image attached to this message."), true);
  assert.equal(looksLikeMissingImageResponse("抱歉，我没有看到图片，请上传图片后再试。"), true);
  assert.equal(looksLikeMissingImageResponse("1. 解方程 2x+3=7"), false);
});
