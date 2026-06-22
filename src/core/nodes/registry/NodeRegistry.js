/**
 * 节点注册中心 - NodeRegistry
 * 集中管理所有节点类型定义，提供创建/查询/分类能力
 */

class NodeRegistry {
  constructor() {
    this._types = new Map()   // typeId → typeDefinition
    this._categories = new Map() // categoryId → { label, types[] }
  }

  /** 注册节点类型 */
  registerType(def) {
    if (!def.typeId) throw new Error('Node type must have a typeId')
    this._types.set(def.typeId, def)

    // 自动归入分类
    const cat = def.category || 'general'
    if (!this._categories.has(cat)) {
      this._categories.set(cat, { label: cat, types: [] })
    }
    const catGroup = this._categories.get(cat)
    if (!catGroup.types.find(t => t.typeId === def.typeId)) {
      catGroup.types.push(def)
    }
  }

  /** 批量注册 */
  registerTypes(defs) {
    defs.forEach(d => this.registerType(d))
  }

  /** 根据 typeId 创建节点实例 */
  createNode(typeId, overrides = {}) {
    const typeDef = this._types.get(typeId)
    if (!typeDef) {
      console.warn(`[NodeRegistry] Unknown type: "${typeId}"`)
      return null
    }
    return {
      id: `node_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      typeId,
      title: typeDef.label || typeId,
      category: typeDef.category || 'general',
      position: overrides.position || { x: 0, y: 0 },
      inputs: typeDef.inputs || [],
      outputs: typeDef.outputs || [],
      properties: { ...(typeDef.defaultProperties || {}), ...(overrides.properties || {}) },
      compute: typeDef.compute || null,
      ...overrides
    }
  }

  /** 查询节点类型定义 */
  getType(typeId) { return this._types.get(typeId) }

  /** 获取所有分类 */
  getCategories() {
    return Array.from(this._categories.values())
  }

  /** 获取指定分类下的节点类型 */
  getTypesByCategory(category) {
    const cat = this._categories.get(category)
    return cat ? cat.types : []
  }

  /** 获取所有已注册类型 */
  getAllTypes() {
    return Array.from(this._types.values())
  }
}

const nodeRegistry = new NodeRegistry()

// ========================================
// 注册内置节点类型（按技术文档节点体系）
// ========================================

nodeRegistry.registerTypes([
  // ---- 几何输入 ----
  {
    typeId: 'primitive_cube', category: 'geometry_input', label: 'Cube',
    icon: 'check_box_outline_blank', color: '#339af0',
    inputs: [], outputs: [{ name: 'geometry', type: 'geometry' }],
    defaultProperties: { width: 1, height: 1, depth: 1 },
    compute(inputs, cache) {
      const props = this.properties
      return { geometry: { type: 'box', params: { width: props.width, height: props.height, depth: props.depth } } }
    }
  },
  {
    typeId: 'primitive_sphere', category: 'geometry_input', label: 'Sphere',
    icon: 'circle', color: '#339af0',
    inputs: [], outputs: [{ name: 'geometry', type: 'geometry' }],
    defaultProperties: { radius: 0.5, segments: 32 },
    compute(inputs, cache) {
      const props = this.properties
      return { geometry: { type: 'sphere', params: { radius: props.radius, widthSegments: props.segments, heightSegments: props.segments } } }
    }
  },
  {
    typeId: 'primitive_cylinder', category: 'geometry_input', label: 'Cylinder',
    icon: 'view_column', color: '#339af0',
    inputs: [], outputs: [{ name: 'geometry', type: 'geometry' }],
    defaultProperties: { radius: 0.5, height: 1, segments: 32 },
    compute(inputs, cache) {
      const props = this.properties
      return { geometry: { type: 'cylinder', params: { radiusTop: props.radius, radiusBottom: props.radius, height: props.height, segments: props.segments } } }
    }
  },
  {
    typeId: 'primitive_plane', category: 'geometry_input', label: 'Plane',
    icon: 'crop_square', color: '#339af0',
    inputs: [], outputs: [{ name: 'geometry', type: 'geometry' }],
    defaultProperties: { width: 2, height: 2 },
    compute(inputs, cache) {
      const props = this.properties
      return { geometry: { type: 'plane', params: { width: props.width, height: props.height } } }
    }
  },
  {
    typeId: 'import_model', category: 'geometry_input', label: 'Import Model',
    icon: 'file_open', color: '#339af0',
    inputs: [], outputs: [{ name: 'geometry', type: 'geometry' }],
    defaultProperties: { filePath: '' },
    compute(inputs, cache) {
      const props = this.properties
      return { geometry: { type: 'model', filePath: props.filePath } }
    }
  },
  {
    typeId: 'static_model', category: 'geometry_input', label: 'Static Model',
    icon: 'inventory_2', color: '#339af0',
    inputs: [], outputs: [{ name: 'geometry', type: 'geometry' }],
    defaultProperties: {},
    compute(inputs, cache) {
      return { geometry: { type: 'static' } }
    }
  },

  // ---- 几何操作 ----
  {
    typeId: 'op_extrude', category: 'geometry_op', label: 'Extrude',
    icon: 'arrow_upward', color: '#fcc419',
    inputs: [{ name: 'mesh_in', type: 'geometry' }, { name: 'amount', type: 'float' }, { name: 'selection', type: 'selection_set' }],
    outputs: [{ name: 'mesh_out', type: 'geometry' }],
    defaultProperties: { amount: 0.5 },
    compute(inputs, cache) {
      const geom = inputs.mesh_in || { type: 'box' }
      const amount = inputs.amount ?? this.properties.amount
      return { mesh_out: { ...geom, extrude: amount, op: 'extrude' } }
    }
  },
  {
    typeId: 'op_bevel', category: 'geometry_op', label: 'Bevel',
    icon: 'rounded_corner', color: '#fcc419',
    inputs: [{ name: 'mesh_in', type: 'geometry' }, { name: 'radius', type: 'float' }, { name: 'segments', type: 'int' }],
    outputs: [{ name: 'mesh_out', type: 'geometry' }],
    defaultProperties: { radius: 0.1, segments: 3 },
    compute(inputs, cache) {
      const geom = inputs.mesh_in || { type: 'box' }
      const radius = inputs.radius ?? this.properties.radius
      const segments = inputs.segments ?? this.properties.segments
      return { mesh_out: { ...geom, bevelRadius: radius, bevelSegments: segments, op: 'bevel' } }
    }
  },
  {
    typeId: 'op_boolean', category: 'geometry_op', label: 'Boolean',
    icon: 'join_inner', color: '#fcc419',
    inputs: [{ name: 'mesh_a', type: 'geometry' }, { name: 'mesh_b', type: 'geometry' }, { name: 'operation', type: 'string' }],
    outputs: [{ name: 'mesh_out', type: 'geometry' }],
    defaultProperties: { operation: 'union' },
    compute(inputs, cache) {
      const geomA = inputs.mesh_a || { type: 'box' }
      const geomB = inputs.mesh_b || { type: 'sphere' }
      const operation = inputs.operation ?? this.properties.operation
      return { mesh_out: { type: 'boolean', sourceA: geomA, sourceB: geomB, operation, op: 'boolean' } }
    }
  },
  {
    typeId: 'op_merge', category: 'geometry_op', label: 'Merge',
    icon: 'merge_type', color: '#fcc419',
    inputs: [{ name: 'mesh_a', type: 'geometry' }, { name: 'mesh_b', type: 'geometry' }],
    outputs: [{ name: 'mesh_out', type: 'geometry' }],
    defaultProperties: {},
    compute(inputs, cache) {
      const geomA = inputs.mesh_a || { type: 'box' }
      const geomB = inputs.mesh_b || { type: 'box' }
      return { mesh_out: { type: 'merge', sources: [geomA, geomB], op: 'merge' } }
    }
  },
  {
    typeId: 'op_transform', category: 'geometry_op', label: 'Transform',
    icon: 'open_with', color: '#fcc419',
    inputs: [{ name: 'mesh_in', type: 'geometry' }, { name: 'position', type: 'vec3' }, { name: 'rotation', type: 'vec3' }, { name: 'scale', type: 'vec3' }],
    outputs: [{ name: 'mesh_out', type: 'geometry' }],
    defaultProperties: { tx: 0, ty: 0, tz: 0, rx: 0, ry: 0, rz: 0, sx: 1, sy: 1, sz: 1 },
    compute(inputs, cache) {
      const geom = inputs.mesh_in || { type: 'box' }
      const pos = inputs.position || { x: this.properties.tx, y: this.properties.ty, z: this.properties.tz }
      const rot = inputs.rotation || { x: this.properties.rx, y: this.properties.ry, z: this.properties.rz }
      const scl = inputs.scale || { x: this.properties.sx, y: this.properties.sy, z: this.properties.sz }
      return { mesh_out: { ...geom, transform: { position: pos, rotation: rot, scale: scl }, op: 'transform' } }
    }
  },

  // ---- 场景输出 ----
  {
    typeId: 'scene_output', category: 'scene_output', label: 'Scene Output',
    icon: 'output', color: '#51cf66',
    inputs: [{ name: 'geometry', type: 'geometry' }, { name: 'material', type: 'material' }, { name: 'transform', type: 'transform' }],
    outputs: [],
    defaultProperties: {},
    compute(inputs, cache) {
      return { output: { geometry: inputs.geometry, material: inputs.material, transform: inputs.transform } }
    }
  },

  // ---- 参数输入 ----
  {
    typeId: 'param_float', category: 'param_input', label: 'Float Value',
    icon: 'tag', color: '#22b8cf',
    inputs: [], outputs: [{ name: 'value', type: 'float' }],
    defaultProperties: { value: 0 },
    compute(inputs, cache) {
      return { value: parseFloat(this.properties.value) || 0 }
    }
  },
  {
    typeId: 'param_vec3', category: 'param_input', label: 'Vector3',
    icon: '3d_rotation', color: '#22b8cf',
    inputs: [], outputs: [{ name: 'vector', type: 'vec3' }],
    defaultProperties: { x: 0, y: 0, z: 0 },
    compute(inputs, cache) {
      const props = this.properties
      return { vector: { x: parseFloat(props.x) || 0, y: parseFloat(props.y) || 0, z: parseFloat(props.z) || 0 } }
    }
  },
  {
    typeId: 'param_color', category: 'param_input', label: 'Color',
    icon: 'color_lens', color: '#22b8cf',
    inputs: [], outputs: [{ name: 'color', type: 'color' }],
    defaultProperties: { r: 1, g: 0, b: 0 },
    compute(inputs, cache) {
      const props = this.properties
      return { color: { r: parseFloat(props.r) || 0, g: parseFloat(props.g) || 0, b: parseFloat(props.b) || 0 } }
    }
  },
  {
    typeId: 'param_texture', category: 'param_input', label: 'Texture',
    icon: 'image', color: '#22b8cf',
    inputs: [], outputs: [{ name: 'texture', type: 'texture' }],
    defaultProperties: { filePath: '' },
    compute(inputs, cache) {
      return { texture: { filePath: this.properties.filePath } }
    }
  },
  {
    typeId: 'param_selection_set', category: 'param_input', label: 'Selection Set',
    icon: 'select_all', color: '#22b8cf',
    inputs: [], outputs: [{ name: 'selection', type: 'selection_set' }],
    defaultProperties: {},
    compute(inputs, cache) {
      return { selection: { type: 'all' } }
    }
  },

  // ---- 逻辑运算 ----
  {
    typeId: 'logic_math', category: 'logic', label: 'Math',
    icon: 'calculate', color: '#ff922b',
    inputs: [{ name: 'a', type: 'float' }, { name: 'b', type: 'float' }],
    outputs: [{ name: 'result', type: 'float' }],
    defaultProperties: { operation: 'add', a: 0, b: 0 },
    compute(inputs, cache) {
      const a = inputs.a ?? parseFloat(this.properties.a) ?? 0
      const b = inputs.b ?? parseFloat(this.properties.b) ?? 0
      const op = this.properties.operation || 'add'
      let result = 0
      switch (op) {
        case 'add': result = a + b; break
        case 'subtract': result = a - b; break
        case 'multiply': result = a * b; break
        case 'divide': result = b !== 0 ? a / b : 0; break
        case 'power': result = Math.pow(a, b); break
        case 'modulo': result = b !== 0 ? a % b : 0; break
        case 'min': result = Math.min(a, b); break
        case 'max': result = Math.max(a, b); break
        default: result = a + b
      }
      return { result }
    }
  },
  {
    typeId: 'logic_condition', category: 'logic', label: 'Condition',
    icon: 'call_split', color: '#ff922b',
    inputs: [{ name: 'condition', type: 'bool' }, { name: 'true_val', type: 'float' }, { name: 'false_val', type: 'float' }],
    outputs: [{ name: 'result', type: 'float' }],
    defaultProperties: { operator: '>' },
    compute(inputs, cache) {
      const cond = inputs.condition ?? 0
      const trueVal = inputs.true_val ?? 1
      const falseVal = inputs.false_val ?? 0
      return { result: cond ? trueVal : falseVal }
    }
  },
  {
    typeId: 'logic_curve', category: 'logic', label: 'Curve',
    icon: 'show_chart', color: '#ff922b',
    inputs: [{ name: 'input', type: 'float' }],
    outputs: [{ name: 'output', type: 'float' }],
    defaultProperties: { curveType: 'bezier' },
    compute(inputs, cache) {
      const v = inputs.input ?? 0
      const type = this.properties.curveType || 'linear'
      let result = v
      switch (type) {
        case 'smoothstep': result = v * v * (3 - 2 * v); break
        case 'smootherstep': result = v * v * v * (v * (v * 6 - 15) + 10); break
        case 'ease_in': result = v * v * v; break
        case 'ease_out': result = 1 - Math.pow(1 - v, 3); break
        default: result = v
      }
      return { output: Math.max(0, Math.min(1, result)) }
    }
  },
  {
    typeId: 'logic_expression', category: 'logic', label: 'Expression',
    icon: 'functions', color: '#ff922b',
    inputs: [{ name: 't', type: 'float' }, { name: 'frame', type: 'int' }],
    outputs: [{ name: 'result', type: 'float' }],
    defaultProperties: { expression: 'sin(t * 2)' },
    compute(inputs, cache) {
      const t = inputs.t ?? 0
      const frame = inputs.frame ?? 0
      try {
        const expr = this.properties.expression || '0'
        const fn = new Function('t', 'frame', 'sin', 'cos', 'abs', 'sqrt', 'PI', `return ${expr}`)
        const result = fn(t, frame, Math.sin, Math.cos, Math.abs, Math.sqrt, Math.PI)
        return { result: isFinite(result) ? result : 0 }
      } catch (e) {
        return { result: 0 }
      }
    }
  },

  // ---- 动画控制 ----
  {
    typeId: 'anim_time', category: 'animation', label: 'Time',
    icon: 'schedule', color: '#845ef7',
    inputs: [], outputs: [{ name: 'time', type: 'float' }, { name: 'delta', type: 'float' }],
    defaultProperties: { speed: 1, offset: 0 },
    compute(inputs, cache) {
      const speed = parseFloat(this.properties.speed) || 1
      const offset = parseFloat(this.properties.offset) || 0
      const now = performance.now() / 1000
      const time = (now * speed) + offset
      return { time, delta: 1 / 30 }
    }
  },
  {
    typeId: 'anim_formula', category: 'animation', label: 'Formula',
    icon: 'functions', color: '#845ef7',
    inputs: [{ name: 't', type: 'float' }],
    outputs: [{ name: 'result', type: 'float' }],
    defaultProperties: { expression: 'sin(t * 2)' },
    compute(inputs, cache) {
      const t = inputs.t ?? 0
      try {
        const expr = this.properties.expression || '0'
        const fn = new Function('t', 'sin', 'cos', 'abs', 'sqrt', 'PI', `return ${expr}`)
        const result = fn(t, Math.sin, Math.cos, Math.abs, Math.sqrt, Math.PI)
        return { result: isFinite(result) ? result : 0 }
      } catch (e) {
        return { result: 0 }
      }
    }
  },
  {
    typeId: 'anim_keyframe', category: 'animation', label: 'Keyframe',
    icon: 'straighten', color: '#845ef7',
    inputs: [{ name: 'time', type: 'float' }],
    outputs: [{ name: 'value', type: 'float' }],
    defaultProperties: { keyframes: [] },
    compute(inputs, cache) {
      const t = inputs.t ?? 0
      const keyframes = this.properties.keyframes || []
      if (keyframes.length === 0) return { value: 0 }
      if (keyframes.length === 1) return { value: keyframes[0].value }

      // 找到时间点两侧的关键帧进行线性插值
      if (t <= keyframes[0].frame) return { value: keyframes[0].value }
      if (t >= keyframes[keyframes.length - 1].frame) return { value: keyframes[keyframes.length - 1].value }

      for (let i = 0; i < keyframes.length - 1; i++) {
        if (t >= keyframes[i].frame && t <= keyframes[i + 1].frame) {
          const t0 = keyframes[i].frame
          const t1 = keyframes[i + 1].frame
          const v0 = keyframes[i].value
          const v1 = keyframes[i + 1].value
          const alpha = (t1 - t0) > 0 ? (t - t0) / (t1 - t0) : 0
          return { value: v0 + (v1 - v0) * alpha }
        }
      }
      return { value: 0 }
    }
  },

  // ---- 展示面板 ----
  {
    typeId: 'panel_data', category: 'display_panel', label: 'Data Panel',
    icon: 'dashboard', color: '#20c997',
    inputs: [{ name: 'value', type: 'float' }, { name: 'label', type: 'string' }],
    outputs: [{ name: 'panel', type: 'display_panel' }],
    defaultProperties: { panelType: 'value_card', fontSize: 14 },
    compute(inputs, cache) {
      return { panel: { type: 'value_card', value: inputs.value ?? 0, label: inputs.label ?? '', fontSize: this.properties.fontSize } }
    }
  },
  {
    typeId: 'panel_text', category: 'display_panel', label: 'Text Label',
    icon: 'label', color: '#20c997',
    inputs: [{ name: 'text', type: 'string' }],
    outputs: [{ name: 'panel', type: 'display_panel' }],
    defaultProperties: { text: 'Label', fontSize: 12 },
    compute(inputs, cache) {
      return { panel: { type: 'text_label', text: inputs.text ?? this.properties.text, fontSize: this.properties.fontSize } }
    }
  },
  {
    typeId: 'panel_chart', category: 'display_panel', label: 'Chart Panel',
    icon: 'show_chart', color: '#20c997',
    inputs: [{ name: 'data', type: 'array' }],
    outputs: [{ name: 'panel', type: 'display_panel' }],
    defaultProperties: { chartType: 'line' },
    compute(inputs, cache) {
      return { panel: { type: 'chart', data: inputs.data ?? [], chartType: this.properties.chartType } }
    }
  },
  {
    typeId: 'panel_status', category: 'display_panel', label: 'Status Indicator',
    icon: 'indicator', color: '#20c997',
    inputs: [{ name: 'value', type: 'float' }, { name: 'threshold', type: 'float' }],
    outputs: [{ name: 'panel', type: 'display_panel' }],
    defaultProperties: { warnThreshold: 80, errorThreshold: 95 },
    compute(inputs, cache) {
      const value = inputs.value ?? 0
      const warnThreshold = inputs.threshold ?? this.properties.warnThreshold
      const errorThreshold = this.properties.errorThreshold
      return { panel: { type: 'status', value, warnThreshold, errorThreshold } }
    }
  },

  // ---- 实例化 ----
  {
    typeId: 'instance', category: 'instancing', label: 'Instance',
    icon: 'grid_view', color: '#a9e34b',
    inputs: [{ name: 'mesh', type: 'geometry' }, { name: 'count', type: 'int' }, { name: 'transforms', type: 'array' }],
    outputs: [{ name: 'instances', type: 'instanced_mesh' }],
    defaultProperties: { count: 10 },
    compute(inputs, cache) {
      const geom = inputs.mesh || { type: 'box' }
      const count = inputs.count ?? parseInt(this.properties.count) ?? 10
      return { instances: { ...geom, instanced: true, count } }
    }
  },
  {
    typeId: 'array', category: 'instancing', label: 'Array',
    icon: 'view_module', color: '#a9e34b',
    inputs: [{ name: 'mesh', type: 'geometry' }, { name: 'count', type: 'int' }, { name: 'offset', type: 'vec3' }],
    outputs: [{ name: 'meshes', type: 'geometry' }],
    defaultProperties: { count: 3, offsetX: 2, offsetY: 0, offsetZ: 0 },
    compute(inputs, cache) {
      const geom = inputs.mesh || { type: 'box' }
      const count = inputs.count ?? parseInt(this.properties.count) ?? 3
      const offset = inputs.offset || { x: parseFloat(this.properties.offsetX) || 2, y: parseFloat(this.properties.offsetY) || 0, z: parseFloat(this.properties.offsetZ) || 0 }
      return { meshes: { ...geom, arrayCount: count, offset, op: 'array' } }
    }
  },

  // ---- Material nodes ----
  {
    typeId: 'material_output', category: 'material', label: 'Material Output',
    icon: 'palette', color: '#f06595',
    inputs: [{ name: 'baseColor', type: 'color' }, { name: 'metallic', type: 'float' }, { name: 'roughness', type: 'float' }, { name: 'emissive', type: 'color' }, { name: 'emissiveIntensity', type: 'float' }, { name: 'opacity', type: 'float' }],
    outputs: [{ name: 'material', type: 'material' }],
    defaultProperties: { metallic: 0.3, roughness: 0.4, emissiveIntensity: 0, opacity: 1 },
    uiSchema: { metallic: { control: 'slider', min: 0, max: 1, step: 0.01, label: 'Metallic' }, roughness: { control: 'slider', min: 0, max: 1, step: 0.01, label: 'Roughness' }, emissiveIntensity: { control: 'slider', min: 0, max: 5, step: 0.1, label: 'Emissive Intensity' }, opacity: { control: 'slider', min: 0, max: 1, step: 0.01, label: 'Opacity' } },
    compute(inputs, cache) { return { material: { type: 'pbr', baseColor: inputs.baseColor || { r: 0.33, g: 0.32, b: 0.93 }, metallic: inputs.metallic ?? this.properties.metallic, roughness: inputs.roughness ?? this.properties.roughness, emissive: inputs.emissive || { r: 0, g: 0, b: 0 }, emissiveIntensity: inputs.emissiveIntensity ?? this.properties.emissiveIntensity, opacity: inputs.opacity ?? this.properties.opacity } } }
  },
  {
    typeId: 'mat_pbr', category: 'material', label: 'PBR Material',
    icon: 'palette', color: '#f06595',
    inputs: [{ name: 'base_color', type: 'color' }, { name: 'metallic', type: 'float' }, { name: 'roughness', type: 'float' }, { name: 'opacity', type: 'float' }],
    outputs: [{ name: 'material_out', type: 'material' }],
    defaultProperties: { color: '#ffffff', metallic: 0.3, roughness: 0.4, opacity: 1 },
    uiSchema: { metallic: { control: 'slider', min: 0, max: 1, step: 0.01, label: 'Metallic' }, roughness: { control: 'slider', min: 0, max: 1, step: 0.01, label: 'Roughness' }, opacity: { control: 'slider', min: 0, max: 1, step: 0.01, label: 'Opacity' } },
    compute(inputs, cache) { const props = this.properties; return { material_out: { type: 'pbr', baseColor: inputs.base_color || { r: 1, g: 1, b: 1 }, metallic: inputs.metallic ?? props.metallic, roughness: inputs.roughness ?? props.roughness, opacity: inputs.opacity ?? props.opacity } } }
  },
  {
    typeId: 'mat_math', category: 'material', label: 'Material Math',
    icon: 'calculate', color: '#f06595',
    inputs: [{ name: 'a', type: 'float' }, { name: 'b', type: 'float' }],
    outputs: [{ name: 'result', type: 'float' }],
    defaultProperties: { operation: 'multiply' },
    uiSchema: { operation: { control: 'select', options: ['add', 'subtract', 'multiply', 'divide', 'power', 'lerp'], label: 'Operation' } },
    compute(inputs, cache) { const a = inputs.a ?? 0; const b = inputs.b ?? 1; const op = this.properties.operation || 'multiply'; let result = 0; switch (op) { case 'add': result = a + b; break; case 'subtract': result = a - b; break; case 'multiply': result = a * b; break; case 'divide': result = b !== 0 ? a / b : 0; break; case 'power': result = Math.pow(a, b); break; case 'lerp': result = a + (b - a) * 0.5; break; default: result = a * b; } return { result: Math.max(0, Math.min(1, result)) } }
  },
  {
    typeId: 'mat_fresnel', category: 'material', label: 'Fresnel',
    icon: 'blur_on', color: '#f06595',
    inputs: [{ name: 'power', type: 'float' }, { name: 'bias', type: 'float' }],
    outputs: [{ name: 'value', type: 'float' }],
    defaultProperties: { power: 5, bias: 1 },
    uiSchema: { power: { control: 'slider', min: 0.1, max: 10, step: 0.1, label: 'Power' }, bias: { control: 'slider', min: 0, max: 2, step: 0.01, label: 'Bias' } },
    compute(inputs, cache) { const power = inputs.power ?? this.properties.power; return { value: Math.pow(1 - Math.abs(0), power) * (inputs.bias ?? this.properties.bias) } }
  },
  {
    typeId: 'mat_noise_texture', category: 'material', label: 'Noise Texture',
    icon: 'grain', color: '#f06595',
    inputs: [{ name: 'scale', type: 'float' }, { name: 'octaves', type: 'int' }],
    outputs: [{ name: 'texture', type: 'texture' }],
    defaultProperties: { scale: 10, octaves: 4 },
    uiSchema: { scale: { control: 'slider', min: 0.1, max: 100, step: 0.5, label: 'Scale' }, octaves: { control: 'slider', min: 1, max: 8, step: 1, label: 'Octaves' } },
    compute(inputs, cache) { return { texture: { type: 'procedural', noiseType: 'perlin', scale: inputs.scale ?? this.properties.scale, octaves: inputs.octaves ?? this.properties.octaves } } }
  },
  {
    typeId: 'mat_texture_sampler', category: 'material', label: 'Texture Sampler',
    icon: 'texture', color: '#f06595',
    inputs: [{ name: 'texture', type: 'texture' }, { name: 'uv_scale', type: 'vec2' }],
    outputs: [{ name: 'color', type: 'color' }, { name: 'alpha', type: 'float' }],
    defaultProperties: { filePath: '' },
    uiSchema: { filePath: { control: 'text', label: 'File Path' } },
    compute(inputs, cache) { return { color: { r: 1, g: 1, b: 1 }, alpha: 1 } }
  },

  // ---- Physics nodes ----
  {
    typeId: 'physics_body', category: 'physics', label: 'Physics Body',
    icon: 'fitness_center', color: '#e8590c',
    inputs: [{ name: 'mesh', type: 'geometry' }],
    outputs: [{ name: 'body_out', type: 'physics_body' }],
    defaultProperties: { bodyType: 'dynamic', mass: 1, restitution: 0.3, friction: 0.5, impostor: 'box' },
    uiSchema: { mass: { control: 'slider', min: 0, max: 100, step: 0.1, label: 'Mass' }, restitution: { control: 'slider', min: 0, max: 1, step: 0.01, label: 'Restitution' }, friction: { control: 'slider', min: 0, max: 1, step: 0.01, label: 'Friction' }, impostor: { control: 'select', options: ['box', 'sphere', 'capsule', 'mesh', 'cylinder'], label: 'Impostor' } },
    compute(inputs, cache) { return { body_out: { bodyType: this.properties.bodyType, mass: this.properties.mass, restitution: this.properties.restitution, friction: this.properties.friction, impostor: this.properties.impostor } } }
  },

  // ---- Particle nodes ----
  {
    typeId: 'particle_emitter', category: 'particles', label: 'Particle Emitter',
    icon: 'blur_on', color: '#ae3ec9',
    inputs: [{ name: 'emitter', type: 'vec3' }],
    outputs: [{ name: 'particle_out', type: 'particles' }],
    defaultProperties: { capacity: 1000, rate: 100, useGPU: false },
    uiSchema: { capacity: { control: 'slider', min: 10, max: 10000, step: 10, label: 'Capacity' }, rate: { control: 'slider', min: 1, max: 1000, step: 1, label: 'Rate' } },
    compute(inputs, cache) { return { particle_out: { capacity: this.properties.capacity, rate: this.properties.rate, useGPU: this.properties.useGPU } } }
  }
])

export default nodeRegistry
export { NodeRegistry }
