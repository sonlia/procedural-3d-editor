<script setup>
import { ref, watch, computed, onMounted } from "vue";
import { cloneDeep, isEqual } from "lodash-es";
import { uid } from "quasar";
import BasePropertyPanel from '../../propertyPanel/BasePropertyPanel.vue';

const props = defineModel(); // node instance

// --- Composable 选项定义 ---
const composableOptions = [
  { value: 'defineProps', label: 'defineProps()', description: '声明组件 props' },
  { value: 'defineEmits', label: 'defineEmits()', description: '声明组件自定义事件' },
  { value: 'defineModel', label: 'defineModel()', description: '父子组件双向绑定' },
  { value: 'defineExpose', label: 'defineExpose()', description: '暴露公共属性' },
  { value: 'defineOptions', label: 'defineOptions()', description: '设置组件选项' },
  { value: 'defineSlots', label: 'defineSlots()', description: '声明组件插槽' },
];

// --- 计算属性 ---
// 是否显示参数输入
const showArgumentInput = computed(() => {
  const withArgs = ['defineProps', 'defineEmits', 'defineModel', 'defineExpose', 'defineOptions'];
  return withArgs.includes(localProperties.value.composableName);
});

// 是否返回值（决定是否显示输出变量配置）
const returnsValue = computed(() => {
  const apis = ['defineProps', 'defineEmits', 'defineModel', 'defineSlots'];
  return apis.includes(localProperties.value.composableName);
});

// 参数标签
const argumentLabel = computed(() => {
  const labels = {
    defineProps: 'Props',
    defineEmits: 'Emits',
    defineModel: 'Model Name',
    defineExpose: 'Exposed',
    defineOptions: 'Options',
  };
  return labels[localProperties.value.composableName] || 'Argument';
});

// 参数帮助提示
const argumentHint = computed(() => {
  const hints = {
    defineProps: '例如: { msg: String } 或 [\'msg\']',
    defineEmits: '例如: [\'update\', \'change\']',
    defineModel: '可选，例如: \'count\'',
    defineExpose: '例如: { a, b }',
    defineOptions: '例如: { inheritAttrs: false }',
  };
  return hints[localProperties.value.composableName] || '';
});

// --- 数据模型 ---
const defaultProperties = () => ({
  composableName: 'defineProps',
  arg: '',
  argIsSlot: false,
  argSlotId: uid(),
  varName: 'props',
  varNameIsSlot: false,
  varNameSlotId: uid(),
});

const localProperties = ref(defaultProperties());

onMounted(() => {
  const initialProps = { ...defaultProperties(), ...cloneDeep(props.value?.properties ?? {}) };
  localProperties.value = initialProps;
  if (!isEqual(props.value.properties, localProperties.value)) {
    props.value.properties = cloneDeep(localProperties.value);
  }
});

// --- 双向同步 ---
watch(localProperties, (newVal) => {
  if (!isEqual(props.value.properties, newVal)) {
    props.value.properties = cloneDeep(newVal);
    props.value.onExecute?.();
    props.value.graph?.setDirtyCanvas?.(true, true);
  }
}, { deep: true });

watch(() => props.value?.properties, (newVal) => {
  const newProps = { ...defaultProperties(), ...cloneDeep(newVal ?? {}) };
  if (!isEqual(newProps, localProperties.value)) {
    localProperties.value = newProps;
  }
}, { deep: true });

// --- VarName Slot 管理 ---
watch(() => localProperties.value.varNameIsSlot, (isSlot) => {
  const slotId = localProperties.value.varNameSlotId;
  if (!slotId) return;
  const existingIdx = props.value.inputs?.findIndex(s => s.id === slotId);

  if (isSlot && existingIdx === -1) {
    props.value.addInput('VarName', 'string', { id: slotId });
  } else if (!isSlot && existingIdx !== -1) {
    props.value.removeInput(existingIdx);
  }
}, { immediate: true });

// --- Arg Slot 管理 ---
watch(() => localProperties.value.argIsSlot, (isSlot) => {
  const slotId = localProperties.value.argSlotId;
  if (!slotId) return;
  const existingIdx = props.value.inputs?.findIndex(s => s.id === slotId);

  if (isSlot && existingIdx === -1) {
    props.value.addInput('Arg', 'string', { id: slotId });
  } else if (!isSlot && existingIdx !== -1) {
    props.value.removeInput(existingIdx);
  }
}, { immediate: true });

