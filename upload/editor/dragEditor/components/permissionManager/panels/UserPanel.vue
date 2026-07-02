<template>
  <div class="column no-wrap fit bg-grey-10">
    <q-splitter
      v-model="splitterModel"
      :limits="[30, 70]"
      dense
      dark
      class="fit"
    >
      <!-- 左栏：人员列表 -->
      <template #before>
        <div class="column no-wrap fit">
          <q-bar dense dark class="bg-grey-9 text-grey-7">
            <div class="text-caption">人员列表</div>
            <q-space />
            <q-btn flat dense round icon="add"  @click="handleAddUser">
              <q-tooltip>添加人员</q-tooltip>
            </q-btn>
          </q-bar>

          <!-- 搜索栏 -->
          <div class="q-pa-sm bg-grey-9">
            <q-input
              v-model="searchText"
              dense
              dark
              outlined
              placeholder="搜索人员"
              clearable
            >
              <template #prepend>
                <q-icon name="search"  />
              </template>
            </q-input>
          </div>

          <!-- 人员列表 -->
          <q-scroll-area class="col bg-grey-10">
            <q-list dense dark>
              <q-item
                v-for="user in filteredUsers"
                :key="user.id"
                clickable
                :active="selectedUserId === user.id"
                active-class="bg-grey-9"
                @click="handleSelectUser(user)"
                dense
                dark
              >
                <q-item-section avatar>
                  <q-avatar color="primary" text-color="white" size="sm">
                    {{ user.name ? user.name[0] : '?' }}
                  </q-avatar>
                </q-item-section>

                <q-item-section>
                  <q-item-label class="text-grey-7">{{ user.name }}</q-item-label>
                  <q-item-label caption class="text-grey-8">
                    {{ user.account }}
                  </q-item-label>
                </q-item-section>

                <q-item-section side>
                  <q-badge
                    :label="user.status === 'active' ? '启用' : '禁用'"
                    :color="user.status === 'active' ? 'positive' : 'grey-7'"
                    dense
                  />
                </q-item-section>
              </q-item>

              <!-- 空状态 -->
              <q-item v-if="filteredUsers.length === 0" dense dark>
                <q-item-section class="text-center text-grey-7 q-py-md">
                  <q-icon name="people" class="q-mb-xs" />
                  <div class="text-caption">
                    {{ searchText ? '未找到匹配的人员' : '暂无人员' }}
                  </div>
                </q-item-section>
              </q-item>
            </q-list>
          </q-scroll-area>
        </div>
      </template>

      <!-- 右栏：人员详情编辑 -->
      <template #after>
        <div class="column no-wrap fit">
          <q-bar dense dark class="bg-grey-9 text-grey-7">
            <div class="text-caption">
              {{ selectedUserId ? '人员详情' : '请选择人员' }}
            </div>
            <q-space />
            <q-btn
              v-if="selectedUserId"
              flat
              dense
              icon="delete"
              size="sm"
              color="negative"
              @click="handleDeleteUser"
            >
              <q-tooltip>删除人员</q-tooltip>
            </q-btn>
          </q-bar>

          <!-- 人员详情表单 -->
          <q-scroll-area v-if="selectedUserId" class="col bg-grey-10">
            <div class="q-pa-md">
              <!-- 基本信息 -->
              <div class="text-caption text-grey-7 q-mb-sm">基本信息</div>
              <q-input
                v-model="userForm.name"
                label="姓名"
                dense
                dark
                outlined
                class="q-mb-sm"
                :rules="[val => !!val || '请输入姓名']"
              />
              <q-input
                v-model="userForm.account"
                label="账号"
                dense
                dark
                outlined
                class="q-mb-sm"
                :rules="[val => !!val || '请输入账号']"
              />
              <q-input
                v-model="userForm.email"
                label="邮箱"
                type="email"
                dense
                dark
                outlined
                class="q-mb-sm"
              />
              <q-input
                v-model="userForm.phone"
                label="电话"
                dense
                dark
                outlined
                class="q-mb-sm"
              />
              <q-select
                v-model="userForm.status"
                :options="statusOptions"
                label="状态"
                dense
                dark
                outlined
                emit-value
                map-options
                class="q-mb-md"
              />

              <!-- 所属组织 -->
              <div class="text-caption text-grey-7 q-mb-sm">所属组织（多选）</div>
              <q-scroll-area style="height: 200px" class="bg-grey-10 q-mb-md">
                <q-tree
                  :nodes="orgTreeNodes"
                  node-key="id"
                  label-key="name"
                  :ticked="userForm.orgs"
                  @update:ticked="handleOrgChange"
                  tick-strategy="leaf"
                  dense
                  dark
                  class="text-grey-7"
                />
              </q-scroll-area>

              <!-- 分配角色 -->
              <div class="text-caption text-grey-7 q-mb-sm">分配角色（多选）</div>
              <div class="row q-gutter-xs q-mb-md">
                <q-chip
                  v-for="roleId in userForm.roles"
                  :key="roleId"
                  removable
                  dense
                  color="primary"
                  text-color="white"
                  @remove="handleRemoveRole(roleId)"
                >
                  {{ getRoleName(roleId) }}
                </q-chip>
              </div>
              <q-select
                :model-value="null"
                :options="availableRoleOptions"
                label="添加角色"
                dense
                dark
                outlined
                emit-value
                map-options
                @update:model-value="handleAddRole"
                class="q-mb-md"
              >
                <template #prepend>
                  <q-icon name="add" />
                </template>
              </q-select>

              <!-- 操作按钮 -->
              <div class="row q-gutter-sm justify-end">
                <q-btn
                  flat
                  label="取消"
                  color="grey-7"
                  @click="handleCancelEdit"
                />
                <q-btn
                  flat
                  label="保存"
                  color="primary"
                  :disable="!userForm.name || !userForm.account"
                  @click="handleSaveUser"
                />
              </div>
            </div>
          </q-scroll-area>

          <!-- 提示信息（未选中） -->
          <div v-else class="column no-wrap fit items-center justify-center text-center text-grey-7">
            <q-icon name="info_outline" size="lg" class="q-mb-md" />
            <div class="text-subtitle2 q-mb-sm">请选择人员</div>
            <div class="text-caption text-grey-8">
              从左侧列表选择人员查看详情
            </div>
          </div>
        </div>
      </template>
    </q-splitter>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import { useQuasar } from 'quasar';
