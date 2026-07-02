<template>
  <!-- Permission Preview Component -->
  <q-card flat bordered class="permission-preview" dark>
    <q-card-section class="q-pa-sm" dark>
      <!-- 顶部工具栏 -->
      <q-bar dense dark class="bg-grey-9 text-grey-7 q-mb-sm">
        <div class="text-caption">权限预览</div>
        <q-space />
        <q-btn flat dense round icon="help_outline"  @click="showHelp = true">
          <q-tooltip>使用帮助</q-tooltip>
        </q-btn>
      </q-bar>

      <!-- 筛选条件 -->
      <q-card flat bordered class="q-mb-sm" dark>
        <q-card-section class="q-pa-sm">
          <div class="text-caption text-grey-7 q-mb-sm">选择预览条件</div>

          <div class="row q-col-gutter-sm">
            <!-- 选择组织 -->
            <div class="col-4">
              <q-select
                v-model="selectedOrg"
                label="组织节点"
                dense
                dark
                outlined
                :options="orgOptions"
                emit-value
                map-options
                clearable
              >
                <template v-slot:prepend>
                  <q-icon name="account_tree"  />
                </template>
              </q-select>
            </div>

            <!-- 选择角色 -->
            <div class="col-4">
              <q-select
                v-model="selectedRole"
                label="角色"
                dense
                dark
                outlined
                :options="roleOptions"
                emit-value
                map-options
                clearable
              >
                <template v-slot:prepend>
                  <q-icon name="badge"  />
                </template>
              </q-select>
            </div>

            <!-- 资源类型筛选 -->
            <div class="col-4">
              <q-select
                v-model="selectedResourceType"
                label="资源类型"
                dense
                dark
                outlined
                :options="resourceTypeOptions"
                emit-value
                map-options
                clearable
              >
                <template v-slot:prepend>
                  <q-icon name="category"  />
                </template>
              </q-select>
            </div>
          </div>

          <div class="row q-mt-sm">
            <q-space />
            <q-btn flat dense label="重置" color="grey-7" @click="resetFilters" />
            <q-btn flat dense label="预览权限" color="primary" class="q-ml-xs" @click="previewPermissions"
              :disable="!selectedOrg || !selectedRole" />
          </div>
        </q-card-section>
      </q-card>

      <!-- 权限继承路径 -->
      <q-card v-if="inheritanceTree.length > 0" flat bordered class="q-mb-sm" dark>
        <q-card-section class="q-pa-sm">
          <div class="text-caption text-grey-7 q-mb-sm">权限继承路径</div>

          <q-timeline color="primary" dense dark>
            <q-timeline-entry
              v-for="(node) in inheritanceTree"
              :key="node.orgId"
              :title="node.orgName"
              :subtitle="`层级 ${node.level}`"
              :icon="node.isCurrent ? 'check_circle' : 'circle'"
              :color="node.isCurrent ? 'positive' : 'primary'"
            >
              <div v-if="node.permissions.length > 0">
                <q-chip
                  v-for="perm in node.permissions"
                  :key="`${perm.obj}-${perm.act}`"
                  dense

                  :color="perm.eft === 'allow' ? 'positive' : 'negative'"
                  text-color="white"
                  class="q-ma-xs"
                >
                  {{ perm.obj }} : {{ perm.act }}
                </q-chip>
              </div>
              <div v-else class="text-caption text-grey-7">无权限配置</div>
            </q-timeline-entry>
          </q-timeline>
        </q-card-section>
      </q-card>

      <!-- 有效权限列表 -->
      <q-card v-if="effectivePermissions.length > 0" flat bordered dark>
        <q-card-section class="q-pa-sm">
          <div class="row items-center q-mb-sm">
            <div class="text-caption text-grey-7">有效权限列表</div>
            <q-space />
            <q-chip dense  color="grey-8">
              共 {{ effectivePermissions.length }} 条
            </q-chip>
          </div>

          <!-- 权限冲突警告 -->
          <q-banner v-if="conflicts.length > 0" class="bg-warning text-white q-mb-sm" dense dark>
            <template v-slot:avatar>
              <q-icon name="warning" />
            </template>
            检测到 {{ conflicts.length }} 个权限冲突
          </q-banner>

          <q-table
            flat
            bordered
            dense
            dark
            :rows="filteredPermissions"
            :columns="permissionColumns"
            row-key="id"
            :pagination="pagination"
            class="bg-grey-10"
          >
            <template v-slot:body-cell-obj="props">
              <q-td :props="props">
                <div class="row items-center no-wrap">
                  <q-icon :name="getResourceIcon(props.row.obj)" :color="getResourceColor(props.row.obj)"
                    class="q-mr-xs" />
                  <span class="text-mono text-grey-7">{{ props.row.obj }}</span>
                </div>
              </q-td>
            </template>

            <template v-slot:body-cell-source="props">
              <q-td :props="props">
                <q-chip dense  :color="props.row.source === 'direct' ? 'primary' : 'grey-7'">
                  {{ props.row.source === 'direct' ? '直接配置' : '继承自' }}
                  {{ props.row.fromName }}
                </q-chip>
              </q-td>
            </template>

            <template v-slot:body-cell-eft="props">
              <q-td :props="props">
                <q-badge
                  dense
                  :color="props.row.eft === 'allow' ? 'positive' : 'negative'"
                  :label="props.row.eft === 'allow' ? '允许' : '拒绝'"
                />
              </q-td>
            </template>
          </q-table>
        </q-card-section>
      </q-card>

      <!-- 空状态 -->
      <q-card v-else flat bordered dark>
        <q-card-section class="text-center q-pa-md">
          <q-icon name="preview" size="md" color="grey-7" />
          <div class="text-subtitle2 text-grey-7 q-mt-sm">选择组织和角色开始预览</div>
          <div class="text-caption text-grey-8 q-mt-xs">
            权限预览可以帮助你查看指定角色在特定组织下的所有有效权限
          </div>
        </q-card-section>
      </q-card>
    </q-card-section>

    <!-- 帮助对话框 -->
    <q-dialog v-model="showHelp" persistent dark>
      <q-card dark class="bg-grey-9" style="min-width: 500px">
        <q-card-section class="row items-center q-pb-none">
          <div class="text-subtitle2">权限预览帮助</div>
          <q-space />
          <q-btn flat dense round icon="close"  v-close-popup />
        </q-card-section>

        <q-card-section class="q-pt-sm" style="max-height: 60vh; overflow-y: auto">
          <div class="text-caption text-grey-7 q-mb-sm">功能说明</div>
          <q-list dense bordered dark class="q-mb-sm">
            <q-item dense dark>
              <q-item-section avatar>
                <q-icon name="check" color="positive" />
              </q-item-section>
              <q-item-section>
                <q-item-label class="text-grey-7">查看有效权限</q-item-label>
                <q-item-label caption class="text-grey-8">
                  显示角色在指定组织下的所有生效权限（包括继承）
                </q-item-label>
              </q-item-section>
            </q-item>

            <q-item dense dark>
              <q-item-section avatar>
                <q-icon name="timeline" color="primary" />
              </q-item-section>
              <q-item-section>
                <q-item-label class="text-grey-7">权限继承路径</q-item-label>
                <q-item-label caption class="text-grey-8">
                  展示从根节点到当前节点的完整继承链
                </q-item-label>
              </q-item-section>
            </q-item>

            <q-item dense dark>
              <q-item-section avatar>
                <q-icon name="warning" color="warning" />
              </q-item-section>
              <q-item-section>
                <q-item-label class="text-grey-7">冲突检测</q-item-label>
                <q-item-label caption class="text-grey-8">
                  自动检测并提示权限配置冲突
                </q-item-label>
              </q-item-section>
            </q-item>
          </q-list>

          <div class="text-caption text-grey-7 q-mb-sm">权限标识说明</div>
          <q-list dense bordered dark>
            <q-item dense dark>
              <q-item-section>
                <q-badge dense color="primary" label="直接配置" />
                <q-item-label caption class="text-grey-8 q-mt-xs">
                  当前节点直接配置的权限
                </q-item-label>
              </q-item-section>
            </q-item>
            <q-item dense dark>
              <q-item-section>
                <q-badge dense color="grey-7" label="继承自 XXX" />
                <q-item-label caption class="text-grey-8 q-mt-xs">
                  从上级节点继承的权限
                </q-item-label>
              </q-item-section>
            </q-item>
            <q-item dense dark>
              <q-item-section>
                <q-badge dense color="positive" label="允许" />
                <q-item-label caption class="text-grey-8 q-mt-xs">
                  该权限为允许访问
                </q-item-label>
              </q-item-section>
            </q-item>
            <q-item dense dark>
              <q-item-section>
                <q-badge dense color="negative" label="拒绝" />
                <q-item-label caption class="text-grey-8 q-mt-xs">
                  该权限被明确拒绝（deny 优先级最高）
                </q-item-label>
              </q-item-section>
            </q-item>
          </q-list>
        </q-card-section>

        <q-card-actions align="right" class="q-pa-sm">
          <q-btn flat dense label="关闭" color="grey-7" v-close-popup />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </q-card>
