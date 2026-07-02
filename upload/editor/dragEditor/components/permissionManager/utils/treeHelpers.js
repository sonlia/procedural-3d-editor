/**
 * 树形数据处理工具函数
 * 用于组织架构树、角色树等树形数据的操作
 */

import { cloneDeep } from 'lodash-es'

/**
 * 通用树遍历器
 * @param {Array} nodes - 节点数组
 * @param {Function} callback - 回调函数 (node, index, parent) => boolean | void
 *   返回 true 表示找到目标（停止遍历）
 *   返回 false 表示跳过当前节点的子节点
 * @param {Object} options - 选项 { childrenKey: 'children' }
 * @returns {boolean} - 是否找到目标
 *
 * @example
 * walkTree(nodes, (node) => {
 *   if (node.id === targetId) {
 *     console.log('找到了!', node)
 *     return true  // 停止遍历
 *   }
 * })
 */
export const walkTree = (nodes, callback, options = {}) => {
  const { childrenKey = 'children' } = options

  if (!nodes || !Array.isArray(nodes)) return false

  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i]
    if (!node) continue

    // 执行回调
    const result = callback(node, i, nodes)
    if (result === true) return true  // 找到目标
    if (result === false) continue    // 跳过子节点

    // 递归处理子节点
    if (node[childrenKey] && Array.isArray(node[childrenKey])) {
      if (walkTree(node[childrenKey], callback, options)) {
        return true
      }
    }
  }

  return false
}

/**
 * 查找节点
 * @param {Array} nodes - 节点数组
 * @param {Function|string} predicate - 查找条件（函数或 id）
 * @param {Object} options - 选项
 * @returns {Object|null} - 找到的节点或 null
 *
 * @example
 * findNode(nodes, node => node.name === '销售部')
 * findNode(nodes, 'org-123')  // 根据 id 查找
 */
export const findNode = (nodes, predicate, options = {}) => {
  let found = null

  const predicateFn = typeof predicate === 'function'
    ? predicate
    : (node) => node.id === predicate

  walkTree(nodes, (node) => {
    if (predicateFn(node)) {
      found = node
      return true  // 停止遍历
    }
  }, options)

  return found
}

/**
 * 查找节点及其父节点
 * @param {Array} nodes - 节点数组
 * @param {Function|string} predicate - 查找条件
 * @param {Object} options - 选项
 * @returns {Object|null} - { node, parent, siblings, index }
 */
export const findNodeWithParent = (nodes, predicate, options = {}) => {
  const { childrenKey = 'children' } = options

  const predicateFn = typeof predicate === 'function'
    ? predicate
    : (node) => node.id === predicate

  const traverse = (nodeList, parent = null) => {
    for (let i = 0; i < nodeList.length; i++) {
      const node = nodeList[i]

      if (predicateFn(node)) {
        return {
          node,
          parent,
          siblings: nodeList,
          index: i,
        }
      }

      if (node[childrenKey] && Array.isArray(node[childrenKey])) {
        const result = traverse(node[childrenKey], node)
        if (result) return result
      }
    }

    return null
  }

  return traverse(nodes)
}

/**
 * 获取节点路径
 * @param {Array} nodes - 节点数组
 * @param {string} nodeId - 节点 ID
 * @param {Object} options - 选项 { childrenKey, idKey, nameKey }
 * @returns {Array} - 路径数组 [{ id, name }, ...]
 *
 * @example
 * getNodePath(nodes, 'org-456')
 * // [{ id: 'org-123', name: '集团' }, { id: 'org-456', name: '销售部' }]
 */
export const getNodePath = (nodes, nodeId, options = {}) => {
  const {
    childrenKey = 'children',
    idKey = 'id',
    nameKey = 'name',
  } = options

  const path = []

  const traverse = (nodeList) => {
    for (const node of nodeList) {
      if (node[idKey] === nodeId) {
        path.push({ id: node[idKey], name: node[nameKey] })
        return true
      }

      if (node[childrenKey] && Array.isArray(node[childrenKey])) {
        if (traverse(node[childrenKey])) {
          path.unshift({ id: node[idKey], name: node[nameKey] })
          return true
        }
      }
    }

    return false
  }

  traverse(nodes)
  return path
}

