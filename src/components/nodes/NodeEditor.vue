<template>
  <div class="node-editor" ref="canvasRef" tabindex="0" @contextmenu.prevent="onContextMenu" @click="onCanvasClick" @dblclick="onCanvasDblClick" @keydown="onKeyDown">
    <!-- Node Graph Canvas Area -->
    <canvas ref="graphCanvasRef" class="graph-canvas"></canvas>

    <!-- Context Menu Overlay -->
    <div v-if="contextMenu.show" class="context-menu" :style="{ left: contextMenu.x + 'px', top: contextMenu.y + 'px' }">
      <div class="context-menu-title">Add Node</div>
      <div
        v-for="group in nodeCategories"
        :key="group.name"
        class="context-menu-group"
      >
        <div class="context-group-label">{{ group.name }}</div>
        <div
          v-for="nodeType in group.types"
          :key="nodeType.type"
          class="context-menu-item"
          @click="addNodeFromMenu(nodeType)"
        >
          <q-icon :name="nodeType.icon || 'widgets'" size="14px" :color="nodeType.color" />
          <span>{{ nodeType.label }}</span>
        </div>
      </div>
      <template v-if="nodeStore.selectedNodeId">
        <div class="context-menu-group">
          <div class="context-menu-divider"></div>
          <div class="context-menu-item" style="color: #ff6b6b;" @click="deleteSelectedNode">
            <q-icon name="delete" size="14px" color="red-4" />
            <span>Delete Node</span>
          </div>
        </div>
      </template>
    </div>

    <!-- Node info overlay -->
    <div class="node-editor-info" v-if="nodeStore.nodeCount > 0">
      {{ nodeStore.nodeCount }} nodes | {{ nodeStore.linkCount }} links
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, reactive, nextTick } from 'vue'
import { useNodeStore } from '../../stores/nodeStore'

const nodeStore = useNodeStore()

const canvasRef = ref(null)
const graphCanvasRef = ref(null)

// Canvas pan/zoom state
const canvasState = reactive({
  offsetX: 0,
  offsetY: 0,
  zoom: 1,
  isPanning: false,
  panStartX: 0,
  panStartY: 0,
  isDraggingNode: false,
  dragNodeId: null,
  dragStartX: 0,
  dragStartY: 0,
  isConnecting: false,
  connectFromNode: null,
  connectFromSlot: null,
  connectFromType: 'output', // 'output' or 'input'
  connectMouseX: 0,
  connectMouseY: 0
})

const contextMenu = reactive({
  show: false,
  x: 0,
  y: 0
})

const NODE_WIDTH = 160
const SLOT_RADIUS = 5
const HEADER_HEIGHT = 26
const SLOT_SPACING = 24

