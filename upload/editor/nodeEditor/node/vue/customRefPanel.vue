<template>
  <div class="q-pa-sm q-gutter-y-sm">
    <div class="row items-center q-gutter-x-sm">
      <q-toggle v-model="properties.varNameIsSlot" dense dark />
      <q-input :disable="properties.varNameIsSlot" v-model="properties.varName" label="Variable Name" dense dark
        class="col" />
    </div>
  </div>
</template>

<script setup>
import { computed, watch } from 'vue';

const props = defineProps({
  modelValue: {
    type: Object,
    default: () => ({}),
  },
});

const properties = computed(() => props.modelValue.properties);

watch(() => properties.value.varNameIsSlot, (isSlot) => {
  const node = props.modelValue;
  const slotId = properties.value.varNameSlotId;
  const existingSlot = node.inputs.find(i => i.id === slotId);

  if (isSlot && !existingSlot) {
    node.addInput("varNameIn", "*", { id: slotId });
  } else if (!isSlot && existingSlot) {
    const index = node.inputs.indexOf(existingSlot);
    node.removeInput(index);
  }
  node.graph?.setDirtyCanvas(true, true);
});
</script>
