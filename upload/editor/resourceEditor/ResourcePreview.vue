<template>
  <div class="column full-height q-pa-sm">
    <template v-if="node && !node.isParent">
      <div class="row items-center justify-between q-gutter-x-sm">
        <div class="row items-center q-gutter-x-xs col">
          <q-icon :name="previewIcon" color="primary" size="sm" />
          <div class="text-body2 ellipsis">{{ node.name }}</div>
        </div>
        <q-chip dense dark color="grey-9" text-color="grey-3">{{ typeLabel }}</q-chip>
      </div>

      <div class="preview-container col row items-center justify-center q-mt-sm">
        <q-img v-if="isImage || isSvg" :src="previewUrl" :alt="node.name" fit="contain" class="preview-image">
          <template #loading>
            <q-spinner color="primary" size="sm" />
          </template>
          <template #error>
            <div class="column items-center text-grey-6">
              <q-icon name="broken_image" size="32px" />
              <div class="text-caption q-mt-xs">加载失败</div>
            </div>
          </template>
        </q-img>

        <div v-else-if="isFont" class="column items-center q-gutter-y-sm font-preview">
          <q-icon name="font_download" color="primary" size="32px" />
          <div :style="{ fontFamily: previewFontFamily }" class="font-sample">
            VueStudio Resource 123
          </div>
          <div :style="{ fontFamily: previewFontFamily }" class="font-sample small">
            字体预览 AaBbCc 你好
          </div>
        </div>

        <div v-else class="column items-center text-grey-6 q-gutter-y-xs">
          <q-icon name="insert_drive_file" size="48px" />
          <div class="text-body2">{{ node.name }}</div>
          <div class="text-caption">可复制链接或下载文件</div>
        </div>
      </div>

      <q-list dense dark class="resource-info q-mt-sm">
        <q-item>
          <q-item-section>
            <q-item-label caption class="text-grey-5">名称</q-item-label>
            <q-item-label class="ellipsis">{{ node.name }}</q-item-label>
          </q-item-section>
        </q-item>
        <q-item v-if="meta.size">
          <q-item-section>
            <q-item-label caption class="text-grey-5">大小</q-item-label>
            <q-item-label>{{ formatSize(meta.size) }}</q-item-label>
          </q-item-section>
        </q-item>
        <q-item v-if="meta.width && meta.height">
          <q-item-section>
            <q-item-label caption class="text-grey-5">尺寸</q-item-label>
            <q-item-label>{{ meta.width }} x {{ meta.height }}</q-item-label>
          </q-item-section>
        </q-item>
        <q-item v-if="meta.mimeType">
          <q-item-section>
            <q-item-label caption class="text-grey-5">类型</q-item-label>
            <q-item-label>{{ meta.mimeType }}</q-item-label>
          </q-item-section>
        </q-item>
        <q-item v-if="meta.storagePath">
          <q-item-section>
            <q-item-label caption class="text-grey-5">路径</q-item-label>
            <q-item-label class="ellipsis">{{ meta.storagePath }}</q-item-label>
          </q-item-section>
        </q-item>
      </q-list>

      <div class="row q-gutter-x-sm q-mt-sm">
        <q-btn dense flat size="sm" icon="content_copy" label="复制链接" class="col" @click="copyUrl" />
        <q-btn dense flat size="sm" icon="download" label="下载" class="col" @click="downloadResource" />
      </div>
    </template>

    <div v-else class="col row items-center justify-center text-grey-6">
      <div class="text-center">
        <q-icon name="inventory_2" size="48px" />
        <div class="text-body2 q-mt-sm">选择资源以预览</div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, watch } from "vue";
import { copyToClipboard, useQuasar } from "quasar";
import { getResourceUrl } from "src/components/leftWidget/resources/useResourceTree.js";

const props = defineProps({
  node: {
    type: Object,
    default: null,
  },
});

const $q = useQuasar();

const meta = computed(() => props.node?.meta || {});
const mimeType = computed(() => meta.value.mimeType || "");
const type = computed(() => props.node?.type || meta.value.type || "");
const previewUrl = computed(() => (props.node ? getResourceUrl(props.node) : ""));
const isSvg = computed(() => mimeType.value === "image/svg+xml" || type.value === "svg");
const isImage = computed(() => mimeType.value.startsWith("image/") && !isSvg.value);
const isFont = computed(() => type.value === "font" || mimeType.value.startsWith("font/") || mimeType.value.includes("font"));
const previewFontFamily = computed(() => `resource-font-${props.node?.id || "preview"}`);

let fontStyleEl = null;

const removeFontStyle = () => {
  if (fontStyleEl?.parentNode) {
    fontStyleEl.parentNode.removeChild(fontStyleEl);
  }
  fontStyleEl = null;
};

const applyFontStyle = () => {
  removeFontStyle();
  if (!isFont.value || !previewUrl.value || typeof document === "undefined") return;

  fontStyleEl = document.createElement("style");
  fontStyleEl.textContent = `@font-face{font-family:'${previewFontFamily.value}';src:url('${previewUrl.value}');}`;
  document.head.appendChild(fontStyleEl);
};

watch([isFont, previewUrl, previewFontFamily], applyFontStyle, { immediate: true });
onBeforeUnmount(removeFontStyle);

const typeLabel = computed(() => {
  if (isSvg.value) return "SVG";
  if (isImage.value) return "图片";
  if (isFont.value) return "字体";
  return "文件";
});

const previewIcon = computed(() => {
  if (isSvg.value || isImage.value) return "image";
  if (isFont.value) return "font_download";
  return "insert_drive_file";
});

const formatSize = (bytes) => {
  if (!bytes) return "-";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const copyUrl = () => {
  const fullUrl = previewUrl.value.startsWith("http") ? previewUrl.value : window.location.origin + previewUrl.value;
  copyToClipboard(fullUrl);
  $q.notify({ type: "positive", message: "链接已复制" });
};

const downloadResource = () => {
  const link = document.createElement("a");
  link.href = previewUrl.value;
  link.download = props.node.name;
  link.target = "_blank";
  link.click();
};
</script>

<style scoped>
.preview-container {
  min-height: 220px;
  max-height: 520px;
  overflow: hidden;
  background: rgba(0, 0, 0, 0.2);
  border-radius: 6px;
}

.preview-image {
  width: 100%;
  height: 100%;
  max-height: 500px;
}

.font-preview {
  max-width: 100%;
}

.font-sample {
  max-width: 100%;
  font-size: 28px;
  color: white;
  text-align: center;
  word-break: break-word;
}

.font-sample.small {
  font-size: 18px;
  color: #bdbdbd;
}

.resource-info {
  background: rgba(0, 0, 0, 0.1);
  border-radius: 4px;
}
</style>
