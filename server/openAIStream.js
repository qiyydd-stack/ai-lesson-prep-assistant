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

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;

    pending += decoder.decode(value, { stream: true });
    const lines = pending.split(/\r?\n/);
    pending = lines.pop() || "";

    for (const content of extractDeltaContent(lines.join("\n"))) {
      nodeResponse.write(content);
    }
  }

  pending += decoder.decode();
  for (const content of extractDeltaContent(pending)) {
    nodeResponse.write(content);
  }

  nodeResponse.end();
}
