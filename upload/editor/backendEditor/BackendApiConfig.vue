<template>
  <div class="column q-gutter-md">
    <!-- 基本信息 -->
    <div class="text-subtitle2 text-grey-5">基本信息</div>
    <q-input
      v-model="localApi.name"
      dark
      dense
      label="API 名称"
      @update:model-value="emitUpdate('name', $event)"
    />
    <q-input
      v-model="localApi.description"
      dark
      dense
      label="描述"
      type="textarea"
      rows="2"
      @update:model-value="emitUpdate('description', $event)"
    />

    <q-separator dark />

    <!-- HTTP 配置 -->
    <div class="text-subtitle2 text-grey-5">HTTP 配置</div>
    <div class="row q-gutter-sm">
      <q-select
        v-model="localApi.method"
        :options="methodOptions"
        dark
        dense
        label="请求方法"
        style="width: 120px;"
        @update:model-value="emitUpdate('method', $event)"
      />
      <q-input
        v-model="localApi.path"
        dark
        dense
        label="路由路径"
        class="col"
        hint="例如: /api/users 或 /api/users/:id"
        @update:model-value="emitUpdate('path', $event)"
      />
    </div>

    <q-separator dark />

    <!-- 认证配置 -->
    <div class="text-subtitle2 text-grey-5">认证与权限</div>
    <q-toggle
      v-model="localApi.authRequired"
      dark
      dense
      label="需要认证"
      @update:model-value="emitUpdate('authRequired', $event)"
    />
    <q-select
      v-if="localApi.authRequired"
      v-model="localApi.permissions"
      :options="permissionOptions"
      dark
      dense
      multiple
      use-chips
      label="所需权限"
      hint="留空表示仅需登录"
      @update:model-value="emitUpdate('permissions', $event)"
    />

    <q-separator dark />

    <!-- 请求参数 -->
    <div class="row items-center">
      <div class="text-subtitle2 text-grey-5">请求参数</div>
      <q-space />
      <q-btn flat dense icon="add" @click="addParam">
        <q-tooltip>添加参数</q-tooltip>
      </q-btn>
    </div>
    <div v-if="localApi.params.length === 0" class="text-caption text-grey-7">
      暂无参数，点击 + 添加
    </div>
    <div v-for="(param, index) in localApi.params" :key="index" class="row items-center q-gutter-xs">
      <q-input
        v-model="param.name"
        dark
        dense
        label="名称"
        style="width: 100px;"
        @update:model-value="updateParams"
      />
      <q-select
        v-model="param.type"
        :options="paramTypeOptions"
        dark
        dense
        label="类型"
        style="width: 100px;"
        @update:model-value="updateParams"
      />
      <q-select
        v-model="param.in"
        :options="paramInOptions"
        dark
        dense
        label="位置"
        style="width: 100px;"
        @update:model-value="updateParams"
      />
      <q-toggle
        v-model="param.required"
        dark
        dense
        label="必填"
        @update:model-value="updateParams"
      />
      <q-btn flat dense icon="delete" color="negative" @click="removeParam(index)" />
    </div>

    <q-separator dark />

    <!-- 响应配置 -->
    <div class="text-subtitle2 text-grey-5">响应配置</div>
    <q-select
      v-model="localApi.response.type"
      :options="responseTypeOptions"
      dark
      dense
      label="响应类型"
      @update:model-value="updateResponse('type', $event)"
    />

    <q-separator dark />

    <!-- 引用的函数 -->
    <div class="row items-center">
      <div class="text-subtitle2 text-grey-5">引用的功能函数</div>
      <q-space />
      <q-btn flat dense icon="add" @click="showFunctionPicker = true">
        <q-tooltip>添加引用</q-tooltip>
      </q-btn>
    </div>
    <div v-if="localApi.importedFunctions.length === 0" class="text-caption text-grey-7">
      暂无引用，点击 + 添加
    </div>
    <q-chip
      v-for="funcId in localApi.importedFunctions"
      :key="funcId"
      removable
      dark
      dense
      color="secondary"
      @remove="removeImportedFunction(funcId)"
    >
      {{ getFunctionName(funcId) }}
    </q-chip>

    <!-- 函数选择器弹窗 -->
    <q-dialog v-model="showFunctionPicker" dark>
      <q-card dark class="bg-grey-10" style="min-width: 300px;">
        <q-card-section>
          <div class="text-subtitle2">选择功能函数</div>
        </q-card-section>
        <q-card-section>
          <q-list dense dark>
            <q-item
              v-for="func in availableFunctions"
              :key="func.id"
              clickable
              @click="addImportedFunction(func.id)"
            >
              <q-item-section>
                <q-item-label>{{ func.displayName || func.name }}</q-item-label>
              </q-item-section>
            </q-item>
            <q-item v-if="availableFunctions.length === 0">
              <q-item-section class="text-grey-7">暂无可用函数</q-item-section>
            </q-item>
          </q-list>
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat label="关闭" v-close-popup />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </div>
</template>

<script setup>
import { ref, computed, watch } from "vue";
import { backendFunctions } from "src/components/leftWidget/backend/useBackendTree";

const props = defineProps({
  api: {
    type: Object,
    required: true,
  },
});

const emit = defineEmits(['update']);

// 本地副本
const localApi = ref(JSON.parse(JSON.stringify(props.api)));

// 监听外部变化
watch(() => props.api, (newApi) => {
  localApi.value = JSON.parse(JSON.stringify(newApi));
}, { deep: true });

// 选项
const methodOptions = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'];
const paramTypeOptions = ['string', 'number', 'boolean', 'object', 'array'];
const paramInOptions = ['query', 'body', 'params', 'headers'];
const responseTypeOptions = ['json', 'text', 'html', 'stream', 'file'];
const permissionOptions = ['admin', 'user', 'read', 'write', 'delete'];

// 函数选择器
const showFunctionPicker = ref(false);

// 可用函数（排除已引用的）
const availableFunctions = computed(() => {
  return backendFunctions.value.filter(f =>
    !localApi.value.importedFunctions.includes(f.id)
  );
});

// 获取函数名称
const getFunctionName = (funcId) => {
  const func = backendFunctions.value.find(f => f.id === funcId);
  return func?.displayName || func?.name || funcId;
};

// 发送更新
const emitUpdate = (key, value) => {
  emit('update', { [key]: value });
};

// 添加参数
const addParam = () => {
  localApi.value.params.push({
    name: '',
    type: 'string',
    in: 'query',
    required: false,
  });
  updateParams();
};

// 移除参数
const removeParam = (index) => {
  localApi.value.params.splice(index, 1);
  updateParams();
};

// 更新参数
const updateParams = () => {
  emit('update', { params: localApi.value.params });
};

// 更新响应
const updateResponse = (key, value) => {
  localApi.value.response[key] = value;
  emit('update', { response: localApi.value.response });
};

// 添加引用函数
const addImportedFunction = (funcId) => {
  if (!localApi.value.importedFunctions.includes(funcId)) {
    localApi.value.importedFunctions.push(funcId);
    emit('update', { importedFunctions: localApi.value.importedFunctions });
  }
  showFunctionPicker.value = false;
};

// 移除引用函数
const removeImportedFunction = (funcId) => {
  const index = localApi.value.importedFunctions.indexOf(funcId);
  if (index > -1) {
    localApi.value.importedFunctions.splice(index, 1);
    emit('update', { importedFunctions: localApi.value.importedFunctions });
  }
};
</script>