// Node category definitions (matching NodeRegistry)
const nodeCategories = [
  {
    name: 'Geometry Input',
    types: [
      { type: 'primitive_cube', label: 'Cube', icon: 'check_box_outline_blank', color: 'blue-4' },
      { type: 'primitive_sphere', label: 'Sphere', icon: 'circle', color: 'blue-4' },
      { type: 'primitive_cylinder', label: 'Cylinder', icon: 'view_column', color: 'blue-4' },
      { type: 'primitive_plane', label: 'Plane', icon: 'crop_square', color: 'blue-4' },
      { type: 'import_model', label: 'Import Model', icon: 'file_open', color: 'blue-4' }
    ]
  },
  {
    name: 'Geometry Operations',
    types: [
      { type: 'op_extrude', label: 'Extrude', icon: 'arrow_upward', color: 'yellow-5' },
      { type: 'op_bevel', label: 'Bevel', icon: 'rounded_corner', color: 'yellow-5' },
      { type: 'op_boolean', label: 'Boolean', icon: 'join_inner', color: 'yellow-5' },
      { type: 'op_merge', label: 'Merge', icon: 'merge_type', color: 'yellow-5' },
      { type: 'op_transform', label: 'Transform', icon: 'open_with', color: 'yellow-5' }
    ]
  },
  {
    name: 'Scene Output',
    types: [
      { type: 'scene_output', label: 'Scene Output', icon: 'output', color: 'green-4' }
    ]
  },
  {
    name: 'Parameter Input',
    types: [
      { type: 'param_float', label: 'Float Value', icon: 'tag', color: 'cyan-4' },
      { type: 'param_vec3', label: 'Vector3', icon: '3d_rotation', color: 'cyan-4' },
      { type: 'param_color', label: 'Color', icon: 'color_lens', color: 'cyan-4' },
      { type: 'param_texture', label: 'Texture', icon: 'image', color: 'cyan-4' },
      { type: 'param_selection_set', label: 'Selection Set', icon: 'select_all', color: 'cyan-4' }
    ]
  },
  {
    name: 'Logic & Math',
    types: [
      { type: 'logic_math', label: 'Math', icon: 'calculate', color: 'orange-4' },
      { type: 'logic_condition', label: 'Condition', icon: 'call_split', color: 'orange-4' },
      { type: 'logic_curve', label: 'Curve', icon: 'show_chart', color: 'orange-4' },
      { type: 'logic_expression', label: 'Expression', icon: 'functions', color: 'orange-4' }
    ]
  },
  {
    name: 'Animation',
    types: [
      { type: 'anim_time', label: 'Time', icon: 'schedule', color: 'purple-4' },
      { type: 'anim_formula', label: 'Formula', icon: 'functions', color: 'purple-4' },
      { type: 'anim_keyframe', label: 'Keyframe', icon: 'straighten', color: 'purple-4' }
    ]
  },
  {
    name: 'Display Panel',
    types: [
      { type: 'panel_data', label: 'Data Panel', icon: 'dashboard', color: 'teal-4' },
      { type: 'panel_text', label: 'Text Label', icon: 'label', color: 'teal-4' },
      { type: 'panel_chart', label: 'Chart Panel', icon: 'show_chart', color: 'teal-4' },
      { type: 'panel_status', label: 'Status Indicator', icon: 'indicator', color: 'teal-4' }
    ]
  },
  {
    name: 'Instancing',
    types: [
      { type: 'instance', label: 'Instance', icon: 'grid_view', color: 'lime-4' },
      { type: 'array', label: 'Array', icon: 'view_module', color: 'lime-4' }
    ]
  },
  {
    name: 'Material',
    types: [
      { type: 'material_output', label: 'Material Output', icon: 'palette', color: 'pink-4' },
      { type: 'mat_pbr', label: 'PBR Material', icon: 'palette', color: 'pink-4' },
      { type: 'mat_math', label: 'Material Math', icon: 'calculate', color: 'pink-4' },
      { type: 'mat_fresnel', label: 'Fresnel', icon: 'blur_on', color: 'pink-4' },
      { type: 'mat_noise_texture', label: 'Noise Texture', icon: 'grain', color: 'pink-4' },
      { type: 'mat_texture_sampler', label: 'Texture Sampler', icon: 'texture', color: 'pink-4' }
    ]
  },
  {
    name: 'Physics',
    types: [
      { type: 'physics_body', label: 'Physics Body', icon: 'fitness_center', color: 'orange-6' }
    ]
  },
  {
    name: 'Particles',
    types: [
      { type: 'particle_emitter', label: 'Particle Emitter', icon: 'blur_on', color: 'purple-6' }
    ]
  }
]

function screenToWorld(sx, sy) {
  return {
    x: (sx - canvasState.offsetX) / canvasState.zoom,
    y: (sy - canvasState.offsetY) / canvasState.zoom
  }
}

function worldToScreen(wx, wy) {
  return {
    x: wx * canvasState.zoom + canvasState.offsetX,
    y: wy * canvasState.zoom + canvasState.offsetY
  }
}

function onContextMenu(e) {
  const rect = canvasRef.value.getBoundingClientRect()
  contextMenu.x = e.clientX - rect.left
  contextMenu.y = e.clientY - rect.top
  contextMenu.show = true
}

function onCanvasClick() {
  // 点击空白处关闭右键菜单
  closeContextMenu()
}

function onCanvasDblClick(e) {
  const rect = graphCanvasRef.value.getBoundingClientRect()
  const mx = e.clientX - rect.left
  const my = e.clientY - rect.top
  const worldPos = screenToWorld(mx, my)
  const node = hitTestNode(worldPos.x, worldPos.y)
  if (node) {
    nodeStore.selectNode(node.id)
  }
}

function deleteSelectedNode() {
  if (nodeStore.selectedNodeId) {
    nodeStore.removeNode(nodeStore.selectedNodeId)
    closeContextMenu()
  }
}

function addNodeFromMenu(nodeType) {
  const worldPos = screenToWorld(contextMenu.x, contextMenu.y)
  nodeStore.addNode({
    type: nodeType.type,
    title: nodeType.label,
    category: getCategoryName(nodeType.type),
    position: worldPos,
    properties: getDefaultProperties(nodeType.type),
    inputs: getInputsForType(nodeType.type),
    outputs: getOutputsForType(nodeType.type)
  })
  closeContextMenu()
}

function getCategoryName(type) {
  for (const cat of nodeCategories) {
    if (cat.types.find(t => t.type === type)) return cat.name.toLowerCase().replace(/\s+/g, '_')
  }
  return 'general'
}

