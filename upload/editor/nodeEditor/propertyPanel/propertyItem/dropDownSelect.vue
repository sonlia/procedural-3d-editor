<script setup>
import { QSelect, QToggle } from "quasar";
import { computed, ref, toRef, watchEffect, onMounted } from "vue";

// 定义 ensurePropertyStructure 作为函数声明，以确保它可以被提升
function ensurePropertyStructure(x, key) {
  // 如果使用 reactive，可以直接操作对象
  if (!x.properties) {
    x.properties = { props: {} };
  }
  if (!x.properties.props?.[key]) {
    x.properties.props[key] = { value: "", isSlot: false };
  }
}

const props = defineProps({
  label: String,
});

const key = toRef(props, "label");

const nodeData = defineModel();

// 确保在组件挂载时就建立好所需的结构
onMounted(() => {
  if (nodeData.value) {
    ensurePropertyStructure(nodeData.value, key.value);
  }
});

// 使用watchEffect来监听nodeData的变化，并确保结构完整
watchEffect(() => {
  if (nodeData.value) {
    ensurePropertyStructure(nodeData.value, key.value);
  }
});

const value = computed({
  get: () => {
    // 获取原始值，如果有引号包裹则去除，用于显示
    const rawValue = nodeData.value.properties.props[key.value]?.value ?? "";
    if (typeof rawValue === 'string') {
      // 去除首尾的单引号或双引号
      return rawValue.replace(/^['"]|['"]$/g, '');
    }
    return rawValue;
  },
  set: (v) => {
    if (nodeData.value) {
      ensurePropertyStructure(nodeData.value, key.value);
      // 自动添加单引号包裹
      const wrappedValue = v ? `'${v}'` : '';
      nodeData.value.properties.props[key.value].value = wrappedValue;
    }
  },
});

const isSlot = computed({
  get: () => nodeData.value.properties.props[key.value]?.isSlot ?? false,
  set: (v) => {
    if (nodeData.value) {
      ensurePropertyStructure(nodeData.value, key.value);
      nodeData.value.properties.props[key.value].isSlot = v;
    }
  },
});

// 工具函数：安全地获取提示信息（从 nodeRawData 获取元数据）
const getTooltipInfo = computed(() => {
  const rawProp = nodeData.value.nodeRawData?.props?.[key.value];
  return {
    examples: rawProp?.examples ?? "",
    desc_cn: rawProp?.desc_cn ?? "",
  };
});

// 从 nodeRawData 获取下拉选项（元数据）
const option = computed(() => {
  const rawProp = nodeData.value.nodeRawData?.props?.[key.value];
  return rawProp?.values ?? [];
});
</script>
<template>
  <div
    class="row no-wrap self-stretch"
    style="gap: 2px; margin-bottom: 2px;"
  >
    <q-toggle icon="code" v-model="isSlot"  dense dark>
      <q-tooltip anchor="top middle" self="bottom middle" :delay="800">
        {{ isSlot ? '使用直接输入' : '使用 Slot 连接' }}
      </q-tooltip>
    </q-toggle>

    <q-select
      :label="key"
      borderless
      v-model="value"
      :disable="isSlot"
      dense
      dark
      :options="option"
      class="col-grow"
    >
      <q-tooltip
        v-if="getTooltipInfo.examples || getTooltipInfo.desc_cn"
        :delay="1000"
      >
        {{ getTooltipInfo.examples }}
        <q-splitter v-if="getTooltipInfo.examples && getTooltipInfo.desc_cn" />
        {{ getTooltipInfo.desc_cn }}
      </q-tooltip>
    </q-select>
  </div>
</template>
