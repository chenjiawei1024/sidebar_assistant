// AI Sidebar - Main Script
// 通过 Background Service Worker 代理 API 请求，避免 CORS 限制

// ==================== OpenAI Style Client (通过 Background 代理) ====================

class OpenAI {
  constructor({ apiKey, baseURL, dangerouslyAllowBrowser = false }) {
    if (!apiKey) {
      throw new Error('API Key is required');
    }

    this.apiKey = apiKey;
    this.baseURL = baseURL || 'https://api.deepseek.com/v1';
  }

  // Chat Completions API - 流式版本
  chat = {
    completions: {
      create: async (params, onChunk) => {
        // 如果是流式请求，使用长连接
        if (params.stream) {
          return new Promise((resolve, reject) => {
            const port = chrome.runtime.connect({ name: 'chat-stream' });
            let fullContent = '';

            port.onMessage.addListener((message) => {
              if (message.type === 'chunk') {
                fullContent += message.content;
                if (onChunk) {
                  onChunk(message.content, fullContent);
                }
              } else if (message.type === 'done') {
                resolve({
                  choices: [
                    {
                      message: { content: fullContent },
                      finish_reason: 'stop',
                    },
                  ],
                });
              } else if (message.type === 'error') {
                const error = new Error(message.error || 'Stream error');
                error.status = message.status;
                reject(error);
              }
            });

            port.onDisconnect.addListener(() => {
              // 连接断开时的处理
            });

            port.postMessage({
              action: 'chat.completions.stream',
              params: params,
              apiKey: this.apiKey,
            });
          });
        } else {
          // 非流式请求（兼容旧代码）
          return new Promise((resolve, reject) => {
            chrome.runtime.sendMessage(
              {
                action: 'chat.completions.create',
                params: params,
                apiKey: this.apiKey,
              },
              (response) => {
                if (chrome.runtime.lastError) {
                  reject(new Error(chrome.runtime.lastError.message));
                  return;
                }

                if (response.success) {
                  resolve(response.data);
                } else {
                  const error = new Error(response.error || 'Unknown error');
                  error.status = response.status;
                  reject(error);
                }
              },
            );
          });
        }
      },
    },
  };

  // Models API - 通过 Background Script 代理
  models = {
    list: async () => {
      return new Promise((resolve, reject) => {
        chrome.runtime.sendMessage(
          {
            action: 'models.list',
            apiKey: this.apiKey,
          },
          (response) => {
            if (chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError.message));
              return;
            }

            if (response.success) {
              resolve(response.data);
            } else {
              const error = new Error(response.error || 'Unknown error');
              error.status = response.status;
              reject(error);
            }
          },
        );
      });
    },
  };
}

// 验证 API Key 格式
function validateApiKey(key) {
  if (!key || typeof key !== 'string') {
    return { valid: false, message: 'API Key 不能为空' };
  }

  const trimmedKey = key.trim();

  if (trimmedKey.length === 0) {
    return { valid: false, message: 'API Key 不能为空' };
  }

  if (trimmedKey.length < 10) {
    return { valid: false, message: 'API Key 长度过短，请检查是否复制完整' };
  }

  return { valid: true, message: '' };
}

// ==================== Main Application ====================

// Configuration
const API_BASE_URL = 'https://api.deepseek.com/v1';
const STORAGE_KEY_API_KEY = 'ai_sidebar_api_key';
const STORAGE_KEY_MODEL = 'ai_sidebar_model';

// State
let apiKey = '';
let currentModel = 'gpt-3.5-turbo';
let isGenerating = false;
let messageHistory = [];
let openaiClient = null;
let currentStreamingElement = null;

// DOM Elements
const settingsBtn = document.getElementById('settingsBtn');
const settingsPanel = document.getElementById('settingsPanel');
const apiKeyInput = document.getElementById('apiKeyInput');
const modelInput = document.getElementById('modelInput');
const saveSettingsBtn = document.getElementById('saveSettingsBtn');
const testConnectionBtn = document.getElementById('testConnectionBtn');
const chatInput = document.getElementById('chatInput');
const sendBtn = document.getElementById('sendBtn');
const quoteBtn = document.getElementById('quoteBtn');
const messagesContainer = document.getElementById('messages');
const chatContainer = document.getElementById('chatContainer');
const welcomeState = document.getElementById('welcomeState');

// Initialize
async function init() {
  await loadSettings();
  setupEventListeners();
  updateSendButton();
  initOpenAIClient();
}