</template>

<script setup>
import { ref, computed } from 'vue'
import { usePermissionStore } from '../composables/usePermissionStore.js'
import {
  calculateEffectivePermissions,
  checkPermissionConflicts,
  generateInheritanceTree,
} from '../utils/policyCalculator.js'

const store = usePermissionStore()

// 状态
const selectedOrg = ref(null)
const selectedRole = ref(null)
const selectedResourceType = ref(null)
const showHelp = ref(false)

const effectivePermissions = ref([])
const inheritanceTree = ref([])
const conflicts = ref([])

const pagination = ref({
  rowsPerPage: 20,
})

// 计算属性
const orgOptions = computed(() => {
  const flatten = (nodes, result = []) => {
    nodes.forEach(node => {
      result.push({
        label: node.name,
        value: node.id,
      })
      if (node.children && node.children.length > 0) {
        flatten(node.children, result)
      }
    })
    return result
  }
  return flatten(store.organizations)
})

const roleOptions = computed(() => {
  const flatten = (nodes, result = []) => {
    nodes.forEach(node => {
      result.push({
        label: node.name,
        value: node.id,
      })
      if (node.children && node.children.length > 0) {
        flatten(node.children, result)
      }
    })
    return result
  }
  return flatten(store.roles)
})

const resourceTypeOptions = computed(() => {
  return [
    { label: '全部类型', value: null },
    ...store.resourceTypes.map(type => ({
      label: type.name,
      value: type.id,
    })),
  ]
})

