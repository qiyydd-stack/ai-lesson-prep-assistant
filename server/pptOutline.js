export function buildPptOutlinePrompt(input) {
  const lessonContent = String(input.lessonContent || "").slice(0, 12000);
  const customType = input.customTeachingType ? `（${input.customTeachingType}）` : "";
  const customStyle = input.customTeachingStyle ? `（${input.customTeachingStyle}）` : "";
  const slideCount = Number(input.pptSlideCount || 8);
  const featureTags = Array.isArray(input.featureTags) ? input.featureTags.join("、") : "无";
  const customFeatureTags = String(input.customFeatureTags || "无").trim();

  return `请根据以下教案与课堂信息，生成一套中小学课堂教学 PPT 大纲。

课堂信息：
- 学科：${input.subject}
- 年级：${input.grade}
- 章节/课题：${input.chapter}
- 课时：${input.duration}
- 教学类型：${input.teachingType}${customType}
- 教学风格：${input.teachingStyle}${customStyle}
- PPT 页数：${slideCount} 页
- 可选生成项：${featureTags}
- 自定义生成要求：${customFeatureTags}
- 学情补充：${input.studentContext || "未提供"}

教案内容：
${lessonContent}

请只输出 JSON，不要输出 Markdown，不要包裹代码块。JSON 结构必须为：
{
  "title": "PPT标题",
  "slides": [
    {
      "type": "cover | objectives | hook | concept | practice | interaction | summary | homework",
      "title": "页面标题",
      "bullets": ["页面要点1", "页面要点2"],
      "sections": [
        { "label": "栏目名", "text": "栏目内容" }
      ],
      "visualHint": "建议的视觉表达，如目标卡片、流程图、对比表、例题拆解、问题气泡",
      "speakerNotes": "教师讲解提示",
      "activity": "可选：课堂互动或操作建议"
    }
  ]
}

要求：
- 生成 ${slideCount} 页左右，适合一节真实课堂使用。
- 每页 bullets 3-5 条，每条不超过 28 个汉字。
- 覆盖封面、目标、导入、核心讲解/探究、例题或活动、互动问题、小结、作业。
- 每页必须选择一个 type。不同 type 应给出适合该页的 sections 和 visualHint，不要所有页面都只有 bullets。
- 语言简洁，适合直接放进教学 PPT。
- 不要编造教材页码或不存在的资源。`;
}

export function parseJsonObject(text) {
  const raw = String(text || "").trim();
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1].trim() : raw;
  const first = candidate.indexOf("{");
  const last = candidate.lastIndexOf("}");
  if (first < 0 || last < first) {
    throw new Error("Model did not return a JSON object.");
  }
  return JSON.parse(candidate.slice(first, last + 1));
}

export function normalizePptOutline(outline) {
  const title = String(outline?.title || "教学PPT").trim();
  const slides = Array.isArray(outline?.slides) ? outline.slides : [];
  if (slides.length === 0) {
    throw new Error("PPT outline must include slides.");
  }

  return {
    title,
    slides: slides.slice(0, 14).map((slide, index) => ({
      type: normalizeSlideType(slide?.type, index),
      title: String(slide?.title || `第${index + 1}页`).trim(),
      bullets: normalizeBullets(slide?.bullets),
      sections: normalizeSections(slide?.sections),
      visualHint: String(slide?.visualHint || "").trim(),
      speakerNotes: String(slide?.speakerNotes || "").trim(),
      activity: String(slide?.activity || "").trim(),
    })),
  };
}

function normalizeSlideType(type, index) {
  const allowed = new Set([
    "cover",
    "objectives",
    "hook",
    "concept",
    "practice",
    "interaction",
    "summary",
    "homework",
  ]);
  const value = String(type || "").trim();
  if (allowed.has(value)) return value;
  return index === 0 ? "cover" : "concept";
}

function normalizeBullets(value) {
  const bullets = Array.isArray(value) ? value : String(value || "").split(/\n|；|;/);
  return bullets
    .map((item) => String(item).replace(/^[-*]\s*/, "").trim())
    .filter(Boolean)
    .slice(0, 5);
}

function normalizeSections(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((section) => ({
      label: String(section?.label || "").trim(),
      text: String(section?.text || "").trim(),
    }))
    .filter((section) => section.label || section.text)
    .slice(0, 4);
}
