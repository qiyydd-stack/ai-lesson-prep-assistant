import test from "node:test";
import assert from "node:assert/strict";

import { buildSectionRegenerationPrompt, validateSectionRegenerationRequest } from "./sectionRegeneration.js";

test("validateSectionRegenerationRequest requires section and lesson content", () => {
  const errors = validateSectionRegenerationRequest({
    sectionTitle: "",
    lessonContent: "",
  });

  assert.deepEqual(errors, ["sectionTitle is required", "lessonContent is required"]);
});

test("buildSectionRegenerationPrompt asks to rewrite only one section", () => {
  const prompt = buildSectionRegenerationPrompt({
    subject: "数学",
    grade: "七年级",
    chapter: "一元一次方程",
    sectionTitle: "课堂互动问题",
    lessonContent: "# 教学目标\n理解方程\n# 课堂互动问题\n旧问题",
    extraInstruction: "问题更有层次",
  });

  assert.match(prompt, /只重写/);
  assert.match(prompt, /课堂互动问题/);
  assert.match(prompt, /问题更有层次/);
  assert.match(prompt, /不要输出其他章节/);
});
