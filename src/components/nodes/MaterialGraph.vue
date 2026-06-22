<template>
  <div class="material-graph" ref="canvasRef">
    <canvas ref="graphCanvasRef" class="graph-canvas"></canvas>

    <!-- Placeholder info -->
    <div class="material-graph-empty">
      <div class="material-graph-hint">
        <q-icon name="palette" size="18px" color="grey-6" />
        <span>Material Node Graph</span>
      </div>
      <p class="material-graph-desc">
        Select a mesh object and assign a material to edit its shading graph.
        Supports PBR, unlit, and translucent material outputs compiled via TSL.
      </p>
    </div>
  </div>
</template>

<script setup>
/**
 * MaterialGraph - 材质节点图预览面板
 * 仅作为静态展示，不做交互（实际材质编辑通过 TSL 实现）
 */
import { ref, onMounted, onUnmounted, watch, nextTick } from 'vue'

const canvasRef = ref(null)
const graphCanvasRef = ref(null)

let animFrameId = null
let drawn = false

// 暴露给父组件用于 v-show 切换后触发重绘
function redraw() {
  nextTick(() => drawMaterialGraph())
}

defineExpose({ redraw })

const materialNodes = [
  { id: 1, type: 'base_color', title: 'Base Color', x: 50, y: 60, color: '#ff6b6b', outputs: ['color'] },
  { id: 2, type: 'metallic', title: 'Metallic', x: 50, y: 160, color: '#339af0', outputs: ['value'] },
  { id: 3, type: 'roughness', title: 'Roughness', x: 50, y: 260, color: '#51cf66', outputs: ['value'] },
  { id: 4, type: 'normal_map', title: 'Normal Map', x: 50, y: 360, color: '#fcc419', outputs: ['normal'] },
  { id: 5, type: 'noise_texture', title: 'Noise Texture', x: 250, y: 60, color: '#cc5de8', inputs: ['scale', 'detail'], outputs: ['color', 'value'] },
  { id: 6, type: 'math_multiply', title: 'Multiply', x: 250, y: 200, color: '#ff922b', inputs: ['a', 'b'], outputs: ['result'] },
  { id: 7, type: 'fresnel', title: 'Fresnel', x: 250, y: 320, color: '#22b8cf', inputs: ['normal', 'power'], outputs: ['value'] },
  { id: 8, type: 'pbr_output', title: 'PBR Output', x: 460, y: 150, color: '#e0e0f0', inputs: ['base_color', 'metallic', 'roughness', 'normal', 'emission'], outputs: [] }
]

