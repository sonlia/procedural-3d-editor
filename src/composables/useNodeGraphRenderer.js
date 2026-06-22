/**
 * NodeGraphRenderer - 节点图 Canvas 2D 渲染器
 * 从 NodeEditor.vue 中提取的画布渲染逻辑
 *
 * 纯 JS 类，不依赖 Vue
 *
 * 功能：
 * - Canvas 高 DPI 设置
 * - 网格绘制（小格/大格）
 * - 节点绘制（按分类着色、选中高亮、标题栏、输入/输出插槽）
 * - 连线绘制（贝塞尔曲线）
 * - 平移/缩放状态管理
 * - 鼠标事件处理（中键/Alt+点击平移、节点拖拽、右键菜单坐标）
 * - screenToWorld / worldToScreen 坐标转换
 * - drawFrame() 主动画循环
 * - destroy() 清理
 */

/**
 * 节点分类颜色映射表
 * bg: 节点背景色, border: 节点边框色
 */
const nodeColors = {
  geometry_input: { bg: '#1e3a5f', border: '#339af0' },
  geometry_op: { bg: '#3a3a1e', border: '#fcc419' },
  scene_output: { bg: '#1e3a2e', border: '#51cf66' },
  param_input: { bg: '#1e3a3a', border: '#22b8cf' },
  logic: { bg: '#3a2a1e', border: '#ff922b' },
  animation: { bg: '#2e1e3a', border: '#845ef7' },
  display_panel: { bg: '#1e3a3a', border: '#20c997' },
  material: { bg: '#3a1e3a', border: '#cc5de8' },
  instancing: { bg: '#2e3a1e', border: '#a9e34b' },
  general: { bg: '#2a2a3a', border: '#5352ed' }
}

const NODE_WIDTH = 160
const TITLE_BAR_HEIGHT = 26
const SLOT_SPACING = 24
const SLOT_RADIUS = 5
const CORNER_RADIUS = 6
const BG_COLOR = '#141428'
const GRID_COLOR_MINOR = '#1a1a30'
const GRID_COLOR_MAJOR = '#222240'
const GRID_BASE_SIZE = 20
const GRID_MAJOR_MULTIPLIER = 5
const LINK_COLOR = 'rgba(83, 82, 237, 0.6)'
const LINK_ACTIVE_COLOR = 'rgba(83, 82, 237, 0.8)'
const SELECTION_COLOR = '#5352ed'
const INPUT_SLOT_COLOR = '#5352ed'
const OUTPUT_SLOT_COLOR = '#51cf66'
const TITLE_TEXT_COLOR = '#e0e0f0'
const ZOOM_MIN = 0.1
const ZOOM_MAX = 5

export class NodeGraphRenderer {
  /**
   * @param {HTMLCanvasElement} canvas - 渲染目标画布
   * @param {HTMLElement} container - 画布父容器（用于获取尺寸）
   * @param {Object} nodeStore - 响应式节点数据源，需包含 nodes / links / selectedNodeId
   * @param {Object} [options] - 可选配置
   * @param {Function} [options.onNodeSelect] - 节点选中回调 (nodeId) => void
   * @param {Function} [options.onNodeDeselect] - 取消选中回调 () => void
   * @param {Function} [options.onNodeDragEnd] - 节点拖拽结束回调 (nodeId, {x, y}) => void
   * @param {Function} [options.onContextMenu] - 右键菜单回调 ({screenX, screenY}) => void
   * @param {Function} [options.onSlotConnect] - 插槽连线回调 ({sourceId, sourceSlot, targetId, targetSlot}) => void
   */
  constructor(canvas, container, nodeStore, options = {}) {
    this.canvas = canvas
    this.container = container
    this.nodeStore = nodeStore

    // 回调
    this._onNodeSelect = options.onNodeSelect || null
    this._onNodeDeselect = options.onNodeDeselect || null
    this._onNodeDragEnd = options.onNodeDragEnd || null
    this._onContextMenu = options.onContextMenu || null
    this._onSlotConnect = options.onSlotConnect || null

    // 平移/缩放状态
    this.offsetX = 0
    this.offsetY = 0
    this.zoom = 1

    // 交互状态
    this._isPanning = false
    this._panStartX = 0
    this._panStartY = 0
    this._isDraggingNode = false
    this._dragNodeId = null
    this._dragStartX = 0
    this._dragStartY = 0
    this._isConnecting = false
    this._connectFromNode = null
    this._connectFromSlot = null
    this._connectFromType = null // 'input' | 'output'
    this._connectMouseX = 0
    this._connectMouseY = 0
    this._isSlotDown = false

    // 动画帧 ID
    this._animFrameId = null

    // 绑定事件处理器（保存引用以便卸载时移除）
    this._boundMouseDown = this._handleMouseDown.bind(this)
    this._boundMouseMove = this._handleMouseMove.bind(this)
    this._boundMouseUp = this._handleMouseUp.bind(this)
    this._boundWheel = this._handleWheel.bind(this)
    this._boundContextMenu = this._handleContextMenu.bind(this)
    this._boundMouseLeave = this._handleMouseUp.bind(this)

    // 初始化事件监听
    this._attachEvents()

    // 启动渲染循环
    this._animFrameId = requestAnimationFrame(() => this.drawFrame())
  }

