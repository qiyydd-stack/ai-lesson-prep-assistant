const REQUIRED_FIELDS = ["sectionTitle", "lessonContent"];

export function validateSectionRegenerationRequest(input) {
  return REQUIRED_FIELDS.filter((field) => !String(input?.[field] ?? "").trim()).map(
    (field) => `${field} is required`,
  );
}

export function buildSectionRegenerationPrompt(input) {
  const extraInstruction = String(input.extraInstruction || "保持原教案整体风格，提升可执行性。").trim();
  const lessonContent = String(input.lessonContent || "").slice(0, 12000);

  return `请只重写下列教案中的一个章节：${input.sectionTitle}

课程信息：
- 学科：${input.subject || "未提供"}
- 年级：${input.grade || "未提供"}
- 章节/课题：${input.chapter || "未提供"}

重写要求：
${extraInstruction}

原教案：
${lessonContent}

输出要求：
- 只输出“${input.sectionTitle}”这一节的 Markdown 内容。
- 第一行必须是一级标题：# ${input.sectionTitle}
- 不要输出其他章节。
- 不要解释你做了什么。`;
}
