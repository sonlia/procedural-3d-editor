<template>
  <div class="column no-wrap fit bg-grey-10">
    <!-- 左右分栏布局 -->
    <q-splitter
      v-model="splitterModel"
      :limits="[30, 70]"
      dense
      dark
      class="fit"
    >
      <!-- 左栏：资源树 -->
      <template #before>
        <div class="column no-wrap fit">
          <!-- 工具栏 -->
          <q-bar dense dark class="bg-grey-9 text-grey-7">
            <div class="text-caption">资源列表</div>
            <q-space />
          </q-bar>

          <!-- 搜索栏 -->
          <div class="q-pa-sm bg-grey-9">
            <q-input
              v-model="resourceSearchText"
              dense
              dark
              outlined
              placeholder="搜索资源名称/标识符"
              clearable
            >
              <template #prepend>
                <q-icon name="search"  />
              </template>
            </q-input>
          </div>

          <!-- 资源树 -->
          <q-scroll-area class="col bg-grey-10">
            <q-tree
              :nodes="resourceTreeNodes"
              node-key="id"
              label-key="name"
              :selected="selectedResourceId"
              v-model:expanded="expandedResourceNodes"
              @update:selected="handleSelectResource"
              dense
              dark
              class="text-grey-7"
            >
              <template #default-header="prop">
                <!-- 模块节点 -->
                <div
                  v-if="prop.node.isModule"
                  class="column full-width"
                >
                  <div class="row items-center">
                    <div
                      class="text-weight-medium cursor-pointer col"
                      @click="handleSelectModule(prop.node)"
                    >
                      {{ prop.node.name }}
                    </div>

                    <!-- 操作菜单 -->
                    <q-btn flat dense round icon="more_vert"  color="grey-7" @click.stop>
                      <q-menu dark auto-close>
                        <q-list dense dark class="bg-grey-9">
                          <!-- 子级操作 -->
                          <q-item-label header class="text-grey-7">添加子级</q-item-label>
                          <q-item clickable @click="handleAddResourceToModule(prop.node.name)">
                            <q-item-section avatar>
                              <q-icon name="add_circle" color="positive"  />
                            </q-item-section>
                            <q-item-section>添加子级资源</q-item-section>
                          </q-item>
                          <q-item clickable @click="handleAddSubModule(prop.node.name)">
                            <q-item-section avatar>
                              <q-icon name="create_new_folder" color="info"  />
                            </q-item-section>
                            <q-item-section>添加子级目录</q-item-section>
                          </q-item>

                          <q-separator dark />

                          <!-- 同级操作 -->
                          <q-item-label header class="text-grey-7">添加同级</q-item-label>
                          <q-item clickable @click="handleAddSiblingResource(prop.node)">
                            <q-item-section avatar>
                              <q-icon name="note_add" color="positive"  />
                            </q-item-section>
                            <q-item-section>添加同级资源</q-item-section>
                          </q-item>
                          <q-item clickable @click="handleAddSiblingModule(prop.node)">
                            <q-item-section avatar>
                              <q-icon name="folder" color="accent"  />
                            </q-item-section>
                            <q-item-section>添加同级目录</q-item-section>
                          </q-item>

                          <q-separator dark />

                          <!-- 编辑操作 -->
                          <q-item clickable @click="handleRenameModule(prop.node)">
                            <q-item-section avatar>
                              <q-icon name="edit" color="primary"  />
                            </q-item-section>
                            <q-item-section>重命名</q-item-section>
                          </q-item>
                          <q-item clickable @click="handleChangeParent(prop.node)">
                            <q-item-section avatar>
                              <q-icon name="drive_file_move" color="warning"  />
                            </q-item-section>
                            <q-item-section>调整层级</q-item-section>
                          </q-item>

                          <q-separator dark />

                          <!-- 删除操作 -->
                          <q-item clickable @click="handleDeleteModule(prop.node.name)">
                            <q-item-section avatar>
                              <q-icon name="delete" color="negative"  />
                            </q-item-section>
                            <q-item-section>删除目录</q-item-section>
                          </q-item>
                        </q-list>
                      </q-menu>
                    </q-btn>
                  </div>
                </div>

                <!-- 资源节点 -->
                <div v-else class="column full-width">
                  <div class="row items-center">
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

                    <!-- 操作菜单 -->
                    <q-btn flat dense round icon="more_vert"  color="grey-7" @click.stop>
                      <q-menu dark auto-close>
                        <q-list dense dark class="bg-grey-9">
                          <!-- 添加子资源（根据类型动态显示） -->
                          <template v-if="getAllowedChildTypes(prop.node).length > 0">
                            <q-item-label header class="text-grey-7">添加子资源</q-item-label>
                            <q-item
                              v-for="childType in getAllowedChildTypes(prop.node)"
                              :key="childType.id"
                              clickable
                              @click="handleAddChildResource(prop.node, childType.id)"
                            >
                              <q-item-section avatar>
                                <q-icon :name="childType.icon" color="positive"  />
                              </q-item-section>
                              <q-item-section>添加{{ childType.name }}</q-item-section>
                            </q-item>

                            <q-separator dark />
                          </template>

                          <!-- 同级操作 -->
                          <q-item-label header class="text-grey-7">同级操作</q-item-label>
                          <q-item clickable @click="handleAddSiblingResourceFromResource(prop.node)">
                            <q-item-section avatar>
                              <q-icon name="note_add" color="positive"  />
                            </q-item-section>
                            <q-item-section>添加同级资源</q-item-section>
                          </q-item>

                          <q-separator dark />

                          <!-- 编辑操作 -->
                          <q-item clickable @click="handleRenameResource(prop.node)">
                            <q-item-section avatar>
                              <q-icon name="edit" color="primary"  />
                            </q-item-section>
                            <q-item-section>重命名</q-item-section>
                          </q-item>
                          <q-item clickable @click="handleMoveResource(prop.node)">
                            <q-item-section avatar>
                              <q-icon name="drive_file_move" color="warning"  />
                            </q-item-section>
                            <q-item-section>移动到...</q-item-section>
                          </q-item>

                          <q-separator dark />

                          <!-- 删除操作 -->
                          <q-item clickable @click="handleDeleteResource(prop.node)">
                            <q-item-section avatar>
                              <q-icon name="delete" color="negative"  />
                            </q-item-section>
                            <q-item-section>删除资源</q-item-section>
                          </q-item>
                        </q-list>
                      </q-menu>
                    </q-btn>
                  </div>
                </div>
              </template>
            </q-tree>

            <!-- 空状态 -->
            <div v-if="resourceTreeNodes.length === 0" class="text-center text-grey-7 q-py-xl">
              <q-icon name="inventory_2" size="md" class="q-mb-md" />
              <div class="text-subtitle2 q-mb-sm">
                {{ resourceSearchText ? '未找到匹配的资源' : '暂无资源' }}
              </div>
              <div class="text-caption text-grey-8">
                {{ resourceSearchText ? '尝试其他关键词' : '点击模块节点旁的"+"添加资源' }}
              </div>
            </div>
          </q-scroll-area>
        </div>
      </template>

      <!-- 右栏：资源详情 -->
      <template #after>
        <div class="column no-wrap fit">
          <!-- 模块信息 -->
          <div v-if="selectedModule" class="column no-wrap fit">
            <q-bar dense dark class="bg-grey-9 text-grey-7">
              <div class="text-caption">目录信息</div>
              <q-space />
              <q-btn flat dense round icon="close"  @click="handleCloseDetail">
                <q-tooltip>关闭</q-tooltip>
              </q-btn>
            </q-bar>

            <q-scroll-area class="col bg-grey-10">
              <div class="q-pa-md">
                <div class="column items-center justify-center q-py-xl">
                  <q-icon name="folder_open" size="xl" class="text-primary q-mb-md" />
                  <div class="text-h6 text-grey-7 q-mb-sm">{{ selectedModule.name }}</div>
                  <div class="text-caption text-grey-8 q-mb-md">
                    包含 {{ selectedModule.resourceCount || 0 }} 个资源
                  </div>

                  <q-separator dark class="full-width q-my-md" />

                  <div class="text-caption text-grey-8 text-center" style="max-width: 300px">
                    这是一个目录节点，用于组织和管理资源。<br />
                    点击右侧按钮可以添加资源、子目录或同级目录。
                  </div>
                </div>
              </div>
            </q-scroll-area>
          </div>

          <!-- 资源详情 -->
          <div v-else-if="selectedResourceId && (currentEditingResource || isNewResource)" class="column no-wrap fit">
            <!-- 详情工具栏 -->
            <q-bar dense dark class="bg-grey-9 text-grey-7">
              <div class="text-caption">资源详情</div>
              <q-space />
              <q-btn flat dense round icon="close"  @click="handleCloseDetail">
                <q-tooltip>关闭</q-tooltip>
              </q-btn>
            </q-bar>

            <!-- 详情内容 -->
            <q-scroll-area class="col bg-grey-10">
              <div class="q-pa-md">
                <!-- 基本信息 -->
                <div class="text-caption text-primary q-mb-sm">基本信息</div>
                <q-input
                  v-model="resourceForm.name"
                  label="资源名称"
                  dense
                  dark
                  outlined
                  class="q-mb-sm"
                  :rules="[val => !!val || '请输入资源名称']"
                >
                  <template #hint>
                    <span v-if="autoGeneratedIdentifier" class="text-grey-7">
                      标识符：<span class="text-weight-medium">{{ autoGeneratedIdentifier }}</span>
                    </span>
                  </template>
                </q-input>

                <q-select
                  v-model="resourceForm.type"
                  :options="resourceTypeOptions"
                  label="资源类型"
                  dense
                  dark
                  outlined
                  emit-value
                  map-options
                  class="q-mb-sm"
                  :disable="isResourceTypeLocked"
                  :rules="[val => !!val || '请选择资源类型']"
                >
                  <template #prepend>
                    <q-icon name="category"  />
                  </template>
                  <template #hint>
                    <span v-if="isResourceTypeLocked" class="text-warning">
                      <q-icon name="lock"  /> 资源类型已锁定（由父资源类型决定）
                    </span>
                    <span v-else-if="resourceForm.parentResourceId" class="text-grey-7">
                      可用类型已根据父资源自动过滤
                    </span>
                    <span v-else class="text-grey-7">
                      {{ resourceTypeOptions.length }} 种资源类型可选
                    </span>
                  </template>
                  <template #option="scope">
                    <q-item v-bind="scope.itemProps" dense dark>
                      <q-item-section avatar>
                        <q-icon :name="scope.opt.icon"  />
                      </q-item-section>
                      <q-item-section>
                        <q-item-label>{{ scope.opt.label }}</q-item-label>
                        <q-item-label caption class="text-grey-8">
                          {{ scope.opt.description }}
                        </q-item-label>
                      </q-item-section>
                    </q-item>
                  </template>
                </q-select>

                <q-input
                  v-model="resourceForm.description"
                  label="描述"
                  type="textarea"
                  dense
                  dark
                  outlined
                  rows="2"
                  class="q-mb-md"
                />

                <!-- 可操作项配置 -->
                <div class="text-caption text-primary q-mb-sm q-mt-md">可操作项配置</div>
                <div class="text-caption text-grey-8 q-mb-sm" style="font-size: 11px">
                  从默认操作中选择，或添加自定义操作
                </div>

                <!-- 默认操作（多选） -->
                <div class="q-mb-sm">
                  <div class="text-caption text-grey-7 q-mb-xs">默认操作</div>
                  <div class="row q-gutter-xs">
                    <q-checkbox
                      v-for="action in defaultActions"
                      :key="action.code"
                      v-model="resourceForm.selectedActions"
                      :val="action.code"
                      :label="action.name"
                      dense
                      dark
                      color="primary"
                      class="text-grey-7"
                    >
                      <q-tooltip>{{ action.description }}</q-tooltip>
                    </q-checkbox>
                  </div>
                </div>

                <!-- 自定义操作 -->
                <div class="q-mb-md">
                  <div class="row items-center q-mb-xs">
                    <div class="text-caption text-grey-7">自定义操作</div>
                    <q-space />
                    <q-btn flat dense icon="add" color="primary" @click="handleAddCustomAction">
                      <q-tooltip>添加自定义操作</q-tooltip>
                    </q-btn>
                  </div>

                  <div v-if="resourceForm.customActions.length === 0" class="text-caption text-grey-8 text-center q-py-sm">
                    暂无自定义操作，点击"+"添加
                  </div>

                  <div v-else class="column q-gutter-xs">
                    <div
                      v-for="(customAction, index) in resourceForm.customActions"
                      :key="index"
                      class="row q-gutter-xs items-center"
                    >
                      <q-input
                        v-model="customAction.code"
                        label="操作代码"
                        dense
                        dark
                        outlined
                        style="flex: 1"
                        placeholder="如：approve"
                      />
                      <q-input
                        v-model="customAction.name"
                        label="操作名称"
                        dense
                        dark
                        outlined
                        style="flex: 1"
                        placeholder="如：审批"
                      />
                      <q-btn
                        flat
                        dense
                        round
                        icon="close"
                        size="sm"
                        color="negative"
                        @click="handleRemoveCustomAction(index)"
                      >
                        <q-tooltip>删除</q-tooltip>
                      </q-btn>
                    </div>
                  </div>
                </div>

                <!-- URL 类型专用配置 -->
                <div v-if="isUrlType" class="q-mt-md q-pa-md bg-grey-9 rounded-borders">
                  <div class="text-caption text-primary q-mb-sm">
                    <q-icon name="api"  class="q-mr-xs" />
                    URL 匹配配置
                  </div>

                  <q-input
                    v-model="resourceForm.urlPattern"
                    label="URL 模式"
                    dense
                    dark
                    outlined
                    class="q-mb-sm"
                    placeholder="/api/users/:id"
                    :rules="[val => !!val || '请输入 URL 模式']"
                  >
                    <template #prepend>
                      <q-icon name="link"  />
                    </template>
                    <template #hint>
                      <span class="text-grey-7">
                        示例：/api/users/:id 或 /api/orders/*
                      </span>
                    </template>
                  </q-input>

                  <q-select
                    v-model="resourceForm.matchMethod"
                    :options="matchMethodOptions"
                    label="匹配方法"
                    dense
                    dark
                    outlined
                    emit-value
                    map-options
                    class="q-mb-sm"
                  >
                    <template #prepend>
                      <q-icon name="rule"  />
                    </template>
                    <template #option="scope">
                      <q-item v-bind="scope.itemProps" dense dark>
                        <q-item-section>
                          <q-item-label>{{ scope.opt.label }}</q-item-label>
                          <q-item-label caption class="text-grey-8">
                            {{ scope.opt.description }}
                            <code class="q-ml-xs">{{ scope.opt.example }}</code>
                          </q-item-label>
                        </q-item-section>
                      </q-item>
                    </template>
                  </q-select>

                  <!-- 关联的数据实体（内联显示） -->
                  <q-expansion-item
                    v-if="!isNewResource && isUrlType && linkedDataEntities.length > 0"
                    dense
                    dark
                    default-opened
                    class="q-mt-md bg-grey-10 rounded-borders"
                    header-class="text-grey-7"
                    expand-icon-class="text-grey-7"
                  >
                    <template #header>
                      <q-item-section avatar>
                        <q-icon name="table_chart" color="warning"  />
                      </q-item-section>
                      <q-item-section>
                        <q-item-label class="text-caption">
                          关联的数据实体 ({{ linkedDataEntities.length }})
                        </q-item-label>
                        <q-item-label caption class="text-grey-8">
                          该API返回数据的字段权限配置
                        </q-item-label>
                      </q-item-section>
                    </template>

                    <q-card dark flat class="bg-grey-10">
                      <q-card-section class="q-pa-sm">
                        <div
                          v-for="dataEntity in linkedDataEntities"
                          :key="dataEntity.id"
                          class="q-mb-sm q-pa-sm bg-grey-9 rounded-borders"
                        >
                          <div class="row items-center q-mb-xs">
                            <q-icon name="table_chart" color="warning"  class="q-mr-xs" />
                            <span class="text-weight-medium text-grey-7">{{ dataEntity.name }}</span>
                            <q-space />
                            <q-btn
                              flat
                              dense
                              size="sm"
                              icon="edit"
                              color="primary"
                              @click="handleSelectResource(dataEntity.id)"
                            >
                              <q-tooltip>编辑数据实体</q-tooltip>
                            </q-btn>
                          </div>
                          <div class="text-caption text-grey-8 q-mb-xs">
                            {{ dataEntity.identifier }}
                          </div>
                          <div v-if="dataEntity.fields && dataEntity.fields.length > 0" class="q-mt-xs">
                            <div class="text-caption text-grey-7 q-mb-xs">字段配置:</div>
                            <div class="row q-gutter-xs">
                              <q-chip
                                v-for="field in dataEntity.fields"
                                :key="field.name"
                                dense
                                size="sm"
                                :color="getSensitivityColor(field.sensitivity)"
                                text-color="white"
                                class="text-caption"
                              >
                                {{ field.label || field.name }}
                              </q-chip>
                            </div>
                          </div>
                        </div>

                        <q-banner dense dark class="bg-grey-9 q-mt-sm">
                          <template #avatar>
                            <q-icon name="info"  color="primary" />
                          </template>
                          <div class="text-caption text-grey-7">
                            数据实体控制该API返回数据的字段可见性、编辑性和脱敏规则
                          </div>
                        </q-banner>
                      </q-card-section>
                    </q-card>
                  </q-expansion-item>
                </div>

                <!-- 数据类型专用配置（字段） -->
                <div v-if="isDataType" class="q-mt-md q-pa-md bg-grey-9 rounded-borders">
                  <div class="row items-center q-mb-sm">
                    <div class="text-caption text-primary">
                      <q-icon name="table_chart"  class="q-mr-xs" />
                      字段配置（用于字段级权限控制）
                    </div>
                    <q-space />
                    <q-btn flat dense icon="add" color="primary" @click="handleAddField">
                      <q-tooltip>添加字段</q-tooltip>
                    </q-btn>
                  </div>

                  <div v-if="resourceForm.fields.length === 0" class="text-caption text-grey-8 text-center q-py-md">
                    暂无字段配置，点击上方"+"添加字段
                  </div>

                  <div v-else class="column q-gutter-sm">
                    <div
                      v-for="(field, index) in resourceForm.fields"
                      :key="index"
                      class="row q-gutter-xs items-center"
                    >
                      <q-input
                        v-model="field.name"
                        label="字段名"
                        dense
                        dark
                        outlined
                        style="flex: 1"
                        placeholder="如：salary"
                      />
                      <q-input
                        v-model="field.label"
                        label="显示名"
                        dense
                        dark
                        outlined
                        style="flex: 1"
                        placeholder="如：薪资"
                      />
                      <q-select
                        v-model="field.sensitivity"
                        :options="sensitivityOptions"
                        label="敏感级别"
                        dense
                        dark
                        outlined
                        emit-value
                        map-options
                        option-value="value"
                        option-label="label"
                        style="min-width: 100px"
                      >
                        <template #selected-item="scope">
                          <q-chip
                            dense
                            size="sm"
                            :color="scope.opt.color"
                            text-color="white"
                            :icon="scope.opt.icon"
                          >
                            {{ scope.opt.label }}
                          </q-chip>
                        </template>
                      </q-select>
                      <q-btn
                        flat
                        dense
                        round
                        icon="close"
                        size="sm"
                        color="negative"
                        @click="handleRemoveField(index)"
                      >
                        <q-tooltip>删除字段</q-tooltip>
                      </q-btn>
                    </div>
                  </div>

                  <q-banner dense dark class="bg-grey-10 q-mt-sm text-grey-8">
                    <template #avatar>
                      <q-icon name="info"  color="primary" />
                    </template>
                    <div class="text-caption">
                      字段敏感级别说明：<br />
                      • <strong>普通</strong>：默认可见<br />
                      • <strong>敏感</strong>：需要脱敏显示（如手机号）<br />
                      • <strong>机密</strong>：默认隐藏，需特殊权限
                    </div>
                  </q-banner>
                </div>

                <!-- 权限配置预览（仅编辑现有资源时显示） -->
                <div v-if="!isNewResource && resourcePermissionSummary.length > 0" class="q-mt-md">
                  <q-expansion-item
                    dense
                    dark
                    default-opened
                    class="bg-grey-9 rounded-borders"
                    header-class="text-grey-7"
                    expand-icon-class="text-grey-7"
                  >
                    <template #header>
                      <q-item-section avatar>
                        <q-icon name="security" color="primary"  />
                      </q-item-section>
                      <q-item-section>
                        <q-item-label class="text-caption">
                          权限配置概览 ({{ resourcePermissionSummary.length }})
                        </q-item-label>
                        <q-item-label caption class="text-grey-8">
                          查看该资源的权限配置
                        </q-item-label>
                      </q-item-section>
                    </template>

                    <q-card dark flat class="bg-grey-10">
                      <q-card-section class="q-pa-sm">
                        <q-list dense dark>
                          <q-item
                            v-for="(summary, index) in resourcePermissionSummary"
                            :key="index"
                            dense
                            dark
                            class="q-pa-xs bg-grey-9 q-mb-xs rounded-borders"
                          >
                            <q-item-section>
                              <q-item-label class="text-caption text-grey-7">
                                {{ summary.roleName }} @ {{ summary.orgName }}
                              </q-item-label>
                              <q-item-label caption class="text-grey-8 q-mt-xs">
                                <span
                                  v-for="(perm, pIndex) in summary.permissions"
                                  :key="pIndex"
                                  class="q-mr-sm"
                                >
                                  <q-badge
                                    dense
                                    :color="perm.effect === 'allow' ? 'positive' : 'negative'"
                                    :label="`${perm.action}: ${perm.effect === 'allow' ? '✓' : '✗'}`"
                                  />
                                </span>
                              </q-item-label>
                            </q-item-section>
                          </q-item>
                        </q-list>

                        <q-separator dark class="q-my-sm" />

                        <div class="row justify-end">
                          <q-btn
                            flat
                            dense
                            size="sm"
                            label="详细配置"
                            color="primary"
                            icon="settings"
                            @click="handleGoToPermissionConfig"
                          >
                            <q-tooltip>跳转到权限配置标签页</q-tooltip>
                          </q-btn>
                        </div>
                      </q-card-section>
                    </q-card>
                  </q-expansion-item>
                </div>

                <!-- 保存按钮 -->
                <div class="row justify-end q-mt-md q-gutter-sm">
                  <q-btn
                    flat
                    label="取消"
                    color="grey-7"
                    @click="handleCloseDetail"
                  />
                  <q-btn
                    v-if="!isNewResource"
                    flat
                    label="配置权限"
                    color="secondary"
                    icon="shield"
                    @click="handleGoToPermissionConfig"
                  >
                    <q-tooltip>跳转到权限配置标签页</q-tooltip>
                  </q-btn>
                  <q-btn
                    flat
                    label="保存"
                    color="primary"
                    :disable="!resourceForm.name || !resourceForm.type"
                    @click="handleSaveResource"
                  />
                </div>
              </div>
            </q-scroll-area>
          </div>

          <!-- 未选中提示 -->
          <div v-else class="column no-wrap fit items-center justify-center text-center text-grey-7">
            <q-icon name="info_outline" size="lg" class="q-mb-md" />
            <div class="text-subtitle2 q-mb-sm">请选择资源</div>
            <div class="text-caption text-grey-8" style="max-width: 300px">
              从左侧树中选择资源节点，或点击模块节点旁的"+"添加新资源
            </div>
          </div>
        </div>
      </template>
    </q-splitter>

    <!-- 添加子模块对话框 -->
    <q-dialog v-model="showAddSubModuleDialog" persistent dark>
      <q-card dark class="bg-grey-9" style="min-width: 400px">
        <q-card-section class="row items-center q-pb-none">
          <div class="text-subtitle2">添加子模块</div>
          <q-space />
          <q-btn flat dense round icon="close" v-close-popup @click="showAddSubModuleDialog = false" />
        </q-card-section>

        <q-card-section>
          <div class="q-mb-sm text-caption text-grey-7">
            父模块：<span class="text-primary">{{ currentParentModule }}</span>
          </div>
          <q-input
            v-model="newSubModuleName"
            label="子模块名称"
            dense
            dark
            outlined
            placeholder="如：子分类A"
            @keyup.enter="confirmAddSubModule"
            autofocus
          >
            <template #prepend>
              <q-icon name="folder"  />
            </template>
          </q-input>
        </q-card-section>

        <q-card-actions align="right">
          <q-btn flat label="取消" color="grey-7" v-close-popup @click="showAddSubModuleDialog = false" />
          <q-btn flat label="确定" color="primary" :disable="!newSubModuleName" @click="confirmAddSubModule" />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <!-- 添加同级模块对话框 -->
    <q-dialog v-model="showAddSiblingModuleDialog" persistent dark>
      <q-card dark class="bg-grey-9" style="min-width: 400px">
        <q-card-section class="row items-center q-pb-none">
          <div class="text-subtitle2">添加同级目录</div>
          <q-space />
          <q-btn flat dense round icon="close" v-close-popup @click="showAddSiblingModuleDialog = false" />
        </q-card-section>

        <q-card-section>
          <div class="q-mb-sm text-caption text-grey-7">
            将添加到：<span class="text-primary">{{ currentParentModule || '根目录' }}</span>
          </div>
          <q-input
            v-model="newSiblingModuleName"
            label="目录名称"
            dense
            dark
            outlined
            placeholder="如：分类B"
            @keyup.enter="confirmAddSiblingModule"
            autofocus
          >
            <template #prepend>
              <q-icon name="folder"  />
            </template>
          </q-input>
        </q-card-section>

        <q-card-actions align="right">
          <q-btn flat label="取消" color="grey-7" v-close-popup @click="showAddSiblingModuleDialog = false" />
          <q-btn flat label="确定" color="primary" :disable="!newSiblingModuleName" @click="confirmAddSiblingModule" />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <!-- 重命名对话框 -->
    <q-dialog v-model="showRenameDialog" persistent dark>
      <q-card dark class="bg-grey-9" style="min-width: 400px">
        <q-card-section class="row items-center q-pb-none">
          <div class="text-subtitle2">重命名{{ renamingItem?.type === 'module' ? '目录' : '资源' }}</div>
          <q-space />
          <q-btn flat dense round icon="close" v-close-popup @click="showRenameDialog = false" />
        </q-card-section>

        <q-card-section>
          <q-input
            v-model="newName"
            label="新名称"
            dense
            dark
            outlined
            @keyup.enter="confirmRename"
            autofocus
          >
            <template #prepend>
              <q-icon :name="renamingItem?.type === 'module' ? 'folder' : 'description'"  />
            </template>
          </q-input>
        </q-card-section>

        <q-card-actions align="right">
          <q-btn flat label="取消" color="grey-7" v-close-popup @click="showRenameDialog = false" />
          <q-btn flat label="确定" color="primary" :disable="!newName" @click="confirmRename" />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <!-- 调整层级对话框 -->
    <q-dialog v-model="showChangeParentDialog" persistent dark>
      <q-card dark class="bg-grey-9" style="min-width: 400px">
        <q-card-section class="row items-center q-pb-none">
          <div class="text-subtitle2">调整层级</div>
          <q-space />
          <q-btn flat dense round icon="close" v-close-popup @click="showChangeParentDialog = false" />
        </q-card-section>

        <q-card-section>
          <div class="q-mb-sm text-caption text-grey-7">
            当前目录：<span class="text-primary">{{ changingParentNode?.name }}</span>
          </div>
          <q-select
            v-model="selectedNewParentId"
            :options="[
              { label: '根目录', value: null },
              ...modules.filter(m => m.id !== changingParentNode?.id).map(m => ({ label: m.name, value: m.id }))
            ]"
            label="选择父目录"
            dense
            dark
            outlined
            emit-value
            map-options
          >
            <template #prepend>
              <q-icon name="folder_open"  />
            </template>
          </q-select>
        </q-card-section>

        <q-card-actions align="right">
          <q-btn flat label="取消" color="grey-7" v-close-popup @click="showChangeParentDialog = false" />
          <q-btn flat label="确定" color="primary" @click="confirmChangeParent" />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <!-- 移动资源对话框 -->
    <q-dialog v-model="showMoveResourceDialog" persistent dark>
      <q-card dark class="bg-grey-9" style="min-width: 400px">
        <q-card-section class="row items-center q-pb-none">
          <div class="text-subtitle2">移动资源</div>
          <q-space />
          <q-btn flat dense round icon="close" v-close-popup @click="showMoveResourceDialog = false" />
        </q-card-section>

        <q-card-section>
          <div class="q-mb-sm text-caption text-grey-7">
            资源：<span class="text-primary">{{ movingResource?.name }}</span>
          </div>
          <q-select
            v-model="targetModuleId"
            :options="modules.map(m => ({ label: m.name, value: m.id }))"
            label="目标目录"
            dense
            dark
            outlined
            emit-value
            map-options
          >
            <template #prepend>
              <q-icon name="folder"  />
            </template>
          </q-select>
        </q-card-section>

        <q-card-actions align="right">
          <q-btn flat label="取消" color="grey-7" v-close-popup @click="showMoveResourceDialog = false" />
          <q-btn flat label="确定" color="primary" :disable="!targetModuleId" @click="confirmMoveResource" />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue';
import { useQuasar } from 'quasar';
import { usePermissionStore } from '../composables/usePermissionStore.js';
import { find, filter, includes, some } from 'lodash-es';

// Props 定义
const props = defineProps({
  componentInfo: {
    type: Object,
    default: null
  }
});

// Emit 事件定义
const emit = defineEmits(['navigate-to-permission-config', 'resource-saved']);

const $q = useQuasar();
const permissionStore = usePermissionStore();

// 布局
const splitterModel = ref(40);

// 资源相关
const resources = ref([]);
const resourceSearchText = ref('');
const expandedResourceNodes = ref([]);
const selectedResourceId = ref(null);
const isNewResource = ref(false);
const selectedModule = ref(null); // 选中的模块

// 过滤后的资源列表（只显示当前组件关联的资源）
const filteredResources = computed(() => {
  // 从组件面板打开时，只显示该组件拥有的资源（按 componentMapping 归属键过滤）
  if (props.componentInfo?.id) {
    const componentPermId = props.componentInfo.id;
    return resources.value.filter(
      resource => resource.componentMapping?.componentPermissionId === componentPermId
    );
  }

  // 如果不是从组件面板打开的，显示所有资源
  return resources.value;
});

// 模块管理
const modules = ref([
  { id: 'module-通用', name: '通用', parentId: null }
]);
const showAddSubModuleDialog = ref(false);
const showAddSiblingModuleDialog = ref(false);
const showRenameDialog = ref(false);
const showChangeParentDialog = ref(false);
const showMoveResourceDialog = ref(false);
const newSubModuleName = ref('');
const newSiblingModuleName = ref('');
const currentParentModule = ref(null);
const siblingModuleParentId = ref(null);
const renamingItem = ref(null);
const newName = ref('');
const changingParentNode = ref(null);
const selectedNewParentId = ref(null);
const movingResource = ref(null);
const targetModuleId = ref(null);

// 资源表单
const resourceForm = ref({
  name: '',
  type: '',
  module: '通用',
  description: '',
  parentResourceId: null,  // 父资源ID（通过树结构层级关系表达依赖）
  selectedActions: [],
  customActions: [],
  identifier: '',
  // URL 类型专用配置
  urlPattern: '',
  matchMethod: 'keyMatch2',
  // 数据类型专用配置
  fields: []
});

// 资源类型选项（根据父资源动态过滤）
const resourceTypeOptions = computed(() => {
  const allTypes = permissionStore.getResourceTypes();

  // 如果没有父资源，可以创建顶层资源（page、url、component，但不能创建 data）
  if (!resourceForm.value.parentResourceId) {
    // Data 类型不能作为顶层资源，其他都可以
    return allTypes
      .filter(t => t.id !== 'data')
      .map(t => ({
        label: t.name,
        value: t.id,
        icon: t.icon,
        description: t.description
      }));
  }

  // 根据父资源类型过滤允许的子资源类型
  const parentResource = resources.value.find(r => r.identifier === resourceForm.value.parentResourceId);
  if (!parentResource) {
    return allTypes.map(t => ({
      label: t.name,
      value: t.id,
      icon: t.icon,
      description: t.description
    }));
  }

  const parentTypeInfo = allTypes.find(t => t.id === parentResource.type);
  const allowedChildTypes = parentTypeInfo?.allowedChildren || [];

  return allTypes
    .filter(t => allowedChildTypes.includes(t.id))
    .map(t => ({
      label: t.name,
      value: t.id,
      icon: t.icon,
      description: t.description
    }));
});

// 资源类型是否被锁定（通过右键菜单添加特定类型时）
const isResourceTypeLocked = ref(false);

// 默认操作（根据资源类型）
const defaultActions = computed(() => {
  if (!resourceForm.value.type) return [];
  const types = permissionStore.getResourceTypes();
  const type = types.find(t => t.id === resourceForm.value.type);
  return type?.defaultActions || [];
});

// URL 匹配方法选项
const matchMethodOptions = computed(() => {
  const types = permissionStore.getResourceTypes();
  const urlType = types.find(t => t.id === 'url');
  if (!urlType?.matchTypes) return [];
  return urlType.matchTypes.map(m => ({
    label: m.label,
    value: m.value,
    description: m.description,
    example: m.example
  }));
});

// 字段敏感级别选项
const sensitivityOptions = computed(() => {
  const types = permissionStore.getResourceTypes();
  const dataType = types.find(t => t.id === 'data');
  if (!dataType?.sensitivityLevels) return [];
  return dataType.sensitivityLevels;
});

// 当前资源类型是否是 URL
const isUrlType = computed(() => resourceForm.value.type === 'url');

// 当前资源类型是否是数据实体
const isDataType = computed(() => resourceForm.value.type === 'data');

// 当前编辑的资源
const currentEditingResource = computed(() => {
  if (!selectedResourceId.value) return null;
  return resources.value.find(r => r.id === selectedResourceId.value);
});

// 获取当前URL资源关联的数据实体（子资源）
const linkedDataEntities = computed(() => {
  // 必须是 URL 类型资源
  if (resourceForm.value.type !== 'url') return [];

  // 新建资源时没有关联数据
  if (isNewResource.value || !currentEditingResource.value) return [];

  // 查找所有以当前资源 identifier 为父资源的 data 类型资源
  const currentIdentifier = currentEditingResource.value.identifier;
  if (!currentIdentifier) return [];

  const dataEntities = resources.value.filter(r =>
    r.parentResourceId === currentIdentifier &&
    r.type === 'data'
  );

  console.log('[ResourcePanel] linkedDataEntities:', {
    currentIdentifier,
    currentResource: currentEditingResource.value,
    dataEntities,
    allResources: resources.value
  });

  return dataEntities;
});

// 当前资源的权限配置概览
const resourcePermissionSummary = computed(() => {
  if (isNewResource.value || !currentEditingResource.value) return [];

  const resourceIdentifier = currentEditingResource.value.identifier;
  if (!resourceIdentifier) return [];

  // 获取所有涉及此资源的策略
  const policies = permissionStore.policies.filter(p => p.obj === resourceIdentifier);

  // 按组织-角色分组
  const summary = {};

  policies.forEach(policy => {
    const key = `${policy.sub}-${policy.dom}`;
    if (!summary[key]) {
      const role = permissionStore.getRoleById(policy.sub);
      const org = permissionStore.getOrganizationById(policy.dom);

      summary[key] = {
        roleId: policy.sub,
        roleName: role?.name || policy.sub,
        orgId: policy.dom,
        orgName: org?.name || policy.dom,
        permissions: []
      };
    }

    summary[key].permissions.push({
      action: policy.act,
      effect: policy.eft
    });
  });

  return Object.values(summary);
});

// 自动生成的资源标识符
const autoGeneratedIdentifier = computed(() => {
  if (!resourceForm.value.type || !resourceForm.value.name) {
    return '';
  }

  const prefix = getResourceTypePrefix(resourceForm.value.type);

  // URL 类型使用 urlPattern
  if (resourceForm.value.type === 'url' && resourceForm.value.urlPattern) {
    return `${prefix}${resourceForm.value.urlPattern}`;
  }

  // 其他类型使用名称生成
  const name = resourceForm.value.name
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w\u4e00-\u9fa5-]/g, '')
    .toLowerCase();

  return `${prefix}${name}`;
});

// 资源树节点（基于资源层级关系而非模块）
const resourceTreeNodes = computed(() => {
  // 应用搜索过滤
  const searchFiltered = resourceSearchText.value
    ? filter(filteredResources.value, r => {
        const searchLower = resourceSearchText.value.toLowerCase();
        return r.name?.toLowerCase().includes(searchLower) ||
               r.identifier?.toLowerCase().includes(searchLower);
      })
    : filteredResources.value;

  // 构建层级树（基于 parentResourceId）
  const buildResourceTree = (parentId = null) => {
    return filter(searchFiltered, { parentResourceId: parentId })
      .map(resource => {
        const children = buildResourceTree(resource.identifier);

        return {
          ...resource,
          isModule: false,
          children: children.length > 0 ? children : undefined
        };
      });
  };

  const tree = buildResourceTree();

  // 如果启用了模块分组，按模块组织（作为顶层分组）
  if (modules.value.length > 0) {
    return buildModuleTree();
  }

  return tree;
});

// 构建模块树（旧逻辑，可选）
function buildModuleTree() {
  const searchFiltered = resourceSearchText.value
    ? filter(filteredResources.value, r => {
        const searchLower = resourceSearchText.value.toLowerCase();
        return r.name?.toLowerCase().includes(searchLower) ||
               r.identifier?.toLowerCase().includes(searchLower);
      })
    : filteredResources.value;

  const buildTree = (parentId = null) => {
    return filter(modules.value, { parentId })
      .map(module => {
        const moduleResources = filter(searchFiltered, { module: module.name, parentResourceId: null });
        const childModules = buildTree(module.id);

        return {
          id: module.id,
          name: module.name,
          isModule: true,
          resourceCount: moduleResources.length,
          children: [
            ...childModules,
            ...moduleResources.map(r => buildResourceWithChildren(r))
          ]
        };
      });
  };

  return buildTree();
}

// 递归构建资源及其子资源
function buildResourceWithChildren(resource) {
  const children = filter(resources.value, { parentResourceId: resource.identifier });

  return {
    ...resource,
    isModule: false,
    children: children.length > 0 ? children.map(buildResourceWithChildren) : undefined
  };
}

/**
 * 获取资源类型信息
 */