  // ================================================================
  //  坐标转换
  // ================================================================

  /**
   * 屏幕坐标 -> 世界坐标
   * @param {number} sx - 屏幕 x
   * @param {number} sy - 屏幕 y
   * @returns {{ x: number, y: number }}
   */
  screenToWorld(sx, sy) {
    return {
      x: (sx - this.offsetX) / this.zoom,
      y: (sy - this.offsetY) / this.zoom
    }
  }

  /**
   * 世界坐标 -> 屏幕坐标
   * @param {number} wx - 世界 x
   * @param {number} wy - 世界 y
   * @returns {{ x: number, y: number }}
   */
  worldToScreen(wx, wy) {
    return {
      x: wx * this.zoom + this.offsetX,
      y: wy * this.zoom + this.offsetY
    }
  }

  // ================================================================
  //  渲染
  // ================================================================

  /**
   * 主渲染帧 - 使用 requestAnimationFrame 循环
   */
  drawFrame() {
    const canvas = this.canvas
    const container = this.container
    if (!canvas || !container) return

    // 高 DPI 适配
    const dpr = window.devicePixelRatio || 1
    const w = container.clientWidth
    const h = container.clientHeight
    canvas.width = w * dpr
    canvas.height = h * dpr
    canvas.style.width = w + 'px'
    canvas.style.height = h + 'px'

    const ctx = canvas.getContext('2d')
    ctx.scale(dpr, dpr)

    // 清空画布
    ctx.fillStyle = BG_COLOR
    ctx.fillRect(0, 0, w, h)

    // 绘制网格（屏幕空间）
    this._drawGrid(ctx, w, h)

    // 进入世界空间
    ctx.save()
    ctx.translate(this.offsetX, this.offsetY)
    ctx.scale(this.zoom, this.zoom)

    // 绘制连线
    this._drawLinks(ctx)

    // 绘制节点
    this._drawNodes(ctx)

    ctx.restore()

    // 继续下一帧
    this._animFrameId = requestAnimationFrame(() => this.drawFrame())
  }

  /**
   * 绘制背景网格
   */
  _drawGrid(ctx, w, h) {
    const gridSize = GRID_BASE_SIZE * this.zoom
    const majorGridSize = gridSize * GRID_MAJOR_MULTIPLIER

    // 小格
    ctx.strokeStyle = GRID_COLOR_MINOR
    ctx.lineWidth = 1

    const startX = this.offsetX % gridSize
    const startY = this.offsetY % gridSize

    ctx.beginPath()
    for (let x = startX; x < w; x += gridSize) {
      ctx.moveTo(x, 0)
      ctx.lineTo(x, h)
    }
    for (let y = startY; y < h; y += gridSize) {
      ctx.moveTo(0, y)
      ctx.lineTo(w, y)
    }
    ctx.stroke()

    // 大格
    ctx.strokeStyle = GRID_COLOR_MAJOR
    const majorStartX = this.offsetX % majorGridSize
    const majorStartY = this.offsetY % majorGridSize

    ctx.beginPath()
    for (let x = majorStartX; x < w; x += majorGridSize) {
      ctx.moveTo(x, 0)
      ctx.lineTo(x, h)
    }
    for (let y = majorStartY; y < h; y += majorGridSize) {
      ctx.moveTo(0, y)
      ctx.lineTo(w, y)
    }
    ctx.stroke()
  }

