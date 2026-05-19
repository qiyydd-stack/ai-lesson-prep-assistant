import test from "node:test";
import assert from "node:assert/strict";

import {
  appendTaskOutput,
  buildLessonMarkdown,
  createTask,
  parseLessonBlocks,
  replaceLessonBlock,
} from "./lessonWorkspace.js";

test("parseLessonBlocks extracts known markdown sections and preserves content", () => {
  const blocks = parseLessonBlocks(`# 教学目标
1. 理解方程意义。

# 重难点分析
重点：等式性质。

# 课堂互动问题
- 怎样表示未知数？`);

  assert.deepEqual(
    blocks.map((block) => block.title),
    ["教学目标", "重难点分析", "课堂互动问题"],
  );
  assert.equal(blocks[0].content.trim(), "1. 理解方程意义。");
});

test("buildLessonMarkdown joins edited blocks into stable markdown", () => {
  const markdown = buildLessonMarkdown([
    { title: "教学目标", content: "目标 A" },
    { title: "重难点分析", content: "重点 B" },
  ]);

  assert.equal(markdown, "# 教学目标\n目标 A\n\n# 重难点分析\n重点 B\n");
});

test("replaceLessonBlock updates one section without losing other sections", () => {
  const blocks = parseLessonBlocks("# 教学目标\n旧目标\n\n# 课后作业题\n旧作业");
  const next = replaceLessonBlock(blocks, "教学目标", "# 教学目标\n新目标");

  assert.equal(next[0].content.trim(), "新目标");
  assert.equal(next[1].content.trim(), "旧作业");
});

test("createTask and appendTaskOutput keep queue rendering scoped by id", () => {
  const first = createTask("lesson", "生成教案");
  const second = createTask("ppt", "生成 PPT");
  const tasks = appendTaskOutput([first, second], first.id, "第一段");
  const nextTasks = appendTaskOutput(tasks, second.id, "第二段");

  assert.equal(nextTasks[0].output, "第一段");
  assert.equal(nextTasks[1].output, "第二段");
  assert.notEqual(nextTasks[0].id, nextTasks[1].id);
});