function getResourceTypeInfo(typeId) {
  const types = permissionStore.getResourceTypes();
  return types.find(t => t.id === typeId);
}

/**
 * 获取允许的子资源类型
 */
function getAllowedChildTypes(parentResource) {
  const typeInfo = getResourceTypeInfo(parentResource.type);
  if (!typeInfo?.allowedChildren || typeInfo.allowedChildren.length === 0) {
    return [];
  }

  const types = permissionStore.getResourceTypes();
  return typeInfo.allowedChildren.map(childTypeId => {
    const childType = types.find(t => t.id === childTypeId);
    return {
      id: childType.id,
      name: childType.name,
      icon: childType.icon
    };
  });
}

/**
 * 获取敏感级别对应的颜色
 */
function getSensitivityColor(sensitivity) {
  const colorMap = {
    normal: 'grey',
    sensitive: 'warning',
    confidential: 'negative'
  };
  return colorMap[sensitivity] || 'grey';
}

/**
 * 加载数据
 */
function loadData() {
  resources.value = permissionStore.getResources();

  // 自动展开"通用"模块
  if (!includes(expandedResourceNodes.value, 'module-通用')) {
    expandedResourceNodes.value.push('module-通用');
  }
}

/**
 * 获取资源类型前缀
 */
function getResourceTypePrefix(typeId) {
  if (!typeId) return '';
  const types = permissionStore.getResourceTypes();
  const type = types.find(t => t.id === typeId);
  if (!type?.prefix) return '';

  const prefix = type.prefix.trim();
  return prefix.endsWith(':') ? prefix : `${prefix}:`;
}

