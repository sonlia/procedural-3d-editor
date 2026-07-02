<template>
  <div class="q-pa-sm">
    <q-select
      v-model="localProperties.action"
      :options="actionOptions"
      label="操作"
      dense dark outlined
      emit-value map-options
    />
    <q-select
      v-model="localProperties.dialogNodeId"
      :options="qDialogOptions"
      label="关联的 QDialog"
      dense dark outlined
      emit-value map-options
      class="q-mt-sm"
    >
      <template #no-option>
        <q-item dense>
          <q-item-section class="text-caption" style="color: #999;">
            当前页面无 QDialog 组件
          </q-item-section>
        </q-item>
      </template>
    </q-select>
    <div class="text-caption q-mt-sm" style="color: #999;">
      也可将 QDialog 的 Ref 端口连接到 dialogRef 输入
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from "vue";
import { cloneDeep, isEqual } from "lodash-es";
import { useProjectStore } from "src/stores/projectMange.js";

const props = defineModel();
const projectStore = useProjectStore();

const actionOptions = [
  { label: "显示 (show)", value: "show" },
  { label: "隐藏 (hide)", value: "hide" },
  { label: "切换 (toggle)", value: "toggle" },
];

// 本地副本，避免直接 mutate props
const localProperties = ref({
  action: "show",
  dialogNodeId: "",
});

// 外部 → 本地
watch(
  () => props.value?.properties,
  (newVal) => {
    if (newVal) {
      localProperties.value = cloneDeep(newVal);
    }
  },
  { deep: true, immediate: true },
);

// 本地 → 外部
watch(
  localProperties,
  (val) => {
    if (!isEqual(props.value?.properties, val)) {
      props.value.properties = cloneDeep(val);
      props.value.onExecute?.();
      props.value.graph?.setDirtyCanvas?.(true, true);
    }
  },
  { deep: true },
);

// 获取当前页面的 dragEditor 数据
const dragEditorData = computed(
  () => projectStore.getEditorData("dragEditor") || [],
);

// 遍历树查找所有 QDialog 节点
const qDialogOptions = computed(() => {
  const dialogs = [];
  const walk = (nodes) => {
    if (!Array.isArray(nodes)) return;
    for (const node of nodes) {
      if (node.type === "QDialog") {
        dialogs.push({
          label: `QDialog (${node.id.slice(0, 8)})`,
          value: node.id,
        });
      }
      if (node.children) {
        if (Array.isArray(node.children)) {
          walk(node.children);
        } else if (typeof node.children === "object") {
          for (const slotName in node.children) {
            if (Array.isArray(node.children[slotName])) {
              walk(node.children[slotName]);
            }
          }
        }
      }
    }
  };
  walk(dragEditorData.value);
  return dialogs;
});
</script>
