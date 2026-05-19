<script setup>
import { computed, onUnmounted, reactive, ref } from "vue";
import { marked } from "marked";
import {
  appendTaskOutput,
  buildLessonMarkdown,
  createTask,
  failTask,
  finishTask,
  parseLessonBlocks,
  replaceLessonBlock,
} from "./lessonWorkspace.js";

const teachingTypes = [
  "严谨讲授课",
  "探究启发课",
  "考前复习课",
  "一对一家教",
  "习题课",
  "实验实践课",
  "公开展示课",
  "自定义",
];

const teachingStyles = [
  "严谨清晰",
  "启发引导",
  "互动活跃",
  "温和陪伴",
  "高效冲刺",
  "分层照顾",
  "故事化情境",
  "自定义",
];

const taskSteps = {
  lesson: [
    "正在连接模型...",
    "正在分析学科、年级和章节...",
    "正在组织教学目标和重难点...",
    "正在生成课堂活动和互动问题...",
    "正在补充作业与教师提示...",
  ],
  ppt: [
    "正在提取教案结构...",
    "正在规划幻灯片页数...",
    "正在设计页面类型和栏目...",
    "正在生成教师讲解提示...",
    "正在整理 PPT 预览...",
  ],
  pptx: [
    "正在创建 PowerPoint 文件...",
    "正在应用课件版式...",
    "正在写入页面内容...",
    "正在准备下载...",
  ],
  section: [
    "正在定位教案章节...",
    "正在分析上下文...",
    "正在重写局部内容...",
    "正在合并回当前教案...",
  ],
};

const featureTagOptions = [
  "板书设计",
  "课堂评价",
  "分层作业",
  "课堂练习",
  "易错点分析",
  "核心素养",
  "教学反思",
  "课堂导入",
  "拓展任务",
  "家校沟通建议",
  "自定义",
];

const lessonSections = ["教学目标", "重难点分析", "教案框架", "课堂互动问题", "课后作业题"];

const form = reactive({
  subject: "数学",
  grade: "七年级",
  chapter: "一元一次方程",
  duration: "1课时",
  teachingType: "探究启发课",
  customTeachingType: "",
  teachingStyle: "互动活跃",
  customTeachingStyle: "",
  lessonDetail: "标准",
  pptSlideCount: 8,
  featureTags: ["板书设计", "课堂评价"],
  customFeatureTags: "",
  schoolTemplate: "",
  studentContext: "学生计算基础一般，课堂参与度较高，适合小组讨论和情境问题。",
});

const savedApiConfig = JSON.parse(localStorage.getItem("lessonPrepApiConfig") || "{}");

const apiConfig = reactive({
  apiKey: savedApiConfig.apiKey || "",
  baseUrl: savedApiConfig.baseUrl || "https://api.openai.com/v1",
  model: savedApiConfig.model || "gpt-4o-mini",
});

const showApiConfig = ref(!apiConfig.apiKey);
const loading = ref(false);
const error = ref("");
const result = ref("");
const lessonBlocks = ref([]);
const activeBlockTitle = ref("");
const copied = ref(false);
const attachments = ref([]);
const attachmentError = ref("");
const pptLoading = ref(false);
const pptDownloading = ref(false);
const pptError = ref("");
const pptOutline = ref(null);
const pptTemplate = reactive({
  fileName: "",
  base64: "",
  placeholders: [],
});
const templateInput = ref(null);
const sectionLoading = ref(false);
const sectionError = ref("");
const sectionForm = reactive({
  sectionTitle: "课堂互动问题",
  extraInstruction: "",
});
const activeTask = ref(null);
const activeTaskId = ref("");
const taskStepIndex = ref(0);
const taskDetail = ref("");
const taskQueue = ref([]);
let taskTimer = null;
const attachmentAccept =
  ".txt,.md,.docx,.xlsx,.xls,.csv,.png,.jpg,.jpeg,.webp,text/plain,text/markdown,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv,image/png,image/jpeg,image/webp";

const canSubmit = computed(
  () =>
    form.subject.trim() &&
    form.grade.trim() &&
    form.chapter.trim() &&
    form.duration.trim() &&
    form.teachingType.trim() &&
    form.teachingStyle.trim(),
);

