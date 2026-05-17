import test from "node:test";
import assert from "node:assert/strict";

import { buildPptxBuffer, safeFileName } from "./pptxBuilder.js";

test("safeFileName removes unsafe filename characters", () => {
  assert.equal(safeFileName("七年级/数学:一元一次方程?"), "七年级_数学_一元一次方程_");
});

test("buildPptxBuffer creates a pptx buffer", async () => {
  const buffer = await buildPptxBuffer({
    title: "一元一次方程",
    slides: [
      {
        title: "学习目标",
        bullets: ["理解方程思想", "掌握移项方法", "会解决简单问题"],
        speakerNotes: "用一个生活问题导入。",
        activity: "学生说出等量关系。",
      },
    ],
  });

  assert.ok(Buffer.isBuffer(buffer));
  assert.ok(buffer.length > 1000);
  assert.equal(buffer.slice(0, 2).toString(), "PK");
});