  /**
   * 绘制所有连线
   */
  _drawLinks(ctx) {
    const { nodes, links } = this.nodeStore

    for (const link of links) {
      const sourceNode = nodes.find(n => n.id === link.sourceId)
      const targetNode = nodes.find(n => n.id === link.targetId)
      if (!sourceNode || !targetNode) continue

      const sx = sourceNode.position.x + NODE_WIDTH
      const sy = sourceNode.position.y + TITLE_BAR_HEIGHT + SLOT_SPACING + link.sourceSlot * SLOT_SPACING
      const tx = targetNode.position.x
      const ty = targetNode.position.y + TITLE_BAR_HEIGHT + SLOT_SPACING + link.targetSlot * SLOT_SPACING

      const cpOffset = Math.abs(tx - sx) * 0.5

      ctx.strokeStyle = LINK_COLOR
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(sx, sy)
      ctx.bezierCurveTo(sx + cpOffset, sy, tx - cpOffset, ty, tx, ty)
      ctx.stroke()
    }

    // 绘制正在连接中的临时连线（虚线）
    if (this._isConnecting && this._connectFromNode) {
      const sourceNode = nodes.find(n => n.id === this._connectFromNode)
      if (sourceNode) {
        let sx, sy
        if (this._connectFromType === 'output') {
          sx = sourceNode.position.x + NODE_WIDTH
          sy = sourceNode.position.y + TITLE_BAR_HEIGHT + SLOT_SPACING + this._connectFromSlot * SLOT_SPACING
        } else {
          sx = sourceNode.position.x
          sy = sourceNode.position.y + TITLE_BAR_HEIGHT + SLOT_SPACING + this._connectFromSlot * SLOT_SPACING
        }

        const worldMouse = this.screenToWorld(this._connectMouseX, this._connectMouseY)
        const cpOffset = Math.abs(worldMouse.x - sx) * 0.5

        ctx.strokeStyle = LINK_ACTIVE_COLOR
        ctx.lineWidth = 2
        ctx.setLineDash([5, 5])
        ctx.beginPath()
        if (this._connectFromType === 'output') {
          ctx.moveTo(sx, sy)
          ctx.bezierCurveTo(sx + cpOffset, sy, worldMouse.x - cpOffset, worldMouse.y, worldMouse.x, worldMouse.y)
        } else {
          ctx.moveTo(sx, sy)
          ctx.bezierCurveTo(sx - cpOffset, sy, worldMouse.x + cpOffset, worldMouse.y, worldMouse.x, worldMouse.y)
        }
        ctx.stroke()
        ctx.setLineDash([])
      }
    }
  }

