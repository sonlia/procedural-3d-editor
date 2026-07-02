<template>
  <q-scroll-area class="fit">
    <div class="q-pa-sm">
      <!-- 默认颜色 -->
      <q-expansion-item dense dark label="画笔颜色" icon="palette" default-opened header-class="text-grey-5">
        <div class="q-pa-xs">
          <div class="form-row">
            <span class="form-label">默认颜色</span>
            <div class="row items-center no-wrap col">
              <q-input v-model="formData.color" dark dense outlined class="col" @update:model-value="updateOption('color')">
                <template #prepend>
                  <q-icon name="colorize" class="cursor-pointer">
                    <q-popup-proxy cover transition-show="scale" transition-hide="scale">
                      <q-color v-model="formData.color" dark @update:model-value="updateOption('color')" />
                    </q-popup-proxy>
                  </q-icon>
                </template>
              </q-input>
            </div>
          </div>
          <div class="form-row">
            <span class="form-label">选中颜色</span>
            <div class="row items-center no-wrap col">
              <q-input v-model="formData.activeColor" dark dense outlined class="col" @update:model-value="updateOption('activeColor')">
                <template #prepend>
                  <q-icon name="colorize" class="cursor-pointer">
                    <q-popup-proxy cover transition-show="scale" transition-hide="scale">
                      <q-color v-model="formData.activeColor" dark @update:model-value="updateOption('activeColor')" />
                    </q-popup-proxy>
                  </q-icon>
                </template>
              </q-input>
            </div>
          </div>
          <div class="form-row">
            <span class="form-label">悬停颜色</span>
            <div class="row items-center no-wrap col">
              <q-input v-model="formData.hoverColor" dark dense outlined class="col" @update:model-value="updateOption('hoverColor')">
                <template #prepend>
                  <q-icon name="colorize" class="cursor-pointer">
                    <q-popup-proxy cover transition-show="scale" transition-hide="scale">
                      <q-color v-model="formData.hoverColor" dark @update:model-value="updateOption('hoverColor')" />
                    </q-popup-proxy>
                  </q-icon>
                </template>
              </q-input>
            </div>
          </div>
          <div class="form-row">
            <span class="form-label">悬停背景</span>
            <div class="row items-center no-wrap col">
              <q-input v-model="formData.hoverBackground" dark dense outlined class="col" @update:model-value="updateOption('hoverBackground')">
                <template #prepend>
                  <q-icon name="colorize" class="cursor-pointer">
                    <q-popup-proxy cover transition-show="scale" transition-hide="scale">
                      <q-color v-model="formData.hoverBackground" dark @update:model-value="updateOption('hoverBackground')" />
                    </q-popup-proxy>
                  </q-icon>
                </template>
              </q-input>
            </div>
          </div>
        </div>
      </q-expansion-item>

      <!-- 锚点 -->
      <q-expansion-item dense dark label="锚点" icon="adjust" header-class="text-grey-5">
        <div class="q-pa-xs">
          <div class="form-row">
            <span class="form-label">锚点颜色</span>
            <div class="row items-center no-wrap col">
              <q-input v-model="formData.anchorColor" dark dense outlined class="col" @update:model-value="updateOption('anchorColor')">
                <template #prepend>
                  <q-icon name="colorize" class="cursor-pointer">
                    <q-popup-proxy cover transition-show="scale" transition-hide="scale">
                      <q-color v-model="formData.anchorColor" dark @update:model-value="updateOption('anchorColor')" />
                    </q-popup-proxy>
                  </q-icon>
                </template>
              </q-input>
            </div>
          </div>
          <div class="form-row">
            <span class="form-label">锚点半径</span>
            <q-input v-model.number="formData.anchorRadius" dark dense outlined type="number" :min="0" :max="20" class="col" @update:model-value="updateOption('anchorRadius')" />
          </div>
          <div class="form-row">
            <span class="form-label">锚点背景</span>
            <div class="row items-center no-wrap col">
              <q-input v-model="formData.anchorBackground" dark dense outlined class="col" @update:model-value="updateOption('anchorBackground')">
                <template #prepend>
                  <q-icon name="colorize" class="cursor-pointer">
                    <q-popup-proxy cover transition-show="scale" transition-hide="scale">
                      <q-color v-model="formData.anchorBackground" dark @update:model-value="updateOption('anchorBackground')" />
                    </q-popup-proxy>
                  </q-icon>
                </template>
              </q-input>
            </div>
          </div>
        </div>
      </q-expansion-item>

      <!-- 辅助线 -->
      <q-expansion-item dense dark label="辅助线" icon="grid_guides" header-class="text-grey-5">
        <div class="q-pa-xs">
          <div class="form-row">
            <span class="form-label">对齐线颜色</span>
            <div class="row items-center no-wrap col">
              <q-input v-model="formData.dockColor" dark dense outlined class="col" @update:model-value="updateOption('dockColor')">
                <template #prepend>
                  <q-icon name="colorize" class="cursor-pointer">
                    <q-popup-proxy cover transition-show="scale" transition-hide="scale">
                      <q-color v-model="formData.dockColor" dark @update:model-value="updateOption('dockColor')" />
                    </q-popup-proxy>
                  </q-icon>
                </template>
              </q-input>
            </div>
          </div>
          <div class="form-row">
            <span class="form-label">框选颜色</span>
            <div class="row items-center no-wrap col">
              <q-input v-model="formData.dragColor" dark dense outlined class="col" @update:model-value="updateOption('dragColor')">
                <template #prepend>
                  <q-icon name="colorize" class="cursor-pointer">
                    <q-popup-proxy cover transition-show="scale" transition-hide="scale">
                      <q-color v-model="formData.dragColor" dark @update:model-value="updateOption('dragColor')" />
                    </q-popup-proxy>
                  </q-icon>
                </template>
              </q-input>
            </div>
          </div>
          <div class="form-row">
            <span class="form-label">动画颜色</span>
            <div class="row items-center no-wrap col">
              <q-input v-model="formData.animateColor" dark dense outlined class="col" @update:model-value="updateOption('animateColor')">
                <template #prepend>
                  <q-icon name="colorize" class="cursor-pointer">
                    <q-popup-proxy cover transition-show="scale" transition-hide="scale">
                      <q-color v-model="formData.animateColor" dark @update:model-value="updateOption('animateColor')" />
                    </q-popup-proxy>
                  </q-icon>
                </template>
              </q-input>
            </div>
          </div>
        </div>
      </q-expansion-item>

      <!-- 默认字体 -->
      <q-expansion-item dense dark label="默认字体" icon="text_fields" header-class="text-grey-5">
        <div class="q-pa-xs">
          <div class="form-row">
            <span class="form-label">文字颜色</span>
            <div class="row items-center no-wrap col">
              <q-input v-model="formData.textColor" dark dense outlined class="col" @update:model-value="updateOption('textColor')">
                <template #prepend>
                  <q-icon name="colorize" class="cursor-pointer">
                    <q-popup-proxy cover transition-show="scale" transition-hide="scale">
                      <q-color v-model="formData.textColor" dark @update:model-value="updateOption('textColor')" />
                    </q-popup-proxy>
                  </q-icon>
                </template>
              </q-input>
            </div>
          </div>
          <div class="form-row">
            <span class="form-label">字体</span>
            <q-input v-model="formData.fontFamily" dark dense outlined class="col" @update:model-value="updateOption('fontFamily')" />
          </div>
          <div class="row q-gutter-xs">
            <div class="col-6">
              <div class="form-row">
                <span class="form-label">字号</span>
                <q-input v-model.number="formData.fontSize" dark dense outlined type="number" :min="1" @update:model-value="updateOption('fontSize')" />
              </div>
            </div>
            <div class="col-6">
              <div class="form-row">
                <span class="form-label">行高</span>
                <q-input v-model.number="formData.lineHeight" dark dense outlined type="number" :min="0" :step="0.1" @update:model-value="updateOption('lineHeight')" />
              </div>
            </div>
          </div>
          <div class="form-row">
            <span class="form-label">水平对齐</span>
            <q-select
              v-model="formData.textAlign"
              dark
              dense
              outlined
              :options="textAlignOptions"
              emit-value
              map-options
              class="col"
              @update:model-value="updateOption('textAlign')"
            />
          </div>
          <div class="form-row">
            <span class="form-label">垂直对齐</span>
            <q-select
              v-model="formData.textBaseline"
              dark
              dense
              outlined
              :options="textBaselineOptions"
              emit-value
              map-options
              class="col"
              @update:model-value="updateOption('textBaseline')"
            />
          </div>
        </div>
      </q-expansion-item>

      <!-- 鼠标样式 -->
      <q-expansion-item dense dark label="鼠标样式" icon="mouse" header-class="text-grey-5">
        <div class="q-pa-xs">
          <div class="form-row">
            <span class="form-label">旋转光标</span>
            <q-input v-model="formData.rotateCursor" dark dense outlined class="col" placeholder="cursor URL" @update:model-value="updateOption('rotateCursor')" />
          </div>
          <div class="form-row">
            <span class="form-label">悬停光标</span>
            <q-select
              v-model="formData.hoverCursor"
              dark
              dense
              outlined
              :options="cursorOptions"
              emit-value
              map-options
              class="col"
              @update:model-value="updateOption('hoverCursor')"
            />
          </div>
        </div>
      </q-expansion-item>

      <!-- 默认连线 -->
      <q-expansion-item dense dark label="默认连线" icon="timeline" header-class="text-grey-5">
        <div class="q-pa-xs">
          <div class="form-row">
            <span class="form-label">连线类型</span>
            <q-select
              v-model="formData.drawingLineName"
              dark
              dense
              outlined
              :options="lineTypes"
              emit-value
              map-options
              class="col"
              @update:model-value="updateLineName"
            />
          </div>
          <div class="form-row">
            <span class="form-label">起点箭头</span>
            <q-select
              v-model="formData.fromArrow"
              dark
              dense
              outlined
              :options="arrowTypes"
              emit-value
              map-options
              class="col"
              @update:model-value="updateData('fromArrow')"
            />
          </div>
          <div class="form-row">
            <span class="form-label">终点箭头</span>
            <q-select
              v-model="formData.toArrow"
              dark
              dense
              outlined
              :options="arrowTypes"
              emit-value
              map-options
              class="col"
              @update:model-value="updateData('toArrow')"
            />
          </div>
        </div>
      </q-expansion-item>

      <!-- 禁止操作 -->
      <q-expansion-item dense dark label="禁止操作" icon="block" header-class="text-grey-5">
        <div class="q-pa-xs">
          <div class="row q-gutter-xs">
            <div class="col-6">
              <q-toggle v-model="formData.disableInput" dark dense label="禁止编辑" @update:model-value="updateOption('disableInput')" />
            </div>
            <div class="col-6">
              <q-toggle v-model="formData.disableRotate" dark dense label="禁止旋转" @update:model-value="updateOption('disableRotate')" />
            </div>
          </div>
          <div class="row q-gutter-xs">
            <div class="col-6">
              <q-toggle v-model="formData.disableAnchor" dark dense label="禁止锚点" @update:model-value="updateOption('disableAnchor')" />
            </div>
            <div class="col-6">
              <q-toggle v-model="formData.disableScale" dark dense label="禁止缩放" @update:model-value="updateOption('disableScale')" />
            </div>
          </div>
          <div class="row q-gutter-xs">
            <div class="col-6">
              <q-toggle v-model="formData.disableEmptyLine" dark dense label="禁空连线" @update:model-value="updateOption('disableEmptyLine')" />
            </div>
            <div class="col-6">
              <q-toggle v-model="formData.disableRepeatLine" dark dense label="禁重复线" @update:model-value="updateOption('disableRepeatLine')" />
            </div>
          </div>
          <div class="row q-gutter-xs">
            <div class="col-6">
              <q-toggle v-model="formData.disableDockLine" dark dense label="禁辅助线" @update:model-value="updateOption('disableDockLine')" />
            </div>
            <div class="col-6">
              <q-toggle v-model="formData.disableTranslate" dark dense label="禁止移动" @update:model-value="updateOption('disableTranslate')" />
            </div>
          </div>
        </div>
      </q-expansion-item>

      <!-- 画布设置 -->
      <q-expansion-item dense dark label="画布设置" icon="settings" header-class="text-grey-5">
        <div class="q-pa-xs">
          <div class="row q-gutter-xs">
            <div class="col-6">
              <div class="form-row">
                <span class="form-label">最小缩放</span>
                <q-input v-model.number="formData.minScale" dark dense outlined type="number" :min="0.01" :step="0.1" @update:model-value="updateOption('minScale')" />
              </div>
            </div>
            <div class="col-6">
              <div class="form-row">
                <span class="form-label">最大缩放</span>
                <q-input v-model.number="formData.maxScale" dark dense outlined type="number" :min="1" :step="1" @update:model-value="updateOption('maxScale')" />
              </div>
            </div>
          </div>
        </div>
      </q-expansion-item>

      <!-- 其他设置 -->
      <q-expansion-item dense dark label="其他设置" icon="tune" header-class="text-grey-5">
        <div class="q-pa-xs">
          <div class="row q-gutter-xs">
            <div class="col-6">
              <q-toggle v-model="formData.autoAnchor" dark dense label="自动锚点" @update:model-value="updateOption('autoAnchor')" />
            </div>
            <div class="col-6">
              <q-toggle v-model="formData.textRotate" dark dense label="文字旋转" @update:model-value="updateOption('textRotate')" />
            </div>
          </div>
          <div class="row q-gutter-xs">
            <div class="col-6">
              <q-toggle v-model="formData.textFlip" dark dense label="文字镜像" @update:model-value="updateOption('textFlip')" />
            </div>
          </div>
          <div class="row q-gutter-xs">
            <div class="col-6">
              <div class="form-row">
                <span class="form-label">绘画帧长</span>
                <q-input v-model.number="formData.interval" dark dense outlined type="number" :min="1" @update:model-value="updateOption('interval')" />
              </div>
            </div>
            <div class="col-6">
              <div class="form-row">
                <span class="form-label">动画帧长</span>
                <q-input v-model.number="formData.animateInterval" dark dense outlined type="number" :min="1" @update:model-value="updateOption('animateInterval')" />
              </div>
            </div>
          </div>
        </div>
      </q-expansion-item>
    </div>
  </q-scroll-area>
