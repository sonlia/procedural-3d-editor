<script setup>
import { ref, onMounted, watch } from 'vue';
import { cloneDeep, isEqual } from "lodash-es";
import { uid } from 'quasar';
import BasePropertyPanel from 'src/components/editor/nodeEditor/propertyPanel/BasePropertyPanel.vue';

const props = defineModel();

const defaultProperties = () => ({
  operationType: 'get', // 'get' or 'set'
  sourceIsSlot: false,
  sourceValue: 'myObject',
  sourceSlotId: uid(),
  accessChain: [{ id: uid(), isSlot: false, value: 'key', slotId: uid() }],
  // For 'get'
  declareType: 'const',
  outputVar: { id: uid(), isSlot: false, value: 'value' },
  defaultValueIsSlot: false,
  defaultValue: 'undefined',
  defaultValueSlotId: uid(),
  // For 'set'
  setValueIsSlot: false,
  setValue: 'undefined',
  setValueSlotId: uid(),
});

const localProperties = ref(defaultProperties());

onMounted(() => mergeNodeProps());
watch(() => props.value?.properties, mergeNodeProps, { deep: true, immediate: true });

function mergeNodeProps() {
  const newProps = { ...defaultProperties(), ...cloneDeep(props.value?.properties || {}) };
  if (!newProps.sourceSlotId) newProps.sourceSlotId = uid();
  if (!newProps.defaultValueSlotId) newProps.defaultValueSlotId = uid();
  if (!newProps.setValueSlotId) newProps.setValueSlotId = uid();
  // 兼容旧数据：将分散字段合并为三元组
  if (typeof newProps.outputVar !== 'object' || !newProps.outputVar) {
    newProps.outputVar = {
      id: newProps.outputVarSlotId || uid(),
      isSlot: newProps.outputVarIsSlot || false,
      value: typeof newProps.outputVar === 'string' ? newProps.outputVar : 'value'
    };
    delete newProps.outputVarSlotId;
    delete newProps.outputVarIsSlot;
  }
  if (!newProps.outputVar.id) newProps.outputVar.id = uid();
  if (!Array.isArray(newProps.accessChain) || newProps.accessChain.length === 0) {
    newProps.accessChain = [{ id: uid(), isSlot: false, value: 'key', slotId: uid() }];
  }
  newProps.accessChain.forEach(item => {
    if (!item.slotId) item.slotId = uid();
  });
  if (!isEqual(newProps, localProperties.value)) {
    localProperties.value = newProps;
  }
}

watch(localProperties, (newVal) => {
  if (!isEqual(newVal, props.value.properties)) {
    props.value.properties = cloneDeep(newVal);
    props.value.onExecute?.();
    props.value.graph?.setDirtyCanvas?.(true, true);
  }
}, { deep: true });

function addAccessItem() {
  localProperties.value.accessChain.push({ id: uid(), isSlot: false, value: 'newKey', slotId: uid() });
}

function removeAccessItem(index) {
  const removedItem = localProperties.value.accessChain.splice(index, 1)[0];
  if (removedItem.isSlot) {
    const slotIndex = props.value.inputs.findIndex(s => s.id === removedItem.slotId);
    if (slotIndex !== -1) props.value.removeInput(slotIndex);
  }
}

// --- Slot Management ---
const manageSlot = (isSlot, slotId, slotName) => {
  const slot = props.value.inputs.find(s => s.id === slotId);
  if (isSlot) {
    if (!slot) props.value.addInput(slotName, 'string', { id: slotId });
  } else {
    if (slot) props.value.removeInput(props.value.inputs.indexOf(slot));
  }
};

watch(() => localProperties.value.sourceIsSlot, (isSlot) => manageSlot(isSlot, localProperties.value.sourceSlotId, 'source'), { immediate: true });
watch(() => localProperties.value.operationType, (opType) => {
  // Set 模式下强制开启 source slot
  if (opType === 'set' && !localProperties.value.sourceIsSlot) {
    localProperties.value.sourceIsSlot = true;
  }
}, { immediate: true });
watch(() => localProperties.value.defaultValueIsSlot, (isSlot) => manageSlot(isSlot, localProperties.value.defaultValueSlotId, 'default'), { immediate: true });
watch(() => localProperties.value.setValueIsSlot, (isSlot) => manageSlot(isSlot, localProperties.value.setValueSlotId, 'set value'), { immediate: true });

watch(() => localProperties.value.accessChain, (chain, oldChain) => {
  // Add/remove slots for keys
  chain.forEach(item => {
    manageSlot(item.isSlot, item.slotId, 'key');
  });
  // Clean up slots from removed items
  if (oldChain) {
    oldChain.forEach(oldItem => {
      if (!chain.some(item => item.id === oldItem.id)) {
        manageSlot(false, oldItem.slotId, 'key'); // Effectively removes the slot
      }
    });
  }
}, { deep: true, immediate: true });

</script>

<template>
  <BasePropertyPanel v-model="props">
    <q-card dark flat class="q-mb-sm">
      <q-card-section class="q-pa-sm">

        <q-btn-toggle v-model="localProperties.operationType" unelevated toggle-color="primary" color="grey-8" no-caps
          :options="[{ label: 'Get', value: 'get' }, { label: 'Set', value: 'set' }]" class="full-width q-mb-md" />

        <!-- UI for 'get' operation -->
        <div v-if="localProperties.operationType === 'get'">

          <div class="row items-center q-mt-sm q-gutter-x-sm no-wrap">
            <q-toggle dense dark v-model="localProperties.sourceIsSlot" label="Source"
              style="min-width: 90px; flex-shrink: 0;" />
            <q-input dense dark outlined class="col" v-model="localProperties.sourceValue"
              :disable="localProperties.sourceIsSlot" placeholder="Object variable name" />
          </div>




          <div class="row items-center q-mt-sm q-gutter-x-sm no-wrap">
            <q-toggle dense dark v-model="localProperties.defaultValueIsSlot" label="Default"
              style="min-width: 90px; flex-shrink: 0;" />
            <q-input dense dark outlined class="col" v-model="localProperties.defaultValue"
              :disable="localProperties.defaultValueIsSlot" placeholder="e.g., 'not found' or 0" />
          </div>
        </div>
        <div class="text-caption q-mt-md">Access Path</div>
        <q-separator dark />
        <div v-for="(item, index) in localProperties.accessChain" :key="item.id"
          class="row items-center q-mt-sm q-gutter-x-sm no-wrap">
          <q-toggle dense dark v-model="item.isSlot" :label="`[${index}]`" style="min-width: 90px; flex-shrink: 0;" />
          <q-input dense dark outlined class="col" v-model="item.value" :disable="item.isSlot" placeholder="Key" />
          <q-btn flat dense icon="delete" color="negative" @click="removeAccessItem(index)" />
        </div>
        <q-btn dense flat no-caps label="+ Add Key" @click="addAccessItem" class="q-mt-sm full-width" />

        <!-- UI for 'set' operation -->
        <div v-if="localProperties.operationType === 'set'">
          <div class="text-caption q-mt-md">Value to Set</div>
          <q-separator dark />
          <div class="row items-center q-mt-sm q-gutter-x-sm no-wrap">
            <q-toggle dense dark v-model="localProperties.setValueIsSlot" label="Value"
              style="min-width: 90px; flex-shrink: 0;" />
            <q-input dense dark outlined class="col" v-model="localProperties.setValue"
              :disable="localProperties.setValueIsSlot" placeholder="Value to assign" />
          </div>
        </div>



      </q-card-section>
    </q-card>
  </BasePropertyPanel>
</template>

<style scoped></style>