// Initialize OpenAI Client
function initOpenAIClient() {
  if (!apiKey) {
    openaiClient = null;
    return;
  }

  try {
    openaiClient = new OpenAI({
      apiKey: apiKey,
      baseURL: API_BASE_URL,
      dangerouslyAllowBrowser: true,
    });
    console.log('OpenAI client initialized');
  } catch (error) {
    console.error('Failed to initialize OpenAI client:', error);
    openaiClient = null;
  }
}

// Load settings from storage
async function loadSettings() {
  try {
    const result = await chrome.storage.local.get([
      STORAGE_KEY_API_KEY,
      STORAGE_KEY_MODEL,
    ]);
    apiKey = result[STORAGE_KEY_API_KEY] || '';
    currentModel = result[STORAGE_KEY_MODEL] || 'gpt-3.5-turbo';

    // Update UI
    apiKeyInput.value = apiKey;
    modelInput.value = currentModel;
  } catch (error) {
    console.error('Failed to load settings:', error);
  }
}

// Save settings to storage
async function saveSettings() {
  const newApiKey = apiKeyInput.value.trim();
  const newModel = modelInput.value.trim() || 'gpt-3.5-turbo';

  // Validate API Key format
  if (newApiKey) {
    const validation = validateApiKey(newApiKey);
    if (!validation.valid) {
      showToast(validation.message, 'error');
      apiKeyInput.focus();
      return;
    }
  }

  apiKey = newApiKey;
  currentModel = newModel;

  // Re-initialize OpenAI client with new key
  initOpenAIClient();

  try {
    await chrome.storage.local.set({
      [STORAGE_KEY_API_KEY]: apiKey,
      [STORAGE_KEY_MODEL]: currentModel,
    });

    // Close settings panel
    settingsPanel.classList.remove('show');
    settingsBtn.classList.remove('active');

    // Show success feedback
    showToast('设置已保存');
  } catch (error) {
    console.error('Failed to save settings:', error);
    showToast('保存失败，请重试', 'error');
  }
}

// Test API connection
async function testConnection() {
  const testApiKey = apiKeyInput.value.trim();
  const testModel = modelInput.value.trim() || 'gpt-3.5-turbo';

  // Validate format first
  const validation = validateApiKey(testApiKey);
  if (!validation.valid) {
    showToast(validation.message, 'error');
    return;
  }

  testConnectionBtn.disabled = true;
  testConnectionBtn.textContent = '测试中...';

  try {
    // Create temporary client for testing
    const testClient = new OpenAI({
      apiKey: testApiKey,
      baseURL: API_BASE_URL,
      dangerouslyAllowBrowser: true,
    });

    const models = await testClient.models.list();
    const modelCount = models.data?.length || 0;

    // Check if requested model is available
    const requestedModelAvailable = models.data?.some(
      (m) => m.id === testModel,
    );

    if (requestedModelAvailable) {
      showToast(`连接成功！模型 "${testModel}" 可用`);
    } else if (modelCount > 0) {
      showToast(
        `连接成功！但 "${testModel}" 可能不可用，可用模型: ${modelCount}个`,
      );
    } else {
      showToast('连接成功！');
    }
  } catch (error) {
    console.error('Test connection error:', error);

    if (error.status === 401) {
      showToast('API Key 无效，请检查 Key 是否正确', 'error');
    } else if (error.status === 429) {
      showToast('请求过于频繁，请稍后再试', 'error');
    } else if (error.message) {
      showToast(`连接失败: ${error.message}`, 'error');
    } else {
      showToast('网络错误，请检查网络连接', 'error');
    }
  } finally {
    testConnectionBtn.disabled = false;
    testConnectionBtn.textContent = '测试连接';
  }
}

// Setup event listeners
function setupEventListeners() {
  // Settings toggle
  settingsBtn.addEventListener('click', toggleSettings);

  // Save settings
  saveSettingsBtn.addEventListener('click', saveSettings);

  // Test connection
  testConnectionBtn.addEventListener('click', testConnection);

  // Chat input
  chatInput.addEventListener('input', handleInput);
  chatInput.addEventListener('keydown', handleKeyDown);

  // Send button
  sendBtn.addEventListener('click', sendMessage);

  // Quote button - 引用页面选中的文本
  quoteBtn.addEventListener('click', async () => {
    const selectedText = await getSelectedTextFromPage();
    if (selectedText) {
      const currentValue = chatInput.value;
      const quoteText = `> ${selectedText.replace(/\n/g, '\n> ')}\n\n`;
      chatInput.value = currentValue + quoteText;
      handleInput(); // 触发 resize
      chatInput.focus();
      showToast('已引用选中的文本');
    } else {
      showToast('请先在页面上选中文本', 'error');
    }
  });

  // Close settings when clicking outside
  document.addEventListener('click', (e) => {
    if (!settingsPanel.contains(e.target) && !settingsBtn.contains(e.target)) {
      settingsPanel.classList.remove('show');
      settingsBtn.classList.remove('active');
    }
  });
}