const filteredPermissions = computed(() => {
  if (!selectedResourceType.value) {
    return effectivePermissions.value
  }

  const prefix = store.resourceTypes.find(
    t => t.id === selectedResourceType.value
  )?.prefix

  if (!prefix) return effectivePermissions.value

  return effectivePermissions.value.filter(perm =>
    perm.obj.startsWith(prefix)
  )
})

const permissionColumns = [
  {
    name: 'obj',
    label: '资源',
    field: 'obj',
    align: 'left',
    sortable: true,
  },
  {
    name: 'act',
    label: '操作',
    field: 'act',
    align: 'left',
    sortable: true,
  },
  {
    name: 'source',
    label: '来源',
    field: 'source',
    align: 'left',
  },
  {
    name: 'eft',
    label: '效果',
    field: 'eft',
    align: 'center',
  },
]

// 方法
const getResourceIcon = (resourceId) => {
  const type = resourceId.split(':')[0]
  const iconMap = {
    page: 'web',
    menu: 'menu',
    button: 'smart_button',
    url: 'api',
    data: 'table_chart',
    field: 'view_column',
  }
  return iconMap[type] || 'category'
}

const getResourceColor = (resourceId) => {
  const type = resourceId.split(':')[0]
  const colorMap = {
    page: 'primary',
    menu: 'secondary',
    button: 'accent',
    url: 'info',
    data: 'warning',
    field: 'positive',
  }
  return colorMap[type] || 'grey'
}

const resetFilters = () => {
  selectedOrg.value = null
  selectedRole.value = null
  selectedResourceType.value = null
  effectivePermissions.value = []
  inheritanceTree.value = []
  conflicts.value = []
}

const previewPermissions = () => {
  if (!selectedOrg.value || !selectedRole.value) {
    return
  }

  // 计算有效权限
  const permissions = calculateEffectivePermissions(
    store.organizations,
    store.policies,
    selectedOrg.value,
    selectedRole.value
  )

  effectivePermissions.value = permissions

  // 生成继承树
  inheritanceTree.value = generateInheritanceTree(
    store.organizations,
    store.policies,
    selectedOrg.value,
    selectedRole.value
  )

  // 检查冲突
  conflicts.value = checkPermissionConflicts(permissions)
}
</script>

<style scoped lang="scss">
.permission-preview {
  .text-mono {
    font-family: 'Courier New', monospace;
    font-size: 0.9em;
  }
}
</style>