/**
 * 获取资源类型名称
 */
function getResourceTypeName(typeId) {
  const types = permissionStore.getResourceTypes();
  const type = types.find(t => t.id === typeId);
  return type?.name || typeId;
}

/**
 * 获取资源类型图标
 */
function getResourceTypeIcon(typeId) {
  const types = permissionStore.getResourceTypes();
  const type = types.find(t => t.id === typeId);
  return type?.icon || 'category';
}

/**
 * 获取资源类型颜色
 */
function getResourceTypeColor(typeId) {
  const colorMap = {
    page: 'primary',
    component: 'secondary',
    url: 'info',
    data: 'warning'
  };
  return colorMap[typeId] || 'grey-7';
}

/**
 * 切换资源节点展开状态
 */
function toggleResourceNodeExpansion(node) {
  if (!node.children || node.children.length === 0) {
    return;
  }

  const index = expandedResourceNodes.value.indexOf(node.id);
  if (index > -1) {
    expandedResourceNodes.value.splice(index, 1);
  } else {
    expandedResourceNodes.value.push(node.id);
  }
}

/**
 * 选择模块
 */
function handleSelectModule(node) {
  selectedResourceId.value = null;
  selectedModule.value = node;
  toggleResourceNodeExpansion(node);
}

/**
 * 选择资源
 */
