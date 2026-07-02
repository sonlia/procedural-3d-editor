<script setup>
import { computed, ref, watch } from "vue";
import BasePropertyPanel from "src/components/editor/nodeEditor/propertyPanel/BasePropertyPanel.vue";
import api from "src/services/api.js";
import { useProjectStore } from "src/stores/projectMange.js";

const props = defineModel();
const node = computed(() => props.value);
const properties = computed(() => props.value?.properties || {});
const projectStore = useProjectStore();
const keyOptions = ref([]);
const keyLoading = ref(false);

const generatedCodePreview = computed(
  () => props.value?.bgJsCode || props.value?.jsCode || "// No generated code",
);

const operationOptions = [
  { label: "GET", value: "get" },
  { label: "SET", value: "set" },
  { label: "DEL", value: "del" },
  { label: "EXISTS", value: "exists" },
  { label: "EXPIRE", value: "expire" },
  { label: "TTL", value: "ttl" },
  { label: "HGET", value: "hget" },
  { label: "HSET", value: "hset" },
  { label: "HGETALL", value: "hgetall" },
  { label: "LPUSH", value: "lpush" },
  { label: "RPUSH", value: "rpush" },
  { label: "LRANGE", value: "lrange" },
  { label: "SADD", value: "sadd" },
  { label: "SMEMBERS", value: "smembers" },
  { label: "ZADD", value: "zadd" },
  { label: "ZRANGE", value: "zrange" },
  { label: "CALL", value: "call" },
];

const operationKeyTypes = {
  get: ["string"],
  set: ["string"],
  hget: ["hash"],
  hset: ["hash"],
  hgetall: ["hash"],
  lpush: ["list"],
  rpush: ["list"],
  lrange: ["list"],
  sadd: ["set"],
  smembers: ["set"],
  zadd: ["zset"],
  zrange: ["zset"],
};

const paramLabels = {
  key: "Key",
  value: "Value",
  field: "Field",
  score: "Score",
  ttl: "TTL",
  start: "Start",
  stop: "Stop",
  command: "Command",
  args: "Args",
};

function requiredParams(operation) {
  switch (operation) {
    case "set":
      return ["key", "value", "ttl"];
    case "hget":
      return ["key", "field"];
    case "hset":
      return ["key", "field", "value"];
    case "lpush":
    case "rpush":
    case "sadd":
      return ["key", "value"];
    case "lrange":
    case "zrange":
      return ["key", "start", "stop"];
    case "zadd":
      return ["key", "score", "value"];
    case "expire":
      return ["key", "ttl"];
    case "call":
      return ["command", "args"];
    case "get":
    case "del":
    case "exists":
    case "ttl":
    case "hgetall":
    case "smembers":
    default:
      return ["key"];
  }
}

const activeParams = computed(() =>
  requiredParams(properties.value.operation || "get"),
);

function flattenDbTree(items, result = []) {
  for (const item of items || []) {
    result.push(item);
    if (Array.isArray(item.children)) {
      flattenDbTree(item.children, result);
    }
  }
  return result;
}

const redisDbOptions = computed(() => {
  const dbTree = flattenDbTree(projectStore.currentProject?.database?.dbTree || []);
  const byId = new Map(dbTree.map((item) => [item.id, item]));
  return dbTree
    .filter((item) => item.type === "redis_db")
    .map((item) => {
      const dbIndex = parseInt(String(item.name || "").replace("db", ""), 10) || 0;
      const parent = byId.get(item.pId);
      const dbGraphData = projectStore.getDbEditorData?.(item.id, "graphData") || {};
      const parentGraphData = projectStore.getDbEditorData?.(parent?.id, "graphData") || {};
      const extra = dbGraphData.extra || parentGraphData.extra || {};
      return {
        label: parent?.name ? `${parent.name} / ${item.name}` : item.name,
        value: item.id,
        dbIndex,
        config: {
          host: extra.host || "localhost",
          port: extra.port || 6379,
          password: extra.password || "",
          username: extra.username || "",
          db: dbIndex,
        },
      };
    });
});

const selectedRedisDb = computed(() =>
  redisDbOptions.value.find((item) => item.value === properties.value.redisDbId),
);

