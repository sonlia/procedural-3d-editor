<template>
  <div class="column no-wrap fit bg-grey-10">
    <!-- 顶部工具栏 -->
    <q-bar dense dark class="bg-grey-9 text-grey-7">
      <div class="text-caption">角色管理</div>
      <q-space />
      <q-btn flat dense round icon="add"  @click="handleAddRole">
        <q-tooltip>添加角色</q-tooltip>
      </q-btn>
    </q-bar>

    <!-- 角色树 -->
    <q-scroll-area class="col bg-grey-10">
      <q-tree
        :nodes="roleTreeNodes"
        node-key="id"
        label-key="name"
        v-model:expanded="expandedRoleNodes"
        dense
        dark
        class="text-grey-7"
      >
        <template #default-header="prop">
          <div class="column full-width">
            <!-- 第一行：角色名称 + 操作按钮 -->
            <div class="row items-center">
              <div
                class="text-weight-medium cursor-pointer"
                @click="toggleRoleNodeExpansion(prop.node)"
              >
                {{ prop.node.name }}
                <q-badge
                  v-if="prop.node.inheritPermissions && prop.node.parentId"
                  label="继承"
                  color="positive"
                  dense
                  class="q-ml-xs"
                  style="font-size: 9px"
                />
              </div>
              <q-space />
              <div class="row items-center q-gutter-xs">
                <q-badge
                  v-if="prop.node.type === 'system'"
                  label="系统"
                  color="warning"
                  dense
                />
                <q-btn
                  flat
                  dense
                  round
                  icon="more_vert"

                  @click.stop
                >
                  <q-menu dense dark>
                    <q-list dense dark>
                      <q-item clickable v-close-popup @click="handleEditRole(prop.node)">
                        <q-item-section avatar>
                          <q-icon name="edit"  />
                        </q-item-section>
                        <q-item-section>编辑</q-item-section>
                      </q-item>
                      <q-item clickable v-close-popup @click="handleAddChildRole(prop.node)">
                        <q-item-section avatar>
                          <q-icon name="add"  />
                        </q-item-section>
                        <q-item-section>添加子角色</q-item-section>
                      </q-item>
                      <q-item
                        v-if="prop.node.type !== 'system' && !isRootRole(prop.node)"
                        clickable
                        v-close-popup
                        @click="handleDeleteRole(prop.node)"
                      >
                        <q-item-section avatar>
                          <q-icon name="delete"  color="negative" />
                        </q-item-section>
                        <q-item-section>删除</q-item-section>
                      </q-item>
                    </q-list>
                  </q-menu>
                </q-btn>
              </div>
            </div>

            <!-- 第二行：编码和描述 -->
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

      <!-- 空状态 -->
      <div v-if="roles.length === 0" class="text-center text-grey-7 q-py-xl">
        <q-icon name="admin_panel_settings" size="md" class="q-mb-md" />
        <div class="text-subtitle2 q-mb-sm">暂无角色</div>
        <div class="text-caption text-grey-8">
          点击右上角"+"添加角色
        </div>
      </div>
    </q-scroll-area>

    <!-- 角色编辑对话框 -->
    <q-dialog v-model="showRoleDialog" persistent dark>
      <q-card dark class="bg-grey-9" style="min-width: 400px">
        <q-card-section class="row items-center q-pb-none">
          <div class="text-subtitle2">{{ isNewRole ? '添加角色' : '编辑角色' }}</div>
          <q-space />
          <q-btn flat dense round icon="close" v-close-popup />
        </q-card-section>

        <q-card-section>
          <q-input
            v-model="roleForm.name"
            label="角色名称"
            dense
            dark
            outlined
            class="q-mb-sm"
            :rules="[val => !!val || '请输入角色名称']"
          />
          <q-input
            v-model="roleForm.code"
            label="角色编码"
            dense
            dark
            outlined
            class="q-mb-sm"
            :rules="[val => !!val || '请输入角色编码']"
          />

          <!-- 父角色选择 -->
          <q-select
            v-model="roleForm.parentId"
            :options="parentRoleOptions"
            label="父角色（可选）"
            dense
            dark
            outlined
            emit-value
            map-options
            clearable
            class="q-mb-sm"
            hint="选择父角色后可继承其权限"
          >
            <template #prepend>
              <q-icon name="account_tree" />
            </template>
          </q-select>

          <!-- 继承权限开关 -->
          <q-toggle
            v-model="roleForm.inheritPermissions"
            label="继承父角色权限"
            dense
            dark
            color="positive"
            class="q-mb-sm"
            :disable="!roleForm.parentId"
          >
            <q-tooltip v-if="!roleForm.parentId">请先选择父角色</q-tooltip>
            <q-tooltip v-else>启用后将自动继承父角色的所有权限</q-tooltip>
          </q-toggle>

          <q-input
            v-model="roleForm.description"
            label="描述"
            type="textarea"
            dense
            dark
            outlined
            rows="2"
            class="q-mt-sm"
          />
        </q-card-section>

        <q-card-actions align="right">
          <q-btn flat label="取消" color="grey-7" v-close-popup />
          <q-btn
            flat
            label="保存"
            color="primary"
            :disable="!roleForm.name || !roleForm.code"
            @click="handleSaveRole"
          />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import { useQuasar } from 'quasar';
import { usePermissionStore } from '../composables/usePermissionStore.js';

const $q = useQuasar();
const permissionStore = usePermissionStore();

