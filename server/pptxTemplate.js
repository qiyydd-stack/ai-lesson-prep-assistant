import JSZip from "jszip";

const PLACEHOLDER_PATTERN = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;

export async function extractPlaceholders(templateBuffer) {
  const zip = await JSZip.loadAsync(templateBuffer);
  const placeholders = new Set();
  const xmlFiles = Object.keys(zip.files).filter((name) => name.startsWith("ppt/") && name.endsWith(".xml"));

  for (const name of xmlFiles) {
    const xml = await zip.file(name).async("string");
    for (const match of xml.matchAll(PLACEHOLDER_PATTERN)) {
      placeholders.add(match[1]);
    }
  }

  return [...placeholders].sort();
}

export function buildTemplateValues(outline) {
  const values = {
    deck_title: outline.title || "教学PPT",
  };

  outline.slides.forEach((slide, slideIndex) => {
    const number = slideIndex + 1;
    values[`slide_${number}_title`] = slide.title || "";
    values[`slide_${number}_speaker_notes`] = slide.speakerNotes || "";
    values[`slide_${number}_activity`] = slide.activity || "";
    values[`slide_${number}_visual_hint`] = slide.visualHint || "";
    values[`slide_${number}_bullets`] = (slide.bullets || []).join("\n");

    (slide.bullets || []).forEach((bullet, bulletIndex) => {
      values[`slide_${number}_bullet_${bulletIndex + 1}`] = bullet;
    });

    (slide.sections || []).forEach((section, sectionIndex) => {
      values[`slide_${number}_section_${sectionIndex + 1}_label`] = section.label || "";
      values[`slide_${number}_section_${sectionIndex + 1}_text`] = section.text || "";
    });
  });

  return values;
}

export async function fillPptxTemplate(templateBuffer, outline) {
  const zip = await JSZip.loadAsync(templateBuffer);
  const values = buildTemplateValues(outline);
  const xmlFiles = Object.keys(zip.files).filter((name) => name.startsWith("ppt/") && name.endsWith(".xml"));

  for (const name of xmlFiles) {
    const file = zip.file(name);
    if (!file) continue;
    const xml = await file.async("string");
    zip.file(name, replacePlaceholders(xml, values));
  }

  return zip.generateAsync({ type: "nodebuffer" });
}

function replacePlaceholders(xml, values) {
  return xml.replace(PLACEHOLDER_PATTERN, (_match, key) => escapeXml(values[key] ?? ""));
}

function escapeXml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
