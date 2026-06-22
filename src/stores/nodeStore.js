/**
 * 节点数据 Store
 * 管理节点图的可视状态，核心计算委托给 NodeEngine
 * 节点类型定义由 NodeRegistry 管理
 */
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { NODE_EVENTS } from '../core/eventBus.js'
import emitter from '../core/eventBus.js'
import nodeEngine from '../core/nodes/engine/NodeEngine.js'
import nodeRegistry from '../core/nodes/registry/NodeRegistry.js'

export const useNodeStore = defineStore('nodes', () => {
  const nodes = ref([])
  const links = ref([])
  const selectedNodeId = ref(null)
  const nextNodeId = ref(1)
  const graphDirty = ref(true)

  const nodeCount = computed(() => nodes.value.length)
  const linkCount = computed(() => links.value.length)

  /** 通过 NodeRegistry 创建节点 */
  function addNodeFromRegistry(typeId, overrides = {}) {
    const nodeInstance = nodeRegistry.createNode(typeId, overrides)
    if (!nodeInstance) return null

    nodeInstance.id = nextNodeId.value++
    nodes.value.push(nodeInstance)
    nodeEngine.registerNode(nodeInstance)
    markDirty()
    return nodeInstance
  }

  /** 通用添加节点（兼容旧接口） */
  function addNode(nodeData) {
    const node = {
      id: nextNodeId.value++,
      type: nodeData.type,
      typeId: nodeData.typeId || nodeData.type,
      title: nodeData.title || nodeData.type,
      category: nodeData.category || 'general',
      position: nodeData.position || { x: 0, y: 0 },
      inputs: nodeData.inputs || [],
      outputs: nodeData.outputs || [],
      properties: nodeData.properties || {},
      computed: false,
      dirty: true
    }
    nodes.value.push(node)
    nodeEngine.registerNode(node)
    markDirty()
    return node
  }

  function removeNode(id) {
    const idx = nodes.value.findIndex(n => n.id === id)
    if (idx !== -1) {
      nodes.value.splice(idx, 1)
      nodeEngine.unregisterNode(id)
      links.value = links.value.filter(l => l.sourceId !== id && l.targetId !== id)
      if (selectedNodeId.value === id) selectedNodeId.value = null
      markDirty()
    }
  }

  function updateNodeProperty(nodeId, propPath, value) {
    const node = nodes.value.find(n => n.id === nodeId)
    if (node) {
      node.properties[propPath] = value
      node.dirty = true
      nodeEngine.markDirty(nodeId)
      markDirty()
    }
  }

  function addLink(linkData) {
    const link = {
      id: `link_${Date.now()}`,
      sourceId: linkData.sourceId,
      sourceSlot: linkData.sourceSlot,
      targetId: linkData.targetId,
      targetSlot: linkData.targetSlot
    }
    links.value.push(link)
    nodeEngine.addLink(link)
    markDirty()
    return link
  }

  function removeLink(id) {
    links.value = links.value.filter(l => l.id !== id)
    nodeEngine.removeLink(id)
    markDirty()
  }

  function selectNode(id) {
    selectedNodeId.value = id
    emitter.emit(NODE_EVENTS.NODE_SELECTED, { id })
  }

  function deselectNode() {
    selectedNodeId.value = null
    emitter.emit(NODE_EVENTS.NODE_DESELECTED)
  }

  function markDirty() { graphDirty.value = true }
  function clearDirty() { graphDirty.value = false }

  function getSelectedNode() {
    if (!selectedNodeId.value) return null
    return nodes.value.find(n => n.id === selectedNodeId.value)
  }

  function clearGraph() {
    nodes.value = []
    links.value = []
    selectedNodeId.value = null
    nodeEngine.destroy()
    markDirty()
  }

  function serializeGraph() {
    return JSON.stringify({ nodes: nodes.value, links: links.value, nextNodeId: nextNodeId.value })
  }

  return {
    nodes, links, selectedNodeId, graphDirty,
    nodeCount, linkCount,
    addNode, addNodeFromRegistry, removeNode, updateNodeProperty,
    addLink, removeLink,
    selectNode, deselectNode,
    markDirty, clearDirty, getSelectedNode, clearGraph, serializeGraph
  }
})