const latestLessonMarkdown = computed(() => {
  if (lessonBlocks.value.length) return buildLessonMarkdown(lessonBlocks.value);
  return result.value;
});

const renderedResult = computed(() => {
  if (!latestLessonMarkdown.value) return "";
  return marked.parse(latestLessonMarkdown.value, { breaks: true });
});

const activeLessonBlock = computed(() => {
  if (!lessonBlocks.value.length) return null;
  return lessonBlocks.value.find((block) => block.title === activeBlockTitle.value) || lessonBlocks.value[0];
});

const recentTasks = computed(() => taskQueue.value.slice(0, 5));

const reusableSnippets = computed(() => {
  const targets = ["教学目标", "课堂互动问题", "课后作业题", "板书设计", "课堂评价"];
  return lessonBlocks.value.filter((block) =>
    targets.some((target) => block.title.includes(target) || block.content.includes(target)),
  );
});

const parsedAttachmentContexts = computed(() =>
  attachments.value
    .filter((attachment) => attachment.status === "done" && (attachment.extractedText || attachment.summary))
    .map((attachment) => ({
      name: attachment.name,
      sourceArea: attachment.sourceArea,
      summary: attachment.summary,
      extractedText: attachment.extractedText,
    })),
);

const taskTitle = computed(() => {
  if (activeTask.value === "lesson") return "正在生成备课方案";
  if (activeTask.value === "ppt") return "正在生成教学 PPT";
  if (activeTask.value === "pptx") return "正在导出 PPTX";
  if (activeTask.value === "section") return "正在局部重写";
  return "";
});

const taskText = computed(() => {
  if (!activeTask.value) return "";
  return taskSteps[activeTask.value][taskStepIndex.value] || taskSteps[activeTask.value][0];
});

function startTask(task) {
  stopTask();
  const queuedTask = createTask(task, taskTitleByType(task));
  taskQueue.value = [queuedTask, ...taskQueue.value].slice(0, 8);
  activeTaskId.value = queuedTask.id;
  activeTask.value = task;
  taskStepIndex.value = 0;
  taskDetail.value = "";
  taskTimer = window.setInterval(() => {
    const steps = taskSteps[task] || [];
    taskStepIndex.value = Math.min(taskStepIndex.value + 1, steps.length - 1);
  }, 2200);
  return queuedTask.id;
}

function stopTask(finalDetail = "", status = "done") {
  if (taskTimer) {
    window.clearInterval(taskTimer);
    taskTimer = null;
  }
  if (activeTaskId.value) {
    taskQueue.value =
      status === "error"
        ? failTask(taskQueue.value, activeTaskId.value, finalDetail)
        : finishTask(taskQueue.value, activeTaskId.value, finalDetail);
  }
  taskDetail.value = finalDetail;
  activeTask.value = null;
  activeTaskId.value = "";
}

onUnmounted(() => stopTask());

function taskTitleByType(task) {
  if (task === "lesson") return "生成备课方案";
  if (task === "ppt") return "生成 PPT 预览";
  if (task === "pptx") return "导出 PPTX";
  if (task === "section") return `重写${sectionForm.sectionTitle}`;
  return "处理任务";
}

function updateActiveTaskOutput(chunk) {
  if (!activeTaskId.value) return;
  taskQueue.value = appendTaskOutput(taskQueue.value, activeTaskId.value, chunk);
}

function syncLessonBlocksFromMarkdown(markdown) {
  lessonBlocks.value = parseLessonBlocks(markdown);
  activeBlockTitle.value = lessonBlocks.value[0]?.title || "";
}

function updateLessonBlock(title, content) {
  lessonBlocks.value = lessonBlocks.value.map((block) =>
    block.title === title ? { ...block, content } : block,
  );
  result.value = buildLessonMarkdown(lessonBlocks.value);
  pptOutline.value = null;
}

async function copyBlock(block) {
  if (!block) return;
  await navigator.clipboard.writeText(`# ${block.title}\n${block.content}`.trim());
}

