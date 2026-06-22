/**
 * 材质编译器 - MaterialCompiler
 * 从节点图/节点 Store 编译 PBR 材质
 */
import { PBRMaterial, PBRMetallicRoughnessMaterial, StandardMaterial, Color3 } from '@babylonjs/core'
import emitter, { MATERIAL_EVENTS, NODE_EVENTS } from '../eventBus.js'
import sceneManager from '../scene/SceneManager.js'
import { evaluateExpression } from './material-utils.js'
import { getMaterialFromCache, setMaterialCache } from './material-cache.js'

class MaterialCompiler {
  constructor() {
    this._scene = null
    this._initialized = false
  }

  init(scene) {
    if (this._initialized) return
    this._scene = scene || sceneManager.scene
    if (!this._scene) {
      console.warn('[MaterialCompiler] No scene available.')
      return
    }
    this._initialized = true
    console.log('[MaterialCompiler] Initialized.')
  }

  /**
   * 从 Pinia nodeStore + nodeEngine 编译材质
   * Adapter that reads the store's reactive nodes/links
   */
  compileFromNodeStore(nodeStore, nodeEngine) {
    if (!this._initialized) return null

    const graphData = {
      nodes: nodeStore.nodes,
      links: nodeStore.links
    }
    return this.compileFromNodeGraph(graphData)
  }

  /**
   * 从节点图数据编译材质
   * Looks for material_output type nodes and traces upstream to resolve parameters
   */
  compileFromNodeGraph(graphData) {
    if (!this._initialized || !graphData) return null

    const { nodes, links } = graphData
    if (!nodes || !links) return null

    // Find material output nodes
    const outputNodes = nodes.filter(n => n.typeId === 'material_output' || n.type === 'material_output')
    if (outputNodes.length === 0) return null

    const results = new Map()

    for (const outputNode of outputNodes) {
      const cacheKey = `mat_output_${outputNode.id}`
      const cached = getMaterialFromCache(cacheKey)
      if (cached) {
        results.set(outputNode.id, cached)
        continue
      }

      // Resolve inputs by traversing links upstream
      const params = this._resolveNodeInputs(outputNode, nodes, links)

      // Create material
      const mat = this._createMaterial(outputNode, params)
      if (mat) {
        setMaterialCache(cacheKey, mat)
        results.set(outputNode.id, mat)
      }
    }

    emitter.emit(MATERIAL_EVENTS.MATERIAL_COMPILED, { count: results.size })
    return results
  }

  _resolveNodeInputs(node, nodes, links) {
    const resolved = {}
    const inputs = node.inputs || []

    for (const input of inputs) {
      // Find link targeting this input slot
      const link = links.find(l => l.targetId === node.id && l.targetSlot === input.name)
      if (!link) continue

      const sourceNode = nodes.find(n => n.id === link.sourceId)
      if (!sourceNode) continue

      // Evaluate source node's output
      const value = this._evaluateNodeOutput(sourceNode, link.sourceSlot, nodes, links)
      resolved[input.name] = value
    }

    return resolved
  }

  _evaluateNodeOutput(node, slotName, nodes, links) {
    // Use nodeEngine cache if available
    const nodeEngine = this._nodeEngine
    if (nodeEngine) {
      const cached = nodeEngine.getCachedResult(node.id)
      if (cached && cached[slotName] !== undefined) return cached[slotName]
    }

    // Fallback: evaluate from properties
    const props = node.properties || {}

    switch (node.typeId || node.type) {
      case 'value': return props.value !== undefined ? props.value : 0
      case 'color':
        return new Color3(
          props.r !== undefined ? props.r : 0.5,
          props.g !== undefined ? props.g : 0.5,
          props.b !== undefined ? props.b : 0.5
        )
      case 'math': {
        const a = props.a || 0
        const b = props.b || 0
        switch (props.operation) {
          case 'add': return a + b
          case 'subtract': return a - b
          case 'multiply': return a * b
          case 'divide': return b !== 0 ? a / b : 0
          default: return a
        }
      }
      case 'texture': return props.textureUrl || null
      case 'mix': {
        const factor = props.factor || 0.5
        // Resolve inputs for A and B
        const inputA = node.inputs?.find(i => i.name === 'a')
        const inputB = node.inputs?.find(i => i.name === 'b')
        let valA = props.a || 0
        let valB = props.b || 0
        if (inputA) {
          const linkA = (node._links || []).find(l => l.targetSlot === 'a')
          if (linkA) valA = this._evaluateNodeOutput(nodes.find(n => n.id === linkA.sourceId), linkA.sourceSlot, nodes, [])
        }
        if (inputB) {
          const linkB = (node._links || []).find(l => l.targetSlot === 'b')
          if (linkB) valB = this._evaluateNodeOutput(nodes.find(n => n.id === linkB.sourceId), linkB.sourceSlot, nodes, [])
        }
        return valA * (1 - factor) + valB * factor
      }
      default: return props[slotName] !== undefined ? props[slotName] : 0
    }
  }

  _createMaterial(outputNode, params) {
    if (!this._scene) return null

    const name = `compiled_mat_${outputNode.id}_${Date.now()}`
    const mat = new PBRMetallicRoughnessMaterial(name, this._scene)

    // Base color
    if (params.baseColor instanceof Color3) {
      mat.baseColor = params.baseColor
    } else if (params.baseColor) {
      const c = params.baseColor
      mat.baseColor = new Color3(c.r || 0.5, c.g || 0.5, c.b || 0.5)
    }

    // Metallic
    mat.metallic = params.metallic !== undefined ? params.metallic : 0.0

    // Roughness
    mat.roughness = params.roughness !== undefined ? params.roughness : 0.5

    // Emissive
    if (params.emissive instanceof Color3) {
      mat.emissiveColor = params.emissive
    } else if (params.emissive) {
      const e = params.emissive
      mat.emissiveColor = new Color3(e.r || 0, e.g || 0, e.b || 0)
    }

    // Alpha
    if (params.alpha !== undefined) {
      mat.alpha = params.alpha
    }

    return mat
  }

  /** Set nodeEngine reference for cache access */
  setNodeEngine(ne) {
    this._nodeEngine = ne
  }

  destroy() {
    this._scene = null
    this._initialized = false
    this._nodeEngine = null
  }
}

const materialCompiler = new MaterialCompiler()
export default materialCompiler
export { MaterialCompiler }