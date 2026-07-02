<template>
  <div class="column full-height q-pa-sm">
    <div class="row items-center q-gutter-x-xs no-wrap">
    
      <div class="text-body2 ellipsis col">{{ title }}</div>

    </div>

    <q-separator dark class="q-my-sm" />

    <div v-if="items.length === 0" class="col row items-center justify-center text-grey-6">
      <div class="text-center">
        <q-icon name="inventory_2" size="48px" />
        <div class="text-body2 q-mt-sm">当前目录没有资源</div>
      </div>
    </div>

    <div v-else class="resource-grid col overflow-auto">
      <q-card
        v-for="item in items"
        :key="item.id"
        dark
        flat
        bordered
        class="resource-tile cursor-pointer"
        :class="{ selected: selectedId === item.id, cut: cutNodeIds.includes(item.id) }"
        @click="handleOpen(item)"
        @dblclick="handleDoubleClick(item)"
      >
        <q-card-section class="q-pa-sm column items-center q-gutter-y-xs">
          <div class="thumb row items-center justify-center">
            <q-img v-if="isImage(item)" :src="getResourceUrl(item)" :alt="item.name" fit="contain" class="thumb-img">
              <template #error>
                <q-icon name="broken_image" color="grey-6" size="32px" />
              </template>
            </q-img>
            <q-icon v-else :name="getItemIcon(item)" :color="getItemColor(item)" size="42px" />
          </div>
          <div class="resource-name text-caption text-center full-width">
            {{ item.name }}
          </div>
        </q-card-section>
      </q-card>
    </div>

    <q-dialog v-model="previewDialog" maximized dark>
      <div class="preview-overlay row items-center justify-center" @click.self="previewDialog = false">
        <q-btn v-close-popup dense flat round size="sm" icon="close" class="preview-close" />
        <img
          v-if="previewNode && isImage(previewNode)"
          :src="getResourceUrl(previewNode)"
          :alt="previewNode.name"
          class="full-preview-image"
        />
        <div v-else class="column items-center text-grey-5 q-gutter-y-sm">
          <q-icon :name="getItemIcon(previewNode)" size="48px" />
          <div class="text-body2">{{ previewNode?.name }}</div>
        </div>
      </div>
    </q-dialog>
  </div>
</template>

<script setup>
import { computed, ref } from "vue";
import {
  cutNodeIds,
  findNodeById,
  getFlatResourceNodes,
  getResourceUrl,
  hasCutNodes,
  pasteCutNodes,
  selectedId,
  selectedNode,
  treeNodes,
} from "src/components/leftWidget/resources/useResourceTree.js";

const emit = defineEmits(["upload"]);

const previewDialog = ref(false);
const previewNode = ref(null);

const currentFolder = computed(() => {
  const node = selectedNode.value;
  if (!node) return null;
  if (node.isParent) return node;
  return node.pId ? findNodeById(treeNodes.value, node.pId)?.node || null : null;
});

const items = computed(() => {
  if (!currentFolder.value) {
    return treeNodes.value;
  }
  return currentFolder.value.children || [];
});

const title = computed(() => currentFolder.value?.name || "资源根目录");

const isImage = (item) => {
  const mimeType = item.meta?.mimeType || "";
  return mimeType.startsWith("image/") || item.type === "image" || item.type === "svg";
};

const getItemIcon = (item) => {
  if (!item) return "insert_drive_file";
  if (item.isParent) return "folder";
  if (item.type === "font") return "font_download";
  return "insert_drive_file";
};

const getItemColor = (item) => {
  if (item.isParent) return "amber";
  if (item.type === "font") return "deep-purple-3";
  return "grey-5";
};

const handleOpen = (item) => {
  selectedId.value = item.id;
  if (item.isParent) return;
  previewNode.value = item;
  previewDialog.value = true;
};

const handleDoubleClick = (item) => {
  if (item.isParent) {
    selectedId.value = item.id;
    return;
  }
  previewNode.value = item;
  previewDialog.value = true;
};

defineExpose({ getFlatResourceNodes });
</script>

<style scoped>
.resource-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  grid-auto-rows: 150px;
  gap: 8px;
  align-content: start;
}

.resource-tile {
  border-color: rgba(255, 255, 255, 0.12);
  transition: all 0.2s ease;
}

.resource-tile:hover,
.resource-tile.selected {
  border-color: var(--q-primary);
  background: rgba(33, 150, 243, 0.12);
}

.resource-tile.cut {
  opacity: 0.55;
}

.thumb {
  width: 96px;
  height: 84px;
  overflow: hidden;
}

.thumb-img {
  width: 96px;
  height: 84px;
}

.resource-name {
  height: 34px;
  line-height: 16px;
  word-break: break-all;
  overflow: hidden;
}

.preview-overlay {
  width: 100vw;
  height: 100vh;
  position: relative;
  padding: 16px;
  background: #050505;
}

.preview-close {
  position: absolute;
  top: 8px;
  right: 8px;
  z-index: 2;
  color: white;
}

.full-preview-image {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
}
</style>