// Toggle settings panel
function toggleSettings() {
  const isOpen = settingsPanel.classList.contains('show');
  settingsPanel.classList.toggle('show', !isOpen);
  settingsBtn.classList.toggle('active', !isOpen);
}

// Handle input changes
function handleInput() {
  // Auto-resize textarea
  chatInput.style.height = 'auto';
  chatInput.style.height = Math.min(chatInput.scrollHeight, 150) + 'px';

  updateSendButton();
}

// Handle keyboard shortcuts
function handleKeyDown(e) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
}

// Update send button state
function updateSendButton() {
  const hasText = chatInput.value.trim().length > 0;
  sendBtn.disabled = !hasText || isGenerating;
}

// Send message - 流式版本
async function sendMessage() {
  const message = chatInput.value.trim();
  if (!message || isGenerating) return;

  // Check API key
  if (!apiKey) {
    showToast('请先设置 API Key', 'error');
    settingsPanel.classList.add('show');
    settingsBtn.classList.add('active');
    return;
  }

  // Ensure client is initialized
  if (!openaiClient) {
    initOpenAIClient();
  }

  if (!openaiClient) {
    showToast('API 客户端初始化失败，请检查 API Key', 'error');
    return;
  }

  // Hide welcome state
  welcomeState.style.display = 'none';

  // Add user message
  addMessage('user', message);

  // Clear input
  chatInput.value = '';
  chatInput.style.height = 'auto';
  updateSendButton();

  // Add to history
  messageHistory.push({ role: 'user', content: message });

  // Show loading
  isGenerating = true;
  updateSendButton();

  // Create streaming message element
  currentStreamingElement = createStreamingMessage();

  let fullContent = '';

  try {
    // Call API using OpenAI client with streaming
    await openaiClient.chat.completions.create(
      {
        model: currentModel,
        messages: messageHistory,
        temperature: 0.7,
        stream: true,
      },
      // onChunk callback - 每次收到数据时更新
      (chunk, contentSoFar) => {
        fullContent = contentSoFar;
        updateStreamingMessage(currentStreamingElement, fullContent);
      },
    );

    // Stream completed
    finishStreamingMessage(currentStreamingElement, fullContent);
    messageHistory.push({ role: 'assistant', content: fullContent });
  } catch (error) {
    console.error('API Error:', error);

    // Remove streaming message and show error
    if (currentStreamingElement) {
      currentStreamingElement.remove();
    }

    // Show detailed error
    let errorMessage = '**错误**: ';

    if (error.status === 401) {
      errorMessage +=
        `API Key 验证失败 (401)\n\n` +
        `可能的原因：\n` +
        `1. API Key 已过期或被吊销\n` +
        `2. API Key 复制不完整\n` +
        `3. 账号没有余额或已被限制\n\n` +
        `请检查您的 API 配置`;
    } else if (error.status === 429) {
      errorMessage += '请求过于频繁，请稍后再试';
    } else if (error.status === 404) {
      errorMessage +=
        `模型 "${currentModel}" 不存在或不可用\n\n` +
        `请检查模型名称是否正确，或使用测试连接验证`;
    } else if (error.status >= 500) {
      errorMessage += '服务器错误，请稍后再试';
    } else if (error.message) {
      errorMessage += error.message;
    } else {
      errorMessage += '未知错误';
    }

    addMessage('assistant', errorMessage);
  } finally {
    isGenerating = false;
    currentStreamingElement = null;
    updateSendButton();
  }
}

// Create streaming message element
function createStreamingMessage() {
  const messageDiv = document.createElement('div');
  messageDiv.className = 'message assistant streaming';
  messageDiv.id = 'streaming-' + Date.now();

  const avatar = document.createElement('div');
  avatar.className = 'message-avatar';
  avatar.textContent = 'AI';

  const contentDiv = document.createElement('div');
  contentDiv.className = 'message-content';
  contentDiv.innerHTML = '<span class="streaming-cursor"></span>';

  messageDiv.appendChild(avatar);
  messageDiv.appendChild(contentDiv);

  messagesContainer.appendChild(messageDiv);
  scrollToBottom();

  return messageDiv;
}

// Update streaming message content
function updateStreamingMessage(messageElement, content) {
  if (!messageElement) return;

  const contentDiv = messageElement.querySelector('.message-content');
  if (contentDiv) {
    // 保留光标元素，更新内容
    contentDiv.innerHTML =
      formatMessage(content) + '<span class="streaming-cursor"></span>';
    scrollToBottom();
  }
}

