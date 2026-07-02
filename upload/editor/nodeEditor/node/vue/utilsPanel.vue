<template>
  <BasePropertyPanel v-model="props">
    <div class="column q-pa-sm q-gutter-y-sm">

      <!-- 输出变量卡片 -->
      <q-card dark flat bordered>
        <q-card-section class="q-pa-sm">
          <!-- Export 单独一行 -->
          <q-checkbox :disable="properties.outputVar?.isSlot" :model-value="properties.exported"
            @update:model-value="(val) => updateField('exported', val)" dense dark label="Export" class="q-mb-xs" />
          <div class="row items-center q-gutter-x-sm no-wrap">
            <q-toggle :model-value="properties.outputVar?.isSlot" @update:model-value="updateVarNameSlot" dense dark
              label="VarName" style="min-width: 90px; flex-shrink: 0;" />
            <q-select :disable="properties.outputVar?.isSlot" :model-value="properties.declareType"
              @update:model-value="(val) => updateField('declareType', val)" :options="['const', 'let']" dense dark
              outlined class="col-auto" style="min-width: 70px;" />
            <q-input :disable="properties.outputVar?.isSlot" :model-value="properties.outputVar?.value"
              @update:model-value="(val) => updateField('outputVar.value', val)" dense dark outlined class="col">
              <template v-slot:append>
                <q-icon name="help_outline"  class="cursor-pointer">
                  <q-tooltip class="bg-dark" max-width="250px">
                    存储 API 返回值的变量名<br />
                    示例: isRef, result, value
                  </q-tooltip>
                </q-icon>
              </template>
            </q-input>
          </div>
        </q-card-section>
      </q-card>

      <!-- API 选择卡片 -->
      <q-card dark flat bordered>
        <q-card-section class="q-pa-sm">
          <q-select v-model="properties.apiName" :options="apiOptions" label="API" dense dark options-dense emit-value
            map-options @update:model-value="onApiChange">
            <template v-slot:option="scope">
              <q-item v-bind="scope.itemProps">
                <q-item-section>
                  <q-item-label>{{ scope.opt.label }}</q-item-label>
                  <q-item-label caption class="text-grey">{{ scope.opt.description }}</q-item-label>
                </q-item-section>
              </q-item>
            </template>
          </q-select>
        </q-card-section>

        <!-- API 参数区域 -->
        <q-card-section v-if="currentApiParams.length > 0" class="q-pa-sm q-pt-none">
          <q-separator dark class="q-mb-sm" />
          <div v-for="(param, idx) in currentApiParams" :key="param.slotId" class="q-mb-sm" style="position: relative;">
            <div class="row items-center q-gutter-x-sm no-wrap" :style="isVariadicApi ? 'padding-right: 40px;' : ''">
              <q-toggle v-model="param.isSlot" dense dark :label="param.name" style="min-width: 90px; flex-shrink: 0;" />
              <q-input :disable="param.isSlot" v-model="param.value" dense dark outlined class="col">
                <template v-slot:append>
                  <q-icon name="help_outline"  class="cursor-pointer">
                    <q-tooltip class="bg-dark" max-width="250px">
                      参数 {{ param.name }} 的值<br />
                      开启 Slot 可从其他节点接收
                    </q-tooltip>
                  </q-icon>
                </template>
              </q-input>
            </div>
            <!-- 可变参数时显示删除按钮（保留至少1个） -->
            <q-btn v-if="isVariadicApi && currentApiParams.length > 1" flat dense icon="close" color="negative"
              @click="removeParam(idx)" style="position: absolute; right: 4px; top: 4px;" />
          </div>
          <!-- 可变参数时显示添加按钮 -->
          <q-btn v-if="isVariadicApi" flat dense icon="add" label="添加参数" color="primary" class="q-mt-sm"
            @click="addParam" />
        </q-card-section>
      </q-card>

    </div>
  </BasePropertyPanel>
</template>

<script setup>
import { computed, watch, ref, onMounted } from "vue";
import { uid } from 'quasar';
import { set } from 'lodash-es';
import BasePropertyPanel from 'src/components/editor/nodeEditor/propertyPanel/BasePropertyPanel.vue';

// 1️⃣ 数据绑定 - 使用 defineModel
const props = defineModel();
const properties = computed(() => props.value?.properties || {});

// 2️⃣ 响应式更新函数
function updateField(key, value) {
  set(properties.value, key, value);
  props.value.onExecute?.();
  props.value.graph?.setDirtyCanvas?.(true, true);
}

// 3️⃣ VarName slot 管理
function updateVarNameSlot(isSlot) {
  const node = props.value;
  const outputVar = properties.value.outputVar;
  if (!outputVar) return;

  outputVar.isSlot = isSlot;
  const existingIdx = node.inputs.findIndex((s) => s.id === outputVar.id);

  if (isSlot && existingIdx === -1) {
    node.addInput("VarName", "string", { id: outputVar.id });
  } else if (!isSlot && existingIdx !== -1) {
    node.removeInput(existingIdx);
  }
  node.onExecute?.();
  node.graph?.setDirtyCanvas?.(true, true);
}

// 4️⃣ 可变参数 API 列表
const variadicApis = ['mergeProps'];

// 判断当前 API 是否支持可变参数
const isVariadicApi = computed(() => {
  return variadicApis.includes(properties.value.apiName);
});