async function uploadReferenceFiles(event, sourceArea) {
  const files = Array.from(event.target.files || []);
  if (!files.length) return;
  attachmentError.value = "";

  for (const file of files) {
    const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    attachments.value = [
      {
        id,
        name: file.name,
        sourceArea,
        status: "parsing",
        summary: "",
        extractedText: "",
        error: "",
      },
      ...attachments.value,
    ];

    try {
      const fileBase64 = await fileToBase64(file);
      const response = await fetch("/api/parse-attachment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileName: file.name,
          sourceArea,
          fileBase64,
          apiConfig,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || "资料解析失败，请换一个文件重试。");
      }
      const parsed = data.attachment || {};
      attachments.value = attachments.value.map((attachment) =>
        attachment.id === id
          ? {
              ...attachment,
              status: "done",
              summary: parsed.summary || "",
              extractedText: parsed.extractedText || "",
            }
          : attachment,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : "资料解析失败，请换一个文件重试。";
      attachmentError.value = message;
      attachments.value = attachments.value.map((attachment) =>
        attachment.id === id ? { ...attachment, status: "error", error: message } : attachment,
      );
    }
  }

  event.target.value = "";
}

function removeAttachment(id) {
  attachments.value = attachments.value.filter((attachment) => attachment.id !== id);
}

function attachmentsByArea(sourceArea) {
  return attachments.value.filter((attachment) => attachment.sourceArea === sourceArea);
}

function fillExample() {
  Object.assign(form, {
    subject: "语文",
    grade: "五年级",
    chapter: "草船借箭",
    duration: "2课时",
    teachingType: "自定义",
    customTeachingType: "公开课展示课，需要兼顾文本细读、角色体验和小组展示",
    teachingStyle: "故事化情境",
    customTeachingStyle: "",
    lessonDetail: "详细",
    pptSlideCount: 10,
    featureTags: ["板书设计", "课堂评价", "核心素养"],
    customFeatureTags: "加入小组评价表",
    studentContext: "学生熟悉三国故事片段，但对人物语言和情节推进的理解需要引导。",
  });
  error.value = "";
}

function resetAll() {
  Object.assign(form, {
    subject: "",
    grade: "",
    chapter: "",
    duration: "1课时",
    teachingType: "探究启发课",
    customTeachingType: "",
    teachingStyle: "互动活跃",
    customTeachingStyle: "",
    lessonDetail: "标准",
    pptSlideCount: 8,
    featureTags: [],
    customFeatureTags: "",
    schoolTemplate: "",
    studentContext: "",
  });
  result.value = "";
  lessonBlocks.value = [];
  activeBlockTitle.value = "";
  pptOutline.value = null;
  pptError.value = "";
  error.value = "";
  copied.value = false;
  taskDetail.value = "";
  taskQueue.value = [];
  attachments.value = [];
  attachmentError.value = "";
}

function clearPptTemplate() {
  pptTemplate.fileName = "";
  pptTemplate.base64 = "";
  pptTemplate.placeholders = [];
}

function openTemplatePicker() {
  templateInput.value?.click();
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || "");
      resolve(result.includes(",") ? result.split(",").pop() : result);
    };
    reader.onerror = () => reject(reader.error || new Error("文件读取失败"));
    reader.readAsDataURL(file);
  });
}

function toggleFeatureTag(tag) {
  const exists = form.featureTags.includes(tag);
  form.featureTags = exists ? form.featureTags.filter((item) => item !== tag) : [...form.featureTags, tag];
}

async function importTemplate(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  const lowerName = file.name.toLowerCase();

  try {
    if (lowerName.endsWith(".txt") || lowerName.endsWith(".md")) {
      form.schoolTemplate = await file.text();
      error.value = "";
      return;
    }

    if (lowerName.endsWith(".ppt")) {
      pptError.value = "暂不支持 .ppt 老格式，请先另存为 .pptx 后上传。";
      return;
    }

    if (lowerName.endsWith(".pptx")) {
      await inspectPptxTemplateFile(file);
      return;
    }

    error.value = "请导入 .txt、.md 或 .pptx 模板文件。";
  } finally {
    event.target.value = "";
  }
}

