/**
 * 权限策略计算器
 * 用于计算权限继承、覆盖和最终有效权限
 */

import { getNodePath, getAncestorIds } from './treeHelpers.js'
import { keyMatch2 } from './casbinMatcher.js'

/**
 * 计算节点的有效权限（包括继承）
 * @param {Array} organizations - 组织树
 * @param {Array} policies - 所有策略
 * @param {string} orgId - 当前组织节点 ID
 * @param {string} roleId - 角色 ID
 * @returns {Array} - 有效权限列表
 *
 * @example
 * calculateEffectivePermissions(orgs, policies, 'org-sales-east', 'role:manager')
 * // [
 * //   { obj: 'page:user-management', act: 'read', eft: 'allow', source: 'inherited', from: 'org-sales' },
 * //   { obj: 'page:order-list', act: '*', eft: 'allow', source: 'direct' },
 * //   { obj: 'page:salary', act: '*', eft: 'deny', source: 'direct' },
 * // ]
 */
export const calculateEffectivePermissions = (
  organizations,
  policies,
  orgId,
  roleId
) => {
  // 获取当前节点到根节点的路径（包括自己）
  const path = getNodePath(organizations, orgId)
  const orgIds = path.map(p => p.id)

  // 从根到当前节点收集所有策略（继承链）
  const permissionsMap = new Map()

  // 按照继承链顺序遍历（根→叶）
  orgIds.forEach(currentOrgId => {
    const orgPolicies = policies.filter(
      p => p.dom === currentOrgId && p.sub === roleId
    )

    orgPolicies.forEach(policy => {
      const key = `${policy.obj}:${policy.act}`

      // 记录策略来源
      permissionsMap.set(key, {
        obj: policy.obj,
        act: policy.act,
        eft: policy.eft,
        source: currentOrgId === orgId ? 'direct' : 'inherited',
        from: currentOrgId,
        fromName: path.find(p => p.id === currentOrgId)?.name || currentOrgId,
        policy,
      })
    })
  })

  // 转换为数组
  return Array.from(permissionsMap.values())
}

/**
 * 检查权限冲突
 * @param {Array} permissions - 权限列表
 * @returns {Array} - 冲突列表
 *
 * @example
 * checkPermissionConflicts(permissions)
 * // [
 * //   {
 * //     resource: 'page:user-management',
 * //     action: 'read',
 * //     conflicts: [
 * //       { eft: 'allow', from: 'org-sales', source: 'inherited' },
 * //       { eft: 'deny', from: 'org-sales-east', source: 'direct' }
 * //     ]
 * //   }
 * // ]
 */
export const checkPermissionConflicts = (permissions) => {
  const grouped = {}

  permissions.forEach(perm => {
    const key = `${perm.obj}:${perm.act}`

    if (!grouped[key]) {
      grouped[key] = []
    }

    grouped[key].push(perm)
  })

  const conflicts = []

  Object.keys(grouped).forEach(key => {
    const perms = grouped[key]

    if (perms.length > 1) {
      const hasAllow = perms.some(p => p.eft === 'allow')
      const hasDeny = perms.some(p => p.eft === 'deny')

      if (hasAllow && hasDeny) {
        const [obj, act] = key.split(':')
        conflicts.push({
          resource: obj,
          action: act,
          conflicts: perms.map(p => ({
            eft: p.eft,
            from: p.fromName || p.from,
            source: p.source,
          })),
          resolution: 'deny',  // deny 优先
        })
      }
    }
  })

  return conflicts
}

/**
 * 计算最终权限（考虑 deny 优先级）
 * @param {Array} permissions - 权限列表
 * @returns {Array} - 最终有效权限
 */
export const calculateFinalPermissions = (permissions) => {
  const grouped = {}

  permissions.forEach(perm => {
    const key = `${perm.obj}:${perm.act}`

    if (!grouped[key]) {
      grouped[key] = []
    }

    grouped[key].push(perm)
  })

  const final = []

  Object.keys(grouped).forEach(key => {
    const perms = grouped[key]

    // deny 优先级最高
    const hasDeny = perms.find(p => p.eft === 'deny')
    if (hasDeny) {
      final.push(hasDeny)
      return
    }

    // 没有 deny，选择最近的 allow
    const hasAllow = perms.find(p => p.eft === 'allow' && p.source === 'direct')
    if (hasAllow) {
      final.push(hasAllow)
      return
    }

    // 继承的 allow
    const inherited = perms.find(p => p.eft === 'allow')
    if (inherited) {
      final.push(inherited)
    }
  })

  return final
}

/**
 * 检查资源层级权限（支持模式匹配）
 * @param {Array} permissions - 权限列表
 * @param {string} resource - 资源标识 (如: page:user-management/button:add)
 * @param {string} action - 操作
 * @returns {Object} - { allowed: boolean, matchedPermission: Object }
 *
 * @example
 * checkResourcePermission(permissions, 'page:user-management/button:add', 'click')
 * // 会匹配:
 * // 1. page:user-management/button:add (精确匹配)
 * // 2. page:user-management/* (父级通配)
 * // 3. page:user-management (父级资源)
 */