function handleSelectResource(nodeId) {
  const resource = find(resources.value, { id: nodeId });
  if (!resource) {
    selectedResourceId.value = null;
    selectedModule.value = null;
    return;
  }

  selectedResourceId.value = nodeId;
  selectedModule.value = null;
  isNewResource.value = false;
  isResourceTypeLocked.value = false;  // 编辑现有资源时，类型不锁定

  // 填充表单
  resourceForm.value = {
    name: resource.name || '',
    type: resource.type || '',
    module: resource.module || '通用',
    description: resource.description || '',
    parentResourceId: resource.parentResourceId || null,
    selectedActions: resource.actions || [],
    customActions: resource.customActions || [],
    identifier: resource.identifier || '',
    urlPattern: resource.urlPattern || '',
    matchMethod: resource.matchMethod || 'keyMatch2',
    fields: resource.fields ? [...resource.fields] : []
  };
}

/**
 * 关闭详情面板
 */
function handleCloseDetail() {
  selectedResourceId.value = null;
  selectedModule.value = null;
  resetForm();
}

/**
 * 重置表单
 */
function resetForm() {
  resourceForm.value = {
    name: '',
    type: '',
    module: '通用',
    description: '',
    parentResourceId: null,
    selectedActions: [],
    customActions: [],
    identifier: '',
    urlPattern: '',
    matchMethod: 'keyMatch2',
    fields: []
  };
  isResourceTypeLocked.value = false;
}