/**
 * 获取所有子节点 ID
 * @param {Object} node - 父节点
 * @param {Object} options - 选项
 * @returns {Array} - 子节点 ID 数组
 */
export const getAllChildIds = (node, options = {}) => {
  const { childrenKey = 'children', idKey = 'id' } = options

  const ids = []

  const traverse = (n) => {
    if (!n[childrenKey] || !Array.isArray(n[childrenKey])) return

    n[childrenKey].forEach(child => {
      ids.push(child[idKey])
      traverse(child)
    })
  }

  traverse(node)
  return ids
}

/**
 * 获取所有祖先节点 ID
 * @param {Array} nodes - 节点数组
 * @param {string} nodeId - 节点 ID
 * @param {Object} options - 选项
 * @returns {Array} - 祖先节点 ID 数组（不包括自己）
 */
export const getAncestorIds = (nodes, nodeId, options = {}) => {
  const path = getNodePath(nodes, nodeId, options)
  // 移除最后一个节点（自己），只保留祖先
  return path.slice(0, -1).map(p => p.id)
}

/**
 * 添加节点
 * @param {Array} nodes - 节点数组
 * @param {string|null} parentId - 父节点 ID（null 表示根节点）
 * @param {Object} newNode - 新节点数据
 * @param {Object} options - 选项
 * @returns {boolean} - 是否成功
 */
export const addNode = (nodes, parentId, newNode, options = {}) => {
  const { childrenKey = 'children' } = options

  // 根节点
  if (!parentId) {
    nodes.push(newNode)
    return true
  }

  // 查找父节点
  const parent = findNode(nodes, parentId, options)
  if (!parent) return false

  // 初始化 children
  if (!parent[childrenKey]) {
    parent[childrenKey] = []
  }

  parent[childrenKey].push(newNode)
  return true
}

/**
 * 删除节点
 * @param {Array} nodes - 节点数组
 * @param {string} nodeId - 节点 ID
 * @param {Object} options - 选项
 * @returns {Object|null} - 被删除的节点
 */
export const removeNode = (nodes, nodeId, options = {}) => {
  const result = findNodeWithParent(nodes, nodeId, options)
  if (!result) return null

  const { siblings, index } = result
  const removed = siblings.splice(index, 1)[0]

  return removed
}

/**
 * 更新节点
 * @param {Array} nodes - 节点数组
 * @param {string} nodeId - 节点 ID
 * @param {Object} updates - 更新数据
 * @param {Object} options - 选项
 * @returns {Object|null} - 更新后的节点
 */
export const updateNode = (nodes, nodeId, updates, options = {}) => {
  const node = findNode(nodes, nodeId, options)
  if (!node) return null

  Object.assign(node, updates)
  return node
}

/**
 * 移动节点
 * @param {Array} nodes - 节点数组
 * @param {string} nodeId - 要移动的节点 ID
 * @param {string|null} newParentId - 新父节点 ID
 * @param {Object} options - 选项
 * @returns {boolean} - 是否成功
 */
export const moveNode = (nodes, nodeId, newParentId, options = {}) => {
  // 不能移动到自己的子节点下
  if (newParentId) {
    const node = findNode(nodes, nodeId, options)
    if (node) {
      const childIds = getAllChildIds(node, options)
      if (childIds.includes(newParentId)) {
        console.error('Cannot move node to its own child')
        return false
      }
    }
  }

  // 删除节点
  const removed = removeNode(nodes, nodeId, options)
  if (!removed) return false

  // 添加到新位置
  return addNode(nodes, newParentId, removed, options)
}

/**
 * 扁平化树（转换为数组）
 * @param {Array} nodes - 节点数组
 * @param {Object} options - 选项
 * @returns {Array} - 扁平化数组
 */
export const flattenTree = (nodes, options = {}) => {
  const { childrenKey = 'children' } = options
  const result = []

  walkTree(nodes, (node) => {
    result.push(node)
  }, options)

  return result
}