export const checkResourcePermission = (permissions, resource, action) => {
  // 生成可能的匹配模式（从具体到抽象）
  const patterns = [
    resource,                          // 精确匹配: page:user-management/button:add
    `${resource.split('/')[0]}/*`,     // 父级通配: page:user-management/*
    resource.split('/')[0],            // 父级资源: page:user-management
  ]

  for (const pattern of patterns) {
    // 查找匹配的权限
    const matched = permissions.find(perm => {
      const objMatch = perm.obj === pattern || keyMatch2(resource, perm.obj)
      const actMatch = perm.act === action || perm.act === '*'
      return objMatch && actMatch
    })

    if (matched) {
      return {
        allowed: matched.eft === 'allow',
        matchedPermission: matched,
        matchedPattern: pattern,
      }
    }
  }

  // 没有匹配的权限
  return {
    allowed: false,
    matchedPermission: null,
    matchedPattern: null,
  }
}

/**
 * 计算角色继承权限
 * @param {Array} roles - 角色树
 * @param {Array} policies - 策略列表
 * @param {string} roleId - 角色 ID
 * @param {string} orgId - 组织 ID
 * @returns {Array} - 包含继承的权限列表
 */
export const calculateRoleInheritance = (roles, policies, roleId, orgId) => {
  // 获取角色及其所有父角色
  const rolePath = getNodePath(roles, roleId)
  const roleIds = rolePath.map(r => r.id)

  const permissionsMap = new Map()

  // 从父角色到子角色收集权限（父角色优先级低）
  roleIds.forEach(currentRoleId => {
    const rolePolicies = policies.filter(
      p => p.sub === currentRoleId && p.dom === orgId
    )

    rolePolicies.forEach(policy => {
      const key = `${policy.obj}:${policy.act}`

      // 如果已存在，只有当前角色的策略可以覆盖
      if (!permissionsMap.has(key) || currentRoleId === roleId) {
        permissionsMap.set(key, {
          obj: policy.obj,
          act: policy.act,
          eft: policy.eft,
          source: currentRoleId === roleId ? 'direct' : 'role-inherited',
          from: currentRoleId,
          fromName: rolePath.find(r => r.id === currentRoleId)?.name || currentRoleId,
          policy,
        })
      }
    })
  })

  return Array.from(permissionsMap.values())
}

/**
 * 对比两个权限列表的差异
 * @param {Array} oldPermissions - 旧权限列表
 * @param {Array} newPermissions - 新权限列表
 * @returns {Object} - { added: [], removed: [], modified: [] }
 */
export const diffPermissions = (oldPermissions, newPermissions) => {
  const oldMap = new Map(oldPermissions.map(p => [`${p.obj}:${p.act}`, p]))
  const newMap = new Map(newPermissions.map(p => [`${p.obj}:${p.act}`, p]))

  const added = []
  const removed = []
  const modified = []

  // 检查新增和修改
  newMap.forEach((perm, key) => {
    const oldPerm = oldMap.get(key)

    if (!oldPerm) {
      added.push(perm)
    } else if (oldPerm.eft !== perm.eft) {
      modified.push({
        key,
        old: oldPerm,
        new: perm,
      })
    }
  })

  // 检查删除
  oldMap.forEach((perm, key) => {
    if (!newMap.has(key)) {
      removed.push(perm)
    }
  })

  return { added, removed, modified }
}

/**
 * 生成权限继承树（用于可视化）
 * @param {Array} organizations - 组织树
 * @param {Array} policies - 策略列表
 * @param {string} orgId - 当前组织 ID
 * @param {string} roleId - 角色 ID
 * @returns {Array} - 继承树
 *
 * @example
 * generateInheritanceTree(orgs, policies, 'org-sales-east', 'role:manager')
 * // [
 * //   {
 * //     orgId: 'org-group',
 * //     orgName: '集团',
 * //     level: 0,
 * //     permissions: [...]
 * //   },
 * //   {
 * //     orgId: 'org-sales',
 * //     orgName: '销售部',
 * //     level: 1,
 * //     permissions: [...]
 * //   },
 * //   ...
 * // ]
 */
export const generateInheritanceTree = (
  organizations,
  policies,
  orgId,
  roleId
) => {
  const path = getNodePath(organizations, orgId)

  return path.map((node, index) => {
    const orgPolicies = policies.filter(
      p => p.dom === node.id && p.sub === roleId
    )

    return {
      orgId: node.id,
      orgName: node.name,
      level: index,
      isCurrent: node.id === orgId,
      permissions: orgPolicies.map(p => ({
        obj: p.obj,
        act: p.act,
        eft: p.eft,
      })),
    }
  })
}

/**
 * 验证策略有效性
 * @param {Object} policy - 策略对象
 * @returns {Object} - { valid: boolean, errors: [] }
 */
export const validatePolicy = (policy) => {
  const errors = []

  if (!policy.sub) {
    errors.push('缺少主体 (sub)')
  }

  if (!policy.dom) {
    errors.push('缺少组织域 (dom)')
  }

  if (!policy.obj) {
    errors.push('缺少资源 (obj)')
  }

  if (!policy.act) {
    errors.push('缺少操作 (act)')
  }

  if (!['allow', 'deny'].includes(policy.eft)) {
    errors.push('效果 (eft) 必须是 allow 或 deny')
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}
