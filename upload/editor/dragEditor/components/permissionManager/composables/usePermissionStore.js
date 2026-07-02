/**
 * 权限管理 Pinia Store
 * 管理组织架构、角色、资源、用户和策略数据
 */

import { defineStore } from 'pinia'
import { uid } from 'quasar'
import { useProjectMangerStore } from 'src/stores/projectMange'

export function createDefaultPermissions() {
  return {
    organizations: [],
    organizationTypes: [
      { id: 'company', name: '公司', icon: 'business', color: 'primary' },
      { id: 'department', name: '部门', icon: 'groups', color: 'secondary' },
      { id: 'team', name: '团队', icon: 'group', color: 'accent' },
    ],
    roles: [],
    resourceTypes: [],
    resources: [],
    users: [],
    policies: [],

    settings: {
      publicRegistrationEnabled: false,
    },
  }
}

function normalizePermissions(permissions = {}) {
  const defaults = createDefaultPermissions()
  return {
    ...defaults,
    ...permissions,
    organizations: Array.isArray(permissions.organizations) ? permissions.organizations : [],
    organizationTypes: Array.isArray(permissions.organizationTypes) && permissions.organizationTypes.length
      ? permissions.organizationTypes
      : defaults.organizationTypes,
    roles: Array.isArray(permissions.roles) ? permissions.roles : [],
    resourceTypes: Array.isArray(permissions.resourceTypes) && permissions.resourceTypes.length
      ? permissions.resourceTypes
      : defaults.resourceTypes,
    resources: Array.isArray(permissions.resources) ? permissions.resources : [],
    users: Array.isArray(permissions.users) ? permissions.users : [],
    policies: Array.isArray(permissions.policies)
      ? permissions.policies
      : (Array.isArray(permissions.rules) ? permissions.rules : []),
    settings: {
      ...defaults.settings,
      ...(permissions.settings || {}),
    },
  }
}

