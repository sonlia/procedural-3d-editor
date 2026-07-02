<template>
  <q-scroll-area class="fit">
    <div class="q-pa-sm">
      <!-- 图元 ID -->
      <div class="form-row">
        <span class="form-label">图元 ID</span>
        <q-input
          :model-value="penId"
          dark
          dense
          outlined
          readonly
          class="col"
        >
          <template #append>
            <q-btn dark dense flat icon="content_copy"  @click="copyId">
              <q-tooltip>复制 ID</q-tooltip>
            </q-btn>
          </template>
        </q-input>
      </div>

      <!-- 图元名称 -->
      <div class="form-row">
        <span class="form-label">名称</span>
        <q-input
          v-model="penName"
          dark
          dense
          outlined
          class="col"
          @update:model-value="updateName"
        />
      </div>

      <q-separator dark class="q-my-md" />

      <!-- 默认标签 -->
      <div class="text-grey-5 text-caption q-mb-sm">默认标签</div>
      <div class="row q-gutter-xs q-mb-md">
        <q-checkbox
          v-model="tags.power"
          dark
          dense
          label="电源 (power)"
          @update:model-value="updateTags"
        />
        <q-checkbox
          v-model="tags.switch"
          dark
          dense
          label="开关 (switch)"
          @update:model-value="updateTags"
        />
      </div>

      <q-separator dark class="q-my-md" />

      <!-- 自定义标签 -->
      <div class="text-grey-5 text-caption q-mb-sm">自定义标签</div>
      <div class="row q-gutter-xs q-mb-sm">
        <q-chip
          v-for="tag in customTags"
          :key="tag"
          dark
          dense
          removable
          color="primary"
          text-color="white"
          @remove="removeTag(tag)"
        >
          {{ tag }}
        </q-chip>
      </div>
      <div class="row q-gutter-xs">
        <q-input
          v-model="newTag"
          dark
          dense
          outlined
          placeholder="输入标签名"
          class="col"
          @keyup.enter="addTag"
        />
        <q-btn dark dense flat icon="add" @click="addTag">
          <q-tooltip>添加标签</q-tooltip>
        </q-btn>
      </div>

      <q-separator dark class="q-my-md" />

      <!-- 数据绑定 -->
      <q-expansion-item dense dark label="数据绑定" icon="link" header-class="text-grey-5">
        <div class="q-pa-xs">
          <div class="form-row">
            <span class="form-label">绑定变量</span>
            <q-input
              v-model="dataKey"
              dark
              dense
              outlined
              placeholder="变量名"
              class="col"
              @update:model-value="updateDataKey"
            />
          </div>
          <div class="text-grey-6 text-caption q-mt-xs">
            绑定后可通过 meta2d.setValue({ id, [变量名]: value }) 更新
          </div>
        </div>
      </q-expansion-item>
    </div>
  </q-scroll-area>
</template>

<script setup>
import { ref, reactive, watch, computed } from "vue";
import { copyToClipboard, Notify } from "quasar";
import { meta2dInstance, activePen } from "../../composables/useMeta2dEditor.js";

// ==================== 响应式状态 ====================
const penName = ref("");
const tags = reactive({
  power: false,
  switch: false,
});
const customTags = ref([]);
const newTag = ref("");
const dataKey = ref("");

// ==================== Computed ====================
const penId = computed(() => activePen.value?.id || "");

// ==================== 方法 ====================
function copyId() {
  if (penId.value) {
    copyToClipboard(penId.value).then(() => {
      Notify.create({
        type: "positive",
        message: "ID 已复制",
        timeout: 1000,
      });
    });
  }
}

function updateName(value) {
  const m2d = meta2dInstance.value;
  const pen = activePen.value;
  if (!m2d || !pen) return;

  m2d.setValue({
    id: pen.id,
    name: value,
  });
}

function updateTags() {
  const m2d = meta2dInstance.value;
  const pen = activePen.value;
  if (!m2d || !pen) return;

  const allTags = [];
  if (tags.power) allTags.push("power");
  if (tags.switch) allTags.push("switch");
  allTags.push(...customTags.value);

  m2d.setValue({
    id: pen.id,
    tags: allTags,
  });
}

function addTag() {
  const tag = newTag.value.trim();
  if (!tag) return;
  if (customTags.value.includes(tag)) {
    Notify.create({
      type: "warning",
      message: "标签已存在",
      timeout: 1000,
    });
    return;
  }
  customTags.value.push(tag);
  newTag.value = "";
  updateTags();
}

function removeTag(tag) {
  const idx = customTags.value.indexOf(tag);
  if (idx > -1) {
    customTags.value.splice(idx, 1);
    updateTags();
  }
}

function updateDataKey(value) {
  const m2d = meta2dInstance.value;
  const pen = activePen.value;
  if (!m2d || !pen) return;

  m2d.setValue({
    id: pen.id,
    dataKey: value,
  });
}

function mergeData(pen) {
  if (!pen) {
    penName.value = "";
    tags.power = false;
    tags.switch = false;
    customTags.value = [];
    dataKey.value = "";
    return;
  }

  penName.value = pen.name || "";
  dataKey.value = pen.dataKey || "";

  // 解析标签
  const penTags = pen.tags || [];
  tags.power = penTags.includes("power");
  tags.switch = penTags.includes("switch");
  customTags.value = penTags.filter((t) => t !== "power" && t !== "switch");
}

// ==================== Watch ====================
watch(activePen, (pen) => {
  mergeData(pen);
}, { immediate: true });
</script>

<style scoped>
.form-row {
  display: flex;
  align-items: center;
  margin-bottom: 8px;
}

.form-label {
  width: 70px;
  flex-shrink: 0;
  font-size: 12px;
  color: #999;
}
</style>
