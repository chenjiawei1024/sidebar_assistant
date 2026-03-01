# AI Sidebar

一个通用的 Chrome 侧边栏 AI 聊天助手，支持 OpenAI 兼容接口的流式传输，并可直接操作页面内容。

![Version](https://img.shields.io/badge/version-1.2.0-blue)
![License](https://img.shields.io/badge/license-MIT-green)

## 特性

- 🤖 **通用模型支持** - 支持任意 OpenAI 兼容格式的模型
- ⚡ **流式传输** - 实时显示 AI 回复，体验更流畅
- 🎨 **Vercel/Linear 风格** - 简洁优雅的黑白灰设计风格
- 🔒 **本地存储** - API Key 安全保存在本地浏览器
- 💬 **多轮对话** - 支持连续对话上下文
- 📄 **页面内容操作** - 可获取页面选中文本，或将 AI 回复插入到页面输入框

## 页面内容操作功能

### 1. 引用页面文本
- 在任意网页选中文本
- 点击侧边栏输入框旁的 🔗 按钮
- 选中的文本会以引用格式（`>`）插入到输入框

### 2. 插入 AI 回复到页面
- AI 回复后，消息下方会显示操作按钮
- 点击"插入到页面"按钮，可将内容插入到当前聚焦的输入框
- 支持 `<input>`、`<textarea>` 和 `contenteditable` 元素
- 插入前会高亮显示目标输入框

### 3. 一键复制
- 点击"复制"按钮快速复制 AI 回复内容

## 安装

### 开发者模式加载

1. 下载或克隆本项目
2. 打开 Chrome 浏览器，进入 `chrome://extensions/`
3. 开启右上角的"开发者模式"
4. 点击"加载已解压的扩展程序"
5. 选择项目文件夹

### 打包安装

1. 进入 `chrome://extensions/`
2. 开启开发者模式
3. 点击"打包扩展程序"
4. 选择项目文件夹，生成 `.crx` 文件

## 使用

1. 点击浏览器工具栏的扩展图标，或按快捷键打开侧边栏
2. 点击设置按钮，输入你的 API Key 和模型名称
3. 开始聊天！

### 快速操作

- **引用页面内容**：在网页选中文本 → 点击 🔗 按钮
- **插入到页面**：在目标输入框点击聚焦 → 点击 AI 回复的"插入到页面"
- **复制内容**：点击 AI 回复的"复制"按钮

## 配置

在设置面板中配置：

- **API Key**: 你的 OpenAI 兼容 API Key
- **模型**: 模型名称（如 `gpt-3.5-turbo`、`gpt-4`、`deepseek-chat` 等）

默认使用 DeepSeek API，可以通过修改 `background.js` 中的 `API_BASE_URL` 更换其他服务商。

## 技术栈

- Chrome Extension Manifest V3
- Service Worker 代理请求（解决 CORS）
- Content Script 操作页面 DOM
- Server-Sent Events (SSE) 流式传输
- 原生 JavaScript（无框架依赖）

## 文件结构

```
├── manifest.json      # 扩展配置
├── background.js      # Service Worker，处理 API 请求和流式传输
├── content.js         # Content Script，操作页面 DOM
├── sidepanel.html     # 侧边栏 HTML
├── sidepanel.js       # 侧边栏逻辑
├── sidepanel.css      # 样式（Vercel/Linear 风格）
├── icons/             # 图标文件
│   ├── icon16.png
│   ├── icon32.png
│   ├── icon48.png
│   └── icon128.png
├── README.md
└── .gitignore
```

## 权限说明

扩展请求以下权限：

- `sidePanel`: 使用 Chrome 侧边栏 API
- `storage`: 本地存储 API Key 和设置
- `activeTab`: 访问当前活动标签页
- `scripting`: 执行 Content Script
- `host_permissions`: 访问 AI API 服务

## 隐私说明

- API Key 仅存储在本地浏览器，不会上传到任何服务器
- 页面内容仅在用户主动操作时才会读取
- 所有网络请求直接发送到用户配置的 API 端点

## License

MIT
