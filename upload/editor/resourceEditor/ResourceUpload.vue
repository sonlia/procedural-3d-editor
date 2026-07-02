<template>
  <div class="column full-height q-pa-sm">
    <div
      class="upload-zone col row items-center justify-center"
      :class="{ 'drag-active': isDragOver }"
      @click="triggerFileInput"
      @dragover.prevent="isDragOver = true"
      @dragleave.prevent="isDragOver = false"
      @drop.prevent="handleDrop"
    >
      <div class="text-center">
        <q-icon :name="isDragOver ? 'file_download' : 'cloud_upload'" size="48px" :color="isDragOver ? 'primary' : 'grey-6'" />
        <div class="text-body2 q-mt-sm" :class="isDragOver ? 'text-primary' : 'text-grey-5'">
          {{ isDragOver ? "释放上传" : "拖拽文件到此处上传" }}
        </div>
        <div class="text-caption text-grey-7 q-mt-xs">SVG、PNG、JPEG、WebP、GIF、TTF、OTF、WOFF、WOFF2</div>
      </div>
    </div>

    <input ref="fileInputRef" type="file" multiple :accept="RESOURCE_ACCEPT" hidden @change="handleFileSelect" />

    <q-list v-if="uploadList.length > 0" dense dark class="upload-list q-mt-sm">
      <q-item v-for="item in uploadList" :key="item.id" class="q-px-sm">
        <q-item-section avatar>
          <q-icon :name="getStatusIcon(item.status)" :color="getStatusColor(item.status)" size="sm" />
        </q-item-section>
        <q-item-section>
          <q-item-label class="ellipsis">{{ item.name }}</q-item-label>
          <q-item-label caption>{{ formatSize(item.size) }}</q-item-label>
          <q-linear-progress v-if="item.status === 'uploading'" indeterminate size="2px" color="primary" dark class="q-mt-xs" />
        </q-item-section>
        <q-item-section side>
          <q-btn v-if="item.status !== 'uploading'" dense flat round size="sm" icon="close" @click="removeFromList(item.id)" />
          <q-spinner v-else color="primary" size="sm" />
        </q-item-section>
      </q-item>
    </q-list>

    <div class="row items-center q-gutter-x-xs q-mt-sm text-caption text-grey-6">
      <q-icon name="folder" size="sm" />
      <span class="ellipsis">上传到 {{ targetNode?.name || "资源根目录" }}</span>
    </div>
  </div>
</template>

<script setup>
import { ref } from "vue";
import { uid, Notify } from "quasar";
import {
  currentProjectId,
  loadResourceTree,
  RESOURCE_ACCEPT,
} from "src/components/leftWidget/resources/useResourceTree.js";

const props = defineProps({
  targetNode: {
    type: Object,
    default: null,
  },
});

const emit = defineEmits(["uploaded"]);

const isDragOver = ref(false);
const fileInputRef = ref(null);
const uploadList = ref([]);

const allowedExtensions = [".svg", ".png", ".jpg", ".jpeg", ".webp", ".gif", ".ttf", ".otf", ".woff", ".woff2"];

const triggerFileInput = () => {
  fileInputRef.value?.click();
};

const isAcceptedFile = (file) => {
  const name = file.name.toLowerCase();
  return file.type.startsWith("image/")
    || file.type.startsWith("font/")
    || file.type.includes("font")
    || allowedExtensions.some((ext) => name.endsWith(ext));
};

const handleFileSelect = async (event) => {
  const files = Array.from(event.target.files || []);
  event.target.value = "";
  await uploadFiles(files);
};

const handleDrop = async (event) => {
  isDragOver.value = false;
  await uploadFiles(Array.from(event.dataTransfer?.files || []));
};

const uploadFiles = async (files) => {
  const acceptedFiles = files.filter(isAcceptedFile);
  if (acceptedFiles.length === 0) {
    Notify.create({ type: "warning", message: "请选择支持的资源文件" });
    return;
  }

  const items = acceptedFiles.map((file) => ({
    id: uid(),
    name: file.name,
    size: file.size,
    status: "uploading",
  }));
  uploadList.value.unshift(...items);

  try {
    const formData = new FormData();
    acceptedFiles.forEach((file) => formData.append("files", file));
    if (props.targetNode?.id) formData.append("parentId", props.targetNode.id);

    const response = await fetch(`/api/resources/${currentProjectId.value}/upload-batch`, {
      method: "POST",
      body: formData,
    });
    const result = await response.json();
    if (!response.ok || !result.success) {
      throw new Error(result.error || "上传失败");
    }

    items.forEach((item) => {
      item.status = "completed";
    });
    await loadResourceTree();
    emit("uploaded", result.data || []);
    Notify.create({ type: "positive", message: "上传完成" });
  } catch (error) {
    items.forEach((item) => {
      item.status = "error";
    });
    Notify.create({ type: "negative", message: error.message });
  }
};

const removeFromList = (id) => {
  const index = uploadList.value.findIndex((item) => item.id === id);
  if (index !== -1) uploadList.value.splice(index, 1);
};

const formatSize = (bytes) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const getStatusIcon = (status) => {
  if (status === "completed") return "check_circle";
  if (status === "error") return "error";
  return "hourglass_empty";
};

const getStatusColor = (status) => {
  if (status === "completed") return "positive";
  if (status === "error") return "negative";
  return "grey-5";
};

defineExpose({ triggerFileInput });
</script>

<style scoped>
.upload-zone {
  min-height: 220px;
  border: 2px dashed rgba(255, 255, 255, 0.2);
  border-radius: 8px;
  background: rgba(0, 0, 0, 0.1);
  cursor: pointer;
  transition: all 0.2s ease;
}

.upload-zone:hover,
.upload-zone.drag-active {
  border-color: var(--q-primary);
  background: rgba(33, 150, 243, 0.1);
}

.upload-list {
  max-height: 220px;
  overflow-y: auto;
  background: rgba(0, 0, 0, 0.1);
  border-radius: 4px;
}
</style>
