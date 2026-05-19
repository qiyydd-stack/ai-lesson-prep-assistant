import test from "node:test";
import assert from "node:assert/strict";

import { buildAttachmentsContext, normalizeAttachmentContexts } from "./attachmentsContext.js";

test("normalizeAttachmentContexts keeps scoped extracted text and drops empty attachments", () => {
  const contexts = normalizeAttachmentContexts([
    {
      name: "练习册第35页.png",
      sourceArea: "局部重写",
      extractedText: "1. 解方程 2x+3=7\n2. 列方程解决应用题",
    },
    { name: "empty.docx", sourceArea: "学情补充", extractedText: "" },
  ]);

  assert.equal(contexts.length, 1);
  assert.equal(contexts[0].name, "练习册第35页.png");
  assert.equal(contexts[0].sourceArea, "局部重写");
  assert.match(contexts[0].extractedText, /解方程/);
});

test("buildAttachmentsContext formats file context for model prompts", () => {
  const context = buildAttachmentsContext([
    {
      name: "错题统计.xlsx",
      sourceArea: "学情补充",
      summary: "学生在移项和去括号上错误较多",
      extractedText: "移项错误 12 人\n去括号错误 9 人",
    },
  ]);

  assert.match(context, /补充资料上下文/);
  assert.match(context, /错题统计\.xlsx/);
  assert.match(context, /学生在移项和去括号上错误较多/);
  assert.match(context, /去括号错误 9 人/);
});