const apiMap = ref({
  isRef: { params: [{ name: 'value' }] },
  unref: { params: [{ name: 'ref' }] },
  toRef: { params: [{ name: 'source' }, { name: 'key' }] },
  toValue: { params: [{ name: 'source' }] },
  toRefs: { params: [{ name: 'source' }] },
  isProxy: { params: [{ name: 'value' }] },
  isReactive: { params: [{ name: 'value' }] },
  isReadonly: { params: [{ name: 'value' }] },
  shallowReactive: { params: [{ name: 'object' }] },
  shallowReadonly: { params: [{ name: 'object' }] },
  toRaw: { params: [{ name: 'proxy' }] },
  markRaw: { params: [{ name: 'object' }] },
  triggerRef: { params: [{ name: 'ref' }] },
  mergeProps: { params: [{ name: 'props0' }], variadic: true },
  cloneVNode: { params: [{ name: 'vnode' }, { name: 'extraProps' }] },
  isVNode: { params: [{ name: 'value' }] },
  useTemplateRef: { params: [{ name: 'name' }] },
  useId: { params: [] },
});

const apiOptions = ref([
  { value: 'isRef', label: 'isRef(value)', description: '检查一个值是否为 ref 对象。' },
  { value: 'unref', label: 'unref(ref)', description: '如果参数是 ref，则返回内部值，否则返回参数本身。' },
  { value: 'toRef', label: 'toRef(source, key)', description: '可以用来为源响应式对象上的一个属性创建一个 ref。' },
  { value: 'toValue', label: 'toValue(source)', description: '将 ref 或 getter 规范化为值。' },
  { value: 'toRefs', label: 'toRefs(source)', description: '将一个响应式对象转换为一个普通对象。' },
  { value: 'isProxy', label: 'isProxy(value)', description: '检查一个对象是否是由 reactive 或 readonly 创建的 proxy。' },
  { value: 'isReactive', label: 'isReactive(value)', description: '检查一个对象是否是由 reactive 创建的响应式 proxy。' },
  { value: 'isReadonly', label: 'isReadonly(value)', description: '检查一个对象是否是由 readonly 创建的只读 proxy。' },
  { value: 'shallowReactive', label: 'shallowReactive(object)', description: '创建一个浅层响应式代理，非深度。' },
  { value: 'shallowReadonly', label: 'shallowReadonly(object)', description: '创建一个浅层只读代理，非深度。' },
  { value: 'toRaw', label: 'toRaw(proxy)', description: '返回代理的原始对象。' },
  { value: 'markRaw', label: 'markRaw(object)', description: '将一个对象标记为不可被转化为代理。' },
  { value: 'triggerRef', label: 'triggerRef(ref)', description: '手动触发 ref 的依赖更新。' },
  { value: 'mergeProps', label: 'mergeProps(...props)', description: '合并多个 props 对象（支持添加多个参数）。' },
  { value: 'cloneVNode', label: 'cloneVNode(vnode, extraProps)', description: '克隆一个 VNode。' },
  { value: 'isVNode', label: 'isVNode(value)', description: '检查一个值是否是 VNode。' },
  { value: 'useTemplateRef', label: 'useTemplateRef(name)', description: '获取模板元素的 ref。' },
  { value: 'useId', label: 'useId()', description: '生成用于 SSR hydration 的唯一 ID。' },
]);

const currentApiParams = computed(() => {
  return properties.value.params || [];
});

const onApiChange = (newApi) => {
  const node = props.value;
  const oldParams = properties.value.params || [];
  const newApiDef = apiMap.value[newApi];

  // Remove all old param slots
  oldParams.forEach(p => {
    const index = node.inputs.findIndex(i => i.id === p.slotId);
    if (index !== -1) node.removeInput(index);
  });

  // Create new params (isSlot 默认 false)
  const newParams = newApiDef.params.map(p => ({
    ...p,
    value: '',
    isSlot: false,
    slotId: uid()
  }));
  properties.value.params = newParams;

  node.onExecute?.();
  node.graph?.setDirtyCanvas(true, true);
};

// 5️⃣ 添加参数（仅可变参数 API）
function addParam() {
  const node = props.value;
  const params = properties.value.params || [];
  const newParam = {
    name: `props${params.length}`,
    value: '',
    isSlot: false,
    slotId: uid()
  };
  params.push(newParam);
  node.onExecute?.();
  node.graph?.setDirtyCanvas?.(true, true);
}

// 6️⃣ 删除参数（仅可变参数 API）
function removeParam(idx) {
  const node = props.value;
  const params = properties.value.params || [];
  const param = params[idx];

  // 移除对应的 slot
  if (param.isSlot) {
    const slotIdx = node.inputs.findIndex(i => i.id === param.slotId);
    if (slotIdx !== -1) node.removeInput(slotIdx);
  }

  params.splice(idx, 1);
  node.onExecute?.();
  node.graph?.setDirtyCanvas?.(true, true);
}

watch(() => properties.value.params, (params) => {
  if (!params) return;
  const node = props.value;
  params.forEach(p => {
    const slot = node.inputs.find(i => i.id === p.slotId);
    if (p.isSlot && !slot) {
      node.addInput(p.name, "string", { id: p.slotId });
    } else if (!p.isSlot && slot) {
      const index = node.inputs.indexOf(slot);
      node.removeInput(index);
    }
  });
  node.onExecute?.();
  node.graph?.setDirtyCanvas(true, true);
}, { deep: true });

onMounted(() => {
  if (!properties.value.params) {
    onApiChange(properties.value.apiName);
  }
});
</script>