// 角色相关
const roles = ref([]);
const expandedRoleNodes = ref([]);
const showRoleDialog = ref(false);
const isNewRole = ref(false);
const currentEditingRoleId = ref(null);
const roleForm = ref({
  name: '',
  code: '',
  type: 'org',
  parentId: null,
  inheritPermissions: true,
  description: ''
});

// 角色树节点
const roleTreeNodes = computed(() => {
  return convertRolesToTreeNodes(roles.value);
});

// 父角色选项（用于编辑对话框）
const parentRoleOptions = computed(() => {
  if (!roles.value || roles.value.length === 0) return [];

  // 获取当前编辑角色的所有子孙节点ID
  function getDescendantIds(roleId) {
    const descendants = new Set();
    function collect(id) {
      descendants.add(id);
      roles.value.forEach(r => {
        if (r.parentId === id && !descendants.has(r.id)) {
          collect(r.id);
        }
      });
    }
    collect(roleId);
    return descendants;
  }

  const excludeIds = isNewRole.value
    ? new Set()
    : getDescendantIds(currentEditingRoleId.value);

  // 过滤掉当前角色及其子孙角色
  return roles.value
    .filter(r => !excludeIds.has(r.id))
    .map(r => ({
      label: r.name,
      value: r.id,
      caption: r.code
    }));
});

/**
 * 转换角色列表为树形结构
 */
function convertRolesToTreeNodes(roleList) {
  if (!roleList || roleList.length === 0) return [];

  // 构建角色映射
  const roleMap = new Map();
  roleList.forEach(role => {
    roleMap.set(role.id, { ...role, children: [] });
  });

  // 构建树形结构
  const rootNodes = [];
  roleMap.forEach(role => {
    if (role.parentId && roleMap.has(role.parentId)) {
      roleMap.get(role.parentId).children.push(role);
    } else {
      rootNodes.push(role);
    }
  });

  // 清理空children
  function cleanEmptyChildren(nodes) {
    nodes.forEach(node => {
      if (node.children && node.children.length === 0) {
        delete node.children;
      } else if (node.children) {
        cleanEmptyChildren(node.children);
      }
    });
  }

  cleanEmptyChildren(rootNodes);
  return rootNodes;
}

/**
 * 加载角色数据
 */
function loadRoles() {
  roles.value = permissionStore.getRoles();

  // 默认展开角色树的根节点
  if (roles.value.length > 0) {
    const rootRoles = roles.value.filter(r => !r.parentId);
    expandedRoleNodes.value = rootRoles.map(r => r.id);
  }
}

/**
 * 判断是否是根角色（分类节点）
 */
function isRootRole(role) {
  return role.id === 'role-tech-root' || role.id === 'role-mgmt-root';
}

/**
 * 切换角色节点展开状态
 */
function toggleRoleNodeExpansion(node) {
  if (!node.children || node.children.length === 0) {
    return;
  }

  const index = expandedRoleNodes.value.indexOf(node.id);
  if (index > -1) {
    expandedRoleNodes.value.splice(index, 1);
  } else {
    expandedRoleNodes.value.push(node.id);
  }
}

/**
 * 添加角色
 */
function handleAddRole() {
  isNewRole.value = true;
  roleForm.value = {
    name: '',
    code: '',
    type: 'org',
    parentId: null,
    inheritPermissions: true,
    description: ''
  };
  showRoleDialog.value = true;
}

/**
 * 添加子角色
 */
function handleAddChildRole(parentRole) {
  isNewRole.value = true;
  roleForm.value = {
    name: '',
    code: '',
    type: 'org',
    parentId: parentRole.id,
    inheritPermissions: true,
    description: ''
  };
  showRoleDialog.value = true;
}

/**
 * 编辑角色
 */
function handleEditRole(role) {
  isNewRole.value = false;
  roleForm.value = {
    name: role.name || '',
    code: role.code || '',
    type: role.type || 'org',
    parentId: role.parentId || null,
    inheritPermissions: role.inheritPermissions !== false,
    description: role.description || ''
  };
  currentEditingRoleId.value = role.id;
  showRoleDialog.value = true;
}

/**
 * 保存角色
 */
function handleSaveRole() {
  if (!roleForm.value.name || !roleForm.value.code) return;

  try {
    if (isNewRole.value) {
      permissionStore.addRole(roleForm.value);
      $q.notify({
        type: 'positive',
        message: '角色已添加',
        position: 'top',
        timeout: 1500
      });
    } else {
      permissionStore.updateRole(currentEditingRoleId.value, roleForm.value);
      $q.notify({
        type: 'positive',
        message: '角色已更新',
        position: 'top',
        timeout: 1500
      });
    }
    loadRoles();
    showRoleDialog.value = false;
  } catch (error) {
    $q.notify({
      type: 'negative',
      message: '保存失败：' + error.message,
      position: 'top'
    });
  }
}

/**
 * 删除角色
 */
function handleDeleteRole(role) {
  $q.dialog({
    title: '确认删除',
    message: `确定要删除角色"${role.name}"吗？`,
    dark: true,
    persistent: true,
    cancel: { flat: true, label: '取消', color: 'grey-7' },
    ok: { flat: true, label: '确定删除', color: 'negative' }
  }).onOk(() => {
    try {
      permissionStore.deleteRole(role.id);
      loadRoles();
      $q.notify({
        type: 'positive',
        message: '角色已删除',
        position: 'top',
        timeout: 1500
      });
    } catch (error) {
      $q.notify({
        type: 'negative',
        message: '删除失败：' + error.message,
        position: 'top'
      });
    }
  });
}

// 初始化加载数据
loadRoles();
</script>

<style scoped>
.cursor-pointer {
  cursor: pointer;
}
</style>
