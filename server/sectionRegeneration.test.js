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

test("buildSectionRegenerationPrompt includes attachment context for the rewritten section", () => {
  const prompt = buildSectionRegenerationPrompt({
    subject: "数学",
    grade: "七年级",
    chapter: "一元一次方程",
    sectionTitle: "课后作业题",
    lessonContent: "# 课后作业题\n旧作业",
    attachmentsContext: [
      {
        name: "练习册照片.jpg",
        sourceArea: "局部重写",
        summary: "练习册上的方程应用题",
        extractedText: "甲数比乙数多 5，和为 21，求两个数。",
      },
    ],
  });

  assert.match(prompt, /补充资料上下文/);
  assert.match(prompt, /练习册照片\.jpg/);
  assert.match(prompt, /甲数比乙数多 5/);
});
