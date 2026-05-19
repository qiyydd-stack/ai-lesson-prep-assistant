import test from "node:test";
import assert from "node:assert/strict";

import { parseTextLikeAttachment, parseWorkbookAttachment, validateAttachmentInput } from "./attachmentParser.js";

test("validateAttachmentInput rejects unsupported executable files", () => {
  const errors = validateAttachmentInput({
    fileName: "setup.exe",
    fileBase64: Buffer.from("fake").toString("base64"),
  });

  assert.match(errors.join(";"), /不支持/);
});

test("parseTextLikeAttachment extracts UTF-8 text", () => {
  const parsed = parseTextLikeAttachment({
    fileName: "school-template.md",
    sourceArea: "模板导入",
    buffer: Buffer.from("# 教案模板\n一、教学目标", "utf8"),
  });

  assert.equal(parsed.name, "school-template.md");
  assert.equal(parsed.sourceArea, "模板导入");
  assert.match(parsed.extractedText, /教学目标/);
});

test("parseWorkbookAttachment extracts csv table text", () => {
  const parsed = parseWorkbookAttachment({
    fileName: "错题统计.csv",
    sourceArea: "学情补充",
    buffer: Buffer.from("错误类型,人数\n移项错误,12\n去括号错误,9", "utf8"),
  });

  assert.match(parsed.extractedText, /错误类型,人数/);
  assert.match(parsed.extractedText, /去括号错误,9/);
});