// --- Composable 切换时的处理 ---
function onComposableChange(name) {
  localProperties.value.composableName = name;
  // 重置参数
  localProperties.value.arg = '';

  // 清理参数 slot（如果切换到不需要参数的 API）
  const shouldHaveArgSlot = showArgumentInput.value && localProperties.value.argIsSlot;
  const argSlotId = localProperties.value.argSlotId;
  const existingSlotIndex = props.value.inputs?.findIndex(s => s.id === argSlotId);

  if (!shouldHaveArgSlot && existingSlotIndex !== -1) {
    props.value.removeInput(existingSlotIndex);
  }

  // 更新输出 slot 名称
  updateOutputSlotName();
}

// --- 更新输出 slot 名称 ---
function updateOutputSlotName() {
  const outSlot = props.value.outputs?.find(o => o.id === 'default_out');
  if (outSlot && localProperties.value.varName) {
    outSlot.name = localProperties.value.varName;
    props.value.graph?.setDirtyCanvas?.(true, true);
  }
}

// 监听 varName 变化更新输出 slot 名称
watch(() => localProperties.value.varName, () => {
  if (!localProperties.value.varNameIsSlot) {
    updateOutputSlotName();
  }
});
</script>

<template>
  <BasePropertyPanel v-model="props">
    <div class="column q-pa-sm q-gutter-y-sm">

      <!-- 输出变量配置（仅返回值的 API 显示） -->
      <q-card v-if="returnsValue" dark flat bordered>
        <q-card-section class="q-pa-sm">
          <div class="row items-center q-gutter-x-sm no-wrap">
            <q-toggle dense dark label="VarName" :model-value="localProperties.varNameIsSlot"
              @update:model-value="val => localProperties.varNameIsSlot = val"
              style="min-width: 90px; flex-shrink: 0;" />
            <q-input dense dark outlined :model-value="localProperties.varName"
              @update:model-value="val => localProperties.varName = val" class="col"
              :disable="localProperties.varNameIsSlot">
              <template v-slot:append>
                <q-icon name="help_outline"  class="cursor-pointer">
                  <q-tooltip class="bg-dark" max-width="250px">
                    输出变量名<br />
                    例如: props, emits, model
                  </q-tooltip>
                </q-icon>
              </template>
            </q-input>
          </div>
        </q-card-section>
      </q-card>

      <!-- Composable 选择 -->
      <q-card dark flat bordered>
        <q-card-section class="q-pa-sm">
          <q-select dense dark outlined :model-value="localProperties.composableName"
            @update:model-value="onComposableChange" :options="composableOptions" label="Composable" emit-value
            map-options>
            <template v-slot:option="scope">
              <q-item v-bind="scope.itemProps" dense>
                <q-item-section>
                  <q-item-label>{{ scope.opt.label }}</q-item-label>
                  <q-item-label caption class="text-grey-6">{{ scope.opt.description }}</q-item-label>
                </q-item-section>
              </q-item>
            </template>
          </q-select>
        </q-card-section>
      </q-card>

      <!-- 参数配置 -->
      <q-card v-if="showArgumentInput" dark flat bordered>
        <q-card-section class="q-pa-sm">
          <div class="row items-center q-gutter-x-sm no-wrap">
            <q-toggle dense dark :label="argumentLabel" :model-value="localProperties.argIsSlot"
              @update:model-value="val => localProperties.argIsSlot = val"
              style="min-width: 90px; flex-shrink: 0;" />
            <q-input dense dark outlined :model-value="localProperties.arg"
              @update:model-value="val => localProperties.arg = val" class="col" :disable="localProperties.argIsSlot">
              <template v-slot:append>
                <q-icon name="help_outline"  class="cursor-pointer">
                  <q-tooltip class="bg-dark" max-width="250px">
                    {{ argumentHint }}
                  </q-tooltip>
                </q-icon>
              </template>
            </q-input>
          </div>
        </q-card-section>
      </q-card>

    </div>
  </BasePropertyPanel>
</template>
