import test from "node:test";
import assert from "node:assert/strict";

import {
  buildLessonPrompt,
  getSystemPrompt,
  getTeachingStylePrompt,
  getTeachingTypePrompt,
  validateLessonRequest,
} from "./lessonPrompt.js";

test("validateLessonRequest reports missing required fields", () => {
  const errors = validateLessonRequest({
    subject: "语文",
    grade: "",
    chapter: "",
    duration: "1课时",
    teachingType: "探究启发课",
    teachingStyle: "互动活跃",
  });

  assert.deepEqual(errors, ["grade is required", "chapter is required"]);
});

test("buildLessonPrompt includes type and style dimensions", () => {
  const prompt = buildLessonPrompt({
    subject: "数学",
    grade: "七年级",
    chapter: "一元一次方程",
    duration: "1课时",
    teachingType: "习题课",
    teachingStyle: "严谨清晰",
    studentContext: "学生计算基础一般，喜欢小组讨论",
  });

  assert.match(prompt, /中小学教师/);
  assert.match(prompt, /教学类型：习题课/);
  assert.match(prompt, /教学风格：严谨清晰/);
  assert.match(prompt, /教学目标/);
  assert.match(prompt, /重难点分析/);
  assert.match(prompt, /课后作业题/);
});

test("buildLessonPrompt includes generation settings and school template", () => {
  const prompt = buildLessonPrompt({
    subject: "英语",
    grade: "八年级",
    chapter: "Unit 3 Reading",
    duration: "1课时",
    teachingType: "严谨讲授课",
    teachingStyle: "严谨清晰",
    lessonDetail: "详细",
    featureTags: ["板书设计", "课堂评价"],
    customFeatureTags: "加入小组评价表",
    schoolTemplate: "一、教材分析\n二、教学过程\n三、作业设计",
  });

  assert.match(prompt, /教案详略：详细/);
  assert.match(prompt, /板书设计、课堂评价/);
  assert.match(prompt, /加入小组评价表/);
  assert.match(prompt, /校本模板/);
  assert.match(prompt, /教材分析/);
});

test("getTeachingTypePrompt returns exam review guidance", () => {
  const prompt = getTeachingTypePrompt({ teachingType: "考前复习课" });

  assert.match(prompt, /考点/);
  assert.match(prompt, /易错/);
  assert.match(prompt, /限时/);
});

test("getTeachingStylePrompt returns warm tutoring guidance", () => {
  const prompt = getTeachingStylePrompt({ teachingStyle: "温和陪伴" });

  assert.match(prompt, /鼓励/);
  assert.match(prompt, /安全感/);
});

test("getSystemPrompt combines custom type and custom style guidance", () => {
  const prompt = getSystemPrompt({
    teachingType: "自定义",
    customTeachingType: "跨学科公开课，需要融合科学探究和小组展示",
    teachingStyle: "自定义",
    customTeachingStyle: "像经验丰富的班主任一样，亲切但有节奏感",
  });

  assert.match(prompt, /自定义教学类型/);
  assert.match(prompt, /跨学科公开课/);
  assert.match(prompt, /自定义教学风格/);
  assert.match(prompt, /亲切但有节奏感/);
  assert.match(prompt, /不可机械套用固定课型/);
});
