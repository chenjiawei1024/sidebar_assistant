/**
 * HandDrawnOverlay - 手绘风格 SVG 覆盖层工具类
 * 
 * 用于在网页上绘制手绘风格的箭头和矩形框选效果，
 * 风格类似 Excalidraw 的手绘样式。
 * 
 * @example
 * // 基础用法
 * const overlay = new HandDrawnOverlay();
 * 
 * // 绘制箭头指向元素
 * overlay.drawArrowToElement(document.querySelector('#target'));
 * 
 * // 绘制矩形框选元素
 * overlay.drawRectAroundElement(document.querySelector('.box'));
 * 
 * // 清理所有覆盖层
 * overlay.clearAll();
 */
class HandDrawnOverlay {
  /**
   * 创建 HandDrawnOverlay 实例
   * 会自动创建 SVG 滤镜用于手绘效果
   */
  constructor() {
    // 存储所有活动的覆盖层，key 为 ID，value 为 { svg, type }
    this.overlays = new Map();
    
    // 生成唯一的滤镜 ID，避免多个实例冲突
    this.filterId = 'handdrawn-filter-' + Date.now();
    
    // 确保滤镜已创建
    this._ensureFilter();
  }

  /**
   * 确保 SVG 滤镜已创建（用于手绘效果）
   * 使用 feTurbulence 和 feDisplacementMap 创建手绘纹理
   * @private
   */
  _ensureFilter() {
    if (document.getElementById(this.filterId)) return;
    
    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    defs.style.cssText = 'position: absolute; width: 0; height: 0; pointer-events: none;';
    defs.innerHTML = `
      <defs>
        <filter id="${this.filterId}" x="-20%" y="-20%" width="140%" height="140%">
          <feTurbulence type="fractalNoise" baseFrequency="0.05" numOctaves="2" result="noise"/>
          <feDisplacementMap in="SourceGraphic" in2="noise" scale="2" xChannelSelector="R" yChannelSelector="G"/>
        </filter>
      </defs>
    `;
    document.body.appendChild(defs);
  }

  /**
   * 生成范围内的随机数（用于手绘扰动）
   * @param {number} range - 随机范围（正负各半）
   * @returns {number} 随机值
   * @private
   */
  _random(range) {
    return (Math.random() - 0.5) * range;
  }

