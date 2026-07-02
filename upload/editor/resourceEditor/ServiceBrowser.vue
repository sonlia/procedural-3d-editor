<template>
  <q-card class="full-height bg-dark" dark>
    <!-- 标题栏 -->
    <q-bar class="bg-grey-10">
      <q-icon name="cloud" />
      <span>远程文件浏览 - {{ node?.name }}</span>
      <q-space />
      <q-btn dense flat icon="close" @click="emit('close')" />
    </q-bar>

    <q-card-section class="column full-height q-pa-sm">
      <!-- 工具栏 -->
      <div class="row items-center q-gutter-sm q-mb-sm">
        <!-- 路径导航 -->
        <q-breadcrumbs class="col text-grey-5">
          <q-breadcrumbs-el label="根目录" icon="home" class="cursor-pointer" @click="navigateTo('')" />
          <q-breadcrumbs-el v-for="(part, idx) in pathParts" :key="idx" :label="part" class="cursor-pointer"
            @click="navigateTo(pathParts.slice(0, idx + 1).join('/'))" />
        </q-breadcrumbs>

        <q-btn flat dense icon="refresh" :loading="isLoading" @click="loadFiles">
          <q-tooltip>刷新</q-tooltip>
        </q-btn>
      </div>

      <!-- 搜索栏 -->
      <q-input v-model="searchQuery" placeholder="搜索文件..." dark dense outlined clearable class="q-mb-sm">
        <template #prepend>
          <q-icon name="search" />
        </template>
      </q-input>

      <!-- 文件列表 -->
      <q-scroll-area class="col">
        <!-- 加载中 -->
        <div v-if="isLoading" class="row items-center justify-center q-pa-lg">
          <q-spinner size="md" color="primary" />
          <span class="q-ml-sm text-grey-5">加载中...</span>
        </div>

        <!-- 空状态 -->
        <div v-else-if="filteredFiles.length === 0" class="text-center q-pa-lg text-grey-6">
          <q-icon name="folder_open" size="48px" />
          <div class="q-mt-sm">{{ searchQuery ? '未找到匹配文件' : '目录为空' }}</div>
        </div>

        <!-- 文件网格 -->
        <div v-else class="row q-gutter-sm">
          <div v-for="file in filteredFiles" :key="file.key" class="file-item cursor-pointer"
            :class="{ selected: selectedFiles.has(file.key) }" @click="handleFileClick(file)"
            @dblclick="handleFileDblClick(file)">
            <!-- 文件夹 -->
            <div v-if="file.isFolder" class="file-icon">
              <q-icon name="folder" size="32px" color="amber-7" />
            </div>
            <!-- 图片预览 -->
            <div v-else class="file-icon">
              <q-img v-if="isImageFile(file.name)" :src="file.url" fit="contain" class="file-thumbnail">
                <template #error>
                  <div class="row items-center justify-center full-height">
                    <q-icon name="broken_image" color="grey-6" />
                  </div>
                </template>
              </q-img>
              <q-icon v-else name="insert_drive_file" size="32px" color="grey-5" />
            </div>

            <!-- 文件名 -->
            <div class="file-name text-caption ellipsis q-mt-xs">
              {{ file.name }}
            </div>

            <!-- 文件大小 -->
            <div v-if="!file.isFolder" class="text-caption text-grey-7">
              {{ formatSize(file.size) }}
            </div>

            <!-- 选中标记 -->
            <q-icon v-if="selectedFiles.has(file.key)" name="check_circle" color="primary" class="selected-mark" />
          </div>
        </div>
      </q-scroll-area>
    </q-card-section>

    <!-- 底部操作栏 -->
    <q-separator dark />
    <q-card-actions align="right" class="q-pa-sm">
      <span class="text-caption text-grey-5 q-mr-auto">
        {{ selectedFiles.size > 0 ? `已选择 ${selectedFiles.size} 个文件` : '点击选择文件，双击打开文件夹' }}
      </span>
      <q-btn flat dense label="取消" @click="emit('close')" />
      <q-btn color="primary" dense label="导入选中" :disable="selectedFiles.size === 0" @click="handleImport" />
    </q-card-actions>
  </q-card>
</template>

<script setup>
import { ref, computed, defineProps, onMounted, watch } from "vue";
import { uid, Notify } from "quasar";
import {
  getServiceConfig,
} from "src/components/leftWidget/resources/useResourceTree.js";

