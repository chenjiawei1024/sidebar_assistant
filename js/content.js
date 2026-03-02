// Content Script - 运行在网页上下文中，可访问 DOM

(function() {
  'use strict';

  // 高亮当前聚焦的输入框
  let highlightedElement = null;
  let highlightOverlay = null;
  let arrowOverlay = null;

  // 监听来自 Side Panel 的消息
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'ping') {
      // 用于检测 content script 是否已加载
      sendResponse({ success: true });
    } else if (request.action === 'insertText') {
      const result = insertTextToFocusedElement(request.text);
      sendResponse(result);
    } else if (request.action === 'highlightInput') {
      highlightFocusedInputWithArrow();
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

  // 生成手绘风格的随机扰动路径点
  function generateRoughPoints(x1, y1, x2, y2, segments = 20) {
    const points = [];
    const dx = x2 - x1;
    const dy = y2 - y1;
    
    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      // 基础线性插值
      let x = x1 + dx * t;
      let y = y1 + dy * t;
      
      // 添加手绘风格的随机扰动（中间部分扰动更大）
      const roughness = 3;
      const randomOffset = Math.sin(t * Math.PI) * roughness;
      x += (Math.random() - 0.5) * randomOffset * 2;
      y += (Math.random() - 0.5) * randomOffset * 2;
      
      points.push({ x, y });
    }
    return points;
  }

  // 生成平滑的手绘风格 SVG 路径
  function generateRoughPath(x1, y1, x2, y2) {
    const points = generateRoughPoints(x1, y1, x2, y2);
    
    // 使用二次贝塞尔曲线连接点，创建平滑但有机的线条
    let path = `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;
    
    for (let i = 1; i < points.length - 1; i++) {
      const xc = (points[i].x + points[i + 1].x) / 2;
      const yc = (points[i].y + points[i + 1].y) / 2;
      path += ` Q ${points[i].x.toFixed(1)} ${points[i].y.toFixed(1)}, ${xc.toFixed(1)} ${yc.toFixed(1)}`;
    }
    
    // 连接到终点
    const last = points[points.length - 1];
    path += ` L ${last.x.toFixed(1)} ${last.y.toFixed(1)}`;
    
    return path;
  }

  // 生成手绘风格的箭头头部路径
  function generateRoughArrowHead(tipX, tipY, angle, size = 20) {
    const leftAngle = angle + Math.PI / 6 + (Math.random() - 0.5) * 0.2;
    const rightAngle = angle - Math.PI / 6 + (Math.random() - 0.5) * 0.2;
    
    const leftX = tipX - Math.cos(leftAngle) * size;
    const leftY = tipY - Math.sin(leftAngle) * size;
    const rightX = tipX - Math.cos(rightAngle) * size;
    const rightY = tipY - Math.sin(rightAngle) * size;
    
    // 添加轻微扰动使线条更自然
    const r1 = 2;
    const r2 = 2;
    
    return `M ${(tipX + (Math.random() - 0.5) * r1).toFixed(1)} ${(tipY + (Math.random() - 0.5) * r1).toFixed(1)} ` +
           `L ${(leftX + (Math.random() - 0.5) * r2).toFixed(1)} ${(leftY + (Math.random() - 0.5) * r2).toFixed(1)} ` +
           `M ${(tipX + (Math.random() - 0.5) * r1).toFixed(1)} ${(tipY + (Math.random() - 0.5) * r1).toFixed(1)} ` +
           `L ${(rightX + (Math.random() - 0.5) * r2).toFixed(1)} ${(rightY + (Math.random() - 0.5) * r2).toFixed(1)}`;
  }

  // 创建手绘风格的 SVG 箭头
  function createHandDrawnArrow(targetRect) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      pointer-events: none;
      z-index: 999999;
    `;
    svg.setAttribute('width', '100%');
    svg.setAttribute('height', '100%');
    svg.setAttribute('viewBox', `0 0 ${window.innerWidth} ${window.innerHeight}`);
    
    // 计算箭头起点（从页面右侧边缘往内缩进，尾巴长度约 48-60px）
    const startX = window.innerWidth - 60;
    const startY = window.innerHeight / 2;
    
    // 计算箭头终点（输入框中心）
    const endX = targetRect.left + targetRect.width / 2;
    const endY = targetRect.top + targetRect.height / 2;
    
    // 计算箭头角度
    const angle = Math.atan2(endY - startY, endX - startX);
    
    // 创建滤镜用于手绘效果
    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    const filter = document.createElementNS('http://www.w3.org/2000/svg', 'filter');
    filter.setAttribute('id', 'rough-filter');
    filter.innerHTML = `
      <feTurbulence type="fractalNoise" baseFrequency="0.05" numOctaves="2" result="noise"/>
      <feDisplacementMap in="SourceGraphic" in2="noise" scale="2" xChannelSelector="R" yChannelSelector="G"/>
    `;
    defs.appendChild(filter);
    svg.appendChild(defs);
    
    // 使用二次贝塞尔曲线创建平滑曲线路径
    const roughPath = generateRoughPath(startX, startY, endX, endY);
    
    // 创建路径元素
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', roughPath);
    path.setAttribute('stroke', '#1a1a1a');
    path.setAttribute('stroke-width', '4');
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke-linecap', 'round');
    path.setAttribute('stroke-linejoin', 'round');
    path.setAttribute('filter', 'url(#rough-filter)');
    
    // 创建箭头头部
    const arrowHeadPath = generateRoughArrowHead(endX, endY, angle, 18);
    const arrowHead = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    arrowHead.setAttribute('d', arrowHeadPath);
    arrowHead.setAttribute('stroke', '#1a1a1a');
    arrowHead.setAttribute('stroke-width', '4');
    arrowHead.setAttribute('fill', 'none');
    arrowHead.setAttribute('stroke-linecap', 'round');
    arrowHead.setAttribute('stroke-linejoin', 'round');
    arrowHead.setAttribute('filter', 'url(#rough-filter)');
    
    svg.appendChild(path);
    svg.appendChild(arrowHead);
    
    return svg;
  }

  // 使用手绘箭头高亮当前聚焦的输入框
  function highlightFocusedInputWithArrow() {
    clearHighlight();
    
    const activeElement = document.activeElement;
    if (!activeElement || (activeElement.tagName !== 'INPUT' && activeElement.tagName !== 'TEXTAREA' && !activeElement.isContentEditable)) {
      return;
    }

    highlightedElement = activeElement;
    const rect = activeElement.getBoundingClientRect();
    
    // 创建手绘风格箭头
    arrowOverlay = createHandDrawnArrow(rect);
    document.body.appendChild(arrowOverlay);
    
    // 3秒后自动清除
    setTimeout(clearHighlight, 3000);
  }

  // 清除高亮
  function clearHighlight() {
    if (highlightOverlay) {
      highlightOverlay.remove();
      highlightOverlay = null;
    }
    if (arrowOverlay) {
      arrowOverlay.remove();
      arrowOverlay = null;
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
    if (highlightOverlay || arrowOverlay) {
      clearHighlight();
    }
  }, true);

  console.log('[AI Sidebar] Content script loaded');
})();
