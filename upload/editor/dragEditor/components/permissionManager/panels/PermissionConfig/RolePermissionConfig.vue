<template>
  <div class="column no-wrap fit bg-grey-10">
    <q-splitter
      v-model="mainSplitter"
      :limits="[15, 30]"
      dense
      dark
      class="fit"
    >
      <!-- 左栏：组织树 -->
      <template #before>
        <div class="column no-wrap fit">
          <q-bar dense dark class="bg-grey-9 text-grey-7">
            <div class="text-caption">选择组织</div>
            <q-space />
          </q-bar>

          <q-scroll-area class="col bg-grey-10">
            <q-tree
              :nodes="orgTreeNodes"
              node-key="id"
              label-key="name"
              :selected="selectedOrgId"
              v-model:expanded="expandedNodes"
              @update:selected="handleOrgSelect"
              dense
              dark
              class="text-grey-7"
            >
              <template #default-header="prop">
                <div
                  class="permission-tree-node column full-width"
                  :class="{ 'permission-tree-node--selected': prop.node.id === selectedOrgId }"
                >
                  <div
                    class="text-weight-medium cursor-pointer"
                    @click="toggleNodeExpansion(prop.node)"
                  >
                    {{ prop.node.name }}
                  </div>
                  <div v-if="prop.node.code || prop.node.description" class="q-pl-md q-mt-xs">
                    <div v-if="prop.node.code" class="text-grey-8" style="font-size: 11px; line-height: 1.3">
                      编码：{{ prop.node.code }}
                    </div>
                    <div v-if="prop.node.description" class="text-grey-8" style="font-size: 11px; line-height: 1.3">
                      {{ prop.node.description }}
                    </div>
                  </div>
                </div>
              </template>
            </q-tree>
          </q-scroll-area>
        </div>
      </template>

      <template #after>
        <q-splitter
          v-model="rightSplitter"
          :limits="[30, 70]"
          dense
          dark
          class="fit"
        >
          <!-- 中栏：角色列表 -->
          <template #before>
            <div class="column no-wrap fit">
              <q-bar dense dark class="bg-grey-9 text-grey-7">
                <div class="text-caption">
                  {{ selectedOrgId ? '该组织的角色' : '角色列表' }}
                </div>
                <q-space />
                <q-chip v-if="orgRoles.length > 0" dense  :label="orgRoles.length" color="primary" />
              </q-bar>

              <q-scroll-area class="col bg-grey-10">
                <q-list dense dark>
                  <q-item
                    v-for="role in orgRoles"
                    :key="role.id"
                    clickable
                    :active="selectedRoleId === role.id"
                    active-class="bg-grey-9"
                    @click="handleSelectRole(role)"
                    dense
                    dark
                  >
                    <q-item-section>
                      <q-item-label class="text-grey-7">{{ role.name }}</q-item-label>
                      <q-item-label caption class="text-grey-7">
                        {{ getRolePermissionCount(role.id) }} 项权限
                      </q-item-label>
                    </q-item-section>
                  </q-item>

                  <q-item v-if="!selectedOrgId" dense dark>
                    <q-item-section class="text-center text-grey-7 q-py-md">
                      <q-icon name="info" class="q-mb-xs" />
                      <div class="text-caption">请先从左侧选择组织</div>
                    </q-item-section>
                  </q-item>

                  <q-item v-else-if="orgRoles.length === 0" dense dark>
                    <q-item-section class="text-center text-grey-7 q-py-md">
                      <div class="text-caption">该组织暂无角色</div>
                    </q-item-section>
                  </q-item>
                </q-list>
              </q-scroll-area>
            </div>
          </template>

          <!-- 右栏：权限配置 -->
          <template #after>
            <div class="column no-wrap fit">
              <div v-if="selectedRoleId && selectedOrgId" class="column no-wrap fit">
                <q-bar dense dark class="bg-grey-9 text-grey-7">
                  <div class="text-caption">
                    {{ currentRoleName }} 在 {{ getOrgName(selectedOrgId) }} 的权限
                  </div>
                  <q-space />
                  <q-chip dense  :label="`${roleDirectPermissions.length} 项直接配置`" color="primary" />
                </q-bar>

                <!-- 筛选工具栏 -->
                <div class="q-pa-sm bg-grey-9">
                  <div class="row q-gutter-xs items-center">
                    <!-- 资源类型筛选 -->
                    <q-select
                      v-model="filterResourceType"
                      :options="resourceTypeFilterOptions"
                      label="资源类型"
                      dense
                      dark
                      outlined
                      emit-value
                      map-options
                      clearable
                      style="min-width: 140px"
                    >
                      <template v-slot:prepend>
                        <q-icon name="category"  />
                      </template>
                    </q-select>

                    <!-- 权限效果筛选 -->
                    <q-select
                      v-model="filterPermissionEffect"
                      :options="permissionEffectFilterOptions"
                      label="权限效果"
                      dense
                      dark
                      outlined
                      emit-value
                      map-options
                      clearable
                      style="min-width: 120px"
                    >
                      <template v-slot:prepend>
                        <q-icon name="filter_list"  />
                      </template>
                    </q-select>

                    <!-- 搜索框 -->
                    <q-input
                      v-model="searchResourceText"
                      dense
                      dark
                      outlined
                      placeholder="搜索资源"
                      clearable
                      style="flex: 1; min-width: 120px"
                    >
                      <template v-slot:prepend>
                        <q-icon name="search"  />
                      </template>
                    </q-input>

                    <!-- 仅显示已配置 -->
                    <q-toggle
                      v-model="showOnlyConfigured"
                      dense
                      dark
                      label="仅已配置"
                      color="primary"

                    />
                  </div>
                </div>

                <q-scroll-area class="col bg-grey-10">
                  <!-- 资源树（类似 ResourcePanel） -->
                  <q-tree
                    :nodes="filteredResourceTree"
                    node-key="id"
                    label-key="name"
                    :selected="selectedResourceId"
                    v-model:expanded="expandedResourceNodes"
                    @update:selected="handleResourceSelect"
                    dense
                    dark
                    class="text-grey-7"
                    :key="permissionsKey"
                  >
                    <template #default-header="prop">
                      <div
                        class="permission-tree-node column full-width"
                        :class="{ 'permission-tree-node--selected': prop.node.id === selectedResourceId }"
                      >
                        <!-- 模块节点 -->
                        <div v-if="prop.node.isModule" class="row items-center full-width">
                          <q-icon name="folder" color="grey-7"  class="q-mr-xs" />
                          <div class="text-weight-medium col">{{ prop.node.name }}</div>
                        </div>

                        <!-- 资源节点 -->
                        <div v-else class="column full-width">
                          <div class="row items-center full-width">
                            <q-icon
                              :name="getResourceTypeIcon(prop.node.type)"
                              :color="getResourceTypeColor(prop.node.type)"

                              class="q-mr-xs"
                            />
                            <div class="col">
                              <div class="text-weight-medium">{{ prop.node.name }}</div>
                              <div class="text-caption text-grey-8 q-mt-xs" style="font-size: 11px; line-height: 1.3">
                                {{ prop.node.identifier }}
                              </div>
                            </div>
                          </div>

                          <!-- 资源的操作配置 -->
                          <div v-if="getResourceActions(prop.node).length > 0" class="q-pl-md q-mt-sm">
                            <div
                              v-for="action in getResourceActions(prop.node)"
                              :key="action.code"
                              class="q-mb-sm"
                            >
                              <div class="row items-center q-gutter-xs">
                                <div class="text-caption text-grey-7" style="min-width: 60px; font-size: 11px">
                                  {{ action.name }}：
                                </div>

                                <!-- 按钮组：允许、禁用、删除 -->
                                <q-btn-group dense flat>
                                  <!-- 允许按钮 -->
                                  <q-btn
                                    dense
                                    flat
                                    size="sm"
                                    label="允许"
                                    icon="check_circle"
                                    :color="getPermissionState(prop.node.identifier, action.code) === 'allow' ? 'positive' : 'grey-7'"
                                    :outline="getPermissionState(prop.node.identifier, action.code) !== 'allow'"
                                    :unelevated="getPermissionState(prop.node.identifier, action.code) === 'allow'"
                                    @click="handlePermissionChange(prop.node, action, 'allow')"
                                  >
                                    <q-tooltip>设置为允许</q-tooltip>
                                  </q-btn>

                                  <!-- 禁用按钮 -->
                                  <q-btn
                                    dense
                                    flat
                                    size="sm"
                                    label="禁用"
                                    icon="cancel"
                                    :color="getPermissionState(prop.node.identifier, action.code) === 'deny' ? 'negative' : 'grey-7'"
                                    :outline="getPermissionState(prop.node.identifier, action.code) !== 'deny'"
                                    :unelevated="getPermissionState(prop.node.identifier, action.code) === 'deny'"
                                    @click="handlePermissionChange(prop.node, action, 'deny')"
                                  >
                                    <q-tooltip>设置为禁用</q-tooltip>
                                  </q-btn>

                                  <!-- 删除（继承）按钮 -->
                                  <q-btn
                                    dense
                                    flat
                                    size="sm"
                                    label="继承"
                                    icon="arrow_downward"
                                    :color="getPermissionState(prop.node.identifier, action.code) === null ? 'primary' : 'grey-7'"
                                    :outline="getPermissionState(prop.node.identifier, action.code) !== null"
                                    :unelevated="getPermissionState(prop.node.identifier, action.code) === null"
                                    :disable="!hasDirectPermission(prop.node.identifier, action.code)"
                                    @click="handleDeletePermission(prop.node, action)"
                                  >
                                    <q-tooltip>
                                      {{ hasDirectPermission(prop.node.identifier, action.code) ? '删除配置，恢复继承' : '当前为继承状态' }}
                                    </q-tooltip>
                                  </q-btn>
                                </q-btn-group>
                              </div>

                              <!-- 显示继承来源信息 -->
                              <div
                                v-if="!hasDirectPermission(prop.node.identifier, action.code) && getInheritedPermissionInfo(prop.node.identifier, action.code)"
                                class="q-pl-md q-mt-xs text-caption text-grey-8"
                                style="font-size: 10px"
                              >
                                ↳ 继承自 {{ getInheritedPermissionInfo(prop.node.identifier, action.code).source }}
                                <span :class="getInheritedPermissionInfo(prop.node.identifier, action.code).eft === 'deny' ? 'text-negative' : 'text-positive'">
                                  {{ getInheritedPermissionInfo(prop.node.identifier, action.code).effect }}
                                </span>
                              </div>
                            </div>
                          </div>
                          <div v-else class="q-pl-md q-mt-xs text-caption text-grey-8">
                            无可用操作
                          </div>
                        </div>
                      </div>
                    </template>
                  </q-tree>

                  <!-- 空状态 -->
                  <div v-if="filteredResourceTree.length === 0" class="text-center text-grey-7 q-py-xl">
                    <q-icon name="inventory_2" size="md" class="q-mb-md" />
                    <div class="text-subtitle2 q-mb-sm">
                      {{ showOnlyConfigured ? '暂无已配置的资源' : '暂无可配置的资源' }}
                    </div>
                    <div class="text-caption text-grey-8">
                      {{ showOnlyConfigured ? '取消「仅已配置」筛选查看所有资源' : '请先在资源管理Tab中注册资源' }}
                    </div>
                  </div>
                </q-scroll-area>
              </div>

              <!-- 提示信息（未选中） -->
              <div v-else class="column no-wrap fit items-center justify-center text-center text-grey-7">
                <q-icon name="info_outline" size="lg" class="q-mb-md" />
                <div class="text-subtitle2 q-mb-sm">请选择配置对象</div>
                <div class="text-caption text-grey-8" style="max-width: 300px">
                  <div class="q-mb-sm">1. 从左侧选择组织</div>
                  <div>2. 从中间选择角色</div>
                  <div class="q-mb-sm">3. 配置该角色在该组织的权限</div>
                  <div class="text-info" style="font-size: 10px">
                    说明：选择"继承"使用上级组织的权限配置
                  </div>
                </div>
              </div>
            </div>
          </template>
        </q-splitter>
      </template>
    </q-splitter>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import { useQuasar } from 'quasar';
