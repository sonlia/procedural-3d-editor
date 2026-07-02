<template>
  <q-scroll-area class="fit">
    <div class="q-pa-sm">
      <!-- 文件 -->
      <q-expansion-item dense dark label="文件" icon="description" default-opened header-class="text-grey-5">
        <div class="q-pa-xs">
          <div class="form-row">
            <span class="form-label">文件名</span>
            <q-input v-model="formData.fileName" dark dense outlined class="col" placeholder="请输入文件名" @update:model-value="updateFileName" />
          </div>
        </div>
      </q-expansion-item>

      <!-- 画布 -->
      <q-expansion-item dense dark label="画布" icon="crop_free" default-opened header-class="text-grey-5">
        <div class="q-pa-xs">
          <div class="form-row">
            <span class="form-label">默认颜色</span>
            <div class="row items-center no-wrap col">
              <q-input v-model="formData.color" dark dense outlined class="col" @update:model-value="updateColor">
                <template #prepend>
                  <q-icon name="colorize" class="cursor-pointer">
                    <q-popup-proxy cover transition-show="scale" transition-hide="scale">
                      <q-color v-model="formData.color" dark @update:model-value="updateColor" />
                    </q-popup-proxy>
                  </q-icon>
                </template>
              </q-input>
            </div>
          </div>
          <div class="form-row">
            <span class="form-label">画笔填充</span>
            <div class="row items-center no-wrap col">
              <q-input v-model="formData.penBackground" dark dense outlined class="col" @update:model-value="updatePenBackground">
                <template #prepend>
                  <q-icon name="colorize" class="cursor-pointer">
                    <q-popup-proxy cover transition-show="scale" transition-hide="scale">
                      <q-color v-model="formData.penBackground" dark @update:model-value="updatePenBackground" />
                    </q-popup-proxy>
                  </q-icon>
                </template>
              </q-input>
            </div>
          </div>
          <div class="form-row">
            <span class="form-label">背景颜色</span>
            <div class="row items-center no-wrap col">
              <q-input v-model="formData.background" dark dense outlined class="col" @update:model-value="updateBackground">
                <template #prepend>
                  <q-icon name="colorize" class="cursor-pointer">
                    <q-popup-proxy cover transition-show="scale" transition-hide="scale">
                      <q-color v-model="formData.background" dark @update:model-value="updateBackground" />
                    </q-popup-proxy>
                  </q-icon>
                </template>
              </q-input>
            </div>
          </div>
          <div class="form-row">
            <span class="form-label">背景图片</span>
            <div class="row items-center no-wrap col q-gutter-xs">
              <q-btn dark dense flat icon="image" @click="selectBackgroundImage">
                <q-tooltip>选择图片</q-tooltip>
              </q-btn>
              <span v-if="formData.backGroundImage" class="text-grey-6 text-caption ellipsis" style="max-width: 100px">
                已设置
              </span>
              <q-btn v-if="formData.backGroundImage" dark dense flat icon="close" color="negative" @click="clearBackgroundImage">
                <q-tooltip>清除图片</q-tooltip>
              </q-btn>
            </div>
          </div>
        </div>
      </q-expansion-item>

      <!-- 网格 -->
      <q-expansion-item dense dark label="网格" icon="grid_on" header-class="text-grey-5">
        <div class="q-pa-xs">
          <div class="form-row">
            <span class="form-label">显示网格</span>
            <q-toggle v-model="formData.grid" dark dense class="col" @update:model-value="updateGrid('grid')" />
          </div>
          <div class="form-row">
            <span class="form-label">网格颜色</span>
            <div class="row items-center no-wrap col">
              <q-input v-model="formData.gridColor" dark dense outlined class="col" @update:model-value="updateGrid('gridColor')">
                <template #prepend>
                  <q-icon name="colorize" class="cursor-pointer">
                    <q-popup-proxy cover transition-show="scale" transition-hide="scale">
                      <q-color v-model="formData.gridColor" dark @update:model-value="updateGrid('gridColor')" />
                    </q-popup-proxy>
                  </q-icon>
                </template>
              </q-input>
            </div>
          </div>
          <div class="form-row">
            <span class="form-label">网格大小</span>
            <q-input v-model.number="formData.gridSize" dark dense outlined type="number" :min="1" :max="100" class="col" @update:model-value="updateGrid('gridSize')" />
          </div>
          <div class="form-row">
            <span class="form-label">网格角度</span>
            <q-input v-model.number="formData.gridRotate" dark dense outlined type="number" class="col" @update:model-value="updateGrid('gridRotate')" />
          </div>
        </div>
      </q-expansion-item>

      <!-- 标尺 -->
      <q-expansion-item dense dark label="标尺" icon="straighten" header-class="text-grey-5">
        <div class="q-pa-xs">
          <div class="form-row">
            <span class="form-label">显示标尺</span>
            <q-toggle v-model="formData.rule" dark dense class="col" @update:model-value="updateRule('rule')" />
          </div>
          <div class="form-row">
            <span class="form-label">标尺颜色</span>
            <div class="row items-center no-wrap col">
              <q-input v-model="formData.ruleColor" dark dense outlined class="col" @update:model-value="updateRule('ruleColor')">
                <template #prepend>
                  <q-icon name="colorize" class="cursor-pointer">
                    <q-popup-proxy cover transition-show="scale" transition-hide="scale">
                      <q-color v-model="formData.ruleColor" dark @update:model-value="updateRule('ruleColor')" />
                    </q-popup-proxy>
                  </q-icon>
                </template>
              </q-input>
            </div>
          </div>
        </div>
      </q-expansion-item>
    </div>

    <!-- 隐藏的文件输入 -->
    <input ref="fileInput" type="file" accept="image/*" style="display: none" @change="onFileSelected" />
  </q-scroll-area>