</template>

<script setup>
import { reactive, watch, onMounted } from "vue";
import { meta2dInstance } from "../composables/useMeta2dEditor.js";
import { globalDefaults, arrowTypes, lineTypes } from "../composables/useMeta2dConfig.js";

// ==================== 常量 ====================
const textAlignOptions = [
  { label: "左对齐", value: "left" },
  { label: "居中", value: "center" },
  { label: "右对齐", value: "right" },
];

const textBaselineOptions = [
  { label: "顶部", value: "top" },
  { label: "居中", value: "middle" },
  { label: "底部", value: "bottom" },
];

const cursorOptions = [
  { label: "默认", value: "default" },
  { label: "指针", value: "pointer" },
  { label: "移动", value: "move" },
  { label: "十字", value: "crosshair" },
];

// ==================== 表单数据 ====================
const formData = reactive({ ...globalDefaults });

// ==================== 方法 ====================
function syncFromMeta2d() {
  const m2d = meta2dInstance.value;
  if (!m2d) return;

  const options = m2d.store?.options || {};
  const data = m2d.store?.data || {};

  // 从 options 同步所有 option 类属性
  const optionKeys = [
    "color", "activeColor", "hoverColor", "hoverBackground",
    "anchorColor", "anchorRadius", "anchorBackground",
    "dockColor", "dragColor", "animateColor",
    "textColor", "fontFamily", "fontSize", "lineHeight", "textAlign", "textBaseline",
    "rotateCursor", "hoverCursor",
    "disableInput", "disableRotate", "disableAnchor", "disableEmptyLine",
    "disableRepeatLine", "disableScale", "disableDockLine", "disableTranslate",
    "minScale", "maxScale",
    "autoAnchor", "interval", "animateInterval", "textRotate", "textFlip",
    "drawingLineName",
  ];
  optionKeys.forEach((key) => {
    if (options[key] !== undefined) {
      formData[key] = options[key];
    }
  });

  // 从 data 同步
  ["fromArrow", "toArrow"].forEach((key) => {
    if (data[key] !== undefined) {
      formData[key] = data[key];
    }
  });
}

function updateOption(prop) {
  const m2d = meta2dInstance.value;
  if (!m2d) return;

  m2d.setOptions({ [prop]: formData[prop] });
  m2d.render();
}

function updateData(prop) {
  const m2d = meta2dInstance.value;
  if (!m2d) return;

  m2d.store.data[prop] = formData[prop];
}

function updateLineName() {
  const m2d = meta2dInstance.value;
  if (!m2d) return;

  m2d.store.options.drawingLineName = formData.drawingLineName;
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
