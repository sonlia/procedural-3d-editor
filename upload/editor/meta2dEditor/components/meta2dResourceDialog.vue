<template>
  <q-dialog v-model="show" dark>
    <q-card dark flat bordered class="resource-picker column">
      <div class="row items-center q-pa-sm q-gutter-x-sm">
        <q-icon name="image" color="primary" size="sm" />
        <div class="text-body2 col">选择资源插入(图片 / SVG)</div>
        <q-btn v-close-popup dense flat round size="sm" icon="close" />
      </div>
      <q-separator dark />

      <q-input
        v-model="search"
        dark
        dense
        outlined
        clearable
        class="q-ma-sm"
        placeholder="搜索资源..."
      >
        <template #prepend><q-icon name="search" /></template>
      </q-input>

      <q-scroll-area class="col">
        <div v-if="loading" class="text-grey-6 text-caption text-center q-pa-md">
          加载中...
        </div>
        <div
          v-else-if="items.length === 0"
          class="text-grey-6 text-caption text-center q-pa-md"
        >
          没有可插入的图片 / SVG 资源
        </div>
        <div v-else class="picker-grid q-pa-sm">
          <q-card
            v-for="item in items"
            :key="item.id"
            dark
            flat
            bordered
            class="picker-tile cursor-pointer"
            :title="item.name"
            @click="onPick(item)"
          >
            <div class="thumb row items-center justify-center">
              <q-img :src="urlOf(item)" fit="contain" class="thumb-img">
                <template #error>
                  <q-icon name="broken_image" color="grey-6" size="28px" />
                </template>
              </q-img>
            </div>
            <div class="tile-name text-caption text-center ellipsis">
              {{ item.name }}
            </div>
          </q-card>
        </div>
      </q-scroll-area>
    </q-card>
  </q-dialog>
</template>

<script setup>
import { computed, ref, watch } from "vue";
import {
  getFlatResourceNodes,
  getResourceUrl,
  loadResourceTree,
} from "src/components/leftWidget/resources/useResourceTree.js";
import { insertResource } from "../composables/useMeta2dInsert.js";

const show = defineModel({ type: Boolean, default: false });

const loading = ref(false);
const search = ref("");
const nodes = ref([]);

function isInsertable(n) {
  const type = n.type || n.meta?.type;
  const mime = n.meta?.mimeType || "";
  return type === "image" || type === "svg" || mime.startsWith("image/");
}

function urlOf(n) {
  return getResourceUrl(n);
}

const items = computed(() => {
  const kw = search.value?.toLowerCase().trim();
  let list = nodes.value.filter((n) => !n.isParent && isInsertable(n));
  if (kw) list = list.filter((n) => n.name?.toLowerCase().includes(kw));
  return list;
});

async function refresh() {
  loading.value = true;
  try {
    await loadResourceTree();
    nodes.value = getFlatResourceNodes();
  } finally {
    loading.value = false;
  }
}

async function onPick(item) {
  await insertResource(item);
}

watch(show, (v) => {
  if (v) refresh();
});
</script>

<style scoped>
.resource-picker {
  width: min(720px, 92vw);
  height: min(560px, 82vh);
}
.picker-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(96px, 1fr));
  grid-auto-rows: 116px;
  gap: 8px;
  align-content: start;
}
.picker-tile {
  border-color: rgba(255, 255, 255, 0.12);
  transition: border-color 0.2s ease;
}
.picker-tile:hover {
  border-color: var(--q-primary);
}
.thumb {
  width: 100%;
  height: 84px;
  overflow: hidden;
}
.thumb-img {
  width: 80px;
  height: 80px;
}
.tile-name {
  padding: 2px 4px;
}
</style>