const props = defineProps({
  node: {
    type: Object,
    default: null,
  },
});

const emit = defineEmits(["close", "select"]);

// 状态
const isLoading = ref(false);
const currentPath = ref("");
const files = ref([]);
const selectedFiles = ref(new Set());
const searchQuery = ref("");

// 路径分段
const pathParts = computed(() => {
  if (!currentPath.value) return [];
  return currentPath.value.split("/").filter(Boolean);
});

// 过滤文件
const filteredFiles = computed(() => {
  if (!searchQuery.value) return files.value;
  const query = searchQuery.value.toLowerCase();
  return files.value.filter((f) =>
    f.name.toLowerCase().includes(query)
  );
});

// 加载文件列表
const loadFiles = async () => {
  if (!props.node?.id) return;

  const config = getServiceConfig(props.node.id);
  if (!config) {
    Notify.create({
      type: "warning",
      message: "请先配置文件服务",
    });
    return;
  }

  isLoading.value = true;
  selectedFiles.value.clear();

  try {
    const response = await fetch("/api/resources/browse", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...config,
        path: currentPath.value,
      }),
    });

    const result = await response.json();

    if (result.success) {
      files.value = (result.files || []).map((f) => ({
        ...f,
        key: f.key || f.name,
        name: f.name || f.key?.split("/").pop() || "unknown",
      }));
    } else {
      Notify.create({
        type: "negative",
        message: "加载文件失败",
        caption: result.error,
      });
      files.value = [];
    }
  } catch (error) {
    Notify.create({
      type: "negative",
      message: "请求失败",
      caption: error.message,
    });
    files.value = [];
  } finally {
    isLoading.value = false;
  }
};

// 导航到路径
const navigateTo = (path) => {
  currentPath.value = path;
  loadFiles();
};

// 文件点击
const handleFileClick = (file) => {
  if (file.isFolder) return;

  if (selectedFiles.value.has(file.key)) {
    selectedFiles.value.delete(file.key);
  } else {
    selectedFiles.value.add(file.key);
  }
  // 触发响应式更新
  selectedFiles.value = new Set(selectedFiles.value);
};

// 文件双击
const handleFileDblClick = (file) => {
  if (file.isFolder) {
    navigateTo(file.key);
  }
};

// 导入选中文件
const handleImport = () => {
  const selected = files.value.filter(
    (f) => selectedFiles.value.has(f.key) && !f.isFolder
  );

  const importFiles = selected.map((f) => ({
    id: uid(),
    name: f.name,
    url: f.url,
    mimeType: f.mimeType || guessMimeType(f.name),
    size: f.size || 0,
  }));

  emit("select", importFiles);
};

// 判断是否为图片文件
const isImageFile = (name) => {
  if (!name) return false;
  return /\.(jpg|jpeg|png|gif|svg|webp|bmp|ico)$/i.test(name);
};

// 猜测 MIME 类型
const guessMimeType = (name) => {
  if (!name) return "application/octet-stream";
  const ext = name.split(".").pop()?.toLowerCase();
  const map = {
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    gif: "image/gif",
    svg: "image/svg+xml",
    webp: "image/webp",
    bmp: "image/bmp",
    ico: "image/x-icon",
  };
  return map[ext] || "application/octet-stream";
};

// 格式化大小
const formatSize = (bytes) => {
  if (!bytes) return "-";
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
};

// 初始化
watch(
  () => props.node?.id,
  () => {
    currentPath.value = "";
    loadFiles();
  },
  { immediate: true }
);

onMounted(() => {
  loadFiles();
});
</script>

<style scoped>
.file-item {
  width: 100px;
  padding: 8px;
  border-radius: 6px;
  text-align: center;
  position: relative;
  transition: background-color 0.15s;
}

.file-item:hover {
  background: rgba(255, 255, 255, 0.05);
}

.file-item.selected {
  background: rgba(33, 150, 243, 0.15);
  outline: 1px solid rgba(33, 150, 243, 0.3);
}

.file-icon {
  width: 64px;
  height: 64px;
  margin: 0 auto;
  display: flex;
  align-items: center;
  justify-content: center;
}

.file-thumbnail {
  width: 64px;
  height: 64px;
  border-radius: 4px;
}

.file-name {
  max-width: 100%;
}

.selected-mark {
  position: absolute;
  top: 4px;
  right: 4px;
}
</style>
