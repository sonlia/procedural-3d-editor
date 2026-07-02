<template>
  <q-card v-if="trace" dark flat bordered class="q-mb-sm slot-value-panel">
    <q-card-section class="q-pa-sm">
      <div class="row items-center q-gutter-x-sm q-mb-sm">
        <q-icon name="visibility" color="amber" size="xs" />
        <div class="text-caption text-grey-5">Slot 实时值</div>
        <q-space />
        <div class="text-caption text-grey-7 q-mr-xs">{{ statusText }}</div>
      </div>

      <template v-if="inputItems.length">
        <div class="text-caption text-cyan-5 q-mb-xs">In</div>
        <div v-for="item in inputItems" :key="'i-' + item.key" class="slot-row q-mb-sm">
          <div class="text-caption text-grey-4 q-mb-xs">{{ item.name }}</div>
          <pre v-if="item.payload" class="slot-value">{{ item.formatted }}</pre>
          <div v-else class="slot-empty text-grey-7">{{ item.emptyText }}</div>
        </div>
      </template>

      <template v-if="outputItems.length">
        <div class="text-caption text-amber-5 q-mb-xs q-mt-sm">Out</div>
        <div v-for="item in outputItems" :key="'o-' + item.key" class="slot-row q-mb-sm">
          <div class="text-caption text-grey-4 q-mb-xs">{{ item.name }}</div>
          <pre v-if="item.payload" class="slot-value">{{ item.formatted }}</pre>
          <div v-else class="slot-empty text-grey-7">{{ item.emptyText }}</div>
        </div>
      </template>

      <div v-if="!inputItems.length && !outputItems.length" class="text-caption text-grey-7">
        节点没有可追踪的 slot。
      </div>
    </q-card-section>
  </q-card>
</template>

<script setup>
import { computed } from 'vue';
import { useDebugTrace } from 'src/composables/useDebugTrace.js';

const props = defineProps({
  node: { type: Object, default: null },
});

const debug = useDebugTrace();
const slotValues = debug.slotValues;

const trace = computed(() => props.node?.properties?.__debugMode === 'trace');

function formatValue(payload) {
  if (!payload) return '';
  const v = payload.value;
  if (v === undefined) return '/* undefined */';
  if (v === null) return 'null';
  try {
    if (typeof v === 'string') return JSON.stringify(v);
    return JSON.stringify(v, null, 2);
  } catch {
    return String(v);
  }
}

const inputItems = computed(() => {
  void slotValues.value;
  if (!trace.value) return [];
  const node = props.node;
  if (!node?.inputs) return [];
  const items = [];
  for (const input of node.inputs) {
    if (!input?.name) continue;
    if (input.type === 'orderSlot') continue;
    const isConnected = input.link != null;
    const payload = isConnected ? debug.getSlotValue(node.id, 'in', input.name) : null;
    items.push({
      key: input.name,
      name: input.name,
      payload,
      formatted: formatValue(payload),
      emptyText: isConnected ? '已连接,尚未触发' : '未连接',
    });
  }
  return items;
});

const outputItems = computed(() => {
  void slotValues.value;
  if (!trace.value) return [];
  const node = props.node;
  if (!node?.outputs) return [];
  const items = [];
  for (const output of node.outputs) {
    if (!output?.name) continue;
    if (output.type === 'orderSlot') continue;
    const payload = debug.getSlotValue(node.id, 'out', output.name);
    items.push({
      key: output.name,
      name: output.name,
      payload,
      formatted: formatValue(payload),
      emptyText: '尚未触发',
    });
  }
  return items;
});

const statusText = computed(() => {
  void slotValues.value;
  const total = inputItems.value.length + outputItems.value.length;
  if (total === 0) return '—';
  const filled = [...inputItems.value, ...outputItems.value].filter(i => i.payload).length;
  return `${filled}/${total}`;
});

</script>

<style scoped>
.slot-value-panel {
  background: #1a1a1a;
}

.slot-row {
  border-left: 2px solid #3a3a3a;
  padding-left: 6px;
}

.slot-value {
  margin: 0;
  padding: 4px 6px;
  background: #0d0d0d;
  border-radius: 3px;
  color: #c8e1ff;
  font-family: ui-monospace, "Cascadia Code", "Consolas", monospace;
  font-size: 11px;
  white-space: pre-wrap;
  word-break: break-all;
  max-height: 160px;
  overflow: auto;
}

.slot-empty {
  font-size: 11px;
  font-style: italic;
}
</style>
