const REQUIRED_FIELDS = ["subject", "grade", "chapter", "duration", "teachingType", "teachingStyle"];

const DEFAULT_SYSTEM_PROMPT =
  "你是一名熟悉中国中小学课堂的一线教研员和备课助手。生成内容必须服务真实课堂教学，结构清晰、可执行、便于教师二次修改。";

const TYPE_PROMPTS = {
  "严谨讲授课":
    "教学类型是严谨讲授课。请突出知识结构、概念定义、板书逻辑、例题递进、课堂检测和教师讲解节奏，避免活动堆砌。",
  "探究启发课":
    "教学类型是探究启发课。请突出问题链、情境导入、学生猜想、合作讨论、证据推理和教师归纳，避免直接给结论。",
  "考前复习课":
    "教学类型是考前复习课。请突出考点梳理、题型归纳、易错分析、限时训练、查漏补缺和复盘策略，避免重新讲新课。",
  "一对一家教":
    "教学类型是一对一家教。请突出诊断先行、个性化讲解、即时反馈、薄弱点补救、陪练节奏和课后跟进，语言要适合家教场景。",
  "习题课":
    "教学类型是习题课。请突出题目梯度、解题方法、变式训练、错因分析、学生板演和当堂纠错，避免只罗列答案。",
  "实验实践课":
    "教学类型是实验实践课。请突出操作流程、安全提醒、观察记录、证据分析、实践反思和结果表达，确保活动可落地。",
  "公开展示课":
    "教学类型是公开展示课。请突出课堂亮点、展示节奏、学生参与、问题设计、生成性反馈和可观摩的教学环节。",
};

const STYLE_PROMPTS = {
  "严谨清晰":
    "教学风格是严谨清晰。表达要准确、层次分明、术语规范，课堂推进要稳，重点和结论要明确。",
  "启发引导":
    "教学风格是启发引导。多用递进问题、追问、类比和归纳，引导学生自己说出关键发现。",
  "互动活跃":
    "教学风格是互动活跃。课堂要有高频参与、同伴交流、即时反馈和轻量活动，但不能牺牲知识目标。",
  "温和陪伴":
    "教学风格是温和陪伴。语言要有鼓励感和安全感，适合基础薄弱或需要信心支持的学生。",
  "高效冲刺":
    "教学风格是高效冲刺。内容要直接、节奏紧凑、目标明确，强调短时提分、关键题型和即时纠偏。",
  "分层照顾":
    "教学风格是分层照顾。请同时设计基础、达标、提升三个层次的任务或问题，照顾不同学习水平。",
  "故事化情境":
    "教学风格是故事化情境。请用贴近学生经验的情境、人物、任务或故事线串联课堂，但保持学科严谨。",
};

export function validateLessonRequest(input) {
  return REQUIRED_FIELDS.filter((field) => !String(input?.[field] ?? "").trim()).map(
    (field) => `${field} is required`,
  );
}

export function getTeachingTypePrompt(input = {}) {
  const teachingType = String(input.teachingType || "").trim();

  if (teachingType === "自定义") {
    const customTeachingType = String(input.customTeachingType || "").trim();
    const customText = customTeachingType || "用户未补充具体自定义教学类型";

    return `教学类型是自定义教学类型。用户的自定义要求是：${customText}

请优先理解用户描述的真实教学场景，不可机械套用固定课型。把自定义要求转化为可执行的课堂组织策略；如果描述较宽泛，请采用通用稳妥的中小学教学设计原则：目标清晰、活动有层次、问题能落地、作业有梯度、教师便于二次修改。`;
  }

  return TYPE_PROMPTS[teachingType] || "教学类型未匹配预设项，请按通用中小学课堂设计处理。";
}

export function getTeachingStylePrompt(input = {}) {
  const teachingStyle = String(input.teachingStyle || "").trim();

  if (teachingStyle === "自定义") {
    const customTeachingStyle = String(input.customTeachingStyle || "").trim();
    const customText = customTeachingStyle || "用户未补充具体自定义教学风格";

    return `教学风格是自定义教学风格。用户的自定义风格要求是：${customText}

请把用户描述转化为语言气质、互动方式、课堂节奏和反馈方式上的明确要求。无论用户描述多宽泛，都要保持专业、清楚、可执行，不要影响教学目标完整性。`;
  }

  return STYLE_PROMPTS[teachingStyle] || "教学风格未匹配预设项，请保持表达清晰、课堂节奏稳妥。";
}

export function getSystemPrompt(input = {}) {
  return `${DEFAULT_SYSTEM_PROMPT}

${getTeachingTypePrompt(input)}

${getTeachingStylePrompt(input)}

请同时满足教学类型和教学风格两个维度：教学类型决定课堂任务结构，教学风格决定表达气质、互动方式和推进节奏。若两者有张力，以真实课堂可执行性为最高优先级。`;
}

export function buildLessonPrompt(input) {
  const studentContext = String(input.studentContext || "未提供特殊学情").trim();
  const lessonDetail = String(input.lessonDetail || "标准").trim();
  const featureTags = normalizeFeatureTags(input.featureTags);
  const customFeatureTags = String(input.customFeatureTags || "").trim();
  const schoolTemplate = String(input.schoolTemplate || "").trim();
  const teachingType = String(input.teachingType || "").trim();
  const teachingStyle = String(input.teachingStyle || "").trim();
  const customTeachingType = String(input.customTeachingType || "").trim();
  const customTeachingStyle = String(input.customTeachingStyle || "").trim();
  const typeLine =
    teachingType === "自定义" && customTeachingType
      ? `自定义：${customTeachingType}`
      : teachingType;
  const styleLine =
    teachingStyle === "自定义" && customTeachingStyle
      ? `自定义：${customTeachingStyle}`
      : teachingStyle;

  return `你是一名熟悉中国中小学课堂的一线教研员和中小学教师备课助手。

请根据以下信息生成一份可直接供教师二次修改的 AI 备课方案：

- 学科：${input.subject}
- 年级：${input.grade}
- 章节/课题：${input.chapter}
- 课时：${input.duration}
- 教学类型：${typeLine}
- 教学风格：${styleLine}
- 教案详略：${lessonDetail}
- 可选生成项：${featureTags.length ? featureTags.join("、") : "无"}
- 自定义生成要求：${customFeatureTags || "无"}
- 学情补充：${studentContext}
${schoolTemplate ? `\n校本模板（请优先参照其栏目结构和表达习惯）：\n${schoolTemplate.slice(0, 6000)}\n` : ""}

请使用简体中文，贴近中小学教师真实备课表达，避免空泛口号。输出 Markdown，必须包含以下一级标题：

# 教学目标
从知识与技能、过程与方法、情感态度价值观三个角度列出 3-5 条具体目标。

# 重难点分析
分别说明教学重点、教学难点、突破策略。

# 教案框架
按导入、核心教学活动、练习/反馈、课堂小结、板书/资源建议给出流程，标注建议时间。

# 课堂互动问题
给出 6-8 个分层提问，覆盖导入、理解、应用、拓展，并提示预期学生反应。

# 课后作业题
给出基础题、提升题、实践/探究题，并附简要设计意图。

请同时紧扣“${typeLine}”的教学场景和“${styleLine}”的课堂表达方式，并结合教案详略、可选生成项、校本模板和学情补充做差异化建议。`;
}

function normalizeFeatureTags(value) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item).trim()).filter(Boolean).slice(0, 16);
}
