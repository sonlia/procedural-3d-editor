<template>
  <div class="permission-manager flat bordered dark" >

      <q-tabs v-model="activeTab" dense class="text-grey" dark active-color="primary" indicator-color="primary"
        align="left">
        <q-tab name="organization" label="组织架构" icon="account_tree" />
        <q-tab name="role" label="角色管理" icon="badge" />
        <q-tab name="user" label="用户管理" icon="people" />
        <q-tab name="resource" label="资源管理" icon="inventory_2" />
        <q-tab name="permission" label="权限配置" icon="security" />
        <q-tab name="preview" label="权限预览" icon="preview" />
      </q-tabs>

      <q-separator />

      <q-tab-panels v-model="activeTab" dark>
        <!-- 资源管理 -->
        <q-tab-panel name="resource" class="q-pa-none" dark>
          <div style="height: calc(100vh - 150px)">
            <ResourcePanel @navigate-to-permission-config="handleNavigateToPermissionConfig" />
          </div>
        </q-tab-panel>

        <!-- 组织架构 -->
        <q-tab-panel name="organization" class="q-pa-none">
          <div style="height: calc(100vh - 150px)">
            <OrganizationPanel />
          </div>
        </q-tab-panel>

        <!-- 角色管理 -->
        <q-tab-panel name="role" class="q-pa-none">
          <div style="height: calc(100vh - 150px)">
            <RolePanel />
          </div>
        </q-tab-panel>

        <!-- 权限配置 -->
        <q-tab-panel name="permission" class="q-pa-none">
          <div style="height: calc(100vh - 150px)">
            <PermissionConfigPanel />
          </div>
        </q-tab-panel>

        <!-- 用户管理 -->
        <q-tab-panel name="user" class="q-pa-none">
          <div style="height: calc(100vh - 150px)">
            <UserPanel />
          </div>
        </q-tab-panel>

        <!-- 权限预览 -->
        <q-tab-panel name="preview" class="q-pa-md">
          <PermissionPreview />
        </q-tab-panel>
      </q-tab-panels>
    
  </div>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue'
import { useQuasar } from 'quasar'
import { usePermissionStore } from './composables/usePermissionStore.js'
import { useProjectMangerStore } from 'src/stores/projectMange'
import ResourcePanel from './panels/ResourcePanel.vue'
import PermissionPreview from './components/PermissionPreview.vue'
import OrganizationPanel from './panels/OrganizationPanel.vue'
import RolePanel from './panels/RolePanel.vue'
import PermissionConfigPanel from './panels/PermissionConfigPanel.vue'
import UserPanel from './panels/UserPanel.vue'

const $q = useQuasar()
const store = usePermissionStore()
const projectStore = useProjectMangerStore()
const activeTab = ref('resource')

onMounted(loadPermissionData)
watch(() => projectStore.currentProjectId, loadPermissionData)

async function loadPermissionData() {
  if (!projectStore.currentProjectId) return

  try {
    const loaded = await store.loadFromBackend()
    if (!loaded || isPermissionEmpty()) {
      store.initSampleData()
    }
  } catch (error) {
    console.error('[PermissionManager] 加载权限数据失败:', error)
    if (store.organizations.length === 0) {
      store.initSampleData()
    }
  }
}

function isPermissionEmpty() {
  return !store.organizations.length &&
    !store.roles.length &&
    !store.resources.length &&
    !store.users.length &&
    !store.policies.length
}

const handleNavigateToPermissionConfig = (data) => {
  console.log('[PermissionManager] 导航到权限配置:', data)

  // 切换到权限配置标签页
  activeTab.value = 'permission'

  // 可选：将资源信息存储到 store，让 PermissionConfigPanel 高亮该资源
  if (data.resourceIdentifier) {
    store.selectedResourceIdentifier = data.resourceIdentifier
  }

  // 提示用户
  $q.notify({
    type: 'info',
    message: `已切换到权限配置，请为「${data.resourceIdentifier}」配置权限`,
    position: 'top',
    timeout: 2000
  })
}
</script>

<style scoped lang="scss">
.permission-manager {
  padding: 16px;

  .text-mono {
    font-family: 'Courier New', monospace;
    font-size: 0.9em;
  }

  :deep(.q-tab-panel) {
    padding: 0;
  }
}
</style>
