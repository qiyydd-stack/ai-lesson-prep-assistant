import test from "node:test";
import assert from "node:assert/strict";

import { buildSchoolRagContext, chunkSchoolResources, retrieveSchoolResources } from "./schoolRag.js";

test("chunkSchoolResources splits parsed school resources into chunks", () => {
  const chunks = chunkSchoolResources([
    {
      name: "七年级数学校本题库.docx",
      sourceArea: "校本资源库",
      extractedText: "一元一次方程例题：2x+3=7。\n应用题：甲数比乙数多 5。",
    },
  ]);

  assert.equal(chunks.length, 1);
  assert.equal(chunks[0].resourceName, "七年级数学校本题库.docx");
  assert.match(chunks[0].text, /一元一次方程/);
});

test("retrieveSchoolResources ranks resources by lesson query relevance", () => {
  const resources = [
    {
      name: "七年级数学校本题库.docx",
      extractedText: "一元一次方程例题：2x+3=7。移项、合并同类项、应用题。",
    },
    {
      name: "五年级语文阅读材料.docx",
      extractedText: "草船借箭人物语言、情节推进、文本细读。",
    },
  ];

  const matches = retrieveSchoolResources(resources, {
    subject: "数学",
    grade: "七年级",
    chapter: "一元一次方程",
    sectionTitle: "课后作业题",
  });

  assert.equal(matches[0].resourceName, "七年级数学校本题库.docx");
  assert.match(matches[0].text, /移项/);
});

test("buildSchoolRagContext formats retrieved chunks for prompts", () => {
  const context = buildSchoolRagContext(
    [
      {
        name: "校本题库.xlsx",
        extractedText: "一元一次方程 分层作业 基础题 提升题",
      },
    ],
    {
      subject: "数学",
      grade: "七年级",
      chapter: "一元一次方程",
    },
  );

  assert.match(context, /校本资源库检索结果/);
  assert.match(context, /校本题库\.xlsx/);
  assert.match(context, /分层作业/);
});