function getInputsForType(type) {
  const map = {
    primitive_cube: [], primitive_sphere: [], primitive_cylinder: [], primitive_plane: [],
    import_model: [], param_float: [], param_vec3: [], param_color: [],
    param_texture: [], param_selection_set: [], anim_time: [],
    op_extrude: ['mesh_in', 'amount', 'selection'],
    op_bevel: ['mesh_in', 'radius', 'segments'],
    op_boolean: ['mesh_a', 'mesh_b', 'operation'],
    op_merge: ['mesh_a', 'mesh_b'],
    op_transform: ['mesh_in', 'position', 'rotation', 'scale'],
    scene_output: ['geometry', 'material', 'transform'],
    logic_math: ['a', 'b'],
    logic_condition: ['condition', 'true_val', 'false_val'],
    logic_curve: ['input'],
    logic_expression: ['t', 'frame'],
    anim_formula: ['t'],
    anim_keyframe: ['time'],
    panel_data: ['value', 'label'],
    panel_text: ['text'],
    panel_chart: ['data'],
    panel_status: ['value', 'threshold'],
    instance: ['mesh', 'count', 'transforms'],
    array: ['mesh', 'count', 'offset']
  }
  return map[type] || []
}

function getOutputsForType(type) {
  const map = {
    primitive_cube: ['geometry'], primitive_sphere: ['geometry'],
    primitive_cylinder: ['geometry'], primitive_plane: ['geometry'],
    import_model: ['geometry'],
    param_float: ['value'], param_vec3: ['vector'], param_color: ['color'],
    param_texture: ['texture'], param_selection_set: ['selection'],
    anim_time: ['time', 'delta'],
    op_extrude: ['mesh_out'], op_bevel: ['mesh_out'],
    op_boolean: ['mesh_out'], op_merge: ['mesh_out'],
    op_transform: ['mesh_out'],
    scene_output: [],
    logic_math: ['result'], logic_condition: ['result'],
    logic_curve: ['output'], logic_expression: ['result'],
    anim_formula: ['result'], anim_keyframe: ['value'],
    panel_data: ['panel'], panel_text: ['panel'],
    panel_chart: ['panel'], panel_status: ['panel'],
    instance: ['instances'], array: ['meshes']
  }
  return map[type] || []
}

function getDefaultProperties(type) {
  const defaults = {
    primitive_cube: { width: 1, height: 1, depth: 1 },
    primitive_sphere: { radius: 0.5, segments: 32 },
    primitive_cylinder: { radius: 0.5, height: 1, segments: 32 },
    primitive_plane: { width: 2, height: 2 },
    op_transform: { tx: 0, ty: 0, tz: 0, rx: 0, ry: 0, rz: 0, sx: 1, sy: 1, sz: 1 },
    param_float: { value: 0 },
    param_vec3: { x: 0, y: 0, z: 0 },
    logic_math: { operation: 'add', a: 0, b: 0 },
    logic_condition: { operator: '>' },
    anim_time: { speed: 1, offset: 0 },
    anim_formula: { expression: 'sin(t * 2)' },
    scene_output: {},
    op_extrude: { amount: 0.5 },
    op_boolean: { operation: 'union' },
    op_bevel: { radius: 0.1, segments: 3 },
    instance: { count: 10 },
    array: { count: 3, offsetX: 2, offsetY: 0, offsetZ: 0 }
  }
  return defaults[type] || {}
}

function closeContextMenu() {
  contextMenu.show = false
}

// Port type color map for connection coloring
const portTypeColors = {
  color: '#fb7185',    // rose
  float: '#22d3ee',    // cyan
  geometry: '#4ade80', // green
  texture: '#fb923c',  // orange
  material: '#f06595', // pink
  int: '#22d3ee',
  string: '#a0a0c0',
  bool: '#a0a0c0',
  vec3: '#818cf8',
  selection_set: '#a0a0c0',
  transform: '#818cf8',
  array: '#a0a0c0',
  physics_body: '#e8590c',
  particles: '#ae3ec9',
  display_panel: '#20c997',
  instanced_mesh: '#4ade80'
}