/**
 * 添加子资源（特定类型）
 */
function handleAddChildResource(parentResource, childTypeId) {
  isNewResource.value = true;
  selectedResourceId.value = 'new';
  resetForm();

  // 设置父资源和资源类型（类型被锁定）
  resourceForm.value.parentResourceId = parentResource.identifier;
  resourceForm.value.type = childTypeId;
  resourceForm.value.module = parentResource.module || '通用';
  isResourceTypeLocked.value = true;  // 锁定资源类型，不允许修改
}

/**
 * 添加资源
 */
function handleAddResource() {
  isNewResource.value = true;
  selectedResourceId.value = 'new';
  resetForm();
}

/**
 * 添加资源到指定模块
 */
function handleAddResourceToModule(moduleName) {
  isNewResource.value = true;
  selectedResourceId.value = 'new';
  resetForm();
  // 设置默认模块
  resourceForm.value.module = moduleName;
}

/**
 * 添加子节点
 */
function handleAddSubModule(parentModuleName) {
  currentParentModule.value = parentModuleName;
  showAddSubModuleDialog.value = true;
}

/**
 * 添加同级目录（从模块节点）
 */
function handleAddSiblingModule(node) {
  const currentModule = find(modules.value, { id: node.id });
  if (!currentModule) return;

  // 找到父模块名称（如果有父模块）
  let parentModuleName = '根目录';
  if (currentModule.parentId) {
    const parentModule = find(modules.value, { id: currentModule.parentId });
    if (parentModule) {
      parentModuleName = parentModule.name;
    }
  }

  currentParentModule.value = parentModuleName;
  // 保存当前模块的 parentId，用于创建同级模块
  showAddSiblingModuleDialog.value = true;
  siblingModuleParentId.value = currentModule.parentId;
}