import { usePermissionStore } from '../composables/usePermissionStore.js';

const $q = useQuasar();
const permissionStore = usePermissionStore();

// 分割器
const splitterModel = ref(35);

// 数据
const users = ref([]);
const roles = ref([]);
const orgTreeData = ref([]);
const searchText = ref('');
const selectedUserId = ref(null);
const userForm = ref({
  name: '',
  account: '',
  email: '',
  phone: '',
  status: 'active',
  orgs: [],
  roles: []
});

// 状态选项
const statusOptions = [
  { label: '启用', value: 'active' },
  { label: '禁用', value: 'inactive' }
];

// 过滤后的用户列表
const filteredUsers = computed(() => {
  if (!searchText.value) return users.value;
  const search = searchText.value.toLowerCase();
  return users.value.filter(u =>
    u.name?.toLowerCase().includes(search) ||
    u.account?.toLowerCase().includes(search)
  );
});

// 组织树节点
const orgTreeNodes = computed(() => {
  return convertToTreeNodes(orgTreeData.value);
});

// 可用角色选项（排除已分配的）
const availableRoleOptions = computed(() => {
  return roles.value
    .filter(r => !userForm.value.roles.includes(r.id))
    .map(r => ({
      label: r.name,
      value: r.id,
      caption: r.code
    }));
});

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
  users.value = permissionStore.getUsers();
  roles.value = permissionStore.getRoles();
  orgTreeData.value = permissionStore.getOrgTreeData();
}

/**
 * 获取角色名称
 */
function getRoleName(roleId) {
  const role = roles.value.find(r => r.id === roleId);
  return role ? role.name : roleId;
}

/**
 * 选择用户
 */
function handleSelectUser(user) {
  selectedUserId.value = user.id;
  userForm.value = {
    name: user.name || '',
    account: user.account || '',
    email: user.email || '',
    phone: user.phone || '',
    status: user.status || 'active',
    orgs: user.orgs || [],
    roles: user.roles || []
  };
}

/**
 * 添加用户
 */
function handleAddUser() {
  selectedUserId.value = 'new';
  userForm.value = {
    name: '',
    account: '',
    email: '',
    phone: '',
    status: 'active',
    orgs: [],
    roles: []
  };
}

/**
 * 取消编辑
 */
function handleCancelEdit() {
  selectedUserId.value = null;
  userForm.value = {
    name: '',
    account: '',
    email: '',
    phone: '',
    status: 'active',
    orgs: [],
    roles: []
  };
}

/**
 * 保存用户
 */
function handleSaveUser() {
  if (!userForm.value.name || !userForm.value.account) return;

  try {
    if (selectedUserId.value === 'new') {
      permissionStore.addUser(userForm.value);
      $q.notify({
        type: 'positive',
        message: '人员已添加',
        position: 'top',
        timeout: 1500
      });
    } else {
      permissionStore.updateUser(selectedUserId.value, userForm.value);
      $q.notify({
        type: 'positive',
        message: '人员已更新',
        position: 'top',
        timeout: 1500
      });
    }
    loadData();
    handleCancelEdit();
  } catch (error) {
    $q.notify({
      type: 'negative',
      message: '保存失败：' + error.message,
      position: 'top'
    });
  }
}

/**
 * 删除用户
 */
function handleDeleteUser() {
  const user = users.value.find(u => u.id === selectedUserId.value);
  if (!user) return;

  $q.dialog({
    title: '确认删除',
    message: `确定要删除人员"${user.name}"吗？`,
    dark: true,
    persistent: true,
    cancel: { flat: true, label: '取消', color: 'grey-7' },
    ok: { flat: true, label: '确定删除', color: 'negative' }
  }).onOk(() => {
    try {
      permissionStore.deleteUser(selectedUserId.value);
      loadData();
      handleCancelEdit();
      $q.notify({
        type: 'positive',
        message: '人员已删除',
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

/**
 * 组织变更
 */
function handleOrgChange(orgs) {
  userForm.value.orgs = orgs;
}

/**
 * 添加角色
 */
function handleAddRole(roleId) {
  if (roleId && !userForm.value.roles.includes(roleId)) {
    userForm.value.roles.push(roleId);
  }
}

/**
 * 移除角色
 */
function handleRemoveRole(roleId) {
  userForm.value.roles = userForm.value.roles.filter(r => r !== roleId);
}

// 初始化加载数据
loadData();
</script>

<style scoped>
.q-splitter :deep(.q-splitter__separator) {
  background: #424242;
}
</style>