function getAllowedKeyTypes() {
  return operationKeyTypes[properties.value.operation || "get"] || null;
}

async function loadRedisKeys() {
  const selected = selectedRedisDb.value;
  if (!selected?.config || properties.value.key?.isSlot) {
    keyOptions.value = [];
    return;
  }

  keyLoading.value = true;
  const keys = [];
  let cursor = "0";

  try {
    do {
      const response = await api.post("/api/redis/keys", {
        config: selected.config,
        pattern: "*",
        cursor,
        count: 500,
      });

      if (!response.data?.success) break;
      const data = response.data.data || {};
      keys.push(...(data.keys || []));
      cursor = data.cursor || "0";
    } while (cursor !== "0");

    const allowedTypes = getAllowedKeyTypes();
    keyOptions.value = keys
      .filter((item) => !allowedTypes || allowedTypes.includes(item.type))
      .map((item) => ({
        label: item.key,
        value: item.key,
      }));
  } catch {
    keyOptions.value = [];
  } finally {
    keyLoading.value = false;
  }
}

function rerun() {
  node.value?.updateInputSlots?.();
  node.value?.onExecute?.();
  node.value?.graph?.setDirtyCanvas?.(true, true);
}

function onOperationChange(value) {
  properties.value.operation = value;
  rerun();
}

function onRedisDbChange(value) {
  const selected = redisDbOptions.value.find((item) => item.value === value);
  properties.value.redisDbId = value || "";
  properties.value.dbIndex = selected?.dbIndex ?? 0;
  keyOptions.value = [];
  node.value?.onExecute?.();
  node.value?.graph?.setDirtyCanvas?.(true, true);
}

function onToggleSlot(config, value) {
  config.isSlot = value;
  rerun();
}

function onValueChange(config, value) {
  config.value = value;
  node.value?.onExecute?.();
  node.value?.graph?.setDirtyCanvas?.(true, true);
}

watch(
  () => [
    properties.value.redisDbId,
    properties.value.operation,
    properties.value.key?.isSlot,
  ],
  () => {
    loadRedisKeys();
  },
  { immediate: true },
);
</script>

<template>
  <BasePropertyPanel v-model="props" :code-content="generatedCodePreview">
    <div class="column q-pa-sm q-gutter-y-sm">
      <q-select
        dense
        dark
        outlined
        emit-value
        map-options
        label="Redis DB"
        :model-value="properties.redisDbId"
        :options="redisDbOptions"
        @update:model-value="onRedisDbChange"
      />

      <q-select
        dense
        dark
        outlined
        emit-value
        map-options
        label="Operation"
        :model-value="properties.operation || 'get'"
        :options="operationOptions"
        @update:model-value="onOperationChange" />

      <q-card dark flat bordered>
        <q-card-section class="q-pa-sm">
          <div class="text-caption text-grey-5 q-mb-sm">Params</div>
          <div
            v-for="name in activeParams"
            :key="name"
            class="row items-center no-wrap q-gutter-x-sm q-mb-sm"
          >
            <div class="col-auto" style="width: 112px">
              <q-toggle
                dense
                dark
                size="sm"
                :label="paramLabels[name] || name"
                :model-value="properties[name]?.isSlot"
                @update:model-value="(value) => onToggleSlot(properties[name], value)"
              />
            </div>

            <q-select
              v-if="name === 'key'"
              dense
              dark
              outlined
              use-input
              hide-selected
              fill-input
              input-debounce="0"
              class="col"
              :loading="keyLoading"
              :disable="properties[name]?.isSlot"
              :model-value="properties[name]?.value"
              :options="keyOptions"
              emit-value
              map-options
              @input-value="(value) => onValueChange(properties[name], value)"
              @update:model-value="(value) => onValueChange(properties[name], value)"
              @popup-show="loadRedisKeys"
            />
            <q-input
              v-else
              dense
              dark
              outlined
              class="col"
              :disable="properties[name]?.isSlot"
              :model-value="properties[name]?.value"
              @update:model-value="(value) => onValueChange(properties[name], value)"
            />
          </div>
        </q-card-section>
      </q-card>
    </div>
  </BasePropertyPanel>
</template>