// Finish streaming message
function finishStreamingMessage(messageElement, finalContent) {
  if (!messageElement) return;

  messageElement.classList.remove('streaming');
  const contentDiv = messageElement.querySelector('.message-content');
  if (contentDiv) {
    contentDiv.innerHTML = formatMessage(finalContent);
  }

  // 为完成的流式消息添加操作按钮
  const actionsDiv = document.createElement('div');
  actionsDiv.className = 'message-actions';

  // 插入到页面按钮
  const insertBtn = document.createElement('button');
  insertBtn.className = 'action-btn';
  insertBtn.innerHTML = `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
      <polyline points="7 10 12 15 17 10"/>
      <line x1="12" y1="15" x2="12" y2="3"/>
    </svg>
    <span>插入到页面</span>
  `;
  insertBtn.title = '插入到当前页面聚焦的输入框';
  insertBtn.onclick = () => insertToPage(finalContent, insertBtn);

  // 复制按钮
  const copyBtn = document.createElement('button');
  copyBtn.className = 'action-btn';
  copyBtn.innerHTML = `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
    </svg>
    <span>复制</span>
  `;
  copyBtn.onclick = () => copyToClipboard(finalContent, copyBtn);

  actionsDiv.appendChild(insertBtn);
  actionsDiv.appendChild(copyBtn);
  messageElement.appendChild(actionsDiv);
}

// Add message to UI
function addMessage(role, content) {
  const messageDiv = document.createElement('div');
  messageDiv.className = `message ${role}`;

  const avatar = document.createElement('div');
  avatar.className = 'message-avatar';
  avatar.textContent = role === 'user' ? 'U' : 'AI';

  const contentDiv = document.createElement('div');
  contentDiv.className = 'message-content';
  contentDiv.innerHTML = formatMessage(content);

  messageDiv.appendChild(avatar);
  messageDiv.appendChild(contentDiv);

  // 为 AI 消息添加操作按钮
  if (role === 'assistant') {
    const actionsDiv = document.createElement('div');
    actionsDiv.className = 'message-actions';

    // 插入到页面按钮
    const insertBtn = document.createElement('button');
    insertBtn.className = 'action-btn';
    insertBtn.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
        <polyline points="7 10 12 15 17 10"/>
        <line x1="12" y1="15" x2="12" y2="3"/>
      </svg>
      <span>插入到页面</span>
    `;
    insertBtn.title = '插入到当前页面聚焦的输入框';
    insertBtn.onclick = () => insertToPage(content, insertBtn);

    // 复制按钮
    const copyBtn = document.createElement('button');
    copyBtn.className = 'action-btn';
    copyBtn.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
      </svg>
      <span>复制</span>
    `;
    copyBtn.onclick = () => copyToClipboard(content, copyBtn);

    actionsDiv.appendChild(insertBtn);
    actionsDiv.appendChild(copyBtn);
    messageDiv.appendChild(actionsDiv);
  }

  messagesContainer.appendChild(messageDiv);
  scrollToBottom();
}

// Add loading message (用于非流式场景或加载状态)
function addLoadingMessage() {
  const id = 'loading-' + Date.now();
  const messageDiv = document.createElement('div');
  messageDiv.className = 'message assistant';
  messageDiv.id = id;

  const avatar = document.createElement('div');
  avatar.className = 'message-avatar';
  avatar.textContent = 'AI';

  const contentDiv = document.createElement('div');
  contentDiv.className = 'message-content';
  contentDiv.innerHTML = `
    <div class="loading-indicator">
      <span></span>
      <span></span>
      <span></span>
    </div>
  `;

  messageDiv.appendChild(avatar);
  messageDiv.appendChild(contentDiv);

  messagesContainer.appendChild(messageDiv);
  scrollToBottom();

  return id;
}

// Remove loading message
function removeLoadingMessage(id) {
  const element = document.getElementById(id);
  if (element) {
    element.remove();
  }
}

