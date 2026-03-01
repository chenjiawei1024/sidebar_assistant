// Content Script - 运行在网页上下文中，可访问 DOM

(function() {
  'use strict';

  // 高亮当前聚焦的输入框
  let highlightedElement = null;
  let highlightOverlay = null;

  // 监听来自 Side Panel 的消息
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'ping') {
      // 用于检测 content script 是否已加载
      sendResponse({ success: true });
    } else if (request.action === 'insertText') {
      const result = insertTextToFocusedElement(request.text);
      sendResponse(result);
    } else if (request.action === 'highlightInput') {
      highlightFocusedInput();
      sendResponse({ success: true });
    } else if (request.action === 'clearHighlight') {
      clearHighlight();
      sendResponse({ success: true });
    } else if (request.action === 'getSelectedText') {
      sendResponse({ text: window.getSelection().toString() });
    } else if (request.action === 'getPageContent') {
      sendResponse({
        title: document.title,
        url: window.location.href,
        content: getPageTextContent()
      });
    }
    return true;
  });

  // 插入文本到当前聚焦的元素
  function insertTextToFocusedElement(text) {
    const activeElement = document.activeElement;
    
    if (!activeElement) {
      return { success: false, error: '没有聚焦的输入元素' };
    }

    // 处理 input 和 textarea
    if (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA') {
      const start = activeElement.selectionStart || 0;
      const end = activeElement.selectionEnd || 0;
      const value = activeElement.value || '';
      
      // 在光标位置插入文本
      activeElement.value = value.substring(0, start) + text + value.substring(end);
      
      // 移动光标到插入文本之后
      const newCursorPos = start + text.length;
      activeElement.selectionStart = activeElement.selectionEnd = newCursorPos;
      
      // 触发 input 事件，让页面知道内容已更改
      activeElement.dispatchEvent(new Event('input', { bubbles: true }));
      activeElement.dispatchEvent(new Event('change', { bubbles: true }));
      
      // 保持聚焦
      activeElement.focus();
      
      return { success: true, type: 'input' };
    }
    
    // 处理 contenteditable 元素
    if (activeElement.isContentEditable) {
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
        activeElement.dispatchEvent(new InputEvent('input', { bubbles: true }));
      }
      
      return { success: true, type: 'contenteditable' };
    }

    return { success: false, error: '当前聚焦的元素不是可输入元素' };
  }

  // 高亮当前聚焦的输入框
  function highlightFocusedInput() {
    clearHighlight();
    
    const activeElement = document.activeElement;
    if (!activeElement || (activeElement.tagName !== 'INPUT' && activeElement.tagName !== 'TEXTAREA' && !activeElement.isContentEditable)) {
      return;
    }

    highlightedElement = activeElement;
    const rect = activeElement.getBoundingClientRect();
    
    highlightOverlay = document.createElement('div');
    highlightOverlay.style.cssText = `
      position: fixed;
      top: ${rect.top - 4}px;
      left: ${rect.left - 4}px;
      width: ${rect.width + 8}px;
      height: ${rect.height + 8}px;
      border: 2px solid #22C55E;
      border-radius: 6px;
      pointer-events: none;
      z-index: 999999;
      animation: ai-sidebar-pulse 1.5s ease-in-out infinite;
    `;
    
    // 添加动画样式
    if (!document.getElementById('ai-sidebar-styles')) {
      const style = document.createElement('style');
      style.id = 'ai-sidebar-styles';
      style.textContent = `
        @keyframes ai-sidebar-pulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.4); }
          50% { box-shadow: 0 0 0 8px rgba(34, 197, 94, 0); }
        }
      `;
      document.head.appendChild(style);
    }
    
    document.body.appendChild(highlightOverlay);
    
    // 3秒后自动清除高亮
    setTimeout(clearHighlight, 3000);
  }

  // 清除高亮
  function clearHighlight() {
    if (highlightOverlay) {
      highlightOverlay.remove();
      highlightOverlay = null;
    }
    highlightedElement = null;
  }

  // 获取页面文本内容（用于上下文）
  function getPageTextContent() {
    // 尝试获取主要内容区域
    const selectors = [
      'article',
      'main',
      '[role="main"]',
      '.content',
      '.post-content',
      '.article-content',
      '#content'
    ];
    
    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element) {
        return element.innerText.substring(0, 5000); // 限制长度
      }
    }
    
    // 默认返回 body 文本
    return document.body.innerText.substring(0, 3000);
  }

  // 监听聚焦事件，自动清除旧高亮
  document.addEventListener('focusin', () => {
    if (highlightOverlay) {
      clearHighlight();
    }
  }, true);

  console.log('[AI Sidebar] Content script loaded');
})();
