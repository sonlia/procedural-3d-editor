/**
 * 节点求值引擎 - NodeEngine
 * DAG 数据流驱动、脏标记传播、惰性求值、增量缓存
 */
import emitter, { NODE_EVENTS } from '../../eventBus.js'

class NodeEngine {
  constructor() {
    this.nodes = new Map()
    this.links = new Map()
    this._dirty = new Set()
    this._cache = new Map()
    this._evaluating = false
  }

  /** 注册节点 */
  registerNode(node) {
    this.nodes.set(node.id, node)
    this._dirty.add(node.id)
    emitter.emit(NODE_EVENTS.NODE_ADDED, { node })
    emitter.emit(NODE_EVENTS.NODE_GRAPH_CHANGED)
  }

  /** 移除节点 */
  unregisterNode(id) {
    this.nodes.delete(id)
    this._dirty.delete(id)
    this._cache.delete(id)
    // 移除关联连线
    for (const [linkId, link] of this.links) {
      if (link.sourceId === id || link.targetId === id) {
        this.links.delete(linkId)
      }
    }
    emitter.emit(NODE_EVENTS.NODE_REMOVED, { id })
    emitter.emit(NODE_EVENTS.NODE_GRAPH_CHANGED)
  }

  /** 添加连线 */
  addLink(link) {
    this.links.set(link.id, link)
    // 目标节点变脏
    this._dirty.add(link.targetId)
    emitter.emit(NODE_EVENTS.NODE_GRAPH_CHANGED)
  }

  /** 移除连线 */
  removeLink(id) {
    const link = this.links.get(id)
    if (link) {
      this.links.delete(id)
      this._dirty.add(link.targetId)
      emitter.emit(NODE_EVENTS.NODE_GRAPH_CHANGED)
    }
  }

  /** 标记节点属性变更 */
  markDirty(nodeId) {
    this._dirty.add(nodeId)
    // 向下游传播脏标记
    this._propagateDirty(nodeId)
    emitter.emit(NODE_EVENTS.NODE_GRAPH_DIRTY)
  }

  /** 向下游传播脏标记 */
  _propagateDirty(nodeId) {
    for (const [, link] of this.links) {
      if (link.sourceId === nodeId) {
        if (!this._dirty.has(link.targetId)) {
          this._dirty.add(link.targetId)
          this._propagateDirty(link.targetId)
        }
      }
    }
  }

  /** 拓扑排序 */
  _topologicalSort() {
    const inDegree = new Map()
    const adj = new Map()

    for (const [id] of this.nodes) {
      inDegree.set(id, 0)
      adj.set(id, [])
    }

    for (const [, link] of this.links) {
      if (inDegree.has(link.targetId)) {
        inDegree.set(link.targetId, inDegree.get(link.targetId) + 1)
      }
      if (adj.has(link.sourceId)) {
        adj.get(link.sourceId).push(link.targetId)
      }
    }

    const queue = []
    for (const [id, deg] of inDegree) {
      if (deg === 0) queue.push(id)
    }

    const sorted = []
    while (queue.length > 0) {
      const node = queue.shift()
      sorted.push(node)
      for (const neighbor of (adj.get(node) || [])) {
        inDegree.set(neighbor, inDegree.get(neighbor) - 1)
        if (inDegree.get(neighbor) === 0) queue.push(neighbor)
      }
    }

    return sorted
  }

  /** 惰性求值：仅计算脏节点 */
  evaluate() {
    if (this._evaluating) return
    this._evaluating = true

    const sorted = this._topologicalSort()

    for (const nodeId of sorted) {
      if (!this._dirty.has(nodeId)) continue
      const node = this.nodes.get(nodeId)
      if (!node || typeof node.compute !== 'function') continue

      // 收集输入
      const inputs = {}
      for (const [, link] of this.links) {
        if (link.targetId === nodeId) {
          const sourceCache = this._cache.get(link.sourceId)
          if (sourceCache !== undefined) {
            inputs[link.targetSlot] = sourceCache[link.sourceSlot]
          }
        }
      }

      try {
        const result = node.compute(inputs, this._cache)
        this._cache.set(nodeId, result)
        this._dirty.delete(nodeId)
        emitter.emit(NODE_EVENTS.NODE_EXECUTED, { nodeId, result })
      } catch (err) {
        console.error(`[NodeEngine] Error evaluating node "${nodeId}":`, err)
      }
    }

    this._evaluating = false
  }

  /** 获取节点缓存结果 */
  getCachedResult(nodeId) {
    return this._cache.get(nodeId)
  }

  /** 清空所有缓存 */
  clearCache() {
    this._cache.clear()
    for (const [id] of this.nodes) {
      this._dirty.add(id)
    }
  }

  /** 序列化节点图 */
  serialize() {
    const nodesArr = []
    for (const [, node] of this.nodes) {
      nodesArr.push({ ...node })
    }
    const linksArr = []
    for (const [, link] of this.links) {
      linksArr.push({ ...link })
    }
    return JSON.stringify({ nodes: nodesArr, links: linksArr })
  }

  /** 节点数量 */
  get nodeCount() { return this.nodes.size }
  get linkCount() { return this.links.size }
  get isDirty() { return this._dirty.size > 0 }

  destroy() {
    this.nodes.clear()
    this.links.clear()
    this._dirty.clear()
    this._cache.clear()
  }
}

const nodeEngine = new NodeEngine()
export default nodeEngine
export { NodeEngine }
