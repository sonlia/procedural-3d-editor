<template>
  <div class="column q-gutter-md">
    <!-- 基本信息 -->
    <div class="text-subtitle2 text-grey-5">基本信息</div>
    <q-input
      v-model="localFunc.name"
      dark
      dense
      label="函数名（代码中使用）"
      hint="使用驼峰命名，例如: getUserById"
      @update:model-value="emitUpdate('name', $event)"
    />
    <q-input
      v-model="localFunc.displayName"
      dark
      dense
      label="显示名称"
      @update:model-value="emitUpdate('displayName', $event)"
    />
    <q-input
      v-model="localFunc.description"
      dark
      dense
      label="描述"
      type="textarea"
      rows="2"
      @update:model-value="emitUpdate('description', $event)"
    />

    <q-separator dark />

    <!-- 函数配置 -->
    <div class="text-subtitle2 text-grey-5">函数配置</div>
    <div class="row q-gutter-md">
      <q-toggle
        v-model="localFunc.isAsync"
        dark
        dense
        label="异步函数 (async)"
        @update:model-value="emitUpdate('isAsync', $event)"
      />
      <q-toggle
        v-model="localFunc.exported"
        dark
        dense
        label="导出 (export)"
        @update:model-value="emitUpdate('exported', $event)"
      />
    </div>
    <q-select
      v-model="localFunc.returnType"
      :options="returnTypeOptions"
      dark
      dense
      label="返回类型"
      @update:model-value="emitUpdate('returnType', $event)"
    />

    <q-separator dark />

    <!-- 参数列表 -->
    <div class="row items-center">
      <div class="text-subtitle2 text-grey-5">参数列表</div>
      <q-space />
      <q-btn flat dense icon="add" @click="addParam">
        <q-tooltip>添加参数</q-tooltip>
      </q-btn>
    </div>
    <div v-if="localFunc.params.length === 0" class="text-caption text-grey-7">
      暂无参数，点击 + 添加
    </div>
    <div v-for="(param, index) in localFunc.params" :key="index" class="row items-center q-gutter-xs">
      <q-input
        v-model="param.name"
        dark
        dense
        label="名称"
        style="width: 120px;"
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
      <q-input
        v-model="param.defaultValue"
        dark
        dense
        label="默认值"
        class="col"
        @update:model-value="updateParams"
      />
      <q-btn flat dense icon="delete" color="negative" @click="removeParam(index)" />
    </div>

    <q-separator dark />

    <!-- 函数签名预览 -->
    <div class="text-subtitle2 text-grey-5">函数签名预览</div>
    <div class="bg-grey-10 q-pa-sm rounded-borders">
      <code class="text-grey-4">{{ functionSignature }}</code>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from "vue";

const props = defineProps({
  func: {
    type: Object,
    required: true,
  },
});

const emit = defineEmits(['update']);

// 本地副本
const localFunc = ref(JSON.parse(JSON.stringify(props.func)));

// 监听外部变化
watch(() => props.func, (newFunc) => {
  localFunc.value = JSON.parse(JSON.stringify(newFunc));
}, { deep: true });

// 选项
const paramTypeOptions = ['string', 'number', 'boolean', 'object', 'array', 'any'];
const returnTypeOptions = ['void', 'string', 'number', 'boolean', 'object', 'array', 'any', 'Promise<any>'];

// 函数签名预览
const functionSignature = computed(() => {
  const f = localFunc.value;
  const exportStr = f.exported ? 'export ' : '';
  const asyncStr = f.isAsync ? 'async ' : '';
  const params = f.params.map(p => {
    let paramStr = p.name;
    if (p.type && p.type !== 'any') {
      paramStr += `: ${p.type}`;
    }
    if (p.defaultValue) {
      paramStr += ` = ${p.defaultValue}`;
    }
    return paramStr;
  }).join(', ');
  const returnStr = f.returnType && f.returnType !== 'any' ? `: ${f.returnType}` : '';

  return `${exportStr}${asyncStr}function ${f.name}(${params})${returnStr}`;
});

// 发送更新
const emitUpdate = (key, value) => {
  emit('update', { [key]: value });
};

// 添加参数
const addParam = () => {
  localFunc.value.params.push({
    name: '',
    type: 'any',
    defaultValue: '',
  });
  updateParams();
};

// 移除参数
const removeParam = (index) => {
  localFunc.value.params.splice(index, 1);
  updateParams();
};

// 更新参数
const updateParams = () => {
  emit('update', { params: localFunc.value.params });
};
</script>
