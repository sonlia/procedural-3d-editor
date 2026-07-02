<template>
  <BasePropertyPanel v-model="props">
    <q-card dark flat bordered>
      <q-card-section class="q-pa-sm">
        <q-select
          v-model="hookName"
          :options="hookOptions"
          label="Lifecycle Hook"
          dense
          dark
          outlined
          emit-value
          map-options
        >
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
    </q-card>
  </BasePropertyPanel>
</template>

<script setup>
import { computed } from 'vue';
import BasePropertyPanel from 'src/components/editor/nodeEditor/propertyPanel/BasePropertyPanel.vue';

const props = defineModel();
const properties = computed(() => props.value?.properties || {});

// 生命周期钩子配置：包含参数签名
const hookOptions = [
  { label: 'onMounted', value: 'onMounted', description: '组件挂载后调用', args: [] },
  { label: 'onUpdated', value: 'onUpdated', description: '组件更新后调用', args: [] },
  { label: 'onUnmounted', value: 'onUnmounted', description: '组件卸载后调用', args: [] },
  { label: 'onBeforeMount', value: 'onBeforeMount', description: '组件挂载前调用', args: [] },
  { label: 'onBeforeUpdate', value: 'onBeforeUpdate', description: '组件更新前调用', args: [] },
  { label: 'onBeforeUnmount', value: 'onBeforeUnmount', description: '组件卸载前调用', args: [] },
  { label: 'onActivated', value: 'onActivated', description: 'KeepAlive 组件激活时调用', args: [] },
  { label: 'onDeactivated', value: 'onDeactivated', description: 'KeepAlive 组件停用时调用', args: [] },
  { label: 'onErrorCaptured', value: 'onErrorCaptured', description: '捕获后代组件错误', args: ['err', 'instance', 'info'] },
  { label: 'onRenderTracked', value: 'onRenderTracked', description: '响应式依赖被追踪时调用（仅开发模式）', args: ['event'] },
  { label: 'onRenderTriggered', value: 'onRenderTriggered', description: '响应式依赖触发更新时调用（仅开发模式）', args: ['event'] },
];

// 根据 hookName 获取对应的 args
function getHookArgs(name) {
  const hook = hookOptions.find(h => h.value === name);
  return hook?.args || [];
}

// 更新 callback slot 的 meta.args
function updateCallbackSlotMeta(args) {
  if (!props.value) return;
  const callbackSlot = props.value.inputs?.find(s => s.name === 'callback');
  if (callbackSlot) {
    callbackSlot.meta = { args };
  }
}

const hookName = computed({
  get: () => properties.value.hookName,
  set: (val) => {
    if (!props.value) return;
    props.value.properties.hookName = val;
    // 切换钩子时更新 slot 的参数签名
    updateCallbackSlotMeta(getHookArgs(val));
    props.value.onExecute?.();
    props.value.graph?.setDirtyCanvas?.(true, true);
  },
});
</script>