  /**
   * 生成手绘风格的扰动点
   * 在中间部分添加更大的扰动，使线条更自然
   * @param {number} x1 - 起点 X
   * @param {number} y1 - 起点 Y
   * @param {number} x2 - 终点 X
   * @param {number} y2 - 终点 Y
   * @param {number} segments - 分段数（默认 20）
   * @returns {Array<{x: number, y: number}>} 扰动后的点数组
   * @private
   */
  _generateRoughPoints(x1, y1, x2, y2, segments = 20) {
    const points = [];
    const dx = x2 - x1;
    const dy = y2 - y1;
    
    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      // 基础线性插值
      let x = x1 + dx * t;
      let y = y1 + dy * t;
      
      // 中间部分扰动更大（sin 曲线）
      const roughness = 3;
      const randomOffset = Math.sin(t * Math.PI) * roughness;
      x += this._random(randomOffset * 2);
      y += this._random(randomOffset * 2);
      
      points.push({ x, y });
    }
    return points;
  }

  /**
   * 生成平滑的手绘风格 SVG 路径
   * 使用二次贝塞尔曲线连接扰动点
   * @param {number} x1 - 起点 X
   * @param {number} y1 - 起点 Y
   * @param {number} x2 - 终点 X
   * @param {number} y2 - 终点 Y
   * @param {number} segments - 分段数
   * @returns {string} SVG 路径字符串
   * @private
   */
  _generateRoughPath(x1, y1, x2, y2, segments = 20) {
    const points = this._generateRoughPoints(x1, y1, x2, y2, segments);
    
    let path = `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;
    
    // 使用二次贝塞尔曲线连接点
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

  /**
   * 生成手绘风格的箭头头部
   * @param {number} tipX - 箭头尖端 X
   * @param {number} tipY - 箭头尖端 Y
   * @param {number} angle - 箭头角度（弧度）
   * @param {number} size - 箭头大小（默认 18）
   * @returns {string} SVG 路径字符串
   * @private
   */
  _generateArrowHead(tipX, tipY, angle, size = 18) {
    // 左右两翼的角度（30度 + 随机扰动）
    const leftAngle = angle + Math.PI / 6 + this._random(0.2);
    const rightAngle = angle - Math.PI / 6 + this._random(0.2);
    
    const leftX = tipX - Math.cos(leftAngle) * size;
    const leftY = tipY - Math.sin(leftAngle) * size;
    const rightX = tipX - Math.cos(rightAngle) * size;
    const rightY = tipY - Math.sin(rightAngle) * size;
    
    const r = 2;
    
    return `M ${(tipX + this._random(r)).toFixed(1)} ${(tipY + this._random(r)).toFixed(1)} ` +
           `L ${(leftX + this._random(r)).toFixed(1)} ${(leftY + this._random(r)).toFixed(1)} ` +
           `M ${(tipX + this._random(r)).toFixed(1)} ${(tipY + this._random(r)).toFixed(1)} ` +
           `L ${(rightX + this._random(r)).toFixed(1)} ${(rightY + this._random(r)).toFixed(1)}`;
  }

  /**
   * 生成手绘风格的矩形路径
   * @param {number} x - 左上角 X
   * @param {number} y - 左上角 Y
   * @param {number} width - 宽度
   * @param {number} height - 高度
   * @param {number} roughness - 粗糙度（默认 3）
   * @returns {string} SVG 路径字符串
   * @private
   */
  _generateRoughRect(x, y, width, height, roughness = 3) {
    const segments = 8; // 每条边的分段数
    
    // 生成四条边的扰动点
    const topPoints = this._generateRoughPoints(x, y, x + width, y, segments);
    const rightPoints = this._generateRoughPoints(x + width, y, x + width, y + height, segments);
    const bottomPoints = this._generateRoughPoints(x + width, y + height, x, y + height, segments);
    const leftPoints = this._generateRoughPoints(x, y + height, x, y, segments);
    
    // 合并所有点（去掉重复拐角）
    const allPoints = [
      ...topPoints,
      ...rightPoints.slice(1),
      ...bottomPoints.slice(1),
      ...leftPoints.slice(1)
    ];
    
    if (allPoints.length === 0) return '';
    
    // 构建路径
    let path = `M ${allPoints[0].x.toFixed(1)} ${allPoints[0].y.toFixed(1)}`;
    
    for (let i = 1; i < allPoints.length; i++) {
      const nextIndex = (i + 1) % allPoints.length;
      const xc = (allPoints[i].x + allPoints[nextIndex].x) / 2;
      const yc = (allPoints[i].y + allPoints[nextIndex].y) / 2;
      path += ` Q ${allPoints[i].x.toFixed(1)} ${allPoints[i].y.toFixed(1)}, ${xc.toFixed(1)} ${yc.toFixed(1)}`;
    }
    
    path += ' Z'; // 闭合路径
    return path;
  }

  /**
   * 创建全屏 SVG 容器
   * @returns {SVGSVGElement} SVG 元素
   * @private
   */
  _createSVG() {
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
    return svg;
  }

  /**
   * 创建 SVG 路径元素
   * @param {string} d - 路径数据
   * @param {Object} options - 样式选项
   * @param {string} options.stroke - 描边颜色
   * @param {number} options.strokeWidth - 描边宽度
   * @param {string} options.fill - 填充颜色
   * @returns {SVGPathElement} path 元素
   * @private
   */
  _createPath(d, options = {}) {
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', d);
    path.setAttribute('stroke', options.stroke || '#1a1a1a');
    path.setAttribute('stroke-width', options.strokeWidth || '4');
    path.setAttribute('fill', options.fill || 'none');
    path.setAttribute('stroke-linecap', 'round');
    path.setAttribute('stroke-linejoin', 'round');
    path.setAttribute('filter', `url(#${this.filterId})`);
    return path;
  }

  /**
   * 保存覆盖层并设置自动清理
   * @param {SVGSVGElement} svg - SVG 元素
   * @param {string} type - 类型 ('arrow' | 'rect')
   * @param {number} duration - 显示时长（ms），0 表示永久
   * @returns {string} 覆盖层 ID
   * @private
   */
  _saveOverlay(svg, type, duration) {
    const id = type + '-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
    this.overlays.set(id, { svg, type });
    
    // 自动清理
    if (duration > 0) {
      setTimeout(() => this.remove(id), duration);
    }
    
    return id;
  }

  // ==================== 公开 API ====================

  /**
   * 绘制手绘风格箭头指向目标元素
   * 箭头从页面右侧（模拟侧边栏）指向目标元素中心
   * 
   * @param {HTMLElement} targetElement - 目标元素
   * @param {Object} options - 配置选项
   * @param {number} options.tailLength - 尾巴长度（默认 60）
   * @param {string} options.color - 箭头颜色（默认 #1a1a1a）
   * @param {number} options.strokeWidth - 线条宽度（默认 4）
   * @param {number} options.headSize - 箭头头部大小（默认 18）
   * @param {number} options.duration - 显示时长 ms，0 表示永久（默认 2000）
   * @returns {string} 覆盖层 ID
   * 
   * @example
   * const overlay = new HandDrawnOverlay();
   * overlay.drawArrowToElement(document.querySelector('#input'));
   */
  drawArrowToElement(targetElement, options = {}) {
    const rect = targetElement.getBoundingClientRect();
    const targetX = rect.left + rect.width / 2;
    const targetY = rect.top + rect.height / 2;
    
    const tailLength = options.tailLength || 60;
    const startX = window.innerWidth - tailLength;
    const startY = window.innerHeight / 2;
    
    return this.drawArrow(startX, startY, targetX, targetY, options);
  }

  /**
   * 绘制手绘风格箭头（从起点到终点）
   * 
   * @param {number} startX - 起点 X
   * @param {number} startY - 起点 Y
   * @param {number} endX - 终点 X
   * @param {number} endY - 终点 Y
   * @param {Object} options - 配置选项（同 drawArrowToElement）
   * @returns {string} 覆盖层 ID
   * 
   * @example
   * overlay.drawArrow(100, 100, 300, 300, { color: '#FF5722' });
   */
  drawArrow(startX, startY, endX, endY, options = {}) {
    const svg = this._createSVG();
    const angle = Math.atan2(endY - startY, endX - startX);
    
    // 主箭头线
    const linePath = this._generateRoughPath(startX, startY, endX, endY);
    const line = this._createPath(linePath, {
      stroke: options.color || '#1a1a1a',
      strokeWidth: options.strokeWidth || 4
    });
    
    // 箭头头部
    const headPath = this._generateArrowHead(endX, endY, angle, options.headSize || 18);
    const head = this._createPath(headPath, {
      stroke: options.color || '#1a1a1a',
      strokeWidth: options.strokeWidth || 4
    });
    
    svg.appendChild(line);
    svg.appendChild(head);
    document.body.appendChild(svg);
    
    const duration = options.duration !== undefined ? options.duration : 2000;
    return this._saveOverlay(svg, 'arrow', duration);
  }

  /**
   * 绘制手绘风格矩形框选元素
   * 
   * @param {HTMLElement} targetElement - 目标元素
   * @param {Object} options - 配置选项
   * @param {number} options.padding - 内边距（默认 8）
   * @param {string} options.color - 边框颜色（默认 #1a1a1a）
   * @param {number} options.strokeWidth - 边框宽度（默认 3）
   * @param {string} options.fill - 填充颜色（默认 rgba(255,193,7,0.1)）
   * @param {number} options.roughness - 手绘粗糙度（默认 3）
   * @param {number} options.duration - 显示时长 ms，0 表示永久（默认 2000）
   * @returns {string} 覆盖层 ID
   * 
   * @example
   * overlay.drawRectAroundElement(document.querySelector('.card'), {
   *   padding: 10,
   *   fill: 'rgba(33,150,243,0.1)'
   * });
   */
  drawRectAroundElement(targetElement, options = {}) {
    const rect = targetElement.getBoundingClientRect();
    const padding = options.padding !== undefined ? options.padding : 8;
    
    return this.drawRect(
      rect.left - padding,
      rect.top - padding,
      rect.width + padding * 2,
      rect.height + padding * 2,
      options
    );
  }

  /**
   * 绘制手绘风格矩形
   * 
   * @param {number} x - 左上角 X
   * @param {number} y - 左上角 Y
   * @param {number} width - 宽度
   * @param {number} height - 高度
   * @param {Object} options - 配置选项（同 drawRectAroundElement）
   * @returns {string} 覆盖层 ID
   * 
   * @example
   * overlay.drawRect(100, 100, 200, 150, { color: '#2196F3' });
   */
  drawRect(x, y, width, height, options = {}) {
    const svg = this._createSVG();
    
    const rectPath = this._generateRoughRect(x, y, width, height, options.roughness || 3);
    const rect = this._createPath(rectPath, {
      stroke: options.color || '#1a1a1a',
      strokeWidth: options.strokeWidth || 3,
      fill: options.fill || 'rgba(255,193,7,0.1)'
    });
    
    svg.appendChild(rect);
    document.body.appendChild(svg);
    
    const duration = options.duration !== undefined ? options.duration : 2000;
    return this._saveOverlay(svg, 'rect', duration);
  }

  /**
   * 同时绘制箭头和矩形框（组合效果）
   * 
   * @param {HTMLElement} targetElement - 目标元素
   * @param {Object} options - 配置选项
   * @param {Object} options.arrowOptions - 箭头专属选项
   * @param {Object} options.rectOptions - 矩形专属选项
   * @param {number} options.duration - 整体显示时长（默认 2000）
   * @returns {Object} { arrowId, rectId } 两个覆盖层 ID
   * 
   * @example
   * overlay.drawArrowAndRect(document.querySelector('#target'), {
   *   duration: 5000,
   *   arrowOptions: { color: '#1a1a1a' },
   *   rectOptions: { fill: 'rgba(255,193,7,0.15)' }
   * });
   */
  drawArrowAndRect(targetElement, options = {}) {
    // 先绘制矩形（不自动清理）
    const rectId = this.drawRectAroundElement(targetElement, {
      duration: 0,
      ...options.rectOptions
    });
    
    // 再绘制箭头（不自动清理）
    const arrowId = this.drawArrowToElement(targetElement, {
      duration: 0,
      ...options.arrowOptions
    });
    
    // 统一设置持续时间
    const duration = options.duration !== undefined ? options.duration : 2000;
    if (duration > 0) {
      setTimeout(() => {
        this.remove(rectId);
        this.remove(arrowId);
      }, duration);
    }
    
    return { arrowId, rectId };
  }

  /**
   * 移除指定覆盖层
   * @param {string} id - 覆盖层 ID
   */
  remove(id) {
    const overlay = this.overlays.get(id);
    if (overlay) {
      overlay.svg.remove();
      this.overlays.delete(id);
    }
  }

  /**
   * 移除所有覆盖层
   */
  clearAll() {
    this.overlays.forEach((overlay) => {
      overlay.svg.remove();
    });
    this.overlays.clear();
  }

  /**
   * 获取所有活动的覆盖层 ID
   * @returns {Array<string>} 覆盖层 ID 列表
   */
  getActiveOverlays() {
    return Array.from(this.overlays.keys());
  }
}

// 导出类（UMD 格式，兼容各种环境）
if (typeof module !== 'undefined' && module.exports) {
  module.exports = HandDrawnOverlay;
} else if (typeof define === 'function' && define.amd) {
  define([], function() {
    return HandDrawnOverlay;
  });
} else {
  // 浏览器全局变量
  window.HandDrawnOverlay = HandDrawnOverlay;
}
