export function normalizeAttachmentContexts(value, options = {}) {
  const maxItems = Number(options.maxItems || 8);
  const maxTextLength = Number(options.maxTextLength || 5000);
  const attachments = Array.isArray(value) ? value : [];

  return attachments
    .map((attachment) => ({
      name: String(attachment?.name || "未命名资料").trim(),
      sourceArea: String(attachment?.sourceArea || "通用资料").trim(),
      summary: String(attachment?.summary || "").trim().slice(0, 800),
      extractedText: String(attachment?.extractedText || "").trim().slice(0, maxTextLength),
    }))
    .filter((attachment) => attachment.extractedText || attachment.summary)
    .slice(0, maxItems);
}

export function buildAttachmentsContext(value, options = {}) {
  const attachments = normalizeAttachmentContexts(value, options);
  if (attachments.length === 0) return "";

  const body = attachments
    .map((attachment, index) => {
      const summary = attachment.summary ? `\n摘要：${attachment.summary}` : "";
      return `资料 ${index + 1}
文件名：${attachment.name}
来源位置：${attachment.sourceArea}${summary}
识别内容：
${attachment.extractedText}`;
    })
    .join("\n\n");

  return `补充资料上下文（来自用户上传的教学资料、题目图片或表格，请优先结合但不要编造资料中没有的信息）：\n${body}`;
}
