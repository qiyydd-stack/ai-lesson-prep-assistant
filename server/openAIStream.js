export function extractDeltaContent(chunkText) {
  return String(chunkText)
    .split(/\r?\n/)
    .filter((line) => line.startsWith("data: "))
    .map((line) => line.slice(6).trim())
    .filter((data) => data && data !== "[DONE]")
    .flatMap((data) => {
      try {
        const parsed = JSON.parse(data);
        const content = parsed?.choices?.[0]?.delta?.content;
        return content ? [content] : [];
      } catch {
        return [];
      }
    });
}

export async function pipeOpenAIStream(openAIResponse, nodeResponse) {
  const reader = openAIResponse.body?.getReader();
  if (!reader) {
    throw new Error("Model response did not include a readable stream.");
  }

  const decoder = new TextDecoder();
  let pending = "";
  let inThinkBlock = false;

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;

    pending += decoder.decode(value, { stream: true });
    const lines = pending.split(/\r?\n/);
    pending = lines.pop() || "";

    for (const content of extractDeltaContent(lines.join("\n"))) {
      const { text, inThinkBlock: nextInThinkBlock } = stripThinkFromStreamChunk(content, inThinkBlock);
      inThinkBlock = nextInThinkBlock;
      if (text) nodeResponse.write(text);
    }
  }

  pending += decoder.decode();
  for (const content of extractDeltaContent(pending)) {
    const { text, inThinkBlock: nextInThinkBlock } = stripThinkFromStreamChunk(content, inThinkBlock);
    inThinkBlock = nextInThinkBlock;
    if (text) nodeResponse.write(text);
  }

  nodeResponse.end();
}

export function stripThinkFromStreamChunk(chunk, initialInThinkBlock = false) {
  let rest = String(chunk || "");
  let output = "";
  let inThinkBlock = initialInThinkBlock;

  while (rest) {
    if (inThinkBlock) {
      const end = rest.search(/<\/think>/i);
      if (end < 0) {
        return { text: output, inThinkBlock: true };
      }
      rest = rest.slice(end).replace(/^<\/think>/i, "");
      inThinkBlock = false;
      continue;
    }

    const start = rest.search(/<think>/i);
    if (start < 0) {
      output += rest;
      break;
    }
    output += rest.slice(0, start);
    rest = rest.slice(start).replace(/^<think>/i, "");
    inThinkBlock = true;
  }

  return { text: output, inThinkBlock };
}
