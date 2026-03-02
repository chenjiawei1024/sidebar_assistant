// OpenAI Style Client - 通过 Background Service Worker 代理 API 请求，避免 CORS 限制

/**
 * OpenAI 兼容的 API 客户端
 * 通过 Chrome Extension Background Script 代理请求，避免 CORS 限制
 */
class OpenAI {
  /**
   * 创建 OpenAI 客户端实例
   * @param {Object} options - 配置选项
   * @param {string} options.apiKey - API 密钥
   * @param {string} options.baseURL - API 基础地址
   * @param {boolean} options.dangerouslyAllowBrowser - 是否允许在浏览器中使用（兼容参数，实际通过 background 代理）
   */
  constructor({ apiKey, baseURL, dangerouslyAllowBrowser = false }) {
    if (!apiKey) {
      throw new Error('API Key is required');
    }

    this.apiKey = apiKey;
    this.baseURL = baseURL || '';
  }

  /**
   * Chat Completions API
   */
  chat = {
    completions: {
      /**
       * 创建聊天完成请求
       * @param {Object} params - 请求参数
       * @param {string} params.model - 模型名称
       * @param {Array} params.messages - 消息列表
       * @param {number} params.temperature - 温度参数
       * @param {boolean} params.stream - 是否使用流式传输
       * @param {Function} onChunk - 流式传输时的回调函数，接收 (chunk, contentSoFar)
       * @returns {Promise<Object>} 响应数据
       */
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
              baseURL: this.baseURL,
            });
          });
        } else {
          // 非流式请求
          return new Promise((resolve, reject) => {
            chrome.runtime.sendMessage(
              {
                action: 'chat.completions.create',
                params: params,
                apiKey: this.apiKey,
                baseURL: this.baseURL,
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

  /**
   * Models API
   */
  models = {
    /**
     * 获取可用模型列表
     * @returns {Promise<Object>} 模型列表数据
     */
    list: async () => {
      return new Promise((resolve, reject) => {
        chrome.runtime.sendMessage(
          {
            action: 'models.list',
            apiKey: this.apiKey,
            baseURL: this.baseURL,
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

// 导出（支持 ES Module 和全局变量两种方式）
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { OpenAI };
} else {
  // 在浏览器环境中挂载到全局
  window.OpenAI = OpenAI;
}