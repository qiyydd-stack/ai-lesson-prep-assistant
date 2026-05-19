export const defaultLessonBlockTitles = [
  "教学目标",
  "重难点分析",
  "教案框架",
  "课堂互动问题",
  "课后作业题",
];

let taskSeed = 0;

export function parseLessonBlocks(markdown, preferredTitles = defaultLessonBlockTitles) {
  const source = String(markdown || "").trim();
  if (!source) return [];

  const headingPattern = /^#\s+(.+?)\s*$/gm;
  const matches = [...source.matchAll(headingPattern)];
  if (matches.length === 0) {
    return [{ title: "完整教案", content: source, locked: true }];
  }

  const blocks = [];
  matches.forEach((match, index) => {
    const title = match[1].trim();
    const contentStart = match.index + match[0].length;
    const contentEnd = index + 1 < matches.length ? matches[index + 1].index : source.length;
    const content = source.slice(contentStart, contentEnd).trim();
    blocks.push({
      title,
      content,
      locked: !preferredTitles.includes(title),
    });
  });
  return blocks;
}

export function buildLessonMarkdown(blocks) {
  return blocks
    .map((block) => `# ${block.title}\n${String(block.content || "").trim()}`)
    .join("\n\n")
    .trimEnd()
    .concat("\n");
}

export function replaceLessonBlock(blocks, sectionTitle, replacementMarkdown) {
  const replacement = parseLessonBlocks(replacementMarkdown, [sectionTitle])[0] || {
    title: sectionTitle,
    content: String(replacementMarkdown || "").trim(),
  };
  const nextBlock = {
    title: sectionTitle,
    content: replacement.title === sectionTitle ? replacement.content : String(replacementMarkdown || "").trim(),
    locked: false,
  };
  const found = blocks.some((block) => block.title === sectionTitle);
  if (!found) return [...blocks, nextBlock];
  return blocks.map((block) => (block.title === sectionTitle ? nextBlock : block));
}

export function createTask(type, title) {
  taskSeed += 1;
  return {
    id: `${Date.now()}-${taskSeed}`,
    type,
    title,
    status: "running",
    output: "",
    detail: "",
    createdAt: new Date().toISOString(),
  };
}

export function appendTaskOutput(tasks, taskId, chunk) {
  return tasks.map((task) =>
    task.id === taskId
      ? {
          ...task,
          output: `${task.output || ""}${chunk}`,
          detail: `已生成约 ${(task.output || "").length + String(chunk || "").length} 字`,
        }
      : task,
  );
}

export function finishTask(tasks, taskId, detail = "") {
  return tasks.map((task) =>
    task.id === taskId
      ? {
          ...task,
          status: "done",
          detail,
        }
      : task,
  );
}

export function failTask(tasks, taskId, detail = "") {
  return tasks.map((task) =>
    task.id === taskId
      ? {
          ...task,
          status: "error",
          detail,
        }
      : task,
  );
}