async function inspectPptxTemplateFile(file) {
  pptError.value = "";
  const base64 = await fileToBase64(file);
  const response = await fetch("/api/inspect-pptx-template", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      fileName: file.name,
      templateBase64: base64,
    }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || "模板解析失败，请检查 PPTX 文件。");
  }
  pptTemplate.fileName = file.name;
  pptTemplate.base64 = base64;
  pptTemplate.placeholders = data.placeholders || [];
}

async function readError(response) {
  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    const data = await response.json().catch(() => ({}));
    return data.error || "生成失败，请稍后重试。";
  }
  return (await response.text()) || "生成失败，请稍后重试。";
}

async function generateLesson() {
  if (!canSubmit.value) {
    error.value = "请先填写学科、年级、章节、课时、教学类型和教学风格。";
    return;
  }

  if (!apiConfig.apiKey.trim()) {
    error.value = "请先打开右上角模型配置并填写 API Key。";
    showApiConfig.value = true;
    return;
  }

  loading.value = true;
  error.value = "";
  result.value = "";
  lessonBlocks.value = [];
  activeBlockTitle.value = "";
  pptOutline.value = null;
  pptError.value = "";
  copied.value = false;
  startTask("lesson");
  localStorage.setItem("lessonPrepApiConfig", JSON.stringify(apiConfig));

  try {
    const response = await fetch("/api/generate-lesson", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        apiConfig,
        attachmentsContext: parsedAttachmentContexts.value,
      }),
    });

    if (!response.ok) {
      throw new Error(await readError(response));
    }

    if (!response.body) {
      throw new Error("浏览器未收到可读流，请重试。");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value, { stream: true });
      result.value += chunk;
      updateActiveTaskOutput(chunk);
      taskDetail.value = `已生成约 ${result.value.length} 字`;
    }

    result.value += decoder.decode();
    syncLessonBlocksFromMarkdown(result.value);
    stopTask(`备课方案已生成，约 ${result.value.length} 字`);
  } catch (err) {
    error.value = err instanceof Error ? err.message : "生成失败，请稍后重试。";
    stopTask("生成失败，请检查配置后重试", "error");
  } finally {
    loading.value = false;
  }
}

async function copyResult() {
  if (!latestLessonMarkdown.value) return;
  await navigator.clipboard.writeText(latestLessonMarkdown.value);
  copied.value = true;
  window.setTimeout(() => {
    copied.value = false;
  }, 1800);
}

async function generatePptOutline() {
  if (!latestLessonMarkdown.value) {
    pptError.value = "请先生成备课方案。";
    return;
  }

  pptLoading.value = true;
  pptError.value = "";
  pptOutline.value = null;
  startTask("ppt");
  localStorage.setItem("lessonPrepApiConfig", JSON.stringify(apiConfig));

  try {
    const response = await fetch("/api/generate-ppt-outline", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        apiConfig,
        lessonContent: latestLessonMarkdown.value,
        attachmentsContext: parsedAttachmentContexts.value,
      }),
    });
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(data.error || "PPT 大纲生成失败，请稍后重试。");
    }

    pptOutline.value = data.outline;
    stopTask(`PPT 预览已生成，共 ${pptOutline.value?.slides?.length || 0} 页`);
  } catch (err) {
    pptError.value = err instanceof Error ? err.message : "PPT 大纲生成失败，请稍后重试。";
    stopTask("PPT 预览生成失败，请检查配置后重试", "error");
  } finally {
    pptLoading.value = false;
  }
}