import { usePermissionStore } from '../../composables/usePermissionStore.js';

const $q = useQuasar();
const permissionStore = usePermissionStore();

// 分割器
const mainSplitter = ref(20);
const rightSplitter = ref(35);

// 数据
const orgTreeData = ref([]);
const expandedNodes = ref([]);
const expandedResourceNodes = ref([]); // 资源树展开节点
const roles = ref([]);
const permissions = ref([]);
const resources = ref([]);

// 选中项
const selectedOrgId = ref(null);
const selectedRoleId = ref(null);
const selectedResourceId = ref(null);

// 筛选条件
const filterResourceType = ref(null);
const filterPermissionEffect = ref(null);
const searchResourceText = ref('');
const showOnlyConfigured = ref(true); // 默认仅显示已配置的

// 权限状态选项（仅允许和拒绝，不包括继承）
const permissionStateOptions = [
  { label: '允许', value: 'allow', color: 'positive' },
  { label: '拒绝', value: 'deny', color: 'negative' }
];

// 资源类型筛选选项
const resourceTypeFilterOptions = computed(() => {
  const types = permissionStore.getResourceTypes();
  return types.map(t => ({
    label: t.name,
    value: t.id
  }));
});

// 权限效果筛选选项
const permissionEffectFilterOptions = [
  { label: '继承', value: 'inherit' },
  { label: '允许', value: 'allow' },
  { label: '拒绝', value: 'deny' }
];

