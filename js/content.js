// Content Script - 运行在网页上下文中，可访问 DOM
// 负责：页面文本操作、手绘覆盖层展示、与 Side Panel 通信

(function() {
  'use strict';

  // ==================== 初始化 ====================
  
  // 创建手绘覆盖层实例（用于箭头、矩形框等效果）
  const handDrawnOverlay = new HandDrawnOverlay();

  // 记录当前高亮的目标元素
  let highlightedElement = null;

  console.log('[AI Sidebar] Content script loaded');

  // ==================== 消息处理器 ====================
  
  /**
   * 处理来自 Side Panel 的消息
   * 根据 action 类型分发到不同的处理函数
   */
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    // 使用 Promise 包装异步操作，统一处理错误
    handleMessage(request)
      .then(result => sendResponse(result))
      .catch(error => {
        console.error('[AI Sidebar] Message handler error:', error);
        sendResponse({ success: false, error: error.message });
      });
    
    // 保持消息通道开放（支持异步响应）
    return true;
  });

  /**
   * 消息分发器
   * @param {Object} request - 消息内容
   * @returns {Promise<Object>} 处理结果
   */
  async function handleMessage(request) {
    const { action } = request;

    switch (action) {
      // 基础检测
      case 'ping':
        return { success: true, message: 'pong' };

      // 文本插入
      case 'insertText':
        return handleInsertText(request.text);

      // 高亮当前聚焦的输入框（箭头指向）
      case 'highlightInput':
        return handleHighlightInput();

      // 清除所有覆盖层
      case 'clearHighlight':
      case 'clearOverlays':
        return handleClearOverlays();

      // 绘制箭头到指定元素
      case 'drawArrow':
        return handleDrawArrow(request.selector, request.options);

      // 绘制矩形框选指定元素
      case 'drawRect':
        return handleDrawRect(request.selector, request.options);

      // 同时绘制箭头和矩形
      case 'drawArrowAndRect':
        return handleDrawArrowAndRect(request.selector, request.options);

      // 获取页面选中的文本
      case 'getSelectedText':
        return handleGetSelectedText();

      // 获取页面内容
      case 'getPageContent':
        return handleGetPageContent();

      default:
        throw new Error(`Unknown action: ${action}`);
    }
  }

  // ==================== 具体消息处理函数 ====================

  /**
   * 处理文本插入请求
   * 将文本插入到当前聚焦的输入框或 contenteditable 元素
   * 
   * @param {string} text - 要插入的文本
   * @returns {Object} { success: boolean, type?: string, error?: string }
   */
  function handleInsertText(text) {
    const activeElement = document.activeElement;
    
    if (!activeElement) {
      return { success: false, error: '没有聚焦的输入元素' };
    }

    // 处理 input 和 textarea
    if (isInputElement(activeElement)) {
      insertTextToInput(activeElement, text);
      return { success: true, type: 'input' };
    }
    
    // 处理 contenteditable 元素
    if (activeElement.isContentEditable) {
      insertTextToContentEditable(activeElement, text);
      return { success: true, type: 'contenteditable' };
    }

    return { success: false, error: '当前聚焦的元素不是可输入元素' };
  }

  /**
   * 处理高亮输入框请求
   * 使用手绘箭头指向当前聚焦的输入框
   * 
   * @returns {Object} { success: boolean }
   */
  function handleHighlightInput() {
    // 清除之前的覆盖层
    handDrawnOverlay.clearAll();
    
    const activeElement = document.activeElement;
    
    // 检查是否是有效的输入元素
    if (!activeElement || !isEditableElement(activeElement)) {
      return { success: false, error: '当前没有聚焦的输入框' };
    }

    highlightedElement = activeElement;
    
    // 绘制箭头指向输入框
    handDrawnOverlay.drawArrowToElement(activeElement, {
      tailLength: 60,
      color: '#1a1a1a',
      strokeWidth: 4,
      duration: 2000
    });

    return { success: true };
  }

  /**
   * 处理清除覆盖层请求
   * @returns {Object} { success: boolean }
   */
  function handleClearOverlays() {
    handDrawnOverlay.clearAll();
    highlightedElement = null;
    return { success: true };
  }

  /**
   * 处理绘制箭头请求
   * @param {string} selector - CSS 选择器
   * @param {Object} options - 绘制选项
   * @returns {Object} { success: boolean, id?: string, error?: string }
   */
  function handleDrawArrow(selector, options = {}) {
    const element = document.querySelector(selector);
    if (!element) {
      return { success: false, error: '元素未找到: ' + selector };
    }
    
    const id = handDrawnOverlay.drawArrowToElement(element, options);
    return { success: true, id };
  }

  /**
   * 处理绘制矩形请求
   * @param {string} selector - CSS 选择器
   * @param {Object} options - 绘制选项
   * @returns {Object} { success: boolean, id?: string, error?: string }
   */
  function handleDrawRect(selector, options = {}) {
    const element = document.querySelector(selector);
    if (!element) {
      return { success: false, error: '元素未找到: ' + selector };
    }
    
    const id = handDrawnOverlay.drawRectAroundElement(element, options);
    return { success: true, id };
  }

  /**
   * 处理同时绘制箭头和矩形请求
   * @param {string} selector - CSS 选择器
   * @param {Object} options - 绘制选项
   * @returns {Object} { success: boolean, ids?: Object, error?: string }
   */
  function handleDrawArrowAndRect(selector, options = {}) {
    const element = document.querySelector(selector);
    if (!element) {
      return { success: false, error: '元素未找到: ' + selector };
    }
    
    const ids = handDrawnOverlay.drawArrowAndRect(element, options);
    return { success: true, ids };
  }

  /**
   * 获取页面选中的文本
   * @returns {Object} { text: string }
   */
  function handleGetSelectedText() {
    const text = window.getSelection().toString();
    return { text };
  }

  /**
   * 获取页面内容
   * @returns {Object} { title: string, url: string, content: string }
   */
  function handleGetPageContent() {
    return {
      title: document.title,
      url: window.location.href,
      content: extractMainContent()
    };
  }

  // ==================== 工具函数 ====================

  /**
   * 检查元素是否是 input 或 textarea
   * @param {HTMLElement} element 
   * @returns {boolean}
   */
  function isInputElement(element) {
    const tag = element.tagName;
    return tag === 'INPUT' || tag === 'TEXTAREA';
  }

  /**
   * 检查元素是否是可编辑元素
   * @param {HTMLElement} element 
   * @returns {boolean}
   */
  function isEditableElement(element) {
    return isInputElement(element) || element.isContentEditable;
  }

  /**
   * 插入文本到 input 或 textarea 元素
   * @param {HTMLInputElement|HTMLTextAreaElement} element - 输入元素
   * @param {string} text - 要插入的文本
   */
  function insertTextToInput(element, text) {
    const start = element.selectionStart || 0;
    const end = element.selectionEnd || 0;
    const value = element.value || '';
    
    // 在光标位置插入文本
    element.value = value.substring(0, start) + text + value.substring(end);
    
    // 移动光标到插入文本之后
    const newCursorPos = start + text.length;
    element.selectionStart = element.selectionEnd = newCursorPos;
    
    // 触发事件，让页面知道内容已更改
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
    
    // 保持聚焦
    element.focus();
  }

  /**
   * 插入文本到 contenteditable 元素
   * @param {HTMLElement} element - 可编辑元素
   * @param {string} text - 要插入的文本
   */
  function insertTextToContentEditable(element, text) {
    const selection = window.getSelection();
    
    if (selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      range.deleteContents();
      
      const textNode = document.createTextNode(text);
      range.insertNode(textNode);
      
      // 移动光标到插入文本之后
      range.setStartAfter(textNode);
      range.setEndAfter(textNode);
      selection.removeAllRanges();
      selection.addRange(range);
      
      // 触发输入事件
      element.dispatchEvent(new InputEvent('input', { bubbles: true }));
    }
    
    // 保持聚焦
    element.focus();
  }

  /**
   * 提取页面主要内容
   * 按优先级尝试多个选择器
   * @returns {string} 页面文本内容
   */
  function extractMainContent() {
    // 按优先级排序的选择器列表
    const contentSelectors = [
      'article',           // 文章标签
      'main',              // 主内容区
      '[role="main"]',     // ARIA 主内容标记
      '.content',          // 常见内容类名
      '.post-content',     // 博客/文章类名
      '.article-content',  // 文章类名
      '#content'           // 常见内容 ID
    ];
    
    // 尝试找到主要内容区域
    for (const selector of contentSelectors) {
      const element = document.querySelector(selector);
      if (element) {
        return element.innerText.substring(0, 5000); // 限制长度
      }
    }
    
    // 回退到 body 文本
    return document.body.innerText.substring(0, 2000);
  }

  // ==================== 事件监听 ====================

  /**
   * 监听聚焦事件，自动清除旧高亮
   * 当用户点击其他输入框时，清除之前的箭头/矩形框
   */
  document.addEventListener('focusin', () => {
    if (handDrawnOverlay.getActiveOverlays().length > 0) {
      handDrawnOverlay.clearAll();
      highlightedElement = null;
    }
  }, true);

})();
