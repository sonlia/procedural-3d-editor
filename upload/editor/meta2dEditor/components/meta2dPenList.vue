<template>
  <div class="meta2d-pen-list column">
    <q-bar dark class="bg-grey-10">
      <span class="text-grey-5 text-caption">图元列表</span>
      <q-space />
      <q-btn dense flat round size="sm" icon="image" :disable="!canInsert" @click="resourceDialog = true">
        <q-tooltip>插入资源(图片 / SVG)</q-tooltip>
      </q-btn>
    </q-bar>

    <!-- 搜索框 -->
    <div class="q-pa-xs">
      <q-input
        v-model="searchText"
        dark
        dense
        outlined
        placeholder="搜索图元..."
        clearable
        @update:model-value="doSearch"
      >
        <template #prepend>
          <q-icon name="search"  />
        </template>
      </q-input>
    </div>

    <!-- 搜索结果 -->
    <div v-if="searchList.length" class="search-results q-px-xs">
      <div class="pen-grid">
        <div
          v-for="(item, index) in searchList"
          :key="'s-' + index"
          class="pen-item"
          draggable="true"
          @dragstart="onDragStart($event, item)"
          @click="onClickAdd(item)"
          :title="item.name"
        >
          <!-- iconfont 字体图标 -->
          <i v-if="item.type === 'icon'" class="l-icon" :class="item.icon"></i>
          <!-- SVG sprite 图标 -->
          <svg v-else-if="item.icon" class="l-icon" aria-hidden="true">
            <use :xlink:href="'#' + item.icon"></use>
          </svg>
          <!-- 图片 -->
          <img v-else-if="item.image" :src="item.image" class="pen-img" />
          <!-- 嵌入 SVG -->
          <div v-else-if="item.svg" class="pen-svg" v-html="item.svg"></div>
        </div>
      </div>
    </div>

    <q-scroll-area class="col">
      <div class="q-pa-xs">
        <!-- 图元分组 -->
        <q-expansion-item
          v-for="icons in showList"
          :key="icons.name"
          dense
          dark
          :label="icons.name + (icons.count ? ` (${icons.count})` : '')"
          header-class="text-grey-5"
          @before-show="changeState(icons)"
        >
          <div class="pen-grid q-pa-xs">
            <div
              v-for="(item, index) in icons.list"
              :key="icons.name + '-' + index"
              class="pen-item"
              draggable="true"
              @dragstart="onDragStart($event, item)"
              @click="onClickAdd(item)"
              :title="item.name"
            >
              <!-- iconfont 字体图标 -->
              <i v-if="item.type === 'icon'" class="l-icon" :class="item.icon"></i>
              <!-- SVG sprite 图标 -->
              <svg v-else-if="item.icon" class="l-icon" aria-hidden="true">
                <use :xlink:href="'#' + item.icon"></use>
              </svg>
              <!-- 图片 -->
              <img v-else-if="item.image" :src="item.image" class="pen-img" />
              <!-- 嵌入 SVG -->
              <div v-else-if="item.svg" class="pen-svg" v-html="item.svg"></div>
            </div>
          </div>
        </q-expansion-item>

        <!-- 无搜索结果 -->
        <div
          v-if="showList.length === 0 && !loading"
          class="text-grey-6 text-caption text-center q-pa-md"
        >
          无匹配的图元
        </div>

        <!-- 加载中 -->
        <div v-if="loading" class="text-grey-6 text-caption text-center q-pa-md">
          加载图元中...
        </div>
      </div>
    </q-scroll-area>

    <meta2d-resource-dialog v-model="resourceDialog" />
  </div>
</template>

<script setup>
import { ref, computed, reactive, onMounted } from "vue";
import { cloneDeep } from "lodash-es";
import { meta2dInstance, isInitialized, loadError } from "../composables/useMeta2dEditor.js";
import { lockStatus } from "../composables/useMeta2dConfig.js";
import meta2dResourceDialog from "./meta2dResourceDialog.vue";
import {
  defaultIcons,
  getOtherIcons,
  svgToPens,
  pngToPens,
} from "../data/icons.js";
import { uid } from "quasar";
import axios from "axios";