function drawMaterialGraph() {
  const canvas = graphCanvasRef.value
  const container = canvasRef.value
  if (!canvas || !container) return

  const dpr = window.devicePixelRatio || 1
  const w = container.clientWidth
  const h = container.clientHeight

  canvas.width = w * dpr
  canvas.height = h * dpr
  canvas.style.width = w + 'px'
  canvas.style.height = h + 'px'

  const ctx = canvas.getContext('2d')
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

  ctx.fillStyle = '#141428'
  ctx.fillRect(0, 0, w, h)

  const nodeWidth = 150

  // Draw material nodes
  for (const node of materialNodes) {
    const inputH = (node.inputs?.length || 0) * 22 + 36
    const outputH = (node.outputs?.length || 0) * 22 + 36
    const height = Math.max(inputH, outputH, 36)

    // Shadow
    ctx.shadowColor = 'rgba(0,0,0,0.3)'
    ctx.shadowBlur = 8
    ctx.shadowOffsetX = 2
    ctx.shadowOffsetY = 2

    // Body - use manual roundRect for compatibility
    ctx.fillStyle = '#1e1e3a'
    ctx.strokeStyle = node.color + '80'
    ctx.lineWidth = 1.5
    drawRoundedRect(ctx, node.x, node.y, nodeWidth, height, 4)
    ctx.fill()
    ctx.stroke()

    ctx.shadowColor = 'transparent'

    // Title bar accent
    ctx.fillStyle = node.color + '30'
    drawRoundedRectTop(ctx, node.x, node.y, nodeWidth, 24, 4)
    ctx.fill()

    // Title
    ctx.fillStyle = node.color
    ctx.font = 'bold 10px "Segoe UI", sans-serif'
    ctx.fillText(node.title, node.x + 8, node.y + 16)

    // Input slots
    if (node.inputs) {
      node.inputs.forEach((input, i) => {
        const sy = node.y + 40 + i * 22
        ctx.fillStyle = node.color
        ctx.beginPath()
        ctx.arc(node.x, sy, 4, 0, Math.PI * 2)
        ctx.fill()
        ctx.fillStyle = '#9090b0'
        ctx.font = '9px "Segoe UI", sans-serif'
        ctx.fillText(input, node.x + 10, sy + 3)
      })
    }

    // Output slots
    if (node.outputs) {
      node.outputs.forEach((output, i) => {
        const sy = node.y + 40 + i * 22
        ctx.fillStyle = node.color
        ctx.beginPath()
        ctx.arc(node.x + nodeWidth, sy, 4, 0, Math.PI * 2)
        ctx.fill()
        ctx.fillStyle = '#9090b0'
        ctx.font = '9px "Segoe UI", sans-serif'
        const tw = ctx.measureText(output).width
        ctx.fillText(output, node.x + nodeWidth - tw - 10, sy + 3)
      })
    }
  }

  // Draw connections
  const connections = [
    { from: 1, fromSlot: 0, to: 8, toSlot: 0 },
    { from: 2, fromSlot: 0, to: 8, toSlot: 1 },
    { from: 3, fromSlot: 0, to: 8, toSlot: 2 },
    { from: 4, fromSlot: 0, to: 8, toSlot: 3 },
    { from: 5, fromSlot: 0, to: 6, toSlot: 0 }
  ]

  for (const conn of connections) {
    const fromNode = materialNodes.find(n => n.id === conn.from)
    const toNode = materialNodes.find(n => n.id === conn.to)
    if (!fromNode || !toNode) continue

    const sx = fromNode.x + nodeWidth
    const sy = fromNode.y + 40 + conn.fromSlot * 22
    const tx = toNode.x
    const ty = toNode.y + 40 + conn.toSlot * 22
    const cp = Math.abs(tx - sx) * 0.5

    ctx.strokeStyle = fromNode.color + '50'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(sx, sy)
    ctx.bezierCurveTo(sx + cp, sy, tx - cp, ty, tx, ty)
    ctx.stroke()
  }

  drawn = true
}

// 兼容性 roundRect 实现
function drawRoundedRect(ctx, x, y, w, h, r) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.arcTo(x + w, y, x + w, y + r, r)
  ctx.lineTo(x + w, y + h - r)
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r)
  ctx.lineTo(x + r, y + h)
  ctx.arcTo(x, y + h, x, y + h - r, r)
  ctx.lineTo(x, y + r)
  ctx.arcTo(x, y, x + r, y, r)
  ctx.closePath()
}

function drawRoundedRectTop(ctx, x, y, w, h, r) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.arcTo(x + w, y, x + w, y + r, r)
  ctx.lineTo(x + w, y + h)
  ctx.lineTo(x, y + h)
  ctx.lineTo(x, y + r)
  ctx.arcTo(x, y, x + r, y, r)
  ctx.closePath()
}

// Use ResizeObserver to redraw when container size changes (instead of rAF loop)
onMounted(() => {
  drawMaterialGraph()

  const observer = new ResizeObserver(() => {
    drawMaterialGraph()
  })

  if (canvasRef.value) {
    observer.observe(canvasRef.value)
  }

  // Store for cleanup
  canvasRef.value._observer = observer
})

onUnmounted(() => {
  if (canvasRef.value?._observer) {
    canvasRef.value._observer.disconnect()
  }
})
</script>

<style scoped>
.material-graph {
  width: 100%;
  height: 100%;
  position: relative;
  overflow: hidden;
}

.graph-canvas {
  display: block;
  width: 100%;
  height: 100%;
}

.material-graph-empty {
  position: absolute;
  bottom: 8px;
  left: 8px;
  pointer-events: none;
}

.material-graph-hint {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 10px;
  color: var(--editor-text-muted);
}

.material-graph-desc {
  margin-top: 4px;
  font-size: 9px;
  color: var(--editor-text-muted);
  max-width: 300px;
  line-height: 1.4;
}
</style>