// 组织树节点
const orgTreeNodes = computed(() => {
  return convertToTreeNodes(orgTreeData.value);
});

// 该组织的角色列表
const orgRoles = computed(() => {
  if (!selectedOrgId.value) return [];
  return roles.value;
});

// 当前角色
const currentRole = computed(() => {
  return roles.value.find(r => r.id === selectedRoleId.value) || null;
});

// 当前角色名称
const currentRoleName = computed(() => {
  return currentRole.value?.name || '';
});

// 该角色在该组织的权限（包括继承的权限）
const rolePermissions = computed(() => {
  if (!selectedRoleId.value || !selectedOrgId.value) return [];
  return permissionStore.getRoleAllPermissions(selectedRoleId.value, selectedOrgId.value);
});

// 该角色在该组织的直接配置权限（不包括继承）
const roleDirectPermissions = computed(() => {
  if (!selectedRoleId.value || !selectedOrgId.value) return [];
  return permissions.value.filter(p =>
    p.sub === selectedRoleId.value &&
    p.dom === selectedOrgId.value
  );
});

// 权限更新 key（用于强制刷新列表）
const permissionsKey = computed(() => {
  return `${selectedRoleId.value}-${selectedOrgId.value}-${permissions.value.length}-${JSON.stringify(roleDirectPermissions.value.map(p => p.id))}`;
});