  /**
   * 绘制所有节点
   */
  _drawNodes(ctx) {
    const { nodes, selectedNodeId } = this.nodeStore

    for (const node of nodes) {
      const x = node.position.x
      const y = node.position.y

      const inputCount = (node.inputs && node.inputs.length) || 1
      const outputCount = (node.outputs && node.outputs.length) || 1
      const maxSlots = Math.max(inputCount, outputCount)
      const height = Math.max(40, maxSlots * SLOT_SPACING + TITLE_BAR_HEIGHT + 14)

      const colors = nodeColors[node.category] || nodeColors.general
      const isSelected = node.id === selectedNodeId

      // 节点背景
      ctx.fillStyle = colors.bg
      ctx.strokeStyle = isSelected ? SELECTION_COLOR : colors.border
      ctx.lineWidth = isSelected ? 2 : 1

      this._roundRect(ctx, x, y, NODE_WIDTH, height, CORNER_RADIUS)
      ctx.fill()
      ctx.stroke()

      // 标题栏
      ctx.fillStyle = colors.border + '40'
      this._roundRectTop(ctx, x, y, NODE_WIDTH, TITLE_BAR_HEIGHT, CORNER_RADIUS)
      ctx.fill()

      // 标题文字
      ctx.fillStyle = TITLE_TEXT_COLOR
      ctx.font = '11px "Segoe UI", sans-serif'
      ctx.fillText(node.title, x + 10, y + 17)

      // 输入插槽（左侧蓝色圆点）
      for (let i = 0; i < inputCount; i++) {
        const slotY = y + TITLE_BAR_HEIGHT + SLOT_SPACING + i * SLOT_SPACING
        ctx.fillStyle = INPUT_SLOT_COLOR
        ctx.beginPath()
        ctx.arc(x, slotY, SLOT_RADIUS, 0, Math.PI * 2)
        ctx.fill()
      }

      // 输出插槽（右侧绿色圆点）
      for (let i = 0; i < outputCount; i++) {
        const slotY = y + TITLE_BAR_HEIGHT + SLOT_SPACING + i * SLOT_SPACING
        ctx.fillStyle = OUTPUT_SLOT_COLOR
        ctx.beginPath()
        ctx.arc(x + NODE_WIDTH, slotY, SLOT_RADIUS, 0, Math.PI * 2)
        ctx.fill()
      }
    }
  }

  // ================================================================
  //  辅助绘图
  // ================================================================