function getPortColor(nodeId, slotIndex, slotType) {
  const node = nodeStore.nodes.find(n => n.id === nodeId)
  if (!node) return 'rgba(83, 82, 237, 0.6)'
  const ports = slotType === 'output' ? node.outputs : node.inputs
  // Try to get type from the node's input/output definitions (names only in current data)
  // Use a heuristic based on port name
  if (ports && ports[slotIndex]) {
    const name = ports[slotIndex]
    if (name.includes('color') || name === 'baseColor' || name === 'emissive') return portTypeColors.color
    if (name === 'geometry' || name === 'mesh_in' || name === 'mesh_out' || name === 'meshes' || name === 'instances') return portTypeColors.geometry
    if (name === 'material' || name === 'material_out' || name === 'body_out' || name === 'particle_out') return portTypeColors.material
    if (name === 'texture') return portTypeColors.texture
    if (name === 'value' || name === 'result' || name === 'time' || name === 'delta' || name.includes('intensity') || name.includes('amount') || name === 'radius' || name.includes('power') || name.includes('bias') || name === 'a' || name === 'b') return portTypeColors.float
    if (name === 'vector' || name === 'position' || name === 'rotation' || name === 'scale' || name.includes('offset')) return portTypeColors.vec3
  }
  return 'rgba(83, 82, 237, 0.6)'
}

// Cycle detection via DFS
function wouldCreateCycle(sourceId, targetId) {
  const visited = new Set()
  function dfs(nodeId) {
    if (nodeId === sourceId) return true
    if (visited.has(nodeId)) return false
    visited.add(nodeId)
    for (const link of nodeStore.links) {
      if (link.sourceId === nodeId) {
        if (dfs(link.targetId)) return true
      }
    }
    return false
  }
  return dfs(targetId)
}

// ---- Hit testing ----
function hitTestNode(worldX, worldY) {
  // Iterate in reverse order (top nodes first)
  for (let i = nodeStore.nodes.length - 1; i >= 0; i--) {
    const node = nodeStore.nodes[i]
    const inputCount = node.inputs?.length || 0
    const outputCount = node.outputs?.length || 0
    const height = Math.max(40, Math.max(inputCount, outputCount) * SLOT_SPACING + HEADER_HEIGHT + 14)

    if (worldX >= node.position.x && worldX <= node.position.x + NODE_WIDTH &&
        worldY >= node.position.y && worldY <= node.position.y + height) {
      return node
    }
  }
  return null
}

function hitTestSlot(worldX, worldY) {
  for (const node of nodeStore.nodes) {
    // Check output slots (right side)
    const outputCount = node.outputs?.length || 0
    for (let i = 0; i < outputCount; i++) {
      const sx = node.position.x + NODE_WIDTH
      const sy = node.position.y + HEADER_HEIGHT + 14 + i * SLOT_SPACING
      const dist = Math.sqrt((worldX - sx) ** 2 + (worldY - sy) ** 2)
      if (dist <= SLOT_RADIUS + 4) {
        return { node, slotIndex: i, slotType: 'output' }
      }
    }

    // Check input slots (left side)
    const inputCount = node.inputs?.length || 0
    for (let i = 0; i < inputCount; i++) {
      const sx = node.position.x
      const sy = node.position.y + HEADER_HEIGHT + 14 + i * SLOT_SPACING
      const dist = Math.sqrt((worldX - sx) ** 2 + (worldY - sy) ** 2)
      if (dist <= SLOT_RADIUS + 4) {
        return { node, slotIndex: i, slotType: 'input' }
      }
    }
  }
  return null
}

// ---- Canvas rendering ----
let animFrameId
let _docClickHandler = null  // 模块级变量，确保 onUnmounted 能可靠清理 document 事件
const nodeColors = {
  geometry_input: { bg: '#1e3a5f', border: '#339af0' },
  geometry_op: { bg: '#3a3a1e', border: '#fcc419' },
  material: { bg: '#3a1e3a', border: '#f06595' },
  scene_output: { bg: '#1e3a2e', border: '#51cf66' },
  param_input: { bg: '#1e3a3a', border: '#22b8cf' },
  logic: { bg: '#3a2a1e', border: '#ff922b' },
  animation: { bg: '#2e1e3a', border: '#845ef7' },
  display_panel: { bg: '#1e3a3a', border: '#20c997' },
  instancing: { bg: '#2a3a1e', border: '#a9e34b' },
  general: { bg: '#2a2a3a', border: '#5352ed' }
}

function drawGraph() {
  const canvas = graphCanvasRef.value
  const container = canvasRef.value
  if (!canvas || !container) return

  const dpr = window.devicePixelRatio || 1
  const w = container.clientWidth
  const h = container.clientHeight

  if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
    canvas.width = w * dpr
    canvas.height = h * dpr
    canvas.style.width = w + 'px'
    canvas.style.height = h + 'px'
  }

  const ctx = canvas.getContext('2d')
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

  // Clear
  ctx.fillStyle = '#141428'
  ctx.fillRect(0, 0, w, h)

  // Grid
  drawGrid(ctx, w, h)

  ctx.save()
  ctx.translate(canvasState.offsetX, canvasState.offsetY)
  ctx.scale(canvasState.zoom, canvasState.zoom)

  // Draw links first
  drawLinks(ctx)

  // Draw nodes
  drawNodes(ctx)

  ctx.restore()

  animFrameId = requestAnimationFrame(drawGraph)
}

