export function cleanModelOutput(value) {
  return String(value || "")
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .replace(/<think>[\s\S]*$/gi, "")
    .trim();
}

export function looksLikeMissingImageResponse(value) {
  const text = cleanModelOutput(value).toLowerCase();
  return (
    /don't see any image|do not see any image|no image attached|there'?s no image data/.test(text) ||
    /没有看到图片|未看到图片|看不到图片|没有收到图片/.test(text)
  );
}