  /**
   * 绘制完整圆角矩形路径
   */
  _roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath()
    ctx.moveTo(x + r, y)
    ctx.lineTo(x + w - r, y)
    ctx.quadraticCurveTo(x + w, y, x + w, y + r)
    ctx.lineTo(x + w, y + h - r)
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
    ctx.lineTo(x + r, y + h)
    ctx.quadraticCurveTo(x, y + h, x, y + h - r)
    ctx.lineTo(x, y + r)
    ctx.quadraticCurveTo(x, y, x + r, y)
    ctx.closePath()
  }

  /**
   * 绘制仅顶部圆角的矩形路径
   */
  _roundRectTop(ctx, x, y, w, h, r) {
    ctx.beginPath()
    ctx.moveTo(x + r, y)
    ctx.lineTo(x + w - r, y)
    ctx.quadraticCurveTo(x + w, y, x + w, y + r)
    ctx.lineTo(x + w, y + h)
    ctx.lineTo(x, y + h)
    ctx.lineTo(x, y + r)
    ctx.quadraticCurveTo(x, y, x + r, y)
    ctx.closePath()
  }

  // ================================================================
  //  碰撞检测
  // ================================================================

  /**
   * 检测屏幕坐标下命中的节点
   * @param {number} mx - 屏幕 x
   * @param {number} my - 屏幕 y
   * @returns {Object|null} 命中的节点数据，或 null
   */
  _hitTestNode(mx, my) {
    const { nodes } = this.nodeStore

    for (let i = nodes.length - 1; i >= 0; i--) {
      const node = nodes[i]
      const x = node.position.x
      const y = node.position.y
      const inputCount = (node.inputs && node.inputs.length) || 1
      const outputCount = (node.outputs && node.outputs.length) || 1
      const maxSlots = Math.max(inputCount, outputCount)
      const height = Math.max(40, maxSlots * SLOT_SPACING + TITLE_BAR_HEIGHT + 14)

      const screenPos = this.worldToScreen(x, y)
      const screenW = NODE_WIDTH * this.zoom
      const screenH = height * this.zoom

      if (mx >= screenPos.x && mx <= screenPos.x + screenW &&
          my >= screenPos.y && my <= screenPos.y + screenH) {
        return node
      }
    }
    return null
  }

  /**
   * 检测屏幕坐标下命中的插槽
   * @param {number} mx - 屏幕 x
   * @param {number} my - 屏幕 y
   * @returns {{ nodeId, slotIndex, slotType } | null}
   */
  _hitTestSlot(mx, my) {
    const { nodes } = this.nodeStore

    for (let i = nodes.length - 1; i >= 0; i--) {
      const node = nodes[i]
      const x = node.position.x
      const y = node.position.y

      // 检测输入插槽
      const inputCount = (node.inputs && node.inputs.length) || 0
      for (let s = 0; s < inputCount; s++) {
        const slotY = y + TITLE_BAR_HEIGHT + SLOT_SPACING + s * SLOT_SPACING
        const screenPos = this.worldToScreen(x, slotY)
        const hitRadius = (SLOT_RADIUS + 4) * this.zoom
        const dx = mx - screenPos.x
        const dy = my - screenPos.y
        if (dx * dx + dy * dy <= hitRadius * hitRadius) {
          return { nodeId: node.id, slotIndex: s, slotType: 'input' }
        }
      }

      // 检测输出插槽
      const outputCount = (node.outputs && node.outputs.length) || 0
      for (let s = 0; s < outputCount; s++) {
        const slotY = y + TITLE_BAR_HEIGHT + SLOT_SPACING + s * SLOT_SPACING
        const screenPos = this.worldToScreen(x + NODE_WIDTH, slotY)
        const hitRadius = (SLOT_RADIUS + 4) * this.zoom
        const dx = mx - screenPos.x
        const dy = my - screenPos.y
        if (dx * dx + dy * dy <= hitRadius * hitRadius) {
          return { nodeId: node.id, slotIndex: s, slotType: 'output' }
        }
      }
    }
    return null
  }

  // ================================================================
  //  鼠标事件处理
  // ================================================================

  _handleContextMenu(e) {
    e.preventDefault()
    if (this._onContextMenu) {
      const rect = this.canvas.getBoundingClientRect()
      this._onContextMenu({
        screenX: e.clientX - rect.left,
        screenY: e.clientY - rect.top
      })
    }
  }

  _handleMouseDown(e) {
    const rect = this.canvas.getBoundingClientRect()
    const mx = e.clientX - rect.left
    const my = e.clientY - rect.top

    // 中键 或 Alt+左键 = 平移
    if (e.button === 1 || (e.button === 0 && e.altKey)) {
      e.preventDefault()
      this._isPanning = true
      this._panStartX = e.clientX - this.offsetX
      this._panStartY = e.clientY - this.offsetY
      return
    }

    // 左键
    if (e.button === 0) {
      // 先检测插槽命中（用于连线）
      const slotHit = this._hitTestSlot(mx, my)
      if (slotHit) {
        this._isConnecting = true
        this._connectFromNode = slotHit.nodeId
        this._connectFromSlot = slotHit.slotIndex
        this._connectFromType = slotHit.slotType
        this._connectMouseX = mx
        this._connectMouseY = my
        return
      }

      // 检测节点命中
      const nodeHit = this._hitTestNode(mx, my)
      const worldPos = this.screenToWorld(mx, my)

      if (nodeHit) {
        // 选中节点
        if (this._onNodeSelect) {
          this._onNodeSelect(nodeHit.id)
        }

        // 开始拖拽
        this._isDraggingNode = true
        this._dragNodeId = nodeHit.id
        this._dragStartX = worldPos.x - nodeHit.position.x
        this._dragStartY = worldPos.y - nodeHit.position.y
      } else {
        // 点击空白区域，取消选中
        if (this._onNodeDeselect) {
          this._onNodeDeselect()
        }
      }
    }
  }

  _handleMouseMove(e) {
    const rect = this.canvas.getBoundingClientRect()
    const mx = e.clientX - rect.left
    const my = e.clientY - rect.top

    // 平移
    if (this._isPanning) {
      this.offsetX = e.clientX - this._panStartX
      this.offsetY = e.clientY - this._panStartY
    }

    // 节点拖拽
    if (this._isDraggingNode && this._dragNodeId) {
      const worldPos = this.screenToWorld(mx, my)
      const node = this.nodeStore.nodes.find(n => n.id === this._dragNodeId)
      if (node) {
        node.position.x = worldPos.x - this._dragStartX
        node.position.y = worldPos.y - this._dragStartY
      }
    }

    // 连线跟随
    if (this._isConnecting) {
      this._connectMouseX = mx
      this._connectMouseY = my
    }
  }

  _handleMouseUp(e) {
    // 结束连线 - 检测目标插槽
    if (this._isConnecting) {
      const rect = this.canvas.getBoundingClientRect()
      const mx = e.clientX - rect.left
      const my = e.clientY - rect.top
      const slotHit = this._hitTestSlot(mx, my)

      if (slotHit && slotHit.nodeId !== this._connectFromNode) {
        // 确保连接方向是 output -> input
        let sourceId, sourceSlot, targetId, targetSlot
        if (this._connectFromType === 'output' && slotHit.slotType === 'input') {
          sourceId = this._connectFromNode
          sourceSlot = this._connectFromSlot
          targetId = slotHit.nodeId
          targetSlot = slotHit.slotIndex
        } else if (this._connectFromType === 'input' && slotHit.slotType === 'output') {
          sourceId = slotHit.nodeId
          sourceSlot = slotHit.slotIndex
          targetId = this._connectFromNode
          targetSlot = this._connectFromSlot
        }

        if (sourceId && this._onSlotConnect) {
          this._onSlotConnect({ sourceId, sourceSlot, targetId, targetSlot })
        }
      }

      this._isConnecting = false
      this._connectFromNode = null
      this._connectFromSlot = null
      this._connectFromType = null
    }

    // 结束拖拽 - 通知回调
    if (this._isDraggingNode && this._dragNodeId) {
      const node = this.nodeStore.nodes.find(n => n.id === this._dragNodeId)
      if (node && this._onNodeDragEnd) {
        this._onNodeDragEnd(this._dragNodeId, { x: node.position.x, y: node.position.y })
      }
    }

    this._isPanning = false
    this._isDraggingNode = false
    this._dragNodeId = null
  }

  _handleWheel(e) {
    e.preventDefault()
    const rect = this.canvas.getBoundingClientRect()
    const mx = e.clientX - rect.left
    const my = e.clientY - rect.top

    const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1
    const newZoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, this.zoom * zoomFactor))

    // 以鼠标位置为中心缩放
    this.offsetX = mx - (mx - this.offsetX) * (newZoom / this.zoom)
    this.offsetY = my - (my - this.offsetY) * (newZoom / this.zoom)
    this.zoom = newZoom
  }

  // ================================================================
  //  事件绑定/解绑
  // ================================================================

  _attachEvents() {
    this.canvas.addEventListener('mousedown', this._boundMouseDown)
    this.canvas.addEventListener('mousemove', this._boundMouseMove)
    this.canvas.addEventListener('mouseup', this._boundMouseUp)
    this.canvas.addEventListener('wheel', this._boundWheel, { passive: false })
    this.canvas.addEventListener('mouseleave', this._boundMouseLeave)
    this.canvas.addEventListener('contextmenu', this._boundContextMenu)
  }

  _detachEvents() {
    this.canvas.removeEventListener('mousedown', this._boundMouseDown)
    this.canvas.removeEventListener('mousemove', this._boundMouseMove)
    this.canvas.removeEventListener('mouseup', this._boundMouseUp)
    this.canvas.removeEventListener('wheel', this._boundWheel)
    this.canvas.removeEventListener('mouseleave', this._boundMouseLeave)
    this.canvas.removeEventListener('contextmenu', this._boundContextMenu)
  }

  // ================================================================
  //  公共 API
  // ================================================================

  /**
   * 设置视口偏移（平移到指定世界位置居中显示）
   * @param {number} worldX
   * @param {number} worldY
   */
  centerOn(worldX, worldY) {
    if (!this.container) return
    const w = this.container.clientWidth
    const h = this.container.clientHeight
    this.offsetX = w / 2 - worldX * this.zoom
    this.offsetY = h / 2 - worldY * this.zoom
  }

  /**
   * 重置视口（归零平移和缩放）
   */
  resetView() {
    this.offsetX = 0
    this.offsetY = 0
    this.zoom = 1
  }

  /**
   * 销毁渲染器，停止动画循环，移除事件监听
   */
  destroy() {
    if (this._animFrameId) {
      cancelAnimationFrame(this._animFrameId)
      this._animFrameId = null
    }
    this._detachEvents()
  }
}