// Format message content (simple markdown)
function formatMessage(content) {
  // Escape HTML
  let formatted = content
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // Bold: **text**
  formatted = formatted.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

  // Italic: *text*
  formatted = formatted.replace(/\*(.*?)\*/g, '<em>$1</em>');

  // Code blocks: ```code```
  formatted = formatted.replace(
    /```([\s\S]*?)```/g,
    '<pre><code>$1</code></pre>',
  );

  // Inline code: `code`
  formatted = formatted.replace(/`([^`]+)`/g, '<code>$1</code>');

  // Line breaks
  formatted = formatted.replace(/\n/g, '<br>');

  return formatted;
}

// Scroll to bottom
function scrollToBottom() {
  chatContainer.scrollTop = chatContainer.scrollHeight;
}

// Show toast notification
function showToast(message, type = 'success') {
  // 确保只有一个 toast 容器
  let toastContainer = document.getElementById('toast-container');
  if (!toastContainer) {
    toastContainer = document.createElement('div');
    toastContainer.id = 'toast-container';
    toastContainer.style.cssText = `
      position: fixed;
      top: 16px;
      left: 0;
      right: 0;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
      pointer-events: none;
      z-index: 10000;
    `;
    document.body.appendChild(toastContainer);
  }

  // Create toast element
  const toast = document.createElement('div');
  toast.style.cssText = `
    padding: 10px 16px;
    border-radius: 8px;
    font-size: 13px;
    font-weight: 500;
    animation: fadeIn 0.2s ease;
    ${
      type === 'error'
        ? 'background-color: rgba(239, 68, 68, 0.95); color: white;'
        : 'background-color: rgba(34, 197, 94, 0.95); color: white;'
    }
  `;
  toast.textContent = message;

  toastContainer.appendChild(toast);

  // Remove after 2 seconds
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(-8px)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => {
      toast.remove();
      // 如果没有 toast 了，移除容器
      if (toastContainer.children.length === 0) {
        toastContainer.remove();
      }
    }, 300);
  }, 2000);
}

// ==================== 页面内容操作功能 ====================

// 获取当前活动标签页
async function getCurrentTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

// 插入文本到页面
async function insertToPage(text, btnElement) {
  try {
    const tab = await getCurrentTab();

    if (!tab) {
      showToast('无法获取当前页面', 'error');
      return;
    }

    // 检查是否是特殊页面（chrome:// 等）
    // if (tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) {
    //   showToast('无法在浏览器内置页面使用此功能', 'error');
    //   return;
    // }

    // 先高亮显示当前聚焦的输入框
    await chrome.tabs.sendMessage(tab.id, { action: 'highlightInput' });

    // 发送插入文本消息给 content script
    const response = await chrome.tabs.sendMessage(tab.id, {
      action: 'insertText',
      text: text,
    });

    if (response && response.success) {
      showToast('已插入到页面');
      // 按钮反馈
      if (btnElement) {
        const originalHTML = btnElement.innerHTML;
        btnElement.innerHTML = `
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
          <span>已插入</span>
        `;
        btnElement.style.color = '#22C55E';
        setTimeout(() => {
          btnElement.innerHTML = originalHTML;
          btnElement.style.color = '';
        }, 2000);
      }
    } else {
      showToast(
        response?.error || '插入失败，请先在页面上点击一个输入框',
        'error',
      );
    }
  } catch (error) {
    console.error('Insert error:', error);
    if (error.message?.includes('Receiving end does not exist')) {
      showToast('请刷新页面后再试', 'error');
    } else {
      showToast('插入失败: ' + error.message, 'error');
    }
  }
}

// 复制文本到剪贴板
async function copyToClipboard(text, btnElement) {
  try {
    await navigator.clipboard.writeText(text);
    showToast('已复制到剪贴板');

    // 按钮反馈
    if (btnElement) {
      const originalHTML = btnElement.innerHTML;
      btnElement.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="20 6 9 17 4 12"/>
        </svg>
        <span>已复制</span>
      `;
      btnElement.style.color = '#22C55E';
      setTimeout(() => {
        btnElement.innerHTML = originalHTML;
        btnElement.style.color = '';
      }, 2000);
    }
  } catch (error) {
    console.error('Copy error:', error);
    showToast('复制失败', 'error');
  }
}

// 获取页面中选中的文本
async function getSelectedTextFromPage() {
  try {
    const tab = await getCurrentTab();

    // if (!tab || tab.url.startsWith('chrome://')) {
    //   return null;
    // }

    const response = await chrome.tabs.sendMessage(tab.id, {
      action: 'getSelectedText',
    });
    return response?.text || '';
  } catch (error) {
    console.error('Get selected text error:', error);
    return '';
  }
}

// 获取页面内容（用于上下文）
async function getPageContent() {
  try {
    const tab = await getCurrentTab();

    if (!tab || tab.url.startsWith('chrome://')) {
      return null;
    }

    const response = await chrome.tabs.sendMessage(tab.id, {
      action: 'getPageContent',
    });
    return response;
  } catch (error) {
    console.error('Get page content error:', error);
    return null;
  }
}

// Initialize on load
init();
