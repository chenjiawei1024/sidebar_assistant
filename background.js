// Background Service Worker - 处理 API 请求（避免 CORS 限制）

const API_BASE_URL = 'https://api.deepseek.com/v1';

// 监听来自侧边栏的长连接（用于流式传输）
chrome.runtime.onConnect.addListener((port) => {
  if (port.name === 'chat-stream') {
    port.onMessage.addListener(async (request) => {
      if (request.action === 'chat.completions.stream') {
        await handleChatCompletionStream(request.params, request.apiKey, port);
      }
    });
  }
});

// 监听来自侧边栏的消息（非流式）
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'models.list') {
    handleModelsList(request.apiKey)
      .then((data) => sendResponse({ success: true, data }))
      .catch((error) =>
        sendResponse({
          success: false,
          error: error.message,
          status: error.status,
        }),
      );
    return true; // 保持消息通道开启（异步）
  }
});

// 处理流式聊天完成请求
async function handleChatCompletionStream(params, apiKey, port) {
  const { model, messages, temperature = 0.7 } = params;

  try {
    const response = await fetch(`${API_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        temperature,
        stream: true,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const error = new Error(
        errorData.error?.message || `HTTP ${response.status}`,
      );
      error.status = response.status;
      error.code = errorData.error?.code;
      port.postMessage({ type: 'error', error: error.message, status: error.status });
      port.disconnect();
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split('\n');

      for (const line of lines) {
        if (line.trim() === '') continue;
        if (line.trim() === 'data: [DONE]') {
          port.postMessage({ type: 'done' });
          port.disconnect();
          return;
        }

        if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.slice(6));
            const content = data.choices?.[0]?.delta?.content || '';
            const finishReason = data.choices?.[0]?.finish_reason;

            if (content || finishReason) {
              port.postMessage({
                type: 'chunk',
                content,
                finishReason,
              });
            }
          } catch (e) {
            // 忽略解析错误
          }
        }
      }
    }

    port.postMessage({ type: 'done' });
    port.disconnect();
  } catch (error) {
    port.postMessage({ type: 'error', error: error.message });
    port.disconnect();
  }
}

// 处理模型列表请求
async function handleModelsList(apiKey) {
  const response = await fetch(`${API_BASE_URL}/models`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const error = new Error(
      errorData.error?.message || `HTTP ${response.status}`,
    );
    error.status = response.status;
    error.code = errorData.error?.code;
    throw error;
  }

  return response.json();
}

// 安装/更新时的处理
chrome.runtime.onInstalled.addListener(() => {
  console.log('AI Sidebar 已安装/更新');
});