function drawGrid(ctx, w, h) {
  const gridSize = 20 * canvasState.zoom
  const majorGridSize = gridSize * 5

  ctx.strokeStyle = '#1a1a30'
  ctx.lineWidth = 1

  const startX = canvasState.offsetX % gridSize
  const startY = canvasState.offsetY % gridSize

  for (let x = startX; x < w; x += gridSize) {
    ctx.beginPath()
    ctx.moveTo(x, 0)
    ctx.lineTo(x, h)
    ctx.stroke()
  }
  for (let y = startY; y < h; y += gridSize) {
    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.lineTo(w, y)
    ctx.stroke()
  }

  ctx.strokeStyle = '#222240'
  const majorStartX = canvasState.offsetX % majorGridSize
  const majorStartY = canvasState.offsetY % majorGridSize

  for (let x = majorStartX; x < w; x += majorGridSize) {
    ctx.beginPath()
    ctx.moveTo(x, 0)
    ctx.lineTo(x, h)
    ctx.stroke()
  }
  for (let y = majorStartY; y < h; y += majorGridSize) {
    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.lineTo(w, y)
    ctx.stroke()
  }
}

function drawLinks(ctx) {
  for (const link of nodeStore.links) {
    const sourceNode = nodeStore.nodes.find(n => n.id === link.sourceId)
    const targetNode = nodeStore.nodes.find(n => n.id === link.targetId)
    if (!sourceNode || !targetNode) continue

    const sx = sourceNode.position.x + NODE_WIDTH
    const sy = sourceNode.position.y + HEADER_HEIGHT + 14 + link.sourceSlot * SLOT_SPACING
    const tx = targetNode.position.x
    const ty = targetNode.position.y + HEADER_HEIGHT + 14 + link.targetSlot * SLOT_SPACING

    const cpOffset = Math.max(50, Math.abs(tx - sx) * 0.5)

    const linkColor = getPortColor(link.sourceId, link.sourceSlot, 'output')
    ctx.strokeStyle = linkColor
    ctx.lineWidth = 2 / canvasState.zoom
    ctx.beginPath()
    ctx.moveTo(sx, sy)
    ctx.bezierCurveTo(sx + cpOffset, sy, tx - cpOffset, ty, tx, ty)
    ctx.stroke()
  }

  // Draw connecting line if active
  if (canvasState.isConnecting && canvasState.connectFromNode) {
    const sourceNode = nodeStore.nodes.find(n => n.id === canvasState.connectFromNode)
    if (sourceNode) {
      let sx, sy
      if (canvasState.connectFromType === 'output') {
        sx = sourceNode.position.x + NODE_WIDTH
        sy = sourceNode.position.y + HEADER_HEIGHT + 14 + canvasState.connectFromSlot * SLOT_SPACING
      } else {
        sx = sourceNode.position.x
        sy = sourceNode.position.y + HEADER_HEIGHT + 14 + canvasState.connectFromSlot * SLOT_SPACING
      }

      const worldMouse = screenToWorld(canvasState.connectMouseX, canvasState.connectMouseY)
      const cpOffset = Math.max(50, Math.abs(worldMouse.x - sx) * 0.5)

      ctx.strokeStyle = 'rgba(83, 82, 237, 0.8)'
      ctx.lineWidth = 2 / canvasState.zoom
      ctx.setLineDash([5 / canvasState.zoom, 5 / canvasState.zoom])
      ctx.beginPath()
      ctx.moveTo(sx, sy)
      ctx.bezierCurveTo(sx + cpOffset, sy, worldMouse.x - cpOffset, worldMouse.y, worldMouse.x, worldMouse.y)
      ctx.stroke()
      ctx.setLineDash([])
    }
  }
}