/**
 * 数组转树（根据 pId 构建树）
 * @param {Array} flatArray - 扁平数组
 * @param {Object} options - 选项 { idKey, pIdKey, childrenKey, rootPId }
 * @returns {Array} - 树形数组
 *
 * @example
 * const flat = [
 *   { id: '1', pId: null, name: '集团' },
 *   { id: '2', pId: '1', name: '销售部' },
 *   { id: '3', pId: '1', name: '技术部' },
 * ]
 * arrayToTree(flat)
 * // [{ id: '1', name: '集团', children: [{ id: '2', ... }, { id: '3', ... }] }]
 */
export const arrayToTree = (flatArray, options = {}) => {
  const {
    idKey = 'id',
    pIdKey = 'pId',
    childrenKey = 'children',
    rootPId = null,
  } = options

  const map = {}
  const roots = []

  // 克隆数据，避免修改原数组
  const cloned = cloneDeep(flatArray)

  // 第一次遍历：建立索引
  cloned.forEach(item => {
    map[item[idKey]] = item
    item[childrenKey] = []
  })

  // 第二次遍历：构建树
  cloned.forEach(item => {
    const parent = map[item[pIdKey]]

    if (parent) {
      parent[childrenKey].push(item)
    } else if (item[pIdKey] === rootPId) {
      roots.push(item)
    }
  })

  return roots
}

/**
 * 树转数组（保留 pId）
 * @param {Array} nodes - 树形数组
 * @param {Object} options - 选项
 * @returns {Array} - 扁平数组
 */
export const treeToArray = (nodes, options = {}) => {
  const {
    childrenKey = 'children',
    idKey = 'id',
    pIdKey = 'pId',
    rootPId = null,
  } = options

  const result = []

  const traverse = (nodeList, parentId = rootPId) => {
    nodeList.forEach(node => {
      const item = { ...node }
      item[pIdKey] = parentId

      // 移除 children（避免重复）
      delete item[childrenKey]

      result.push(item)

      // 递归处理子节点
      if (node[childrenKey] && Array.isArray(node[childrenKey])) {
        traverse(node[childrenKey], node[idKey])
      }
    })
  }

  traverse(nodes)
  return result
}

/**
 * 过滤树节点
 * @param {Array} nodes - 节点数组
 * @param {Function} predicate - 过滤条件
 * @param {Object} options - 选项
 * @returns {Array} - 过滤后的树
 */
export const filterTree = (nodes, predicate, options = {}) => {
  const { childrenKey = 'children' } = options

  const filter = (nodeList) => {
    return nodeList
      .filter(predicate)
      .map(node => {
        const newNode = { ...node }

        if (node[childrenKey] && Array.isArray(node[childrenKey])) {
          newNode[childrenKey] = filter(node[childrenKey])
        }

        return newNode
      })
  }

  return filter(nodes)
}

/**
 * 搜索树节点（包含关键词的节点及其祖先）
 * @param {Array} nodes - 节点数组
 * @param {string} keyword - 关键词
 * @param {Object} options - 选项 { searchKey: 'name' }
 * @returns {Array} - 搜索结果树
 */
export const searchTree = (nodes, keyword, options = {}) => {
  const { childrenKey = 'children', searchKey = 'name' } = options

  if (!keyword) return cloneDeep(nodes)

  const lowerKeyword = keyword.toLowerCase()

  const search = (nodeList) => {
    const result = []

    nodeList.forEach(node => {
      const matchSelf = node[searchKey]
        ?.toLowerCase()
        .includes(lowerKeyword)

      let matchChildren = []
      if (node[childrenKey] && Array.isArray(node[childrenKey])) {
        matchChildren = search(node[childrenKey])
      }

      // 如果自己匹配或子节点匹配，则保留
      if (matchSelf || matchChildren.length > 0) {
        const newNode = { ...node }
        if (matchChildren.length > 0) {
          newNode[childrenKey] = matchChildren
        }
        result.push(newNode)
      }
    })

    return result
  }

  return search(nodes)
}
