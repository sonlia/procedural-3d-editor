<template>
  <div class="column q-gutter-y-xs">
    <div class="row items-center q-gutter-x-sm">
      <div class="text-caption text-grey-4">{{ label }}</div>
    </div>
    <q-editor
      v-model="value"
      dark
      dense
      min-height="10rem"
      toolbar-bg="grey-9"
      toolbar-text-color="white"
      toolbar-toggle-color="primary"
      class="html-editor-item"
      :toolbar="toolbar"
      :fonts="fonts"
      :definitions="definitions"
    />
  </div>
</template>

<script setup>
import { computed, onMounted, toRef, watchEffect } from "vue";

const props = defineProps({
  label: {
    type: String,
    default: "",
  },
});

const key = toRef(props, "label");
const nodeData = defineModel();

function ensurePropertyStructure(node, propKey) {
  if (!node?.properties) return;
  if (!node.properties.props) {
    node.properties.props = {};
  }
  if (!node.properties.props[propKey]) {
    node.properties.props[propKey] = {
      value: "",
      isSlot: false,
      literalString: true,
    };
  }
}

onMounted(() => {
  if (nodeData.value) {
    ensurePropertyStructure(nodeData.value, key.value);
  }
});

watchEffect(() => {
  if (nodeData.value) {
    ensurePropertyStructure(nodeData.value, key.value);
  }
});

const value = computed({
  get: () => nodeData.value?.properties?.props?.[key.value]?.value ?? "",
  set: (nextValue) => {
    if (!nodeData.value) return;
    ensurePropertyStructure(nodeData.value, key.value);
    nodeData.value.properties.props[key.value].value = nextValue;
    nodeData.value.properties.props[key.value].literalString = true;
    nodeData.value.onExecute?.();
    nodeData.value.graph?.setDirtyCanvas?.(true, true);
  },
});

const toolbar = [
  ["bold", "italic", "underline", "strike"],
  ["unordered", "ordered"],
  ["quote", "hr"],
  ["link"],
  ["undo", "redo"],
];

const fonts = {
  arial: "Arial",
  arial_black: "Arial Black",
  verdana: "Verdana",
};

const definitions = {
  hr: {
    tip: "Horizontal rule",
    icon: "remove",
    label: "HR",
    cmd: "insertHorizontalRule",
  },
};
</script>

<style scoped>
.html-editor-item {
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 4px;
}

.html-editor-item :deep(.q-editor__content) {
  min-height: 10rem;
  font-size: 13px;
}
</style>