/**
 * 添加同级资源（从模块节点）
 */
function handleAddSiblingResource(node) {
  const currentModule = find(modules.value, { id: node.id });
  if (!currentModule) return;

  // 找到父模块
  let targetModuleName = '通用';
  if (currentModule.parentId) {
    const parentModule = find(modules.value, { id: currentModule.parentId });
    if (parentModule) {
      targetModuleName = parentModule.name;
    }
  }

  isNewResource.value = true;
  selectedResourceId.value = 'new';
  resetForm();
  resourceForm.value.module = targetModuleName;
}

/**
 * 添加同级资源（从资源节点）
 */
function handleAddSiblingResourceFromResource(resourceNode) {
  isNewResource.value = true;
  selectedResourceId.value = 'new';
  resetForm();
  resourceForm.value.module = resourceNode.module || '通用';
}

/**
 * 重命名模块
 */
function handleRenameModule(node) {
  const module = find(modules.value, { id: node.id });
  if (!module) return;

  renamingItem.value = { ...module, type: 'module' };
  newName.value = module.name;
  showRenameDialog.value = true;
}

/**
 * 重命名资源
 */
function handleRenameResource(resourceNode) {
  const resource = find(resources.value, { id: resourceNode.id });
  if (!resource) return;

  renamingItem.value = { ...resource, type: 'resource' };
  newName.value = resource.name;
  showRenameDialog.value = true;
}

