import test from "node:test";
import assert from "node:assert/strict";

import { buildPptOutlinePrompt, normalizePptOutline } from "./pptOutline.js";

test("buildPptOutlinePrompt asks for strict JSON slides", () => {
  const prompt = buildPptOutlinePrompt({
    subject: "数学",
    grade: "七年级",
    chapter: "一元一次方程",
    teachingType: "习题课",
    teachingStyle: "严谨清晰",
    pptSlideCount: 10,
    featureTags: ["板书设计"],
    customFeatureTags: "加入课堂评价表",
    lessonContent: "# 教学目标\n理解方程思想",
  });

  assert.match(prompt, /JSON/);
  assert.match(prompt, /slides/);
  assert.match(prompt, /一元一次方程/);
  assert.match(prompt, /习题课/);
  assert.match(prompt, /10 页/);
  assert.match(prompt, /板书设计/);
  assert.match(prompt, /课堂评价表/);
});

test("normalizePptOutline cleans and limits slide content", () => {
  const outline = normalizePptOutline({
    title: "一元一次方程",
    slides: [
      {
        type: "objectives",
        title: "学习目标",
        bullets: ["理解方程", "掌握解法", "会应用", "多余1", "多余2", "多余3"],
        speakerNotes: "说明目标",
        visualHint: "目标卡片",
      },
    ],
  });

  assert.equal(outline.title, "一元一次方程");
  assert.equal(outline.slides.length, 1);
  assert.equal(outline.slides[0].type, "objectives");
  assert.equal(outline.slides[0].bullets.length, 5);
  assert.equal(outline.slides[0].speakerNotes, "说明目标");
  assert.equal(outline.slides[0].visualHint, "目标卡片");
});

test("normalizePptOutline rejects empty slides", () => {
  assert.throws(() => normalizePptOutline({ title: "空", slides: [] }), /slides/);
});

test("normalizePptOutline normalizes structured sections", () => {
  const outline = normalizePptOutline({
    title: "复习课",
    slides: [
      {
        type: "practice",
        title: "典型例题",
        sections: [
          { label: "题干", text: "解方程 2x+3=7" },
          { label: "方法", text: "移项、合并同类项" },
        ],
      },
    ],
  });

  assert.deepEqual(outline.slides[0].sections, [
    { label: "题干", text: "解方程 2x+3=7" },
    { label: "方法", text: "移项、合并同类项" },
  ]);
});