export const usePermissionStore = defineStore('permission', {
  state: () => ({
    // ==================== 组织架构 ====================
    /**
     * 组织架构树
     * @type {Array<{id: string, name: string, type: string, pId: string|null, children: Array}>}
     */
    organizations: [],

    /**
     * 组织节点类型定义
     * @type {Array<{id: string, name: string, icon: string, color: string}>}
     */
    organizationTypes: [
      { id: 'company', name: '公司', icon: 'business', color: 'primary' },
      { id: 'department', name: '部门', icon: 'groups', color: 'secondary' },
      { id: 'team', name: '团队', icon: 'group', color: 'accent' },
    ],

    // ==================== 角色管理 ====================
    /**
     * 角色树
     * @type {Array<{id: string, name: string, pId: string|null, children: Array}>}
     */
    roles: [],

    // ==================== 资源管理 ====================
    /**
     * 资源类型（固定 4 种，不可修改）
     * @type {Array<{id: string, name: string, icon: string, prefix: string, actions: Array}>}
     *
     * 设计原则（基于层级结构的权限模型）：
     * 1. page - 页面（顶层资源，可包含 component 和 url）
     * 2. url - API接口（可包含 component 和 data）
     * 3. component - UI组件（按钮、表单等，最细粒度）
     * 4. data - 数据实体（字段级权限控制）
     *
     * 层级关系示例：
     * page (用户管理页面)
     *   ├── component (新增按钮)
     *   │   └── url (POST /api/users)
     *   └── component (用户表格)
     *       └── url (GET /api/users)
     *           └── data (users 数据实体)
     */
    resourceTypes: [
      // ========== 1. 页面（顶层资源）==========
      {
        id: 'page',
        name: '页面',
        code: 'page',
        icon: 'web',
        prefix: 'page:',
        isSystem: true,
        description: '应用中的页面/路由，是权限控制的顶层入口。可包含子组件和调用的API。',
        // 默认推荐操作
        defaultActions: [
          { name: '访问', code: 'access', description: '是否可以访问该页面' },
          { name: '菜单显示', code: 'menu', description: '是否在菜单中显示' },
        ],
        allowCustomActions: true,
        // 允许的子资源类型
        allowedChildren: ['component', 'url'],
        canBeChild: false,  // 页面只能作为顶层资源
      },

      // ========== 2. API接口（二级资源）==========
      {
        id: 'url',
        name: 'API接口',
        code: 'url',
        icon: 'api',
        prefix: 'url:',
        isSystem: true,
        description: '后端API接口，支持URL模式匹配。可作为页面的子资源，或独立存在。可包含数据实体来控制返回字段。',
        // 默认推荐操作
        defaultActions: [
          { name: 'GET', code: 'GET', description: 'GET 请求（查询数据）' },
          { name: 'POST', code: 'POST', description: 'POST 请求（创建数据）' },
          { name: 'PUT', code: 'PUT', description: 'PUT 请求（更新数据）' },
          { name: 'DELETE', code: 'DELETE', description: 'DELETE 请求（删除数据）' },
          { name: 'PATCH', code: 'PATCH', description: 'PATCH 请求（部分更新）' },
          { name: '*', code: '*', description: '所有 HTTP 方法' },
        ],
        allowCustomActions: true,
        // URL 匹配方法配置
        matchTypes: [
          {
            value: 'exact',
            label: '精确匹配',
            description: '完全相同才匹配',
            example: '/api/users',
            casbin: '=='
          },
          {
            value: 'keyMatch',
            label: '通配符匹配',
            description: '支持 * 通配符，匹配任意字符',
            example: '/api/users/*',
            casbin: 'keyMatch()'
          },
          {
            value: 'keyMatch2',
            label: 'RESTful匹配',
            description: '支持 :param 参数占位符',
            example: '/api/users/:id',
            casbin: 'keyMatch2()'
          },
          {
            value: 'regex',
            label: '正则表达式',
            description: '使用正则表达式匹配',
            example: '/api/users/\\d+',
            casbin: 'regexMatch()'
          },
          {
            value: 'glob',
            label: 'Glob模式',
            description: '支持 ** 多层路径匹配',
            example: '/api/**/users',
            casbin: 'globMatch()'
          },
        ],
        defaultConfig: {
          matchMethod: 'keyMatch2',
        },
        // 允许的子资源类型
        allowedChildren: ['data', 'component'],
        canBeChild: true,  // URL 可以作为子资源
        allowedParents: ['page', 'component'],  // 可以在 page 或 component 下
      },

      // ========== 3. UI组件（细粒度资源）==========
      {
        id: 'component',
        name: 'UI组件',
        code: 'component',
        icon: 'widgets',
        prefix: 'component:',
        isSystem: true,
        description: '页面上的UI组件（按钮、表单、表格等）。可作为页面的子资源，也可以包含调用的API。',
        // 默认推荐操作
        defaultActions: [
          { name: '可见', code: 'visible', description: '组件是否可见' },
          { name: '点击', code: 'click', description: '是否可以点击该按钮' },
          { name: '编辑', code: 'edit', description: '是否可以编辑' },
          { name: '删除', code: 'delete', description: '是否可以删除' },
          { name: '导出', code: 'export', description: '是否可以导出' },
        ],
        allowCustomActions: true,
        // 允许的子资源类型
        allowedChildren: ['url'],
        canBeChild: true,
        allowedParents: ['page', 'component'],  // component 可以嵌套
      },

      // ========== 4. 数据实体（字段级权限）==========
      {
        id: 'data',
        name: '数据实体',
        code: 'data',
        icon: 'table_chart',
        prefix: 'data:',
        isSystem: true,
        description: '业务数据表/实体，作为 API 的子资源来控制字段级权限。支持字段可见性、编辑性和脱敏配置。',
        // 默认推荐操作（表级）
        defaultActions: [
          { name: '查看', code: 'read', description: '是否可以查看数据' },
          { name: '创建', code: 'create', description: '是否可以创建数据' },
          { name: '编辑', code: 'update', description: '是否可以编辑数据' },
          { name: '删除', code: 'delete', description: '是否可以删除数据' },
          { name: '导出', code: 'export', description: '是否可以导出数据' },
        ],
        allowCustomActions: true,
        // 字段级操作（后端根据此配置过滤返回字段）
        fieldActions: [
          { name: '可见', code: 'visible', description: '字段是否在返回数据中包含' },
          { name: '可编辑', code: 'editable', description: '字段是否允许编辑' },
          { name: '脱敏显示', code: 'mask', description: '字段以脱敏方式显示（如手机号：138****1234）' },
        ],
        // 字段敏感级别
        sensitivityLevels: [
          { value: 'normal', label: '普通', color: 'grey', icon: 'check_circle' },
          { value: 'sensitive', label: '敏感', color: 'warning', icon: 'warning' },
          { value: 'confidential', label: '机密', color: 'negative', icon: 'lock' },
        ],
        // 支持字段级权限
        supportsFieldPermission: true,
        allowedChildren: [],  // 数据实体不能再包含子资源
        canBeChild: true,
        allowedParents: ['url'],  // 只能作为 URL 的子资源
      },
    ],

    /**
     * 资源列表
     * @type {Array<{
     *   id: string,
     *   resourceId: string,
     *   resourceType: string,
     *   displayName: string,
     *   parentResourceId: string|null,
     *   module: string,
     *   description: string,
     *   urlPattern: string,
     *   matchMethod: string,
     *   httpMethods: Array<string>
     * }>}
     */
    resources: [],

    // ==================== 用户管理 ====================
    /**
     * 用户列表
     * @type {Array<{id: string, name: string, username: string, organizations: Array, roles: Array}>}
     */
    users: [],

    // ==================== 策略管理 ====================
    /**
     * Casbin 策略规则
     * @type {Array<{
     *   id: string,
     *   ptype: string,
     *   sub: string,
     *   dom: string,
     *   obj: string,
     *   act: string,
     *   eft: 'allow'|'deny'
     * }>}
     */
    policies: [],

    // ==================== UI 状态 ====================
    /**
     * 当前选中的组织节点
     */
    selectedOrgId: null,

    /**
     * 当前选中的角色
     */
    selectedRoleId: null,

    /**
     * 当前选中的用户
     */
    selectedUserId: null,
  }),

  getters: {
    // ==================== 兼容性方法（暂存区组件使用）====================

    /**
     * 获取组织树数据（暂存区兼容）
     */
    getOrgTreeData: (state) => () => {
      return state.organizations
    },

    /**
     * 获取角色列表（暂存区兼容）
     */
    getRoles: (state) => () => {
      return state.roles
    },

    /**
     * 获取用户列表（暂存区兼容）
     */
    getUsers: (state) => () => {
      return state.users
    },

    /**
     * 获取权限/策略列表（暂存区兼容）
     */
    getPermissions: (state) => () => {
      return state.policies
    },

    /**
     * 获取资源列表（暂存区兼容）
     */
    getResources: (state) => () => {
      return state.resources
    },

    /**
     * 获取资源类型列表（暂存区兼容）
     */
    getResourceTypes: (state) => () => {
      return state.resourceTypes
    },

    /**
     * 获取角色的所有权限（包括继承）- 暂存区兼容
     * @param {string} roleId - 角色ID
     * @param {string} orgId - 组织ID
     * @returns {Array} 权限列表，包含继承信息
     */
    getRoleAllPermissions: (state) => (roleId, orgId) => {
      if (!roleId || !orgId) return []

      // 1. 获取组织路径（从根到当前组织）
      const orgPath = []
      const getOrgPath = (currentOrgId) => {
        const org = state.getOrganizationById(currentOrgId)
        if (!org) return

        orgPath.unshift(org.id)
        if (org.pId) {
          getOrgPath(org.pId)
        }
      }
      getOrgPath(orgId)

      // 2. 获取角色继承链（从根角色到当前角色）
      const rolePath = []
      const getRolePath = (currentRoleId) => {
        const role = state.getRoleById(currentRoleId)
        if (!role) return

        rolePath.unshift(role.id)
        if (role.pId) {
          getRolePath(role.pId)
        }
      }
      getRolePath(roleId)

      // 3. 收集所有权限（组织继承 + 角色继承）
      const allPermissions = []
      const permissionMap = new Map() // key: obj-act, value: permission

      // 按优先级从低到高收集：父组织父角色 → 父组织当前角色 → 当前组织父角色 → 当前组织当前角色
      orgPath.forEach((orgNodeId, orgIndex) => {
        rolePath.forEach((roleNodeId, roleIndex) => {
          const perms = state.policies.filter(p =>
            p.sub === roleNodeId && p.dom === orgNodeId
          )

          perms.forEach(perm => {
            const key = `${perm.obj}-${perm.act}`
            const isInherited = orgNodeId !== orgId || roleNodeId !== roleId

            permissionMap.set(key, {
              ...perm,
              inherited: isInherited,
              inheritedFromOrg: orgNodeId !== orgId ? orgNodeId : null,
              inheritedFromRole: roleNodeId !== roleId ? roleNodeId : null,
              priority: (orgPath.length - orgIndex) * 100 + (rolePath.length - roleIndex)
            })
          })
        })
      })

      // 4. 应用策略优先级：deny > allow（同一资源-操作）
      const finalPermissions = Array.from(permissionMap.values())
      const resultMap = new Map()

      finalPermissions.forEach(perm => {
        const key = `${perm.obj}-${perm.act}`
        const existing = resultMap.get(key)

        if (!existing) {
          resultMap.set(key, perm)
        } else {
          // 优先级比较：deny > allow，子节点 > 父节点
          if (perm.eft === 'deny') {
            resultMap.set(key, perm)
          } else if (existing.eft !== 'deny' && perm.priority > existing.priority) {
            resultMap.set(key, perm)
          }
        }
      })

      return Array.from(resultMap.values())
    },

    // ==================== 组织架构 Getters ====================

    /**
     * 根据 ID 获取组织节点
     */
    getOrganizationById: (state) => (id) => {
      const find = (nodes) => {
        for (const node of nodes) {
          if (node.id === id) return node
          if (node.children) {
            const found = find(node.children)
            if (found) return found
          }
        }
        return null
      }
      return find(state.organizations)
    },

    /**
     * 获取当前选中的组织节点
     */
    selectedOrganization: (state) => {
      if (!state.selectedOrgId) return null
      return state.getOrganizationById(state.selectedOrgId)
    },

    // ==================== 资源 Getters ====================

    /**
     * 根据类型获取资源
     */
    getResourcesByType: (state) => (type) => {
      return state.resources.filter(r => r.resourceType === type)
    },

    /**
     * 根据 ID 获取资源
     */
    getResourceById: (state) => (id) => {
      return state.resources.find(r => r.id === id)
    },

    /**
     * 根据资源标识获取资源
     */
    getResourceByResourceId: (state) => (resourceId) => {
      return state.resources.find(r => r.resourceId === resourceId)
    },

    /**
     * 获取资源的子资源
     */
    getChildResources: (state) => (parentResourceId) => {
      return state.resources.filter(
        r => r.parentResourceId === parentResourceId
      )
    },

    // ==================== 策略 Getters ====================

    /**
     * 根据组织域获取策略
     */
    getPoliciesByDomain: (state) => (domain) => {
      return state.policies.filter(p => p.dom === domain)
    },

    /**
     * 根据主体获取策略
     */
    getPoliciesBySubject: (state) => (subject) => {
      return state.policies.filter(p => p.sub === subject)
    },

    /**
     * 获取特定角色在特定组织的策略
     */
    getPoliciesByRoleAndOrg: (state) => (roleId, orgId) => {
      return state.policies.filter(
        p => p.sub === roleId && p.dom === orgId
      )
    },

    // ==================== 用户 Getters ====================

    /**
     * 根据 ID 获取用户
     */
    getUserById: (state) => (id) => {
      return state.users.find(u => u.id === id)
    },

    /**
     * 获取组织下的所有用户
     */
    getUsersByOrganization: (state) => (orgId) => {
      return state.users.filter(u =>
        u.organizations?.some(org => org.id === orgId)
      )
    },

    // ==================== 角色 Getters ====================

    /**
     * 根据 ID 获取角色
     */
    getRoleById: (state) => (id) => {
      const find = (nodes) => {
        for (const node of nodes) {
          if (node.id === id) return node
          if (node.children) {
            const found = find(node.children)
            if (found) return found
          }
        }
        return null
      }
      return find(state.roles)
    },
  },

  actions: {
    ensureProjectPermissions() {
      const projectStore = useProjectMangerStore()
      if (!projectStore.currentProject) return null

      const normalized = normalizePermissions(projectStore.currentProject.permissions)
      projectStore.currentProject.permissions = normalized

      this.organizations = normalized.organizations
      this.organizationTypes = normalized.organizationTypes
      this.roles = normalized.roles
      this.resourceTypes = normalized.resourceTypes
      this.resources = normalized.resources
      this.users = normalized.users
      this.policies = normalized.policies
      this.settings = normalized.settings

      return normalized
    },

    // ==================== 兼容性别名方法（暂存区组件使用）====================

    /**
     * 添加组织（别名）
     */
    addOrg(organization) {
      return this.addOrganization(organization)
    },

    /**
     * 更新组织（别名）
     */
    updateOrg(id, updates) {
      return this.updateOrganization(id, updates)
    },

    /**
     * 删除组织（别名）
     */
    deleteOrg(id) {
      return this.removeOrganization(id)
    },

    /**
     * 删除角色（别名）
     */
    deleteRole(id) {
      return this.removeRole(id)
    },

    /**
     * 删除资源（别名）
     */
    deleteResource(id) {
      return this.removeResource(id)
    },

    /**
     * 更新资源类型
     */
    updateResourceType(id, updates) {
      const type = this.resourceTypes.find(t => t.id === id)
      if (type) {
        Object.assign(type, updates)
        return type
      }
      return null
    },

    /**
     * 删除资源类型
     */
    deleteResourceType(id) {
      const index = this.resourceTypes.findIndex(t => t.id === id)
      if (index !== -1) {
        return this.resourceTypes.splice(index, 1)[0]
      }
      return null
    },

    /**
     * 添加权限（别名）
     */
    addPermission(permission) {
      return this.addPolicy(permission)
    },

    /**
     * 更新权限（别名）
     */
    updatePermission(id, updates) {
      return this.updatePolicy(id, updates)
    },

    /**
     * 删除权限（别名）
     */
    deletePermission(id) {
      return this.removePolicy(id)
    },

    // ==================== 组织架构 Actions ====================

    /**
     * 添加组织节点
     */
    addOrganization(organization) {
      const newOrg = {
        id: uid(),
        children: [],
        ...organization,
        createdAt: new Date().toISOString(),
      }

      if (!organization.pId) {
        // 根节点
        this.organizations.push(newOrg)
      } else {
        // 查找父节点
        const parent = this.getOrganizationById(organization.pId)
        if (parent) {
          if (!parent.children) {
            parent.children = []
          }
          parent.children.push(newOrg)
        }
      }

      return newOrg
    },

    /**
     * 更新组织节点
     */
    updateOrganization(id, updates) {
      const org = this.getOrganizationById(id)
      if (org) {
        Object.assign(org, updates, {
          updatedAt: new Date().toISOString(),
        })
        return org
      }
      return null
    },

    /**
     * 删除组织节点
     */
    removeOrganization(id) {
      const remove = (nodes, targetId) => {
        for (let i = 0; i < nodes.length; i++) {
          if (nodes[i].id === targetId) {
            return nodes.splice(i, 1)[0]
          }
          if (nodes[i].children) {
            const removed = remove(nodes[i].children, targetId)
            if (removed) return removed
          }
        }
        return null
      }

      return remove(this.organizations, id)
    },

    /**
     * 添加组织节点类型
     */
    addOrganizationType(type) {
      this.organizationTypes.push({
        id: uid(),
        ...type,
      })
    },

    // ==================== 角色 Actions ====================

    /**
     * 添加角色
     */
    addRole(role) {
      const newRole = {
        id: uid(),
        children: [],
        ...role,
        createdAt: new Date().toISOString(),
      }

      if (!role.pId) {
        this.roles.push(newRole)
      } else {
        const parent = this.getRoleById(role.pId)
        if (parent) {
          if (!parent.children) {
            parent.children = []
          }
          parent.children.push(newRole)
        }
      }

      return newRole
    },

    /**
     * 更新角色
     */
    updateRole(id, updates) {
      const role = this.getRoleById(id)
      if (role) {
        Object.assign(role, updates, {
          updatedAt: new Date().toISOString(),
        })
        return role
      }
      return null
    },

    /**
     * 删除角色
     */
    removeRole(id) {
      const remove = (nodes, targetId) => {
        for (let i = 0; i < nodes.length; i++) {
          if (nodes[i].id === targetId) {
            return nodes.splice(i, 1)[0]
          }
          if (nodes[i].children) {
            const removed = remove(nodes[i].children, targetId)
            if (removed) return removed
          }
        }
        return null
      }

      return remove(this.roles, id)
    },

    // ==================== 资源 Actions ====================

    /**
     * 添加资源
     */
    addResource(resource) {
      const newResource = {
        id: uid(),
        ...resource,
        createdAt: new Date().toISOString(),
      }

      this.resources.push(newResource)
      return newResource
    },

    /**
     * 更新资源
     */
    updateResource(id, updates) {
      const resource = this.getResourceById(id)
      if (resource) {
        Object.assign(resource, updates, {
          updatedAt: new Date().toISOString(),
        })
        return resource
      }
      return null
    },

    /**
     * 删除资源
     */
    removeResource(id) {
      const index = this.resources.findIndex(r => r.id === id)
      if (index !== -1) {
        return this.resources.splice(index, 1)[0]
      }
      return null
    },

    /**
     * 批量导入资源
     */
    batchImportResources(resources) {
      resources.forEach(resource => {
        this.addResource(resource)
      })
    },

    /**
     * 添加资源类型
     */
    addResourceType(type) {
      this.resourceTypes.push({
        id: uid(),
        ...type,
      })
    },

    // ==================== 策略 Actions ====================

    /**
     * 添加策略
     */
    addPolicy(policy) {
      const newPolicy = {
        id: uid(),
        ptype: 'p',
        ...policy,
        createdAt: new Date().toISOString(),
      }

      this.policies.push(newPolicy)
      return newPolicy
    },

    /**
     * 更新策略
     */
    updatePolicy(id, updates) {
      const policy = this.policies.find(p => p.id === id)
      if (policy) {
        Object.assign(policy, updates, {
          updatedAt: new Date().toISOString(),
        })
        return policy
      }
      return null
    },

    /**
     * 删除策略
     */
    removePolicy(id) {
      const index = this.policies.findIndex(p => p.id === id)
      if (index !== -1) {
        return this.policies.splice(index, 1)[0]
      }
      return null
    },

    /**
     * 批量删除策略
     */
    batchRemovePolicies(ids) {
      ids.forEach(id => {
        this.removePolicy(id)
      })
    },

    /**
     * 删除组织下的所有策略
     */
    removePoliciesByDomain(domain) {
      this.policies = this.policies.filter(p => p.dom !== domain)
    },

    /**
     * 删除角色的所有策略
     */
    removePoliciesBySubject(subject) {
      this.policies = this.policies.filter(p => p.sub !== subject)
    },

    // ==================== 用户 Actions ====================

    /**
     * 添加用户
     */
    addUser(user) {
      const newUser = {
        id: uid(),
        organizations: [],
        roles: [],
        ...user,
        createdAt: new Date().toISOString(),
      }

      this.users.push(newUser)
      return newUser
    },

    /**
     * 更新用户
     */
    updateUser(id, updates) {
      const user = this.getUserById(id)
      if (user) {
        Object.assign(user, updates, {
          updatedAt: new Date().toISOString(),
        })
        return user
      }
      return null
    },

    /**
     * 删除用户
     */
    removeUser(id) {
      const index = this.users.findIndex(u => u.id === id)
      if (index !== -1) {
        return this.users.splice(index, 1)[0]
      }
      return null
    },

    // ==================== UI 状态 Actions ====================

    /**
     * 设置选中的组织节点
     */
    setSelectedOrgId(id) {
      this.selectedOrgId = id
    },

    /**
     * 设置选中的角色
     */
    setSelectedRoleId(id) {
      this.selectedRoleId = id
    },

    /**
     * 设置选中的用户
     */
    setSelectedUserId(id) {
      this.selectedUserId = id
    },

    // ==================== 初始化 Actions ====================

    /**
     * 初始化示例数据（用于开发测试）
     */
    initSampleData() {
      // 组织架构示例
      this.organizations = [
        {
          id: 'org-group',
          name: '集团总部',
          type: 'company',
          pId: null,
          children: [
            {
              id: 'org-sales',
              name: '销售部',
              type: 'department',
              pId: 'org-group',
              children: [
                {
                  id: 'org-sales-east',
                  name: '华东区',
                  type: 'team',
                  pId: 'org-sales',
                  children: [],
                },
                {
                  id: 'org-sales-south',
                  name: '华南区',
                  type: 'team',
                  pId: 'org-sales',
                  children: [],
                },
              ],
            },
            {
              id: 'org-tech',
              name: '技术部',
              type: 'department',
              pId: 'org-group',
              children: [
                {
                  id: 'org-tech-dev',
                  name: '研发团队',
                  type: 'team',
                  pId: 'org-tech',
                  children: [],
                },
              ],
            },
          ],
        },
      ]

      // 角色示例（带继承链）
      this.roles = [
        {
          id: 'role:admin',
          name: '超级管理员',
          pId: null,
          children: [],
        },
        {
          id: 'role:manager',
          name: '部门经理',
          pId: null,
          children: [
            {
              id: 'role:team-lead',
              name: '团队组长',
              pId: 'role:manager',
              children: [
                {
                  id: 'role:senior-employee',
                  name: '高级员工',
                  pId: 'role:team-lead',
                  children: [],
                },
              ],
            },
          ],
        },
        {
          id: 'role:employee',
          name: '普通员工',
          pId: null,
          children: [],
        },
      ]

      // 资源示例（展示新的层级结构）
      this.resources = [
        // ========== 页面级资源（顶层）==========
        {
          id: uid(),
          name: '用户管理页面',
          identifier: 'page:user-management',
          type: 'page',
          module: '系统管理',
          description: '用户管理页面',
          parentResourceId: null,  // 顶层资源
          actions: ['access', 'menu'],
        },

        // ========== 页面下的组件 ==========
        {
          id: uid(),
          name: '新增用户按钮',
          identifier: 'component:user-add-btn',
          type: 'component',
          module: '系统管理',
          description: '用户管理页面的新增按钮',
          parentResourceId: 'page:user-management',  // 父资源：用户管理页面
          actions: ['visible', 'click'],
        },

        // ========== 组件下的 API ==========
        {
          id: uid(),
          name: '创建用户API',
          identifier: 'url:/api/users[POST]',
          type: 'url',
          module: '系统管理',
          description: '创建用户的API接口',
          parentResourceId: 'component:user-add-btn',  // 父资源：新增用户按钮
          urlPattern: '/api/users',
          matchMethod: 'exact',
          actions: ['POST'],
        },

        // ========== 另一个组件：用户表格 ==========
        {
          id: uid(),
          name: '用户列表表格',
          identifier: 'component:user-table',
          type: 'component',
          module: '系统管理',
          description: '用户管理页面的列表表格',
          parentResourceId: 'page:user-management',  // 父资源：用户管理页面
          actions: ['visible'],
        },

        // ========== 表格组件下的 API ==========
        {
          id: uid(),
          name: '获取用户列表API',
          identifier: 'url:/api/users[GET]',
          type: 'url',
          module: '系统管理',
          description: '获取用户列表的API接口',
          parentResourceId: 'component:user-table',  // 父资源：用户列表表格
          urlPattern: '/api/users',
          matchMethod: 'exact',
          actions: ['GET'],
        },

        // ========== API 下的数据实体 ==========
        {
          id: uid(),
          name: '用户数据',
          identifier: 'data:users',
          type: 'data',
          module: '系统管理',
          description: '用户数据表，包含敏感字段',
          parentResourceId: 'url:/api/users[GET]',  // 父资源：获取用户列表API
          actions: ['read', 'export'],
          // 字段配置
          fields: [
            { name: 'id', label: 'ID', sensitivity: 'normal' },
            { name: 'name', label: '姓名', sensitivity: 'normal' },
            { name: 'username', label: '账号', sensitivity: 'normal' },
            { name: 'email', label: '邮箱', sensitivity: 'normal' },
            { name: 'phone', label: '手机号', sensitivity: 'sensitive' },
            { name: 'salary', label: '薪资', sensitivity: 'confidential' },
            { name: 'idcard', label: '身份证', sensitivity: 'confidential' },
            { name: 'department', label: '部门', sensitivity: 'normal' },
          ],
        },

        // ========== 另一个示例：订单管理 ==========
        {
          id: uid(),
          name: '订单管理页面',
          identifier: 'page:order-management',
          type: 'page',
          module: '业务管理',
          description: '订单管理页面',
          parentResourceId: null,
          actions: ['access', 'menu'],
        },

        {
          id: uid(),
          name: '删除订单按钮',
          identifier: 'component:order-delete-btn',
          type: 'component',
          module: '业务管理',
          description: '订单管理页面的删除按钮',
          parentResourceId: 'page:order-management',
          actions: ['visible', 'click'],
        },

        {
          id: uid(),
          name: '删除订单API',
          identifier: 'url:/api/orders/:id[DELETE]',
          type: 'url',
          module: '业务管理',
          description: '删除订单的API接口',
          parentResourceId: 'component:order-delete-btn',
          urlPattern: '/api/orders/:id',
          matchMethod: 'keyMatch2',
          actions: ['DELETE'],
        },
      ]

      // 策略示例（演示继承和覆盖）
      this.policies = [
        // === 场景1: 集团层级配置基础权限 ===
        {
          id: uid(),
          ptype: 'p',
          sub: 'role:admin',
          dom: 'org-group',
          obj: 'component:user-management',
          act: 'access',
          eft: 'allow',
        },
        {
          id: uid(),
          ptype: 'p',
          sub: 'role:admin',
          dom: 'org-group',
          obj: 'component:user-management',
          act: 'menu',
          eft: 'allow',
        },
        {
          id: uid(),
          ptype: 'p',
          sub: 'role:manager',
          dom: 'org-group',
          obj: 'component:user-management',
          act: 'access',
          eft: 'allow',
        },
        {
          id: uid(),
          ptype: 'p',
          sub: 'role:employee',
          dom: 'org-group',
          obj: 'component:user-management',
          act: 'access',
          eft: 'allow',
        },

        // === 场景2: 销售部订单管理权限 ===
        {
          id: uid(),
          ptype: 'p',
          sub: 'role:manager',
          dom: 'org-sales',
          obj: 'component:order-management',
          act: 'access',
          eft: 'allow',
        },
        {
          id: uid(),
          ptype: 'p',
          sub: 'role:employee',
          dom: 'org-sales',
          obj: 'component:order-management',
          act: 'access',
          eft: 'allow',
        },
        {
          id: uid(),
          ptype: 'p',
          sub: 'role:manager',
          dom: 'org-sales',
          obj: 'component:order-delete-btn',
          act: 'click',
          eft: 'allow',
        },

        // === 场景3: 华东区排除删除权限（演示 deny 优先级）===
        {
          id: uid(),
          ptype: 'p',
          sub: 'role:manager',
          dom: 'org-sales-east',
          obj: 'component:order-delete-btn',
          act: 'click',
          eft: 'deny',  // 明确拒绝，覆盖父组织的 allow
        },

        // === 场景4: 薪资报表权限 ===
        {
          id: uid(),
          ptype: 'p',
          sub: 'role:admin',
          dom: 'org-group',
          obj: 'component:salary-report',
          act: 'access',
          eft: 'allow',
        },
        {
          id: uid(),
          ptype: 'p',
          sub: 'role:manager',
          dom: 'org-group',
          obj: 'component:salary-report',
          act: 'access',
          eft: 'allow',
        },
        // 技术部经理没有薪资报表权限（使用 deny）
        {
          id: uid(),
          ptype: 'p',
          sub: 'role:manager',
          dom: 'org-tech',
          obj: 'component:salary-report',
          act: 'access',
          eft: 'deny',  // 技术部门经理无法查看薪资
        },

        // === 场景5: API 权限 ===
        {
          id: uid(),
          ptype: 'p',
          sub: 'role:admin',
          dom: 'org-group',
          obj: 'url:/api/users/:id',
          act: '*',
          eft: 'allow',
        },
        {
          id: uid(),
          ptype: 'p',
          sub: 'role:manager',
          dom: 'org-group',
          obj: 'url:/api/users/:id',
          act: 'GET',
          eft: 'allow',
        },

        // === 场景6: 数据实体权限 ===
        {
          id: uid(),
          ptype: 'p',
          sub: 'role:admin',
          dom: 'org-group',
          obj: 'data:users',
          act: 'read',
          eft: 'allow',
        },
        {
          id: uid(),
          ptype: 'p',
          sub: 'role:manager',
          dom: 'org-group',
          obj: 'data:users',
          act: 'read',
          eft: 'allow',
        },
        {
          id: uid(),
          ptype: 'p',
          sub: 'role:employee',
          dom: 'org-group',
          obj: 'data:users',
          act: 'read',
          eft: 'allow',
        },

        // === 场景7: 字段级权限（薪资字段）===
        // HR 可以查看和编辑薪资
        {
          id: uid(),
          ptype: 'p',
          sub: 'role:admin',
          dom: 'org-group',
          obj: 'data:users.salary',
          act: 'visible',
          eft: 'allow',
        },
        {
          id: uid(),
          ptype: 'p',
          sub: 'role:admin',
          dom: 'org-group',
          obj: 'data:users.salary',
          act: 'editable',
          eft: 'allow',
        },
        // 普通员工看不到薪资字段
        {
          id: uid(),
          ptype: 'p',
          sub: 'role:employee',
          dom: 'org-group',
          obj: 'data:users.salary',
          act: 'visible',
          eft: 'deny',
        },
        // 经理可以看到但不能编辑薪资
        {
          id: uid(),
          ptype: 'p',
          sub: 'role:manager',
          dom: 'org-group',
          obj: 'data:users.salary',
          act: 'visible',
          eft: 'allow',
        },
        {
          id: uid(),
          ptype: 'p',
          sub: 'role:manager',
          dom: 'org-group',
          obj: 'data:users.salary',
          act: 'editable',
          eft: 'deny',
        },

        // === 场景8: 手机号脱敏显示 ===
        // 普通员工看到脱敏的手机号
        {
          id: uid(),
          ptype: 'p',
          sub: 'role:employee',
          dom: 'org-group',
          obj: 'data:users.phone',
          act: 'visible',
          eft: 'allow',
        },
        {
          id: uid(),
          ptype: 'p',
          sub: 'role:employee',
          dom: 'org-group',
          obj: 'data:users.phone',
          act: 'mask',
          eft: 'allow',  // 脱敏显示
        },
      ]

      // 用户示例
      this.users = [
        {
          id: uid(),
          name: '张三',
          account: 'zhangsan',
          username: 'zhangsan',
          email: 'zhangsan@example.com',
          phone: '13800138001',
          status: 'active',
          organizations: [
            { id: 'org-sales-east', name: '华东区' },
          ],
          orgs: ['org-sales-east'],
          roles: ['role:manager'],
        },
        {
          id: uid(),
          name: '李四',
          account: 'lisi',
          username: 'lisi',
          email: 'lisi@example.com',
          phone: '13800138002',
          status: 'active',
          organizations: [
            { id: 'org-sales-south', name: '华南区' },
          ],
          orgs: ['org-sales-south'],
          roles: ['role:manager'],
        },
        {
          id: uid(),
          name: '王五',
          account: 'wangwu',
          username: 'wangwu',
          email: 'wangwu@example.com',
          phone: '13800138003',
          status: 'active',
          organizations: [
            { id: 'org-tech-dev', name: '研发团队' },
          ],
          orgs: ['org-tech-dev'],
          roles: ['role:team-lead'],
        },
        {
          id: uid(),
          name: '赵六',
          account: 'zhaoliu',
          username: 'zhaoliu',
          email: 'zhaoliu@example.com',
          phone: '13800138004',
          status: 'inactive',
          organizations: [
            { id: 'org-sales-east', name: '华东区' },
          ],
          orgs: ['org-sales-east'],
          roles: ['role:employee'],
        },
      ]
      this.syncProjectPermissions()
    },

    syncProjectPermissions() {
      const projectStore = useProjectMangerStore()
      if (!projectStore.currentProject) return null

      const permissionData = normalizePermissions({
        ...projectStore.currentProject.permissions,
        organizations: this.organizations,
        organizationTypes: this.organizationTypes,
        roles: this.roles,
        resourceTypes: this.resourceTypes,
        resources: this.resources,
        users: this.users,
        policies: this.policies,
        settings: this.settings,
      })

      projectStore.currentProject.permissions = permissionData
      this.ensureProjectPermissions()
      return permissionData
    },

    async loadFromBackend() {
      const permissions = this.ensureProjectPermissions()
      return !!permissions
    },

    async saveToBackend() {
      const projectStore = useProjectMangerStore()
      const permissions = this.syncProjectPermissions()
      if (!permissions) throw new Error('请先选择项目')
      await projectStore.saveCurrentProject()
    },
  },
})
