/**
 * Node Graph Drawing Utilities
 * Canvas 2D drawing helpers for node graph rendering
 */
import { NODE_GRAPH_CONSTANTS as C } from './nodeGraph-constants.js'

/**
 * Draw a rounded rectangle
 */
export function drawRoundedRect(ctx, x, y, w, h, r) {
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
 * Draw a node's background and border
 */
export function drawNodeBackground(ctx, node, isSelected, isHovered) {
  const { nodeBackground, nodeBorder, nodeBorderSelected, nodeBorderHover, categories, nodeTitleBarHeight } = C
  const { x, y, width, height } = node._layout || { x: node.position.x, y: node.position.y, width: C.nodeMinWidth, height: 80 }
  const cat = node.category || 'general'
  const catColors = categories[cat] || categories.general

  // Shadow
  ctx.shadowColor = 'rgba(0, 0, 0, 0.3)'
  ctx.shadowBlur = 8
  ctx.shadowOffsetX = 0
  ctx.shadowOffsetY = 2

  // Background
  drawRoundedRect(ctx, x, y, width, height, 6)
  ctx.fillStyle = nodeBackground
  ctx.fill()

  ctx.shadowColor = 'transparent'
  ctx.shadowBlur = 0

  // Title bar
  ctx.save()
  ctx.beginPath()
  ctx.moveTo(x + 6, y)
  ctx.lineTo(x + width - 6, y)
  ctx.quadraticCurveTo(x + width, y, x + width, y + 6)
  ctx.lineTo(x + width, y + nodeTitleBarHeight)
  ctx.lineTo(x, y + nodeTitleBarHeight)
  ctx.lineTo(x, y + 6)
  ctx.quadraticCurveTo(x, y, x + 6, y)
  ctx.closePath()
  ctx.fillStyle = catColors.bg
  ctx.fill()
  ctx.restore()

  // Border
  drawRoundedRect(ctx, x, y, width, height, 6)
  ctx.strokeStyle = isSelected ? nodeBorderSelected : isHovered ? nodeBorderHover : nodeBorder
  ctx.lineWidth = isSelected ? 2 : 1
  ctx.stroke()

  // Title text
  ctx.fillStyle = C.textTitle
  ctx.font = `${C.title.weight} ${C.title.size}px ${C.title.family}`
  ctx.textBaseline = 'middle'
  ctx.fillText(node.title || node.typeId || '', x + C.nodePaddingX, y + nodeTitleBarHeight / 2)
}

/**
 * Draw a slot (input/output port) on a node
 */
export function drawSlot(ctx, x, y, isInput, isConnected, isHovered, color) {
  const r = C.slotRadius
  ctx.beginPath()
  ctx.arc(x, y, r, 0, Math.PI * 2)

  if (isConnected) {
    ctx.fillStyle = C.slotConnectedFill
  } else if (isHovered) {
    ctx.fillStyle = C.slotHoverFill
  } else {
    ctx.fillStyle = color || C.slotDefaultFill
  }
  ctx.fill()

  // Stroke
  ctx.strokeStyle = isInput ? C.slotInputStroke : C.slotOutputStroke
  ctx.lineWidth = 1.5
  ctx.stroke()
}

/**
 * Draw a Bezier curve connection between two points
 */
export function drawConnection(ctx, x1, y1, x2, y2, isSelected = false, isHovered = false) {
  const offset = C.wireBezierOffset
  const dx = Math.abs(x2 - x1)

  ctx.beginPath()
  ctx.moveTo(x1, y1)
  ctx.bezierCurveTo(
    x1 + Math.max(offset, dx * 0.5), y1,
    x2 - Math.max(offset, dx * 0.5), y2,
    x2, y2
  )

  if (isSelected) {
    ctx.strokeStyle = C.wireSelected
    ctx.lineWidth = 3
  } else if (isHovered) {
    ctx.strokeStyle = C.wireHover
    ctx.lineWidth = 2.5
  } else {
    ctx.strokeStyle = C.wireDefault
    ctx.lineWidth = C.wireWidth
  }
  ctx.globalAlpha = C.wireOpacity
  ctx.stroke()
  ctx.globalAlpha = 1.0
}

/**
 * Draw the background grid
 */
export function drawGrid(ctx, width, height, panX, panY, zoom) {
  const smallSpacing = C.gridSmallSpacing * zoom
  const largeSpacing = C.gridLargeSpacing * zoom

  // Small grid
  ctx.strokeStyle = C.gridSmall
  ctx.lineWidth = 0.5

  const startX = (panX * zoom) % smallSpacing
  const startY = (panY * zoom) % smallSpacing

  ctx.beginPath()
  for (let x = startX; x < width; x += smallSpacing) {
    ctx.moveTo(x, 0)
    ctx.lineTo(x, height)
  }
  for (let y = startY; y < height; y += smallSpacing) {
    ctx.moveTo(0, y)
    ctx.lineTo(width, y)
  }
  ctx.stroke()

  // Large grid
  ctx.strokeStyle = C.gridLarge
  ctx.lineWidth = 0.5

  const lStartX = (panX * zoom) % largeSpacing
  const lStartY = (panY * zoom) % largeSpacing

  ctx.beginPath()
  for (let x = lStartX; x < width; x += largeSpacing) {
    ctx.moveTo(x, 0)
    ctx.lineTo(x, height)
  }
  for (let y = lStartY; y < height; y += largeSpacing) {
    ctx.moveTo(0, y)
    ctx.lineTo(width, y)
  }
  ctx.stroke()

  // Origin lines
  ctx.strokeStyle = C.gridOrigin
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(panX * zoom, 0)
  ctx.lineTo(panX * zoom, height)
  ctx.moveTo(0, panY * zoom)
  ctx.lineTo(width, panY * zoom)
  ctx.stroke()
}

/**
 * Draw a selection box
 */
export function drawSelectionBox(ctx, x, y, w, h) {
  ctx.fillStyle = C.selectionBox
  ctx.fillRect(x, y, w, h)
  ctx.strokeStyle = C.selectionBoxBorder
  ctx.lineWidth = 1
  ctx.setLineDash([4, 4])
  ctx.strokeRect(x, y, w, h)
  ctx.setLineDash([])
}

/**
 * Measure text width
 */
export function measureText(ctx, text, font) {
  ctx.font = font
  return ctx.measureText(text).width
}