// 资源树（基于层级关系）
const filteredResourceTree = computed(() => {
  // 检查资源是否满足筛选条件
  const matchesFilter = (resource) => {
    // 搜索筛选
    if (searchResourceText.value) {
      const search = searchResourceText.value.toLowerCase();
      if (!resource.name?.toLowerCase().includes(search) &&
          !resource.identifier?.toLowerCase().includes(search)) {
        return false;
      }
    }

    // 资源类型筛选
    if (filterResourceType.value && resource.type !== filterResourceType.value) {
      return false;
    }

    // "仅显示已配置"筛选
    if (showOnlyConfigured.value) {
      const hasConfigured = getResourceActions(resource).some(action => {
        const state = getPermissionState(resource.identifier, action.code);
        return state !== null;
      });
      if (!hasConfigured) return false;
    }

    // 权限效果筛选
    if (filterPermissionEffect.value) {
      const hasMatchingEffect = getResourceActions(resource).some(action => {
        const state = getPermissionState(resource.identifier, action.code);
        if (filterPermissionEffect.value === 'inherit') {
          return state === null;
        }
        return state === filterPermissionEffect.value;
      });
      if (!hasMatchingEffect) return false;
    }

    return true;
  };

  // 递归构建资源树，如果子节点满足条件，父节点也显示
  const buildResourceTree = (parentId = null) => {
    const resourcesAtLevel = resources.value.filter(r => r.parentResourceId === parentId);

    return resourcesAtLevel
      .map(resource => {
        const children = buildResourceTree(resource.identifier);
        const selfMatches = matchesFilter(resource);
        const hasMatchingChildren = children.length > 0;

        // 如果自己满足条件或有满足条件的子节点，则显示
        if (selfMatches || hasMatchingChildren) {
          return {
            ...resource,
            isModule: false,
            children: children.length > 0 ? children : undefined
          };
        }

        return null;
      })
      .filter(r => r !== null);
  };

  const tree = buildResourceTree();

  // 如果有模块，按模块分组
  const modules = [
    { id: 'module-通用', name: '通用', parentId: null }
  ];

  if (modules && modules.length > 0) {
    const buildModuleTree = (parentId = null) => {
      return modules
        .filter(m => m.parentId === parentId)
        .map(module => {
          // 该模块下的顶层资源（parentResourceId === null）
          const moduleResources = tree.filter(r => r.module === module.name && !r.parentResourceId);
          const childModules = buildModuleTree(module.id);

          // 只显示有资源的模块
          if (moduleResources.length === 0 && childModules.length === 0) {
            return null;
          }

          return {
            id: module.id,
            name: module.name,
            isModule: true,
            children: [
              ...childModules,
              ...moduleResources
            ]
          };
        })
        .filter(m => m !== null);
    };

    return buildModuleTree();
  }

  return tree;
});