/**
 * 确认重命名
 */
function confirmRename() {
  const trimmedName = newName.value?.trim();
  if (!trimmedName) return;

  if (renamingItem.value.type === 'module') {
    // 检查模块名是否已存在
    if (some(modules.value, m => m.name === trimmedName && m.id !== renamingItem.value.id)) {
      $q.notify({
        type: 'warning',
        message: '目录名称已存在',
        position: 'top',
        timeout: 1500
      });
      return;
    }

    const module = find(modules.value, { id: renamingItem.value.id });
    if (module) {
      const oldName = module.name;
      module.name = trimmedName;

      // 更新所有使用该模块名的资源
      resources.value.forEach(r => {
        if (r.module === oldName) {
          r.module = trimmedName;
        }
      });

      loadData();
      $q.notify({
        type: 'positive',
        message: `目录已重命名为「${trimmedName}」`,
        position: 'top',
        timeout: 1500
      });
    }
  } else if (renamingItem.value.type === 'resource') {
    const resource = find(resources.value, { id: renamingItem.value.id });
    if (resource) {
      resource.name = trimmedName;
      permissionStore.updateResource(resource.id, resource);
      loadData();
      $q.notify({
        type: 'positive',
        message: `资源已重命名为「${trimmedName}」`,
        position: 'top',
        timeout: 1500
      });
    }
  }

  showRenameDialog.value = false;
  renamingItem.value = null;
  newName.value = '';
}

/**
 * 调整层级（改变父模块）
 */
function handleChangeParent(node) {
  const module = find(modules.value, { id: node.id });
  if (!module) return;

  changingParentNode.value = module;
  selectedNewParentId.value = module.parentId || null;
  showChangeParentDialog.value = true;
}

/**
 * 确认调整层级
 */
function confirmChangeParent() {
  if (!changingParentNode.value) return;

  // 检查是否会造成循环引用
  if (selectedNewParentId.value && isDescendantModule(selectedNewParentId.value, changingParentNode.value.id)) {
    $q.notify({
      type: 'warning',
      message: '不能将目录移动到其子目录下',
      position: 'top',
      timeout: 1500
    });
    return;
  }

  const module = find(modules.value, { id: changingParentNode.value.id });
  if (module) {
    module.parentId = selectedNewParentId.value;

    const parentModule = selectedNewParentId.value
      ? find(modules.value, { id: selectedNewParentId.value })
      : null;

    $q.notify({
      type: 'positive',
      message: parentModule
        ? `已移动到「${parentModule.name}」下`
        : '已移动到根目录',
      position: 'top',
      timeout: 1500
    });
  }

  showChangeParentDialog.value = false;
  changingParentNode.value = null;
  selectedNewParentId.value = null;
}

/**
 * 移动资源到其他模块
 */
function handleMoveResource(resourceNode) {
  const resource = find(resources.value, { id: resourceNode.id });
  if (!resource) return;

  movingResource.value = resource;
  const currentModule = find(modules.value, { name: resource.module });
  targetModuleId.value = currentModule?.id || null;
  showMoveResourceDialog.value = true;
}

/**
 * 确认移动资源
 */
function confirmMoveResource() {
  if (!movingResource.value || !targetModuleId.value) return;

  const targetModule = find(modules.value, { id: targetModuleId.value });
  if (!targetModule) return;

  movingResource.value.module = targetModule.name;
  permissionStore.updateResource(movingResource.value.id, movingResource.value);
  loadData();

  $q.notify({
    type: 'positive',
    message: `资源已移动到「${targetModule.name}」`,
    position: 'top',
    timeout: 1500
  });

  showMoveResourceDialog.value = false;
  movingResource.value = null;
  targetModuleId.value = null;
}

/**
 * 确认添加子模块
 */
function confirmAddSubModule() {
  const subModuleName = newSubModuleName.value?.trim();
  if (!subModuleName) return;

  // 检查是否已存在
  if (some(modules.value, { name: subModuleName })) {
    $q.notify({
      type: 'warning',
      message: '模块名称已存在',
      position: 'top',
      timeout: 1500
    });
    return;
  }

  // 查找父模块
  const parentModule = find(modules.value, { name: currentParentModule.value });
  if (!parentModule) {
    $q.notify({
      type: 'warning',
      message: '未找到父模块',
      position: 'top',
      timeout: 1500
    });
    return;
  }

  // 添加子模块
  modules.value.push({
    id: `module-${Date.now()}`,
    name: subModuleName,
    parentId: parentModule.id
  });

  // 清空输入并关闭对话框
  newSubModuleName.value = '';
  showAddSubModuleDialog.value = false;
  currentParentModule.value = null;

  // 自动展开父节点
  if (!includes(expandedResourceNodes.value, parentModule.id)) {
    expandedResourceNodes.value.push(parentModule.id);
  }

  $q.notify({
    type: 'positive',
    message: `子模块「${subModuleName}」已添加`,
    position: 'top',
    timeout: 1500
  });
}

/**
 * 确认添加同级模块
 */
function confirmAddSiblingModule() {
  const siblingModuleName = newSiblingModuleName.value?.trim();
  if (!siblingModuleName) return;

  // 检查是否已存在
  if (some(modules.value, { name: siblingModuleName })) {
    $q.notify({
      type: 'warning',
      message: '模块名称已存在',
      position: 'top',
      timeout: 1500
    });
    return;
  }

  // 添加同级模块（使用相同的 parentId）
  modules.value.push({
    id: `module-${Date.now()}`,
    name: siblingModuleName,
    parentId: siblingModuleParentId.value
  });

  // 清空输入并关闭对话框
  newSiblingModuleName.value = '';
  showAddSiblingModuleDialog.value = false;
  currentParentModule.value = null;
  siblingModuleParentId.value = null;

  // 如果有父节点，自动展开
  if (siblingModuleParentId.value && !includes(expandedResourceNodes.value, siblingModuleParentId.value)) {
    expandedResourceNodes.value.push(siblingModuleParentId.value);
  }

  $q.notify({
    type: 'positive',
    message: `同级模块「${siblingModuleName}」已添加`,
    position: 'top',
    timeout: 1500
  });
}

/**
 * 删除模块
 */
