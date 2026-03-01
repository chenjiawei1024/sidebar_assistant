# AI Sidebar

一个通用的 Chrome 侧边栏 AI 聊天助手，支持 OpenAI 兼容接口的流式传输。

![Version](https://img.shields.io/badge/version-1.1.0-blue)
![License](https://img.shields.io/badge/license-MIT-green)

## 特性

- 🤖 **通用模型支持** - 支持任意 OpenAI 兼容格式的模型
- ⚡ **流式传输** - 实时显示 AI 回复，体验更流畅
- 🎨 **Vercel/Linear 风格** - 简洁优雅的黑白灰设计风格
- 🔒 **本地存储** - API Key 安全保存在本地浏览器
- 💬 **多轮对话** - 支持连续对话上下文

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

## 配置

在设置面板中配置：

- **API Key**: 你的 OpenAI 兼容 API Key
- **模型**: 模型名称（如 `gpt-3.5-turbo`、`gpt-4`、`deepseek-chat` 等）

默认使用 DeepSeek API，可以通过修改 `background.js` 中的 `API_BASE_URL` 更换其他服务商。

## 技术栈

- Chrome Extension Manifest V3
- Service Worker 代理请求（解决 CORS）
- Server-Sent Events (SSE) 流式传输
- 原生 JavaScript（无框架依赖）

## 文件结构

```
├── manifest.json      # 扩展配置
├── background.js      # Service Worker，处理 API 请求
├── sidepanel.html     # 侧边栏 HTML
├── sidepanel.js       # 侧边栏逻辑
├── sidepanel.css      # 样式（Vercel/Linear 风格）
├── icons/             # 图标文件
│   ├── icon16.png
│   ├── icon32.png
│   ├── icon48.png
│   └── icon128.png
└── README.md
```

## License

MIT
