# AI 备课辅助工具 Demo

面向中小学教师的 AI 备课辅助工具。项目基于中文教案生成产品框架改造，支持 OpenAI 兼容接口、结构化备课表单、局部重写、教学 PPT 生成、校本资源库 RAG、账号登录和“我的教案”保存。

## 功能

- 中小学教师表单：学科、年级、章节、课时、学情补充、教学类型、教学风格。
- 教学类型：严谨讲授、探究启发、考前复习课、一对一家教、习题课、实验实践课、公开展示课、自定义。
- 教学风格：严谨清晰、启发引导、互动活跃、温和陪伴、高效冲刺、分层照顾、故事化情境、自定义。
- 生成内容：教学目标、重难点分析、教案框架、课堂互动问题、课后作业题。
- 生成前可控项：教案详略、PPT 页数、板书设计、课堂评价、分层作业、自定义补充项。
- OpenAI 兼容接口：在前端配置 API Key、Base URL、模型名，后端代理调用。
- 流式生成：生成过程中实时展示内容，同时维护任务队列状态。
- 局部重写：对教学目标、重难点、课堂互动、课后作业等块单独重写。
- 文件资料解析：支持 `.txt`、`.md`、`.docx`、`.xlsx`、`.xls`、`.csv` 和常见图片格式。
- OCR：图片资料优先使用本地 RapidOCR，适合识别练习册、试卷、课堂截图。
- 校本资源库 / RAG：上传校本题库、优秀教案、课标摘录、教研材料后，按当前学科、年级、章节检索相关片段并注入生成上下文。
- 向量 RAG：资料入库时自动切块并写入轻量文本向量，生成教案和 PPT 时做关键词 + 向量混合检索。
- 我的教案：登录后可保存、打开、更新和删除自己的教案。
- SQLite 存储：用户、教案、校本资源存入本地 SQLite 数据库。
- PPT：支持先预览再下载 `.pptx`，也支持导入带占位符的 `.pptx` 模板。
- Docker：提供 Dockerfile、docker-compose 和 Render 示例配置，方便部署在线 Demo。

## 本地运行

```bash
npm install
python -m pip install rapidocr-onnxruntime
Copy-Item .env.example .env
npm run server
npm run dev
```

前端默认地址：[http://localhost:5173](http://localhost:5173)

后端默认地址：[http://localhost:3001](http://localhost:3001)

可以直接在页面右上角“模型配置”中填写 API Key、Base URL 和模型名。配置只保存在当前浏览器本地，生成时发送给本地后端代理。

也可以在 `.env` 中配置默认值：

```env
OPENAI_API_KEY=your_api_key_here
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_MODEL=gpt-4o-mini
PORT=3001
AUTH_TOKEN_SECRET=change_this_for_deployment
SQLITE_DB_PATH=data/app.db
PYTHON_BIN=python
```

## Docker 运行

```bash
docker compose up --build
```

Docker 模式下服务地址为：[http://localhost:3001](http://localhost:3001)

SQLite 数据会保存到 Docker volume `lesson_data`，不会因为容器重建而丢失。

## 在线 Demo 部署

仓库内提供了 `render.yaml`，可以在 Render 上用 Docker Web Service 部署：

1. 将代码推送到 GitHub。
2. 在 Render 新建 Blueprint 或 Web Service，选择该仓库。
3. 选择 Docker 环境。
4. 配置环境变量 `OPENAI_BASE_URL`、`OPENAI_MODEL`，按需配置 `OPENAI_API_KEY`。
5. 生产环境必须设置强随机 `AUTH_TOKEN_SECRET`。

如果开放给别人使用，不建议让用户在公网页面直接填写自己的 API Key。更稳妥的做法是由服务端统一接入学校或平台侧模型网关。

## 验证

```bash
npm test
npm run build
```

## 技术说明

- 前端：Vue 3 + Vite。
- 后端：Express，负责账号、文件解析、OCR、AI 代理、PPTX 导出、教案和资源库数据接口。
- 数据库：Node 24 内置 `node:sqlite`，默认落盘到 `data/app.db`。
- OCR：RapidOCR，本地不可用时再尝试支持视觉输入的 OpenAI 兼容模型。
- RAG：借鉴 RAGFlow、AnythingLLM 等开源项目的“资料入库、切块、向量索引、检索、注入上下文”流程，Demo 版采用 SQLite 存储和轻量本地向量检索。

## 生产化建议

当前项目适合作为简历项目、课程设计和产品 Demo。若投入真实学校场景，建议继续补充：

- 组织/学校/班级权限体系。
- HTTPS、服务端密钥托管、模型网关。
- 对象存储保存原始资料。
- 更专业的向量数据库或混合检索。
- 内容安全、事实性检查和教师确认发布流程。
- 操作日志、用量统计和成本控制。
- 数据备份、迁移脚本和监控告警。
