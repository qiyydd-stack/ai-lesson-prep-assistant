import pptxgen from "pptxgenjs";

const COLORS = {
  ink: "172033",
  muted: "64748B",
  blue: "2563EB",
  green: "059669",
  orange: "EA580C",
  purple: "7C3AED",
  red: "DC2626",
  lightBlue: "EFF6FF",
  lightGreen: "ECFDF5",
  lightOrange: "FFF7ED",
  lightPurple: "F5F3FF",
  border: "CBD5E1",
  white: "FFFFFF",
};

export function safeFileName(name) {
  return String(name || "教学PPT").replace(/[\\/:*?"<>|]/g, "_").slice(0, 80);
}

export async function buildPptxBuffer(outline) {
  const pptx = new pptxgen();
  pptx.layout = "LAYOUT_WIDE";
  pptx.author = "AI备课辅助工具";
  pptx.subject = outline.title;
  pptx.title = outline.title;
  pptx.company = "AI Lesson Prep Demo";
  pptx.lang = "zh-CN";
  pptx.theme = {
    headFontFace: "Microsoft YaHei",
    bodyFontFace: "Microsoft YaHei",
    lang: "zh-CN",
  };

  addCoverSlide(pptx, outline.title);
  outline.slides.forEach((slide, index) => addTypedSlide(pptx, slide, index + 1));

  const output = await pptx.write({ outputType: "nodebuffer" });
  return Buffer.isBuffer(output) ? output : Buffer.from(output);
}

function addCoverSlide(pptx, title) {
  const slide = pptx.addSlide();
  slide.background = { color: COLORS.lightBlue };
  slide.addShape(pptx.ShapeType.rect, {
    x: 0,
    y: 0,
    w: 13.333,
    h: 0.24,
    fill: { color: COLORS.blue },
    line: { color: COLORS.blue },
  });
  slide.addText(title, {
    x: 0.9,
    y: 1.8,
    w: 11.5,
    h: 0.8,
    fontFace: "Microsoft YaHei",
    fontSize: 34,
    bold: true,
    color: COLORS.ink,
    margin: 0,
  });
  slide.addText("教学PPT", {
    x: 0.94,
    y: 2.8,
    w: 4,
    h: 0.35,
    fontFace: "Microsoft YaHei",
    fontSize: 16,
    color: COLORS.muted,
    margin: 0,
  });
}

function addTypedSlide(pptx, slideData, pageNumber) {
  if (slideData.type === "objectives") return addObjectivesSlide(pptx, slideData, pageNumber);
  if (slideData.type === "hook") return addHookSlide(pptx, slideData, pageNumber);
  if (slideData.type === "practice") return addPracticeSlide(pptx, slideData, pageNumber);
  if (slideData.type === "interaction") return addInteractionSlide(pptx, slideData, pageNumber);
  if (slideData.type === "summary" || slideData.type === "homework") {
    return addTableSlide(pptx, slideData, pageNumber);
  }
  return addContentSlide(pptx, slideData, pageNumber);
}

function addBaseHeader(pptx, slide, slideData, pageNumber, accent = COLORS.blue) {
  slide.background = { color: COLORS.white };
  slide.addShape(pptx.ShapeType.rect, {
    x: 0,
    y: 0,
    w: 13.333,
    h: 0.16,
    fill: { color: accent },
    line: { color: accent },
  });
  slide.addText(slideData.title, {
    x: 0.55,
    y: 0.36,
    w: 11.5,
    h: 0.42,
    fontFace: "Microsoft YaHei",
    fontSize: 22,
    bold: true,
    color: COLORS.ink,
    margin: 0,
  });
  slide.addText(String(pageNumber), {
    x: 12.15,
    y: 6.95,
    w: 0.55,
    h: 0.2,
    fontFace: "Microsoft YaHei",
    fontSize: 10,
    color: COLORS.muted,
    align: "right",
    margin: 0,
  });
}

function addContentSlide(pptx, slideData, pageNumber) {
  const slide = pptx.addSlide();
  addBaseHeader(pptx, slide, slideData, pageNumber, COLORS.blue);
  slide.addShape(pptx.ShapeType.line, {
    x: 0.55,
    y: 0.94,
    w: 12.2,
    h: 0,
    line: { color: COLORS.border, width: 1 },
  });

  const bulletRuns = slideData.bullets.flatMap((text) => [
    {
      text,
      options: {
        bullet: { type: "ul" },
        breakLine: true,
      },
    },
  ]);

  slide.addText(bulletRuns, {
    x: 0.85,
    y: 1.25,
    w: 7.2,
    h: 4.45,
    fontFace: "Microsoft YaHei",
    fontSize: 18,
    color: COLORS.ink,
    breakLine: false,
    fit: "shrink",
    valign: "top",
    paraSpaceAfterPt: 10,
  });

  const noteText = [slideData.activity && `课堂活动：${slideData.activity}`, slideData.speakerNotes]
    .filter(Boolean)
    .join("\n\n");

  slide.addShape(pptx.ShapeType.roundRect, {
    x: 8.55,
    y: 1.18,
    w: 4.05,
    h: 4.65,
    rectRadius: 0.08,
    fill: { color: COLORS.lightBlue },
    line: { color: "BFDBFE", width: 1 },
  });
  slide.addText("教师提示", {
    x: 8.85,
    y: 1.48,
    w: 3.45,
    h: 0.28,
    fontFace: "Microsoft YaHei",
    fontSize: 14,
    bold: true,
    color: COLORS.blue,
    margin: 0,
  });
  slide.addText(noteText || "根据课堂反馈灵活调整讲解节奏。", {
    x: 8.85,
    y: 1.92,
    w: 3.45,
    h: 3.5,
    fontFace: "Microsoft YaHei",
    fontSize: 12,
    color: COLORS.ink,
    fit: "shrink",
    valign: "top",
    breakLine: false,
  });
}

function addObjectivesSlide(pptx, slideData, pageNumber) {
  const slide = pptx.addSlide();
  addBaseHeader(pptx, slide, slideData, pageNumber, COLORS.green);
  const items = slideData.bullets.length ? slideData.bullets : slideData.sections.map((s) => s.text);
  const cardW = 3.75;
  items.slice(0, 3).forEach((text, index) => {
    const x = 0.65 + index * 4.12;
    slide.addShape(pptx.ShapeType.roundRect, {
      x,
      y: 1.35,
      w: cardW,
      h: 3.9,
      rectRadius: 0.08,
      fill: { color: COLORS.lightGreen },
      line: { color: "BBF7D0", width: 1 },
    });
    slide.addText(`目标 ${index + 1}`, {
      x: x + 0.25,
      y: 1.68,
      w: 2.8,
      h: 0.32,
      fontFace: "Microsoft YaHei",
      fontSize: 14,
      bold: true,
      color: COLORS.green,
      margin: 0,
    });
    slide.addText(text, {
      x: x + 0.25,
      y: 2.22,
      w: cardW - 0.5,
      h: 2.25,
      fontFace: "Microsoft YaHei",
      fontSize: 18,
      bold: true,
      color: COLORS.ink,
      fit: "shrink",
      valign: "mid",
      breakLine: false,
    });
  });
  addNotesFooter(slide, slideData);
}

function addHookSlide(pptx, slideData, pageNumber) {
  const slide = pptx.addSlide();
  addBaseHeader(pptx, slide, slideData, pageNumber, COLORS.orange);
  slide.addShape(pptx.ShapeType.roundRect, {
    x: 0.85,
    y: 1.35,
    w: 11.65,
    h: 2.15,
    rectRadius: 0.08,
    fill: { color: COLORS.lightOrange },
    line: { color: "FED7AA", width: 1 },
  });
  slide.addText(slideData.bullets[0] || slideData.activity || "用一个贴近学生经验的问题导入。", {
    x: 1.25,
    y: 1.78,
    w: 10.8,
    h: 1.15,
    fontFace: "Microsoft YaHei",
    fontSize: 28,
    bold: true,
    color: COLORS.ink,
    fit: "shrink",
    align: "center",
    valign: "mid",
  });
  addSectionChips(slide, slideData, 1.05, 4.05, COLORS.orange);
}

function addPracticeSlide(pptx, slideData, pageNumber) {
  const slide = pptx.addSlide();
  addBaseHeader(pptx, slide, slideData, pageNumber, COLORS.purple);
  const sections = slideData.sections.length
    ? slideData.sections
    : [
        { label: "题目", text: slideData.bullets[0] || "典型例题" },
        { label: "方法", text: slideData.bullets[1] || "引导学生说出关键步骤" },
        { label: "反思", text: slideData.bullets[2] || "总结易错点" },
      ];
  const colors = [COLORS.lightPurple, COLORS.lightBlue, COLORS.lightGreen];
  sections.slice(0, 3).forEach((section, index) => {
    const x = 0.7 + index * 4.15;
    slide.addShape(pptx.ShapeType.roundRect, {
      x,
      y: 1.3,
      w: 3.75,
      h: 4.55,
      rectRadius: 0.08,
      fill: { color: colors[index] },
      line: { color: COLORS.border, width: 1 },
    });
    slide.addText(section.label || `步骤 ${index + 1}`, {
      x: x + 0.22,
      y: 1.62,
      w: 3.3,
      h: 0.32,
      fontFace: "Microsoft YaHei",
      fontSize: 15,
      bold: true,
      color: COLORS.purple,
      margin: 0,
    });
    slide.addText(section.text, {
      x: x + 0.22,
      y: 2.18,
      w: 3.3,
      h: 2.95,
      fontFace: "Microsoft YaHei",
      fontSize: 16,
      color: COLORS.ink,
      fit: "shrink",
      valign: "top",
    });
  });
}

function addInteractionSlide(pptx, slideData, pageNumber) {
  const slide = pptx.addSlide();
  addBaseHeader(pptx, slide, slideData, pageNumber, COLORS.red);
  const questions = slideData.bullets.length ? slideData.bullets : slideData.sections.map((s) => s.text);
  questions.slice(0, 4).forEach((question, index) => {
    const x = index % 2 === 0 ? 0.85 : 6.95;
    const y = index < 2 ? 1.35 : 3.75;
    slide.addShape(pptx.ShapeType.roundRect, {
      x,
      y,
      w: 5.5,
      h: 1.55,
      rectRadius: 0.08,
      fill: { color: index % 2 === 0 ? COLORS.lightBlue : COLORS.lightOrange },
      line: { color: COLORS.border, width: 1 },
    });
    slide.addText(`Q${index + 1}`, {
      x: x + 0.22,
      y: y + 0.2,
      w: 0.55,
      h: 0.28,
      fontFace: "Microsoft YaHei",
      fontSize: 13,
      bold: true,
      color: COLORS.red,
      margin: 0,
    });
    slide.addText(question, {
      x: x + 0.85,
      y: y + 0.26,
      w: 4.25,
      h: 0.95,
      fontFace: "Microsoft YaHei",
      fontSize: 15,
      color: COLORS.ink,
      fit: "shrink",
      valign: "mid",
    });
  });
}

function addTableSlide(pptx, slideData, pageNumber) {
  const slide = pptx.addSlide();
  addBaseHeader(pptx, slide, slideData, pageNumber, COLORS.blue);
  const sections = slideData.sections.length
    ? slideData.sections
    : slideData.bullets.map((text, index) => ({ label: `任务 ${index + 1}`, text }));
  const rows = [["类别", "内容"], ...sections.slice(0, 5).map((section) => [section.label, section.text])];
  slide.addTable(rows, {
    x: 0.85,
    y: 1.25,
    w: 11.65,
    h: 4.6,
    border: { color: COLORS.border, pt: 1 },
    fill: { color: COLORS.white },
    color: COLORS.ink,
    fontFace: "Microsoft YaHei",
    fontSize: 13,
    fit: "shrink",
    valign: "mid",
    margin: 0.08,
    rowH: 0.62,
    colW: [2.2, 9.45],
  });
}

function addSectionChips(slide, slideData, x, y, accent) {
  const items = slideData.sections.length
    ? slideData.sections.map((section) => `${section.label}：${section.text}`)
    : slideData.bullets.slice(1);
  items.slice(0, 3).forEach((text, index) => {
    slide.addText(text, {
      x,
      y: y + index * 0.58,
      w: 11.2,
      h: 0.35,
      fontFace: "Microsoft YaHei",
      fontSize: 15,
      color: accent,
      margin: 0,
      fit: "shrink",
    });
  });
}

function addNotesFooter(slide, slideData) {
  if (!slideData.speakerNotes && !slideData.activity) return;
  slide.addText(slideData.activity || slideData.speakerNotes, {
    x: 0.8,
    y: 6.05,
    w: 11.6,
    h: 0.38,
    fontFace: "Microsoft YaHei",
    fontSize: 12,
    color: COLORS.muted,
    margin: 0,
    fit: "shrink",
  });
}