// 按资源类型分组并筛选（保留旧逻辑作为备用）
const filteredResourceGroups = computed(() => {
  const types = permissionStore.getResourceTypes();

  // 图标和颜色映射（适配 3 种资源类型）
  const iconColorMap = {
    component: { icon: 'widgets', color: 'primary' },
    url: { icon: 'api', color: 'info' },
    data: { icon: 'table_chart', color: 'warning' }
  };

  return types
    .map(type => {
      // 筛选该类型的资源
      let typeResources = resources.value.filter(r => r.type === type.id);

      // 应用资源类型筛选
      if (filterResourceType.value && type.id !== filterResourceType.value) {
        return null;
      }

      // 应用搜索筛选
      if (searchResourceText.value) {
        const search = searchResourceText.value.toLowerCase();
        typeResources = typeResources.filter(r =>
          r.name?.toLowerCase().includes(search) ||
          r.identifier?.toLowerCase().includes(search)
        );
      }

      // 应用"仅显示已配置"筛选
      if (showOnlyConfigured.value) {
        typeResources = typeResources.filter(r => {
          return getResourceActions(r).some(action => {
            const state = getPermissionState(r.identifier, action.code);
            return state !== null;  // 有直接配置（allow/deny）
          });
        });
      }

      // 应用权限效果筛选
      if (filterPermissionEffect.value) {
        typeResources = typeResources.filter(r => {
          return getResourceActions(r).some(action => {
            const state = getPermissionState(r.identifier, action.code);
            // 'inherit' 筛选值对应 null 状态
            if (filterPermissionEffect.value === 'inherit') {
              return state === null;
            }
            return state === filterPermissionEffect.value;
          });
        });
      }

      // 如果该类型没有资源，返回 null
      if (typeResources.length === 0) {
        return null;
      }

      // 统计该类型的权限数量
      let allowCount = 0;
      let denyCount = 0;
      let hasConfigured = false;

      typeResources.forEach(r => {
        getResourceActions(r).forEach(action => {
          const state = getPermissionState(r.identifier, action.code);
          if (state === 'allow') {
            allowCount++;
            hasConfigured = true;
          } else if (state === 'deny') {
            denyCount++;
            hasConfigured = true;
          }
        });
      });

      const iconColor = iconColorMap[type.id] || { icon: 'category', color: 'grey-7' };

      return {
        type: type.id,
        typeName: type.name,
        icon: iconColor.icon,
        color: iconColor.color,
        resources: typeResources,
        allowCount,
        denyCount,
        hasConfigured
      };
    })
    .filter(g => g !== null)
    .sort((a, b) => {
      // 有配置的类型排在前面
      if (a.hasConfigured && !b.hasConfigured) return -1;
      if (!a.hasConfigured && b.hasConfigured) return 1;
      return a.typeName.localeCompare(b.typeName, 'zh-CN');
    });
});