function handleDeleteModule(moduleName) {
  const module = find(modules.value, { name: moduleName });
  if (!module) return;

  // 检查是否有子模块或资源
  if (some(modules.value, { parentId: module.id })) {
    $q.notify({
      type: 'warning',
      message: '该模块下有子模块，无法删除',
      position: 'top',
      timeout: 1500
    });
    return;
  }

  if (some(resources.value, { module: moduleName })) {
    $q.notify({
      type: 'warning',
      message: '该模块下有资源，无法删除',
      position: 'top',
      timeout: 1500
    });
    return;
  }

  $q.dialog({
    title: '确认删除',
    message: `确定要删除模块「${moduleName}」吗？`,
    dark: true,
    persistent: true,
    cancel: { flat: true, label: '取消', color: 'grey-7' },
    ok: { flat: true, label: '确定删除', color: 'negative' }
  }).onOk(() => {
    modules.value = filter(modules.value, m => m.id !== module.id);
    $q.notify({
      type: 'positive',
      message: `模块「${moduleName}」已删除`,
      position: 'top',
      timeout: 1500
    });
  });
}

/**
 * 添加自定义操作
 */
function handleAddCustomAction() {
  resourceForm.value.customActions.push({
    code: '',
    name: ''
  });
}

/**
 * 删除自定义操作
 */
function handleRemoveCustomAction(index) {
  resourceForm.value.customActions.splice(index, 1);
}

/**
 * 添加字段
 */
function handleAddField() {
  resourceForm.value.fields.push({
    name: '',
    label: '',
    sensitivity: 'normal'
  });
}

/**
 * 删除字段
 */
function handleRemoveField(index) {
  resourceForm.value.fields.splice(index, 1);
}

/**
 * 导航到权限配置
 */
function handleGoToPermissionConfig() {
  if (!currentEditingResource.value) return;

  emit('navigate-to-permission-config', {
    resourceId: currentEditingResource.value.id,
    resourceIdentifier: currentEditingResource.value.identifier
  });
}

/**
 * 保存资源
 */
function handleSaveResource() {
  if (!resourceForm.value.name || !resourceForm.value.type) {
    $q.notify({
      type: 'warning',
      message: '请填写资源名称和资源类型',
      position: 'top',
      timeout: 1500
    });
    return;
  }

  // URL 类型验证
  if (resourceForm.value.type === 'url' && !resourceForm.value.urlPattern) {
    $q.notify({
      type: 'warning',
      message: '请填写 URL 模式',
      position: 'top',
      timeout: 1500
    });
    return;
  }

  try {
    // 合并所有操作（过滤出有效的自定义操作）
    const validCustomActions = filter(resourceForm.value.customActions, a => a.code && a.name);
    const allActions = [
      ...resourceForm.value.selectedActions,
      ...validCustomActions.map(a => a.code)
    ];

    const resourceData = {
      name: resourceForm.value.name,
      identifier: autoGeneratedIdentifier.value,
      type: resourceForm.value.type,
      module: resourceForm.value.module || '通用',
      description: resourceForm.value.description,
      parentResourceId: resourceForm.value.parentResourceId || null,
      actions: allActions,
      customActions: validCustomActions,
      // 组件映射信息（如果是从组件面板打开的）
      componentMapping: props.componentInfo ? {
        componentPermissionId: props.componentInfo.id, // 组件权限配置的唯一ID
        componentId: props.componentInfo.componentId,
        componentName: props.componentInfo.componentName
      } : null
    };

    // URL 类型额外配置
    if (resourceForm.value.type === 'url') {
      resourceData.urlPattern = resourceForm.value.urlPattern;
      resourceData.matchMethod = resourceForm.value.matchMethod;
    }

    // 数据类型额外配置（过滤出有效字段）
    if (resourceForm.value.type === 'data') {
      resourceData.fields = filter(resourceForm.value.fields, f => f.name && f.label);
    }

    if (isNewResource.value) {
      const newResource = permissionStore.addResource(resourceData);
      loadData();

      // 切换到编辑模式（不再是新建）
      isNewResource.value = false;
      selectedResourceId.value = newResource.id;

      // 如果是从组件面板打开的，通知父组件保存成功
      if (props.componentInfo) {
        emit('resource-saved', newResource);
      }

      // 提示是否要配置权限
      $q.notify({
        type: 'positive',
        message: '资源已注册',
        position: 'top',
        timeout: 2500,
        actions: [
          {
            label: '配置权限',
            color: 'white',
            handler: () => {
              // 使用新资源的标识符
              emit('navigate-to-permission-config', {
                resourceId: newResource.id,
                resourceIdentifier: newResource.identifier
              });
            }
          }
        ]
      });
    } else {
      permissionStore.updateResource(selectedResourceId.value, resourceData);
      loadData();

      // 如果是从组件面板打开的，通知父组件更新成功
      if (props.componentInfo) {
        const updatedResource = resources.value.find(r => r.id === selectedResourceId.value);
        if (updatedResource) {
          emit('resource-saved', updatedResource);
        }
      }

      $q.notify({
        type: 'positive',
        message: '资源已更新',
        position: 'top',
        timeout: 1500
      });
    }
  } catch (error) {
    $q.notify({
      type: 'negative',
      message: '保存失败：' + error.message,
      position: 'top'
    });
  }
}

/**
 * 删除资源
 */
function handleDeleteResource(resource) {
  $q.dialog({
    title: '确认删除',
    message: `确定要删除资源"${resource.name}"吗？`,
    dark: true,
    persistent: true,
    cancel: { flat: true, label: '取消', color: 'grey-7' },
    ok: { flat: true, label: '确定删除', color: 'negative' }
  }).onOk(() => {
    try {
      permissionStore.deleteResource(resource.id);
      loadData();
      if (selectedResourceId.value === resource.id) {
        handleCloseDetail();
      }
      $q.notify({
        type: 'positive',
        message: '资源已删除',
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
 * 检查是否是后代模块（使用递归）
 */
function isDescendantModule(moduleId, ancestorId) {
  const module = find(modules.value, { id: moduleId });
  if (!module || !module.parentId) return false;
  if (module.parentId === ancestorId) return true;
  return isDescendantModule(module.parentId, ancestorId);
}

// 监听 store 的 resources 变化，自动重新加载
watch(() => permissionStore.resources, () => {
  console.log('[ResourcePanel] Store resources 更新，重新加载数据');
  loadData();
}, { deep: true });

// 监听资源类型变化，切换类型时清空操作配置
watch(() => resourceForm.value.type, (newType, oldType) => {
  if (oldType && newType !== oldType) {
    console.log('[ResourcePanel] 资源类型切换:', oldType, '→', newType);
    // 清空之前选择的操作
    resourceForm.value.selectedActions = [];
    resourceForm.value.customActions = [];

    // 清空类型专用配置
    if (oldType === 'url') {
      resourceForm.value.urlPattern = '';
      resourceForm.value.matchMethod = 'keyMatch2';
    }
    if (oldType === 'data') {
      resourceForm.value.fields = [];
    }
  }
});

// 监听 componentInfo 变化，自动加载该组件已拥有的资源（多行子树）
watch(() => props.componentInfo, (newInfo) => {
  if (!newInfo?.id) return;

  loadData(); // 确保 resources.value 已从 store 填充（immediate 时早于末尾的 loadData）

  const owned = resources.value.filter(
    r => r.componentMapping?.componentPermissionId === newInfo.id
  );

  if (owned.length) {
    // 已有资源行：选中第一行展示，树会按 componentMapping 过滤出整棵子树
    handleSelectResource(owned[0].id);
  } else {
    // 尚未配置：准备新建组件自身行，预填名称与类型
    handleAddResourceToModule('通用');
    if (newInfo.componentName) {
      resourceForm.value.name = newInfo.componentName;
    }
    resourceForm.value.type = 'component';
  }
}, { immediate: true });

// 初始化加载数据
loadData();
</script>

<style scoped>
.cursor-pointer {
  cursor: pointer;
}

.q-splitter :deep(.q-splitter__separator) {
  background: #424242;
}
</style>
