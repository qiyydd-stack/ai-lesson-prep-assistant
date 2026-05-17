import test from "node:test";
import assert from "node:assert/strict";
import JSZip from "jszip";

import { buildTemplateValues, extractPlaceholders, fillPptxTemplate } from "./pptxTemplate.js";

test("extractPlaceholders finds placeholders inside pptx slide xml", async () => {
  const buffer = await createFakePptx([
    "<p:t>{{deck_title}}</p:t><p:t>{{slide_1_title}}</p:t>",
  ]);

  const placeholders = await extractPlaceholders(buffer);

  assert.deepEqual(placeholders.sort(), ["deck_title", "slide_1_title"]);
});

test("buildTemplateValues maps outline data to deck and slide placeholders", () => {
  const values = buildTemplateValues({
    title: "一元一次方程",
    slides: [
      {
        title: "学习目标",
        bullets: ["理解方程", "掌握解法"],
        speakerNotes: "说明目标",
        activity: "同桌交流",
      },
    ],
  });

  assert.equal(values.deck_title, "一元一次方程");
  assert.equal(values.slide_1_title, "学习目标");
  assert.equal(values.slide_1_bullet_1, "理解方程");
  assert.equal(values.slide_1_bullet_2, "掌握解法");
  assert.equal(values.slide_1_speaker_notes, "说明目标");
  assert.equal(values.slide_1_activity, "同桌交流");
});

test("fillPptxTemplate replaces placeholders and preserves pptx zip", async () => {
  const buffer = await createFakePptx(["<p:t>{{deck_title}}</p:t><p:t>{{slide_1_bullet_1}}</p:t>"]);
  const output = await fillPptxTemplate(buffer, {
    title: "一元一次方程",
    slides: [{ title: "学习目标", bullets: ["理解方程"], speakerNotes: "", activity: "" }],
  });

  const zip = await JSZip.loadAsync(output);
  const xml = await zip.file("ppt/slides/slide1.xml").async("string");

  assert.equal(output.slice(0, 2).toString(), "PK");
  assert.match(xml, /一元一次方程/);
  assert.match(xml, /理解方程/);
  assert.doesNotMatch(xml, /{{deck_title}}/);
});

async function createFakePptx(slideXmlList) {
  const zip = new JSZip();
  slideXmlList.forEach((xml, index) => {
    zip.file(`ppt/slides/slide${index + 1}.xml`, xml);
  });
  return zip.generateAsync({ type: "nodebuffer" });
}