// ==================== 状态 ====================
const searchText = ref("");
const resourceDialog = ref(false);
const canInsert = computed(
  () => isInitialized.value && !loadError.value && lockStatus.value === 0
);
const loading = ref(false);
const iconList = reactive([]);
const searchList = reactive([]);

// ==================== 初始化 ====================
onMounted(async () => {
  loading.value = true;
  // 加载动态图元（iconfont、SVG、PNG 等）
  const icons = await getOtherIcons();
  iconList.push(...icons);
  // 加入默认静态图元
  iconList.push(...defaultIcons);
  loading.value = false;
});

// ==================== Computed ====================
const showList = computed(() => {
  const search = searchText.value?.toLowerCase().trim();
  if (!search) return iconList.filter((i) => i.show);

  return iconList
    .filter((i) => i.show)
    .map((group) => ({
      ...group,
      list: group.list.filter(
        (pen) =>
          pen.name?.toLowerCase().includes(search) ||
          pen.data?.text?.toLowerCase().includes(search)
      ),
    }))
    .filter((group) => group.list.length > 0);
});

// ==================== 搜索 ====================
function doSearch(value) {
  searchList.length = 0;
  value = value?.trim();
  if (value) {
    showList.value.forEach((item) => {
      searchList.push(...item.list.filter((i) => i.name?.includes(value)));
    });
  }
}

// ==================== 懒加载（SVG/PNG 文件夹） ====================
async function changeState(tab) {
  if (tab.folder && !tab.loaded) {
    const { data: files } = await axios.get(
      (tab.svg ? "/svg/" : "/png/") + tab.name + "/"
    );
    tab.loaded = true;
    if (tab.svg) {
      const fs = await Promise.all(
        files.map((f) => svgToPens(f, tab.name))
      );
      tab.list = fs;
    } else {
      const fs = await Promise.all(
        files.map((f) => pngToPens(f, tab.name))
      );
      tab.list = fs;
    }
  }
}

// ==================== 拖拽 ====================
function onDragStart(event, pen) {
  if (lockStatus.value !== 0) {
    event.preventDefault();
    return;
  }
  const penData = cloneDeep(pen.data || pen);
  event.dataTransfer.setData("Meta2d", JSON.stringify(penData));
  event.dataTransfer.effectAllowed = "copy";
}

// ==================== 点击添加 ====================
function onClickAdd(pen) {
  const m2d = meta2dInstance.value;
  if (!m2d) return;
  if (lockStatus.value !== 0) return;

  const penData = cloneDeep(pen.data || pen);
  penData.id = uid();
  if (!penData.width) penData.width = 100;
  if (!penData.height) penData.height = 100;

  m2d.canvas.addCaches = [penData];
}

// ==================== 暴露 ====================
defineExpose({
  searchText,
  showList,
  iconList,
});
</script>

<style scoped>
.meta2d-pen-list {
  background-color: #252526;
  border-right: 1px solid #3c3c3c;
}

.search-results {
  max-height: 200px;
  overflow-y: auto;
}

.pen-grid {
  display: flex;
  flex-wrap: wrap;
  align-content: flex-start;
}

.pen-item {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 35px;
  height: 35px;
  padding: 4px;
  cursor: pointer;
  transition: background-color 0.2s;
  user-select: none;
}

.pen-item:hover {
  background-color: #3c3c3c;
  border-radius: 4px;
}

.pen-item:active {
  background-color: #094771;
}

/* SVG sprite 图标样式 */
.pen-item .l-icon {
  width: 24px;
  height: 24px;
  font-size: 24px;
  fill: currentColor;
  color: #aaa;
}

/* iconfont 字体图标样式 */
.pen-item i.l-icon {
  display: inline-block;
  width: auto;
  height: auto;
  font-size: 22px;
  color: #aaa;
}

/* 图片预览 */
.pen-img {
  max-width: 25px;
  max-height: 25px;
  object-fit: contain;
}

/* 嵌入 SVG */
.pen-svg {
  width: 25px;
  height: 25px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.pen-svg :deep(svg) {
  width: 100%;
  height: 100%;
}
</style>