function drawNodes(ctx) {
  for (const node of nodeStore.nodes) {
    const x = node.position.x
    const y = node.position.y

    const inputCount = node.inputs?.length || 0
    const outputCount = node.outputs?.length || 0
    const height = Math.max(40, Math.max(inputCount, outputCount) * SLOT_SPACING + HEADER_HEIGHT + 14)

    const colors = nodeColors[node.category] || nodeColors.general
    const isSelected = node.id === nodeStore.selectedNodeId

    // Node background
    ctx.fillStyle = colors.bg
    ctx.strokeStyle = isSelected ? '#5352ed' : colors.border
    ctx.lineWidth = isSelected ? 2 / canvasState.zoom : 1 / canvasState.zoom

    drawRoundRect(ctx, x, y, NODE_WIDTH, height, 6 / canvasState.zoom)
    ctx.fill()
    ctx.stroke()

    // Title bar
    ctx.fillStyle = colors.border + '40'
    drawRoundRectTop(ctx, x, y, NODE_WIDTH, HEADER_HEIGHT, 6 / canvasState.zoom)
    ctx.fill()

    // Title text
    ctx.fillStyle = '#e0e0f0'
    ctx.font = `${11 / canvasState.zoom}px "Segoe UI", sans-serif`
    ctx.fillText(node.title, x + 10 / canvasState.zoom, y + 17 / canvasState.zoom)

    // Input slots
    for (let i = 0; i < inputCount; i++) {
      const slotY = y + HEADER_HEIGHT + 14 + i * SLOT_SPACING
      ctx.fillStyle = '#5352ed'
      ctx.beginPath()
      ctx.arc(x, slotY, SLOT_RADIUS, 0, Math.PI * 2)
      ctx.fill()

      // Slot label
      if (node.inputs[i]) {
        ctx.fillStyle = '#9090b0'
        ctx.font = `${9 / canvasState.zoom}px "Segoe UI", sans-serif`
        ctx.fillText(node.inputs[i], x + 10 / canvasState.zoom, slotY + 3 / canvasState.zoom)
      }
    }

    // Output slots
    for (let i = 0; i < outputCount; i++) {
      const slotY = y + HEADER_HEIGHT + 14 + i * SLOT_SPACING
      ctx.fillStyle = '#51cf66'
      ctx.beginPath()
      ctx.arc(x + NODE_WIDTH, slotY, SLOT_RADIUS, 0, Math.PI * 2)
      ctx.fill()

      // Slot label
      if (node.outputs[i]) {
        ctx.fillStyle = '#9090b0'
        ctx.font = `${9 / canvasState.zoom}px "Segoe UI", sans-serif`
        const text = node.outputs[i]
        const tw = ctx.measureText(text).width
        ctx.fillText(text, x + NODE_WIDTH - tw - 10 / canvasState.zoom, slotY + 3 / canvasState.zoom)
      }
    }
  }
}