/**
 * 获取资源类型图标
 */
function getResourceTypeIcon(typeId) {
  const iconMap = {
    page: 'web',
    url: 'api',
    component: 'widgets',
    data: 'table_chart'
  };
  return iconMap[typeId] || 'category';
}

/**
 * 获取资源类型颜色
 */
function getResourceTypeColor(typeId) {
  const colorMap = {
    page: 'primary',
    url: 'info',
    component: 'secondary',
    data: 'warning'
  };
  return colorMap[typeId] || 'grey-7';
}

/**
 * 转换为 q-tree 格式
 */
function convertToTreeNodes(nodes) {
  if (!nodes || nodes.length === 0) return [];
  return nodes.map(node => ({
    ...node,
    children: node.children ? convertToTreeNodes(node.children) : undefined
  }));
}

/**
 * 加载数据
 */
function loadData() {
  orgTreeData.value = permissionStore.getOrgTreeData();
  roles.value = permissionStore.getRoles();
  permissions.value = permissionStore.getPermissions();
  resources.value = permissionStore.getResources();

  if (orgTreeData.value.length > 0) {
    expandedNodes.value = orgTreeData.value.map(org => org.id);
  }

  // 自动展开资源树的模块节点
  if (resources.value.length > 0) {
    expandedResourceNodes.value = ['module-通用'];
  }
}

/**
 * 加载组织树
 */
function loadOrgTree() {
  orgTreeData.value = permissionStore.getOrgTreeData();

  if (orgTreeData.value.length > 0) {
    const rootIds = orgTreeData.value.map(org => org.id);
    expandedNodes.value = Array.from(new Set([...expandedNodes.value, ...rootIds]));
  }
}

/**
 * 加载权限
 */
function loadPermissions() {
  permissions.value = permissionStore.getPermissions();
}

/**
 * 选择组织
 */
function handleOrgSelect(nodeId) {
  selectedOrgId.value = nodeId;
  selectedRoleId.value = null;
  selectedResourceId.value = null;
}

/**
 * 选择资源树节点
 */
function handleResourceSelect(nodeId) {
  selectedResourceId.value = nodeId;
}

/**
 * 切换节点展开状态
 */
function toggleNodeExpansion(node) {
  if (!node.children || node.children.length === 0) {
    return;
  }

  const index = expandedNodes.value.indexOf(node.id);
  if (index > -1) {
    expandedNodes.value.splice(index, 1);
  } else {
    expandedNodes.value.push(node.id);
  }
}

/**
 * 选择角色
 */
function handleSelectRole(role) {
  selectedRoleId.value = role.id;
}

/**
 * 获取组织名称
 */
function getOrgName(orgId) {
  function findOrg(nodes, id) {
    for (const node of nodes) {
      if (node.id === id) return node.name;
      if (node.children) {
        const found = findOrg(node.children, id);
        if (found) return found;
      }
    }
    return null;
  }
  return findOrg(orgTreeData.value, orgId) || orgId;
}

/**
 * 获取角色的权限数量
 */
function getRolePermissionCount(roleId) {
  if (!selectedOrgId.value) return 0;
  return permissions.value.filter(p =>
    p.sub === roleId &&
    p.dom === selectedOrgId.value
  ).length;
}

/**
 * 获取资源的可用操作
 */
function getResourceActions(resource) {
  if (!resource.actions || resource.actions.length === 0) return [];

  const resourceTypes = permissionStore.getResourceTypes();
  const resourceType = resourceTypes.find(t => t.id === resource.type);
  if (!resourceType?.defaultActions) return [];

  return resourceType.defaultActions.filter(action => resource.actions.includes(action.code));
}

/**
 * 获取权限配置状态（allow/deny/null）
 * - 有直接配置：返回 allow/deny
 * - 无直接配置：返回 null（显示为继承）
 */