async function downloadPptx() {
  if (!pptOutline.value) return;

  pptDownloading.value = true;
  pptError.value = "";
  startTask("pptx");

  try {
    const response = await fetch("/api/export-pptx", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        outline: pptOutline.value,
        templateBase64: pptTemplate.base64,
      }),
    });

    if (!response.ok) {
      throw new Error(await readError(response));
    }

    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${pptOutline.value.title || form.chapter || "教学PPT"}.pptx`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    stopTask("PPTX 已准备完成");
  } catch (err) {
    pptError.value = err instanceof Error ? err.message : "PPTX 导出失败，请稍后重试。";
    stopTask("PPTX 导出失败，请稍后重试", "error");
  } finally {
    pptDownloading.value = false;
  }
}

async function regenerateSection() {
  if (!latestLessonMarkdown.value) {
    sectionError.value = "请先生成备课方案。";
    return;
  }

  sectionLoading.value = true;
  sectionError.value = "";
  startTask("section");

  try {
    const response = await fetch("/api/regenerate-section", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        apiConfig,
        sectionTitle: sectionForm.sectionTitle,
        extraInstruction: sectionForm.extraInstruction,
        lessonContent: latestLessonMarkdown.value,
        attachmentsContext: parsedAttachmentContexts.value,
      }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.error || "局部重写失败，请稍后重试。");
    }

    lessonBlocks.value = replaceLessonBlock(lessonBlocks.value, data.sectionTitle, data.content);
    result.value = buildLessonMarkdown(lessonBlocks.value);
    activeBlockTitle.value = data.sectionTitle;
    pptOutline.value = null;
    stopTask(`${data.sectionTitle} 已更新，PPT 预览需重新生成`);
  } catch (err) {
    sectionError.value = err instanceof Error ? err.message : "局部重写失败，请稍后重试。";
    stopTask("局部重写失败，请稍后重试", "error");
  } finally {
    sectionLoading.value = false;
  }
}
</script>

<template>
  <main class="app-shell">
    <section class="workspace">
      <aside class="prep-panel">
        <div class="brand-row">
          <div class="logo-mark">备</div>
          <div>
            <p class="eyebrow">中小学教师场景</p>
            <h1>AI备课辅助工具</h1>
          </div>
          <button class="config-toggle" type="button" @click="showApiConfig = !showApiConfig">
            模型配置
          </button>
        </div>

        <section v-if="showApiConfig" class="api-config">
          <label>
            <span>API Key</span>
            <input
              v-model="apiConfig.apiKey"
              type="password"
              autocomplete="off"
              placeholder="sk-..."
            />
          </label>
          <label>
            <span>Base URL</span>
            <input v-model="apiConfig.baseUrl" placeholder="https://api.openai.com/v1" />
          </label>
          <label>
            <span>模型</span>
            <input v-model="apiConfig.model" placeholder="gpt-4o-mini" />
          </label>
          <p class="config-note">
            配置仅保存在当前浏览器本地，并在生成时发送给本地后端代理；适合 Demo 演示。
          </p>
        </section>

        <form class="form-grid" @submit.prevent="generateLesson">
          <label>
            <span>学科</span>
            <input v-model="form.subject" placeholder="如：语文、数学、英语" />
          </label>

          <label>
            <span>年级</span>
            <input v-model="form.grade" placeholder="如：三年级、八年级" />
          </label>

          <label class="wide">
            <span>章节 / 课题</span>
            <input v-model="form.chapter" placeholder="如：一元一次方程" />
          </label>

          <label>
            <span>课时</span>
            <input v-model="form.duration" placeholder="如：1课时、45分钟" />
          </label>

          <label>
            <span>教案详略</span>
            <select v-model="form.lessonDetail">
              <option value="简洁">简洁</option>
              <option value="标准">标准</option>
              <option value="详细">详细</option>
            </select>
          </label>

          <label>
            <span>PPT 页数</span>
            <select v-model.number="form.pptSlideCount">
              <option :value="6">6 页</option>
              <option :value="8">8 页</option>
              <option :value="10">10 页</option>
              <option :value="12">12 页</option>
            </select>
          </label>

          <label>
            <span>教学类型</span>
            <select v-model="form.teachingType">
              <option v-for="item in teachingTypes" :key="item" :value="item">{{ item }}</option>
            </select>
          </label>

          <label v-if="form.teachingType === '自定义'" class="wide">
            <span>自定义教学类型说明</span>
            <textarea
              v-model="form.customTeachingType"
              rows="3"
              placeholder="如：实验探究课、公开课展示课、跨学科项目课、低年级游戏化课堂、错题讲评课等。"
            />
          </label>
          <section v-if="form.teachingType === '自定义'" class="wide attachment-panel">
            <div>
              <span>上传教学类型资料</span>
              <input
                type="file"
                multiple
                :accept="attachmentAccept"
                @change="uploadReferenceFiles($event, '自定义教学类型')"
              />
            </div>
          </section>

          <label>
            <span>教学风格</span>
            <select v-model="form.teachingStyle">
              <option v-for="item in teachingStyles" :key="item" :value="item">{{ item }}</option>
            </select>
          </label>

          <label v-if="form.teachingStyle === '自定义'" class="wide">
            <span>自定义教学风格说明</span>
            <textarea
              v-model="form.customTeachingStyle"
              rows="3"
              placeholder="如：班主任式陪伴、竞赛教练式推进、低龄儿童故事化表达、轻松幽默但节奏紧凑等。"
            />
          </label>
          <section v-if="form.teachingStyle === '自定义'" class="wide attachment-panel">
            <div>
              <span>上传教学风格资料</span>
              <input
                type="file"
                multiple
                :accept="attachmentAccept"
                @change="uploadReferenceFiles($event, '自定义教学风格')"
              />
            </div>
          </section>

          <label class="wide">
            <span>学情补充</span>
            <textarea
              v-model="form.studentContext"
              rows="5"
              placeholder="补充学生基础、课堂特点、分层需求等"
            />
          </label>
          <section class="wide attachment-panel">
            <div>
              <span>上传学情资料</span>
              <input
                type="file"
                multiple
                :accept="attachmentAccept"
                @change="uploadReferenceFiles($event, '学情补充')"
              />
            </div>
          </section>

          <section class="wide option-block">
            <span>可选生成项</span>
            <div class="tag-grid">
              <button
                v-for="tag in featureTagOptions"
                :key="tag"
                type="button"
                :class="{ selected: form.featureTags.includes(tag) }"
                @click="toggleFeatureTag(tag)"
              >
                {{ tag }}
              </button>
            </div>
            <input
              v-if="form.featureTags.includes('自定义')"
              v-model="form.customFeatureTags"
              placeholder="补充自定义生成要求，如：加入实验安全提醒、加入中考真题、加入小组评价表"
            />
            <div v-if="form.featureTags.includes('自定义')" class="attachment-panel compact">
              <span>上传自定义要求资料</span>
              <input
                type="file"
                multiple
                :accept="attachmentAccept"
                @change="uploadReferenceFiles($event, '自定义生成要求')"
              />
            </div>
          </section>

          <section class="wide option-block template-import-block">
            <span>模板导入</span>
            <textarea
              v-model="form.schoolTemplate"
              rows="5"
              placeholder="可粘贴学校教案模板；也可点击下方按钮导入 .txt / .md / .pptx 文件"
            />
            <div class="template-upload-row">
              <button type="button" @click="openTemplatePicker">导入模板文件</button>
              <span>支持 .txt / .md / .pptx；.ppt 请先另存为 .pptx</span>
              <input
                ref="templateInput"
                class="hidden-file-input"
                type="file"
                accept=".txt,.md,.ppt,.pptx,text/plain,text/markdown,application/vnd.openxmlformats-officedocument.presentationml.presentation"
                @change="importTemplate"
              />
            </div>
            <div class="template-status">
              <p v-if="form.schoolTemplate">已导入/粘贴教案模板，约 {{ form.schoolTemplate.length }} 字</p>
              <p v-if="pptTemplate.fileName">
                已导入 PPTX 模板：<strong>{{ pptTemplate.fileName }}</strong>
                <button type="button" @click="clearPptTemplate">移除</button>
              </p>
              <p v-if="pptTemplate.placeholders.length">
                PPTX 占位符：{{ pptTemplate.placeholders.slice(0, 12).join("、") }}
              </p>
              <p v-else-if="pptTemplate.fileName">
                PPTX 未识别到占位符。建议加入 <code v-pre>{{deck_title}}</code>、<code
                  v-pre
                  >{{slide_1_title}}</code
                > 等。
              </p>
            </div>
            <p class="config-note">
              .txt/.md 用作教案校本模板；.pptx 用作 PPT 导出模板。PPTX 占位符示例：
              <code v-pre>{{deck_title}}</code>、<code v-pre>{{slide_1_title}}</code>、<code
                v-pre
                >{{slide_1_bullet_1}}</code
              >。
            </p>
            <div class="attachment-panel compact">
              <span>上传校本参考资料</span>
              <input
                type="file"
                multiple
                :accept="attachmentAccept"
                @change="uploadReferenceFiles($event, '模板导入')"
              />
            </div>
          </section>

          <section v-if="attachments.length" class="wide attachment-list">
            <div class="attachment-list-header">
              <span>已解析资料</span>
              <strong>{{ parsedAttachmentContexts.length }} / {{ attachments.length }}</strong>
            </div>
            <article
              v-for="attachment in attachments"
              :key="attachment.id"
              :class="['attachment-item', attachment.status]"
            >
              <div>
                <strong>{{ attachment.name }}</strong>
                <p>
                  {{ attachment.sourceArea }} ·
                  {{
                    attachment.status === "parsing"
                      ? "解析中"
                      : attachment.status === "done"
                        ? attachment.summary || "已解析"
                        : attachment.error
                  }}
                </p>
              </div>
              <button type="button" @click="removeAttachment(attachment.id)">移除</button>
            </article>
            <p v-if="attachmentError" class="error-message">{{ attachmentError }}</p>
          </section>

          <div class="actions wide">
            <button class="primary" type="submit" :disabled="loading || !canSubmit">
              {{ loading ? "生成中..." : "生成备课方案" }}
            </button>
            <button type="button" @click="fillExample">加载示例</button>
            <button type="button" @click="resetAll">清空</button>
          </div>
        </form>

        <p v-if="error" class="error-message">{{ error }}</p>
      </aside>

      <section class="result-panel">
        <div class="result-header">
          <div>
            <p class="eyebrow">生成结果</p>
            <h2>{{ form.chapter || "待生成备课方案" }}</h2>
          </div>
          <button class="copy-button" type="button" :disabled="!latestLessonMarkdown" @click="copyResult">
            {{ copied ? "已复制" : "复制" }}
          </button>
        </div>

        <section v-if="activeTask || taskDetail" class="task-panel">
          <div>
            <p class="eyebrow">{{ taskTitle || "任务状态" }}</p>
            <h3>{{ activeTask ? taskText : taskDetail }}</h3>
            <p v-if="activeTask && taskDetail">{{ taskDetail }}</p>
          </div>
          <div v-if="activeTask" class="task-bar"></div>
        </section>

        <section v-if="recentTasks.length" class="task-queue">
          <div class="task-queue-header">
            <p class="eyebrow">任务队列</p>
            <span>{{ recentTasks.length }} 个最近任务</span>
          </div>
          <div class="task-list">
            <article v-for="task in recentTasks" :key="task.id" :class="['task-item', task.status]">
              <div>
                <strong>{{ task.title }}</strong>
                <p>{{ task.detail || "任务处理中" }}</p>
              </div>
              <span>{{ task.status === "running" ? "进行中" : task.status === "done" ? "完成" : "失败" }}</span>
            </article>
          </div>
        </section>

        <template v-if="latestLessonMarkdown">

          <section class="section-regenerate">
            <div>
              <p class="eyebrow">局部重写</p>
              <h3>只更新需要调整的部分</h3>
            </div>
            <div class="section-controls">
              <select v-model="sectionForm.sectionTitle">
                <option v-for="section in lessonSections" :key="section" :value="section">
                  {{ section }}
                </option>
              </select>
              <input
                v-model="sectionForm.extraInstruction"
                placeholder="可选：例如更有层次、更适合基础薄弱学生、增加开放性问题"
              />
              <button type="button" :disabled="sectionLoading" @click="regenerateSection">
                {{ sectionLoading ? "重写中..." : "重新生成该部分" }}
              </button>
            </div>
            <div class="attachment-panel section-attachment">
              <span>上传局部重写参考资料</span>
              <input
                type="file"
                multiple
                :accept="attachmentAccept"
                @change="uploadReferenceFiles($event, `局部重写-${sectionForm.sectionTitle}`)"
              />
            </div>
            <div v-if="attachmentsByArea(`局部重写-${sectionForm.sectionTitle}`).length" class="section-attachment-summary">
              当前章节参考资料：
              {{
                attachmentsByArea(`局部重写-${sectionForm.sectionTitle}`)
                  .map((attachment) => attachment.name)
                  .join("、")
              }}
            </div>
            <p v-if="sectionError" class="error-message">{{ sectionError }}</p>
          </section>

          <section v-if="lessonBlocks.length" class="content-workbench">
            <div class="workbench-header">
              <div>
                <p class="eyebrow">内容工作台</p>
                <h3>分块编辑与复用</h3>
              </div>
              <span>{{ lessonBlocks.length }} 个内容块已同步到 PPT 与局部重写</span>
            </div>

            <div class="block-tabs">
              <button
                v-for="block in lessonBlocks"
                :key="block.title"
                type="button"
                :class="{ selected: activeLessonBlock?.title === block.title }"
                @click="activeBlockTitle = block.title"
              >
                {{ block.title }}
              </button>
            </div>

            <article v-if="activeLessonBlock" class="block-editor">
              <div class="block-editor-header">
                <h4>{{ activeLessonBlock.title }}</h4>
                <button type="button" @click="copyBlock(activeLessonBlock)">复制该块</button>
              </div>
              <textarea
                :value="activeLessonBlock.content"
                rows="10"
                @input="updateLessonBlock(activeLessonBlock.title, $event.target.value)"
              />
            </article>

            <div v-if="reusableSnippets.length" class="reuse-panel">
              <p class="eyebrow">可复用片段</p>
              <div>
                <button
                  v-for="block in reusableSnippets"
                  :key="`reuse-${block.title}`"
                  type="button"
                  @click="copyBlock(block)"
                >
                  复制{{ block.title }}
                </button>
              </div>
            </div>
          </section>

          <div class="ppt-actions">
            <button type="button" :disabled="pptLoading" @click="generatePptOutline">
              {{ pptLoading ? "生成PPT中..." : "生成教学PPT" }}
            </button>
            <button type="button" :disabled="!pptOutline || pptDownloading" @click="downloadPptx">
              {{ pptDownloading ? "导出中..." : "下载PPTX" }}
            </button>
          </div>

          <p v-if="pptError" class="error-message">{{ pptError }}</p>

          <section v-if="pptOutline" class="ppt-preview">
            <div class="ppt-preview-header">
              <p class="eyebrow">PPT 预览</p>
              <h3>{{ pptOutline.title }}</h3>
            </div>
            <div class="slide-grid">
              <article v-for="(slide, index) in pptOutline.slides" :key="`${slide.title}-${index}`">
                <span>{{ index + 1 }} · {{ slide.type }}</span>
                <h4>{{ slide.title }}</h4>
                <ul>
                  <li v-for="bullet in slide.bullets" :key="bullet">{{ bullet }}</li>
                </ul>
                <div v-if="slide.sections?.length" class="slide-sections">
                  <p v-for="section in slide.sections" :key="`${section.label}-${section.text}`">
                    <strong>{{ section.label }}</strong
                    >：{{ section.text }}
                  </p>
                </div>
                <p v-if="slide.activity">活动：{{ slide.activity }}</p>
                <p v-if="slide.visualHint">视觉：{{ slide.visualHint }}</p>
              </article>
            </div>
          </section>

          <article class="lesson-content" v-html="renderedResult"></article>
        </template>

        <div v-else-if="loading" class="empty-state">
          <div class="loading-bar"></div>
          <p>正在连接模型，准备生成备课方案...</p>
        </div>

        <div v-else class="empty-state">
          <h3>填写左侧信息后生成</h3>
          <p>Demo 会调用后端 OpenAI 兼容接口，输出结构化 Markdown 备课方案。</p>
          <ul>
            <li>教学目标</li>
            <li>重难点分析</li>
            <li>教案框架</li>
            <li>课堂互动问题</li>
            <li>课后作业题</li>
          </ul>
        </div>
      </section>
    </section>
  </main>
</template>