function drawRoundRect(ctx, x, y, w, h, r) {
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

function drawRoundRectTop(ctx, x, y, w, h, r) {
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

// ---- Mouse handlers ----
function onMouseDown(e) {
  const rect = graphCanvasRef.value.getBoundingClientRect()
  const mx = e.clientX - rect.left
  const my = e.clientY - rect.top
  const worldPos = screenToWorld(mx, my)

  if (e.button === 1 || (e.button === 0 && e.altKey)) {
    // Middle click or alt+click = pan
    canvasState.isPanning = true
    canvasState.panStartX = e.clientX - canvasState.offsetX
    canvasState.panStartY = e.clientY - canvasState.offsetY
    return
  }

  if (e.button === 0) {
    closeContextMenu()

    // First check if clicking on a slot (for connecting)
    const slotHit = hitTestSlot(worldPos.x, worldPos.y)
    if (slotHit) {
      canvasState.isConnecting = true
      canvasState.connectFromNode = slotHit.node.id
      canvasState.connectFromSlot = slotHit.slotIndex
      canvasState.connectFromType = slotHit.slotType
      canvasState.connectMouseX = mx
      canvasState.connectMouseY = my
      return
    }

    // Check if clicking on a node
    const clickedNode = hitTestNode(worldPos.x, worldPos.y)
    if (clickedNode) {
      nodeStore.selectNode(clickedNode.id)
      canvasState.isDraggingNode = true
      canvasState.dragNodeId = clickedNode.id
      canvasState.dragStartX = worldPos.x - clickedNode.position.x
      canvasState.dragStartY = worldPos.y - clickedNode.position.y
    } else {
      nodeStore.deselectNode()
    }
  }
}

function onMouseMove(e) {
  const rect = graphCanvasRef.value.getBoundingClientRect()
  const mx = e.clientX - rect.left
  const my = e.clientY - rect.top

  if (canvasState.isPanning) {
    canvasState.offsetX = e.clientX - canvasState.panStartX
    canvasState.offsetY = e.clientY - canvasState.panStartY
  }

  if (canvasState.isDraggingNode && canvasState.dragNodeId) {
    const worldPos = screenToWorld(mx, my)
    const node = nodeStore.nodes.find(n => n.id === canvasState.dragNodeId)
    if (node) {
      node.position.x = worldPos.x - canvasState.dragStartX
      node.position.y = worldPos.y - canvasState.dragStartY
      nodeStore.markDirty()
    }
  }

  if (canvasState.isConnecting) {
    canvasState.connectMouseX = mx
    canvasState.connectMouseY = my
  }
}

function onMouseUp(e) {
  const rect = graphCanvasRef.value.getBoundingClientRect()
  const mx = e.clientX - rect.left
  const my = e.clientY - rect.top

  // If connecting, check if we released on a compatible slot
  if (canvasState.isConnecting && canvasState.connectFromNode) {
    const worldPos = screenToWorld(mx, my)
    const slotHit = hitTestSlot(worldPos.x, worldPos.y)

    if (slotHit && slotHit.node.id !== canvasState.connectFromNode) {
      // Determine source and target
      let sourceId, sourceSlot, targetId, targetSlot

      if (canvasState.connectFromType === 'output' && slotHit.slotType === 'input') {
        sourceId = canvasState.connectFromNode
        sourceSlot = canvasState.connectFromSlot
        targetId = slotHit.node.id
        targetSlot = slotHit.slotIndex
      } else if (canvasState.connectFromType === 'input' && slotHit.slotType === 'output') {
        sourceId = slotHit.node.id
        sourceSlot = slotHit.slotIndex
        targetId = canvasState.connectFromNode
        targetSlot = canvasState.connectFromSlot
      }

      if (sourceId && targetId) {
        // Cycle detection
        if (wouldCreateCycle(sourceId, targetId)) {
          // Don't create cyclic connection
          canvasState.isPanning = false
          canvasState.isDraggingNode = false
          canvasState.dragNodeId = null
          canvasState.isConnecting = false
          canvasState.connectFromNode = null
          canvasState.connectFromSlot = null
          return
        }

        // Connection type validation - check if source output and target input are compatible
        const sourceNode = nodeStore.nodes.find(n => n.id === sourceId)
        const targetNode = nodeStore.nodes.find(n => n.id === targetId)
        if (sourceNode && targetNode) {
          const sourcePortName = sourceNode.outputs?.[sourceSlot] || ''
          const targetPortName = targetNode.inputs?.[targetSlot] || ''
          const sourceColor = getPortColor(sourceId, sourceSlot, 'output')
          const targetColor = getPortColor(targetId, targetSlot, 'input')
          // Allow connection if both are default color or both have specific colors
          if (sourceColor !== 'rgba(83, 82, 237, 0.6)' && targetColor !== 'rgba(83, 82, 237, 0.6)' && sourceColor !== targetColor) {
            // Type mismatch - skip
          }
        }

        // Remove existing link to the same input slot (one input = one connection)
        const existingLink = nodeStore.links.find(l => l.targetId === targetId && l.targetSlot === targetSlot)
        if (existingLink) {
          nodeStore.removeLink(existingLink.id)
        }

        nodeStore.addLink({ sourceId, sourceSlot, targetId, targetSlot })
      }
    }
  }

  canvasState.isPanning = false
  canvasState.isDraggingNode = false
  canvasState.dragNodeId = null
  canvasState.isConnecting = false
  canvasState.connectFromNode = null
  canvasState.connectFromSlot = null
}

function onWheel(e) {
  e.preventDefault()
  const rect = graphCanvasRef.value.getBoundingClientRect()
  const mx = e.clientX - rect.left
  const my = e.clientY - rect.top

  const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1
  const newZoom = Math.max(0.1, Math.min(5, canvasState.zoom * zoomFactor))

  canvasState.offsetX = mx - (mx - canvasState.offsetX) * (newZoom / canvasState.zoom)
  canvasState.offsetY = my - (my - canvasState.offsetY) * (newZoom / canvasState.zoom)
  canvasState.zoom = newZoom
}

// ---- Delete selected node ----
function onKeyDown(e) {
  if (['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return

  if ((e.key === 'Delete' || e.key === 'Backspace') && nodeStore.selectedNodeId) {
    e.stopPropagation()  // 阻止冒泡到全局快捷键处理器，避免同时删除场景物体
    nodeStore.removeNode(nodeStore.selectedNodeId)
  }
}

onMounted(() => {
  nextTick(() => {
    // Add default demo nodes (using registry-compatible types)
    nodeStore.addNode({ type: 'primitive_cube', title: 'Cube', category: 'geometry_input', position: { x: 50, y: 50 }, properties: { width: 1, height: 1, depth: 1 }, inputs: [], outputs: ['geometry'] })
    nodeStore.addNode({ type: 'op_transform', title: 'Transform', category: 'geometry_op', position: { x: 280, y: 50 }, properties: { tx: 0, ty: 0, tz: 0 }, inputs: ['mesh_in', 'position', 'rotation', 'scale'], outputs: ['mesh_out'] })
    nodeStore.addNode({ type: 'scene_output', title: 'Scene Output', category: 'scene_output', position: { x: 510, y: 80 }, properties: {}, inputs: ['geometry', 'material', 'transform'], outputs: [] })
    nodeStore.addNode({ type: 'anim_time', title: 'Time', category: 'animation', position: { x: 50, y: 200 }, properties: { speed: 1, offset: 0 }, inputs: [], outputs: ['time', 'delta'] })
    nodeStore.addNode({ type: 'logic_math', title: 'Math (Sin)', category: 'logic', position: { x: 280, y: 200 }, properties: { operation: 'sin', a: 0, b: 0 }, inputs: ['a', 'b'], outputs: ['result'] })
    nodeStore.addNode({ type: 'param_float', title: 'Float (2.0)', category: 'param_input', position: { x: 50, y: 320 }, properties: { value: 2.0 }, inputs: [], outputs: ['value'] })

    // Auto link some nodes
    const nodes = nodeStore.nodes
    if (nodes.length >= 6) {
      nodeStore.addLink({ sourceId: nodes[0].id, sourceSlot: 0, targetId: nodes[1].id, targetSlot: 0 })
      nodeStore.addLink({ sourceId: nodes[1].id, sourceSlot: 0, targetId: nodes[2].id, targetSlot: 0 })
      nodeStore.addLink({ sourceId: nodes[3].id, sourceSlot: 0, targetId: nodes[4].id, targetSlot: 0 })
    }

    const canvas = graphCanvasRef.value
    if (canvas) {
      canvas.addEventListener('mousedown', onMouseDown)
      canvas.addEventListener('mousemove', onMouseMove)
      canvas.addEventListener('mouseup', onMouseUp)
      canvas.addEventListener('wheel', onWheel, { passive: false })
      canvas.addEventListener('mouseleave', onMouseUp)
    }

    // Keyboard handling moved to template @keydown (with tabindex="0" on the container)

    // 点击编辑器外部时关闭右键菜单
    function onDocumentClick(e) {
      if (canvasRef.value && !canvasRef.value.contains(e.target)) {
        closeContextMenu()
      }
    }
    document.addEventListener('click', onDocumentClick)
    // 存储到模块级变量，确保 onUnmounted 能可靠清理
    _docClickHandler = onDocumentClick

    drawGraph()
  })
})

onUnmounted(() => {
  if (animFrameId) cancelAnimationFrame(animFrameId)
  const canvas = graphCanvasRef.value
  if (canvas) {
    canvas.removeEventListener('mousedown', onMouseDown)
    canvas.removeEventListener('mousemove', onMouseMove)
    canvas.removeEventListener('mouseup', onMouseUp)
    canvas.removeEventListener('wheel', onWheel)
  }
  // 清理 document 点击监听（使用模块级变量，避免 canvasRef.value 为 null 导致泄漏）
  if (_docClickHandler) {
    document.removeEventListener('click', _docClickHandler)
    _docClickHandler = null
  }
  // Keyboard cleanup handled by Vue template @keydown binding
})
</script>

<style scoped>
.node-editor {
  width: 100%;
  height: 100%;
  position: relative;
  overflow: hidden;
  cursor: grab;
  outline: none;
}

.node-editor:active {
  cursor: grabbing;
}

.graph-canvas {
  display: block;
  width: 100%;
  height: 100%;
}

.node-editor-info {
  position: absolute;
  bottom: 6px;
  left: 8px;
  font-size: 10px;
  color: var(--editor-text-muted);
  pointer-events: none;
}

/* Context Menu */
.context-menu {
  position: absolute;
  background: var(--editor-bg-panel);
  border: 1px solid var(--editor-border);
  border-radius: 6px;
  padding: 4px 0;
  min-width: 200px;
  max-height: 400px;
  overflow-y: auto;
  z-index: 1000;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
}

.context-menu-title {
  padding: 8px 12px 4px;
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--editor-text-muted);
}

.context-menu-group {
  border-top: 1px solid var(--editor-border);
}

.context-menu-group:first-of-type {
  border-top: none;
}

.context-group-label {
  padding: 6px 12px 2px;
  font-size: 10px;
  font-weight: 600;
  color: var(--editor-text-secondary);
}

.context-menu-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 12px;
  font-size: 11px;
  color: var(--editor-text-primary);
  cursor: pointer;
  transition: background 0.1s;
}

.context-menu-item:hover {
  background: var(--editor-bg-hover);
}

.context-menu-divider {
  height: 1px;
  background: var(--editor-border);
  margin: 4px 0;
}
</style>