function getPermissionState(resourceIdentifier, actionCode) {
  // 检查是否有直接配置的权限
  const directPerm = roleDirectPermissions.value.find(p =>
    p.obj === resourceIdentifier &&
    p.act === actionCode
  );

  if (directPerm) {
    return directPerm.eft || 'allow';
  }

  // 无直接配置，返回 null
  return null;
}

/**
 * 检查是否有角色直接配置的权限
 */
function hasDirectPermission(resourceIdentifier, actionCode) {
  return roleDirectPermissions.value.some(p =>
    p.obj === resourceIdentifier &&
    p.act === actionCode
  );
}

/**
 * 获取继承的权限信息
 * 返回从上级组织或角色继承的权限详情
 */
function getInheritedPermissionInfo(resourceIdentifier, actionCode) {
  // 在所有权限中查找继承的权限
  const inheritedPerm = rolePermissions.value.find(p =>
    p.obj === resourceIdentifier &&
    p.act === actionCode &&
    p.inherited === true
  );

  if (!inheritedPerm) return null;

  const parts = [];

  // 显示继承来源
  if (inheritedPerm.inheritedFromOrg) {
    const orgName = getOrgName(inheritedPerm.inheritedFromOrg);
    parts.push(`组织: ${orgName}`);
  }

  if (inheritedPerm.inheritedFromRole) {
    const role = roles.value.find(r => r.id === inheritedPerm.inheritedFromRole);
    const roleName = role ? role.name : inheritedPerm.inheritedFromRole;
    parts.push(`角色: ${roleName}`);
  }

  // 显示权限效果
  const effect = inheritedPerm.eft === 'deny' ? '✗ 拒绝' : '✓ 允许';

  return {
    source: parts.join(' ← '),
    effect: effect,
    eft: inheritedPerm.eft
  };
}

/**
 * 删除角色直接配置的权限
 */
function handleDeletePermission(resource, action) {
  const perm = roleDirectPermissions.value.find(p =>
    p.obj === resource.identifier &&
    p.act === action.code
  );

  if (perm) {
    permissionStore.deletePermission(perm.id);
    loadPermissions();
    $q.notify({
      type: 'positive',
      message: `已删除权限配置：${resource.name} - ${action.name}`,
      position: 'top',
      timeout: 1000
    });
  }
}

/**
 * 权限变更
 */
function handlePermissionChange(resource, action, state) {
  try {
    // 查找是否已有直接配置的权限
    const existingPerm = roleDirectPermissions.value.find(p =>
      p.obj === resource.identifier &&
      p.act === action.code
    );

    if (existingPerm) {
      // 更新existing permission
      permissionStore.updatePermission(existingPerm.id, { eft: state });
      loadPermissions();
      $q.notify({
        type: 'positive',
        message: `已更新权限：${resource.name} - ${action.name} (${state === 'allow' ? '允许' : '拒绝'})`,
        position: 'top',
        timeout: 1000
      });
    } else {
      // 添加新权限
      const newPermission = {
        obj: resource.identifier,
        act: action.code,
        eft: state,
        sub: selectedRoleId.value,
        dom: selectedOrgId.value
      };
      permissionStore.addPermission(newPermission);
      loadPermissions();
      $q.notify({
        type: 'positive',
        message: `已添加权限：${resource.name} - ${action.name} (${state === 'allow' ? '允许' : '拒绝'})`,
        position: 'top',
        timeout: 1000
      });
    }
  } catch (error) {
    $q.notify({
      type: 'negative',
      message: '操作失败：' + error.message,
      position: 'top'
    });
  }
}

// 初始化加载数据
loadData();
</script>

<style scoped>
.q-splitter :deep(.q-splitter__separator) {
  background: #424242;
}

.cursor-pointer {
  cursor: pointer;
}

.permission-tree-node {
  border-radius: 4px;
  padding: 3px 6px;
  transition: background-color 0.2s ease, color 0.2s ease;
}

.permission-tree-node--selected {
  background: rgba(25, 118, 210, 0.22);
  color: #ffffff;
}
</style>
