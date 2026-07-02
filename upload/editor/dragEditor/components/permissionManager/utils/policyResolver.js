/**
 * 策略优先级解析器
 *
 * 优先级规则：
 * 1. 用户直接拒绝 (user-level deny) - 最高优先级
 * 2. 用户直接允许 (user-level allow)
 * 3. 角色拒绝 (role-level deny)
 * 4. 角色允许 (role-level allow)
 * 5. 继承的拒绝 (inherited deny)
 * 6. 继承的允许 (inherited allow) - 最低优先级
 */

/**
 * 解析用户的最终权限状态
 * @param {string} userId - 用户ID
 * @param {string} orgId - 组织ID
 * @param {string} resourceId - 资源标识
 * @param {string} actionCode - 操作编码
 * @param {Object} context - 上下文数据
 * @param {Array} context.userPermissions - 用户直接配置的权限
 * @param {Array} context.rolePermissions - 用户所属角色的权限（已包含继承）
 * @returns {Object} { state: 'allow'|'deny'|'inherit', source: string, priority: number }
 */
export function resolveUserPermission(userId, orgId, resourceId, actionCode, context) {
  const { userPermissions = [], rolePermissions = [] } = context

  // 1. 检查用户直接配置的权限
  const userPerm = userPermissions.find(p =>
    p.sub === `user-${userId}` &&
    p.dom === orgId &&
    p.obj === resourceId &&
    p.act === actionCode
  )

  if (userPerm) {
    return {
      state: userPerm.eft || 'allow',
      source: userPerm.eft === 'deny'
        ? '用户直接拒绝（排除角色权限）'
        : '用户直接允许',
      priority: 1000,
      type: 'user-direct',
      effect: userPerm.eft
    }
  }

  // 2. 检查角色权限（已包含组织树和角色树的继承）
  // 优先级：角色的 deny > 角色的 allow > 继承的 deny > 继承的 allow
  let bestRolePerm = null
  let bestPriority = -1

  rolePermissions.forEach(perm => {
    if (perm.obj !== resourceId || perm.act !== actionCode) return

    // 计算优先级：deny 权限 +500，非继承权限 +100
    let priority = 0
    if (perm.eft === 'deny') priority += 500
    if (!perm.inherited) priority += 100
    if (perm.priority) priority += perm.priority

    if (priority > bestPriority) {
      bestPriority = priority
      bestRolePerm = perm
    }
  })

  if (bestRolePerm) {
    return {
      state: bestRolePerm.eft || 'allow',
      source: buildPermissionSource(bestRolePerm),
      priority: bestPriority,
      type: bestRolePerm.inherited ? 'role-inherited' : 'role-direct',
      effect: bestRolePerm.eft,
      inheritedFromOrg: bestRolePerm.inheritedFromOrg,
      inheritedFromRole: bestRolePerm.inheritedFromRole
    }
  }

  // 3. 无任何配置，返回继承状态
  return {
    state: 'inherit',
    source: null,
    priority: -1,
    type: 'none',
    effect: null
  }
}

/**
 * 构建权限来源描述
 */
function buildPermissionSource(perm) {
  const parts = []

  if (perm.eft === 'deny') {
    parts.push('✗ 拒绝')
  } else {
    parts.push('✓ 允许')
  }

  if (perm.inherited) {
    const sources = []
    if (perm.inheritedFromOrg) sources.push(`组织继承`)
    if (perm.inheritedFromRole) sources.push(`角色继承`)
    if (sources.length > 0) {
      parts.push(`(${sources.join(' + ')})`)
    }
  } else {
    parts.push('(直接配置)')
  }

  return parts.join(' ')
}

/**
 * 批量解析资源权限
 * @param {string} userId
 * @param {string} orgId
 * @param {Array} resources - 资源列表
 * @param {Object} context
 * @returns {Map} key: "resourceId-actionCode", value: permission result
 */
export function resolveUserPermissions(userId, orgId, resources, context) {
  const resultMap = new Map()

  resources.forEach(resource => {
    if (!resource.actions || resource.actions.length === 0) return

    resource.actions.forEach(actionCode => {
      const key = `${resource.identifier}-${actionCode}`
      const result = resolveUserPermission(
        userId,
        orgId,
        resource.identifier,
        actionCode,
        context
      )
      resultMap.set(key, result)
    })
  })

  return resultMap
}

/**
 * 检查权限冲突
 * @param {Array} permissions - 权限列表
 * @returns {Array} 冲突列表
 */
export function detectPermissionConflicts(permissions) {
  const conflicts = []
  const groupMap = new Map() // key: "obj-act", value: Array<permission>

  permissions.forEach(perm => {
    const key = `${perm.obj}-${perm.act}`
    if (!groupMap.has(key)) {
      groupMap.set(key, [])
    }
    groupMap.get(key).push(perm)
  })

  groupMap.forEach((perms, key) => {
    if (perms.length <= 1) return

    const allowPerms = perms.filter(p => p.eft === 'allow')
    const denyPerms = perms.filter(p => p.eft === 'deny')

    if (allowPerms.length > 0 && denyPerms.length > 0) {
      conflicts.push({
        resource: key.split('-')[0],
        action: key.split('-')[1],
        allowCount: allowPerms.length,
        denyCount: denyPerms.length,
        finalEffect: 'deny', // deny 优先
        permissions: perms
      })
    }
  })

  return conflicts
}

/**
 * 计算权限差异（用于审计）
 * @param {Array} oldPermissions
 * @param {Array} newPermissions
 * @returns {Object} { added, removed, modified }
 */
export function calculatePermissionDiff(oldPermissions, newPermissions) {
  const oldMap = new Map(oldPermissions.map(p => [`${p.obj}-${p.act}`, p]))
  const newMap = new Map(newPermissions.map(p => [`${p.obj}-${p.act}`, p]))

  const added = []
  const removed = []
  const modified = []

  // 检查新增和修改
  newMap.forEach((newPerm, key) => {
    const oldPerm = oldMap.get(key)
    if (!oldPerm) {
      added.push(newPerm)
    } else if (oldPerm.eft !== newPerm.eft) {
      modified.push({ old: oldPerm, new: newPerm })
    }
  })

  // 检查删除
  oldMap.forEach((oldPerm, key) => {
    if (!newMap.has(key)) {
      removed.push(oldPerm)
    }
  })

  return { added, removed, modified }
}

/**
 * 权限可视化辅助
 * @param {Object} permission
 * @returns {Object} { color, icon, label }
 */
export function getPermissionVisual(permission) {
  if (!permission || permission.state === 'inherit') {
    return {
      color: 'grey-7',
      icon: 'arrow_downward',
      label: '继承',
      class: 'text-grey-7'
    }
  }

  if (permission.effect === 'deny') {
    return {
      color: 'negative',
      icon: 'block',
      label: '拒绝',
      class: 'text-negative'
    }
  }

  return {
    color: 'positive',
    icon: 'check_circle',
    label: '允许',
    class: 'text-positive'
  }
}