</template>

<script setup>
import { reactive, ref, watch, onMounted } from "vue";
import { meta2dInstance, debouncedSaveData } from "../composables/useMeta2dEditor.js";
import { mapDefaults } from "../composables/useMeta2dConfig.js";

// ==================== 表单数据 ====================
const formData = reactive({ ...mapDefaults });
const fileInput = ref(null);

// ==================== 方法 ====================
function syncFromMeta2d() {
  const m2d = meta2dInstance.value;
  if (!m2d) return;

  const data = m2d.store?.data || {};
  const options = m2d.getOptions?.() || {};

  // 从 data 同步
  Object.keys(formData).forEach((key) => {
    if (data[key] !== undefined) {
      formData[key] = data[key];
    }
  });

  // fileName 特殊处理
  if (m2d.fileName) {
    formData.fileName = m2d.fileName;
  }

  // color 从 options 同步
  if (options.color) {
    formData.color = options.color;
  }
}

// 更新文件名
function updateFileName() {
  const m2d = meta2dInstance.value;
  if (!m2d) return;
  m2d.fileName = formData.fileName;
}

// 更新默认颜色
function updateColor() {
  const m2d = meta2dInstance.value;
  if (!m2d) return;
  m2d.setOptions?.({ color: formData.color });
  m2d.render();
}

// 更新画笔填充色
function updatePenBackground() {
  const m2d = meta2dInstance.value;
  if (!m2d) return;
  m2d.store.data.penBackground = formData.penBackground;
  m2d.render();
  debouncedSaveData();
}

// 更新背景颜色
function updateBackground() {
  const m2d = meta2dInstance.value;
  if (!m2d) return;
  m2d.setBackgroundColor?.(formData.background);
  m2d.render();
  debouncedSaveData();
}

// 选择背景图片
function selectBackgroundImage() {
  fileInput.value?.click();
}

// 文件选择回调
function onFileSelected(e) {
  const file = e.target.files?.[0];
  if (!file) return;

  const m2d = meta2dInstance.value;
  if (!m2d) return;

  const fileUrl = URL.createObjectURL(file);
  formData.backGroundImage = fileUrl;
  m2d.setBackgroundImage?.(fileUrl);
  m2d.render();
  debouncedSaveData();

  // 重置 input 以便重复选择同一文件
  e.target.value = "";
}

// 清除背景图片
function clearBackgroundImage() {
  const m2d = meta2dInstance.value;
  if (!m2d) return;

  formData.backGroundImage = "";
  m2d.setBackgroundImage?.("");
  m2d.render();
  debouncedSaveData();
}

// 更新网格属性
function updateGrid(prop) {
  const m2d = meta2dInstance.value;
  if (!m2d) return;

  m2d.setGrid?.({ [prop]: formData[prop] });
  m2d.render();
  debouncedSaveData();
}

// 更新标尺属性
function updateRule(prop) {
  const m2d = meta2dInstance.value;
  if (!m2d) return;

  m2d.setRule?.({ [prop]: formData[prop] });
  m2d.render();
  debouncedSaveData();
}

// ==================== 生命周期 ====================
onMounted(() => {
  syncFromMeta2d();
});

// ==================== Watch ====================
watch(meta2dInstance, () => {
  syncFromMeta2d();
});
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
