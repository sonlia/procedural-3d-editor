<template>
  <div class="column no-wrap fit bg-grey-10">
    <!-- 顶部工具栏 -->
    <q-bar dense dark class="bg-grey-9 text-grey-7">
      <div class="text-caption">组织架构管理</div>
      <q-space />
      <q-btn flat dense round icon="add"  @click="handleAddOrg">
        <q-tooltip>添加根组织</q-tooltip>
      </q-btn>
    </q-bar>

    <!-- 组织树 -->
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
          <div class="column full-width">
            <!-- 第一行：组织名称 + 操作按钮 -->
            <div class="row items-center">
              <div
                class="text-weight-medium cursor-pointer"
                @click="toggleNodeExpansion(prop.node)"
              >
                {{ prop.node.name }}
              </div>
              <q-space />
              <q-btn
                flat
                dense
                round
                icon="more_vert"

                @click.stop
              >
                <q-menu dense dark>
                  <q-list dense dark>
                    <q-item clickable v-close-popup @click="handleEditOrg(prop.node)">
                      <q-item-section avatar>
                        <q-icon name="edit"  />
                      </q-item-section>
                      <q-item-section>编辑</q-item-section>
                    </q-item>
                    <q-item clickable v-close-popup @click="handleAddChildOrg(prop.node)">
                      <q-item-section avatar>
                        <q-icon name="add"  />
                      </q-item-section>
                      <q-item-section>添加子组织</q-item-section>
                    </q-item>
                    <q-item
                      v-if="!isRootOrg(prop.node)"
                      clickable
                      v-close-popup
                      @click="handleDeleteOrg(prop.node)"
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
      <div v-if="orgTreeData.length === 0" class="text-center text-grey-7 q-py-xl">
        <q-icon name="account_tree" size="md" class="q-mb-md" />
        <div class="text-subtitle2 q-mb-sm">暂无组织架构</div>
        <div class="text-caption text-grey-8">
          点击右上角"+"添加根组织
        </div>
      </div>
    </q-scroll-area>

    <!-- 组织编辑对话框 -->
    <q-dialog v-model="showOrgDialog" persistent dark>
      <q-card dark class="bg-grey-9" style="min-width: 400px">
        <q-card-section class="row items-center q-pb-none">
          <div class="text-subtitle2">{{ isNewOrg ? '添加组织' : '编辑组织' }}</div>
          <q-space />
          <q-btn flat dense round icon="close" v-close-popup />
        </q-card-section>

        <q-card-section>
          <q-input
            v-model="orgForm.name"
            label="组织名称"
            dense
            dark
            outlined
            class="q-mb-sm"
            :rules="[val => !!val || '请输入组织名称']"
          />
          <q-input
            v-model="orgForm.code"
            label="组织编码"
            dense
            dark
            outlined
            class="q-mb-sm"
          />
          <q-input
            v-model="orgForm.description"
            label="描述"
            type="textarea"
            dense
            dark
            outlined
            rows="2"
          />
        </q-card-section>

        <q-card-actions align="right">
          <q-btn flat label="取消" color="grey-7" v-close-popup />
          <q-btn
            flat
            label="保存"
            color="primary"
            :disable="!orgForm.name"
            @click="handleSaveOrg"
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

// 组织架构相关
const orgTreeData = ref([]);
const selectedOrgId = ref(null);
const expandedNodes = ref([]);
const showOrgDialog = ref(false);
const isNewOrg = ref(false);
const currentParentOrg = ref(null);
const orgForm = ref({
  name: '',
  code: '',
  description: ''
});

// 组织树节点
const orgTreeNodes = computed(() => {
  return convertToTreeNodes(orgTreeData.value);
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
 * 加载组织树
 */
function loadOrgTree() {
  orgTreeData.value = permissionStore.getOrgTreeData();

  // 保持根节点展开
  if (orgTreeData.value.length > 0) {
    const rootIds = orgTreeData.value.map(org => org.id);
    expandedNodes.value = Array.from(new Set([...expandedNodes.value, ...rootIds]));
  }
}

/**
 * 选择组织
 */
function handleOrgSelect(nodeId) {
  selectedOrgId.value = nodeId;
}

/**
 * 判断是否是根组织
 */
function isRootOrg(node) {
  const rootIds = orgTreeData.value.map(org => org.id);
  return rootIds.includes(node.id);
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
 * 添加根组织
 */
function handleAddOrg() {
  isNewOrg.value = true;
  currentParentOrg.value = null;
  orgForm.value = {
    name: '',
    code: '',
    description: ''
  };
  showOrgDialog.value = true;
}

/**
 * 添加子组织
 */
function handleAddChildOrg(parentNode) {
  isNewOrg.value = true;
  currentParentOrg.value = parentNode;
  orgForm.value = {
    name: '',
    code: '',
    description: ''
  };
  showOrgDialog.value = true;
}

/**
 * 编辑组织
 */
function handleEditOrg(node) {
  isNewOrg.value = false;
  currentParentOrg.value = null;
  orgForm.value = {
    name: node.name || '',
    code: node.code || '',
    description: node.description || ''
  };
  selectedOrgId.value = node.id;
  showOrgDialog.value = true;
}

/**
 * 保存组织
 */
function handleSaveOrg() {
  if (!orgForm.value.name) return;

  try {
    if (isNewOrg.value) {
      const newOrg = {
        ...orgForm.value,
        pId: currentParentOrg.value?.id || null
      };
      const addedOrg = permissionStore.addOrg(newOrg);

      // 如果是添加子组织，自动展开父节点
      if (addedOrg.pId && !expandedNodes.value.includes(addedOrg.pId)) {
        expandedNodes.value.push(addedOrg.pId);
      }

      $q.notify({
        type: 'positive',
        message: '组织已添加',
        position: 'top',
        timeout: 1500
      });
    } else {
      permissionStore.updateOrg(selectedOrgId.value, orgForm.value);
      $q.notify({
        type: 'positive',
        message: '组织已更新',
        position: 'top',
        timeout: 1500
      });
    }
    loadOrgTree();
    showOrgDialog.value = false;
  } catch (error) {
    $q.notify({
      type: 'negative',
      message: '保存失败：' + error.message,
      position: 'top'
    });
  }
}

/**
 * 删除组织
 */
function handleDeleteOrg(node) {
  if (isRootOrg(node)) {
    $q.notify({
      type: 'warning',
      message: '不能删除根组织',
      position: 'top',
      timeout: 1500
    });
    return;
  }

  $q.dialog({
    title: '确认删除',
    message: `确定要删除组织"${node.name}"吗？`,
    dark: true,
    persistent: true,
    cancel: { flat: true, label: '取消', color: 'grey-7' },
    ok: { flat: true, label: '确定删除', color: 'negative' }
  }).onOk(() => {
    try {
      permissionStore.deleteOrg(node.id);
      loadOrgTree();
      $q.notify({
        type: 'positive',
        message: '组织已删除',
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
loadOrgTree();
</script>

<style scoped>
.cursor-pointer {
  cursor: pointer;
}
</style>
