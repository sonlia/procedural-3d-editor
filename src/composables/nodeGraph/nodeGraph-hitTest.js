/**
 * Node Graph Hit Testing
 * Find nodes/slots/links under cursor position
 */
import { NODE_GRAPH_CONSTANTS as C } from './nodeGraph-constants.js'

/**
 * Test if a point is inside a node's bounding box
 * @param {number} wx - World X (after screenToWorld transform)
 * @param {number} wy - World Y
 * @param {object} node - Node with position and _layout (width, height)
 * @returns {boolean}
 */
export function isInsideNode(wx, wy, node) {
  const layout = node._layout || { width: C.nodeMinWidth, height: 80 }
  const nx = node.position.x
  const ny = node.position.y

  return wx >= nx && wx <= nx + layout.width &&
         wy >= ny && wy <= ny + layout.height
}

/**
 * Find which node is under the cursor
 * @param {number} wx - World X
 * @param {number} wy - World Y
 * @param {Array} nodes - Array of node objects
 * @returns {object|null} The topmost node under cursor
 */
export function findNodeAtPosition(wx, wy, nodes) {
  // Search in reverse order (topmost first)
  for (let i = nodes.length - 1; i >= 0; i--) {
    if (isInsideNode(wx, wy, nodes[i])) {
      return nodes[i]
    }
  }
  return null
}

/**
 * Find which slot is under the cursor
 * @param {number} wx - World X
 * @param {number} wy - World Y
 * @param {object} node - Node object with computed _slotPositions
 * @returns {{ nodeId, slotName, slotIndex, isInput }|null}
 */
export function findSlotAtPosition(wx, wy, node) {
  const slots = node._slotPositions
  if (!slots) return null

  const hitRadius = C.slotHitRadius

  // Check inputs
  if (slots.inputs) {
    for (let i = 0; i < slots.inputs.length; i++) {
      const s = slots.inputs[i]
      const dx = wx - s.x
      const dy = wy - s.y
      if (dx * dx + dy * dy <= hitRadius * hitRadius) {
        return {
          nodeId: node.id,
          slotName: s.name,
          slotIndex: i,
          isInput: true,
          x: s.x,
          y: s.y
        }
      }
    }
  }

  // Check outputs
  if (slots.outputs) {
    for (let i = 0; i < slots.outputs.length; i++) {
      const s = slots.outputs[i]
      const dx = wx - s.x
      const dy = wy - s.y
      if (dx * dx + dy * dy <= hitRadius * hitRadius) {
        return {
          nodeId: node.id,
          slotName: s.name,
          slotIndex: i,
          isInput: false,
          x: s.x,
          y: s.y
        }
      }
    }
  }

  return null
}

/**
 * Find which link (connection wire) is near the cursor
 * @param {number} wx - World X
 * @param {number} wy - World Y
 * @param {Array} links - Array of link objects
 * @param {Map} slotPositionMap - nodeId → { inputs: [...], outputs: [...] }
 * @param {number} threshold - Distance threshold for hit
 * @returns {object|null} The link under cursor
 */
export function findLinkAtPosition(wx, wy, links, slotPositionMap, threshold = 8) {
  let closest = null
  let closestDist = threshold * threshold

  for (const link of links) {
    const dist = _pointToBezierDist(
      wx, wy,
      link._startX || 0, link._startY || 0,
      link._endX || 0, link._endY || 0
    )
    if (dist < closestDist) {
      closestDist = dist
      closest = link
    }
  }

  return closest
}

/**
 * Approximate distance from point to Bezier curve
 * Uses sampling approach
 */
function _pointToBezierDist(px, py, x1, y1, x2, y2) {
  const offset = C.wireBezierOffset
  const dx = Math.abs(x2 - x1)
  const cpOffset = Math.max(offset, dx * 0.5)
  const cx1 = x1 + cpOffset
  const cy1 = y1
  const cx2 = x2 - cpOffset
  const cy2 = y2

  let minDist = Infinity
  const steps = 20

  for (let i = 0; i <= steps; i++) {
    const t = i / steps
    const it = 1 - t
    const bx = it * it * it * x1 + 3 * it * it * t * cx1 + 3 * it * t * t * cx2 + t * t * t * x2
    const by = it * it * it * y1 + 3 * it * it * t * cy1 + 3 * it * t * t * cy2 + t * t * t * y2
    const ddx = px - bx
    const ddy = py - by
    const dist = ddx * ddx + ddy * ddy
    if (dist < minDist) minDist = dist
  }

  return minDist
}

/**
 * Test if a point is inside the title bar area of a node
 */
export function isInsideTitleBar(wx, wy, node) {
  const layout = node._layout || { width: C.nodeMinWidth }
  const nx = node.position.x
  const ny = node.position.y

  return wx >= nx && wx <= nx + layout.width &&
         wy >= ny && wy <= ny + C.nodeTitleBarHeight
}

/**
 * Get nodes inside a selection rectangle
 * @param {number} rx - Rect X (world coords)
 * @param {number} ry - Rect Y
 * @param {number} rw - Rect width
 * @param {number} rh - Rect height
 * @param {Array} nodes
 * @returns {Array}
 */
export function getNodesInRect(rx, ry, rw, rh, nodes) {
  const x1 = Math.min(rx, rx + rw)
  const y1 = Math.min(ry, ry + rh)
  const x2 = Math.max(rx, rx + rw)
  const y2 = Math.max(ry, ry + rh)

  return nodes.filter(node => {
    const layout = node._layout || { width: C.nodeMinWidth, height: 80 }
    const nx = node.position.x
    const ny = node.position.y

    // Check overlap
    return !(nx + layout.width < x1 || nx > x2 || ny + layout.height < y1 || ny > y2)
  })
}