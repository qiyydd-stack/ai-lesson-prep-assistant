const DEFAULT_CHUNK_SIZE = 900;
const DEFAULT_OVERLAP = 120;

export function chunkSchoolResources(resources, options = {}) {
  const chunkSize = Number(options.chunkSize || DEFAULT_CHUNK_SIZE);
  const overlap = Number(options.overlap || DEFAULT_OVERLAP);
  const normalizedResources = Array.isArray(resources) ? resources : [];

  return normalizedResources.flatMap((resource, resourceIndex) => {
    const text = String(resource?.extractedText || resource?.text || "").trim();
    if (!text) return [];
    const resourceName = String(resource?.name || `校本资源${resourceIndex + 1}`).trim();
    const chunks = splitText(text, chunkSize, overlap);
    return chunks.map((chunk, chunkIndex) => ({
      id: `${resourceName}-${chunkIndex + 1}`,
      resourceName,
      sourceArea: String(resource?.sourceArea || "校本资源库").trim(),
      text: chunk,
      chunkIndex,
    }));
  });
}

export function retrieveSchoolResources(resources, queryInput = {}, options = {}) {
  const limit = Number(options.limit || 5);
  const query = buildRetrievalQuery(queryInput);
  const queryTerms = tokenize(query);
  if (queryTerms.length === 0) return [];

  return chunkSchoolResources(resources, options)
    .map((chunk) => ({
      ...chunk,
      score: scoreChunk(chunk, queryTerms),
    }))
    .filter((chunk) => chunk.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

export function buildSchoolRagContext(resources, queryInput = {}, options = {}) {
  const matches = retrieveSchoolResources(resources, queryInput, options);
  if (matches.length === 0) return "";

  const body = matches
    .map(
      (match, index) => `片段 ${index + 1}
来源：${match.resourceName}
相关度：${match.score.toFixed(2)}
内容：
${match.text}`,
    )
    .join("\n\n");

  return `校本资源库检索结果（来自用户导入的校本资料，请优先结合相关片段；不要编造资料中没有的信息）：\n${body}`;
}

function splitText(text, chunkSize, overlap) {
  const normalized = String(text || "").replace(/\r/g, "").trim();
  if (!normalized) return [];
  if (normalized.length <= chunkSize) return [normalized];

  const chunks = [];
  let start = 0;
  while (start < normalized.length) {
    const end = Math.min(start + chunkSize, normalized.length);
    chunks.push(normalized.slice(start, end).trim());
    if (end >= normalized.length) break;
    start = Math.max(end - overlap, start + 1);
  }
  return chunks.filter(Boolean);
}

function buildRetrievalQuery(input = {}) {
  return [
    input.subject,
    input.grade,
    input.chapter,
    input.sectionTitle,
    input.teachingType,
    input.teachingStyle,
    input.studentContext,
    input.extraInstruction,
  ]
    .map((item) => String(item || "").trim())
    .filter(Boolean)
    .join(" ");
}

function scoreChunk(chunk, queryTerms) {
  const haystack = `${chunk.resourceName}\n${chunk.text}`.toLowerCase();
  return queryTerms.reduce((score, term) => {
    if (!term) return score;
    const occurrences = countOccurrences(haystack, term.toLowerCase());
    if (occurrences === 0) return score;
    const weight = term.length >= 4 ? 2 : 1;
    return score + occurrences * weight;
  }, 0);
}

function tokenize(value) {
  const text = String(value || "").toLowerCase();
  const words = text.match(/[a-z0-9]+|[\u4e00-\u9fa5]{2,}/g) || [];
  const cjkBigrams = [];
  for (const word of words) {
    if (/^[\u4e00-\u9fa5]+$/.test(word) && word.length > 2) {
      for (let index = 0; index < word.length - 1; index += 1) {
        cjkBigrams.push(word.slice(index, index + 2));
      }
    }
  }
  return [...new Set([...words, ...cjkBigrams])].slice(0, 80);
}

function countOccurrences(text, term) {
  let count = 0;
  let position = text.indexOf(term);
  while (position >= 0) {
    count += 1;
    position = text.indexOf(term, position + term.length);
  }
  return count;
}
