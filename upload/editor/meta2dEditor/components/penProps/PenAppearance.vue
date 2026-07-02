<template>
  <q-scroll-area class="fit">
    <div class="q-pa-sm">
      <!-- 多选对齐工具栏 -->
      <div v-if="multi" class="q-mb-md">
        <div class="text-grey-5 text-caption q-mb-xs">对齐</div>
        <div class="row q-gutter-xs">
          <q-btn dark dense flat icon="align_horizontal_left" @click="align('left')">
            <q-tooltip>左对齐</q-tooltip>
          </q-btn>
          <q-btn dark dense flat icon="align_horizontal_center" @click="align('centerX')">
            <q-tooltip>水平居中</q-tooltip>
          </q-btn>
          <q-btn dark dense flat icon="align_horizontal_right" @click="align('right')">
            <q-tooltip>右对齐</q-tooltip>
          </q-btn>
          <q-btn dark dense flat icon="align_vertical_top" @click="align('top')">
            <q-tooltip>顶部对齐</q-tooltip>
          </q-btn>
          <q-btn dark dense flat icon="align_vertical_center" @click="align('centerY')">
            <q-tooltip>垂直居中</q-tooltip>
          </q-btn>
          <q-btn dark dense flat icon="align_vertical_bottom" @click="align('bottom')">
            <q-tooltip>底部对齐</q-tooltip>
          </q-btn>
        </div>
        <div class="row q-gutter-xs q-mt-xs">
          <q-btn dark dense flat icon="horizontal_distribute" @click="align('spaceX')">
            <q-tooltip>水平等距</q-tooltip>
          </q-btn>
          <q-btn dark dense flat icon="vertical_distribute" @click="align('spaceY')">
            <q-tooltip>垂直等距</q-tooltip>
          </q-btn>
          <q-btn dark dense flat icon="select_all" @click="align('same')">
            <q-tooltip>相同大小</q-tooltip>
          </q-btn>
        </div>
        <q-separator dark class="q-my-sm" />
      </div>

      <!-- 位置与大小 -->
      <q-expansion-item dense dark label="位置与大小" icon="aspect_ratio" default-opened header-class="text-grey-5">
        <div class="q-pa-xs">
          <div class="row q-gutter-xs">
            <div class="col-6">
              <div class="form-row">
                <span class="form-label">X</span>
                <q-input v-model.number="formData.x" dark dense outlined type="number" @update:model-value="updateProp('x')" />
              </div>
            </div>
            <div class="col-6">
              <div class="form-row">
                <span class="form-label">Y</span>
                <q-input v-model.number="formData.y" dark dense outlined type="number" @update:model-value="updateProp('y')" />
              </div>
            </div>
          </div>
          <div class="row q-gutter-xs">
            <div class="col-6">
              <div class="form-row">
                <span class="form-label">宽</span>
                <q-input v-model.number="formData.width" dark dense outlined type="number" :min="1" @update:model-value="updateProp('width')" />
              </div>
            </div>
            <div class="col-6">
              <div class="form-row">
                <span class="form-label">高</span>
                <q-input v-model.number="formData.height" dark dense outlined type="number" :min="1" @update:model-value="updateProp('height')" />
              </div>
            </div>
          </div>
          <div class="row q-gutter-xs">
            <div class="col-6">
              <div class="form-row">
                <span class="form-label">旋转</span>
                <q-input v-model.number="formData.rotate" dark dense outlined type="number" @update:model-value="updateProp('rotate')" />
              </div>
            </div>
            <div class="col-6">
              <div class="form-row">
                <span class="form-label">圆角</span>
                <q-input v-model.number="formData.borderRadius" dark dense outlined type="number" :min="0" @update:model-value="updateProp('borderRadius')" />
              </div>
            </div>
          </div>
          <!-- 内边距 -->
          <div class="text-grey-6 text-caption q-mt-sm q-mb-xs">内边距</div>
          <div class="row q-gutter-xs">
            <div class="col-6">
              <div class="form-row">
                <span class="form-label">上</span>
                <q-input v-model.number="formData.paddingTop" dark dense outlined type="number" :min="0" @update:model-value="updateProp('paddingTop')" />
              </div>
            </div>
            <div class="col-6">
              <div class="form-row">
                <span class="form-label">下</span>
                <q-input v-model.number="formData.paddingBottom" dark dense outlined type="number" :min="0" @update:model-value="updateProp('paddingBottom')" />
              </div>
            </div>
          </div>
          <div class="row q-gutter-xs">
            <div class="col-6">
              <div class="form-row">
                <span class="form-label">左</span>
                <q-input v-model.number="formData.paddingLeft" dark dense outlined type="number" :min="0" @update:model-value="updateProp('paddingLeft')" />
              </div>
            </div>
            <div class="col-6">
              <div class="form-row">
                <span class="form-label">右</span>
                <q-input v-model.number="formData.paddingRight" dark dense outlined type="number" :min="0" @update:model-value="updateProp('paddingRight')" />
              </div>
            </div>
          </div>
          <!-- 进度 -->
          <div class="row q-gutter-xs">
            <div class="col-6">
              <div class="form-row">
                <span class="form-label">进度</span>
                <q-input v-model.number="formData.progress" dark dense outlined type="number" :min="0" :max="1" :step="0.1" @update:model-value="updateProp('progress')" />
              </div>
            </div>
            <div class="col-6">
              <div class="form-row">
                <span class="form-label">状态</span>
                <q-input v-model.number="formData.showChild" dark dense outlined type="number" :min="0" @update:model-value="updateProp('showChild')" />
              </div>
            </div>
          </div>
          <!-- 开关 -->
          <div class="row q-gutter-xs items-center">
            <div class="col">
              <q-toggle v-model="formData.ratio" dark dense label="锁定比例" @update:model-value="updateProp('ratio')" />
            </div>
            <div class="col">
              <q-toggle v-model="formData.verticalProgress" dark dense label="垂直进度" @update:model-value="updateProp('verticalProgress')" />
            </div>
          </div>
          <div class="row q-gutter-xs items-center">
            <div class="col">
              <q-toggle v-model="formData.flipX" dark dense label="水平翻转" @update:model-value="updateProp('flipX')" />
            </div>
            <div class="col">
              <q-toggle v-model="formData.flipY" dark dense label="垂直翻转" @update:model-value="updateProp('flipY')" />
            </div>
          </div>
        </div>
      </q-expansion-item>

      <!-- 样式 -->
      <q-expansion-item dense dark label="样式" icon="palette" header-class="text-grey-5">
        <div class="q-pa-xs">
          <div class="form-row">
            <span class="form-label">线条颜色</span>
            <div class="row items-center no-wrap col">
              <q-input v-model="formData.color" dark dense outlined class="col" @update:model-value="updateProp('color')">
                <template #prepend>
                  <q-icon name="colorize" class="cursor-pointer">
                    <q-popup-proxy cover transition-show="scale" transition-hide="scale">
                      <q-color v-model="formData.color" dark @update:model-value="updateProp('color')" />
                    </q-popup-proxy>
                  </q-icon>
                </template>
              </q-input>
            </div>
          </div>
          <div class="form-row">
            <span class="form-label">背景颜色</span>
            <div class="row items-center no-wrap col">
              <q-input v-model="formData.background" dark dense outlined class="col" @update:model-value="updateProp('background')">
                <template #prepend>
                  <q-icon name="colorize" class="cursor-pointer">
                    <q-popup-proxy cover transition-show="scale" transition-hide="scale">
                      <q-color v-model="formData.background" dark @update:model-value="updateProp('background')" />
                    </q-popup-proxy>
                  </q-icon>
                </template>
              </q-input>
            </div>
          </div>
          <div class="form-row">
            <span class="form-label">线宽</span>
            <q-input v-model.number="formData.lineWidth" dark dense outlined type="number" :min="0" class="col" @update:model-value="updateProp('lineWidth')" />
          </div>
          <div class="form-row">
            <span class="form-label">虚线</span>
            <q-select v-model="formData.dash" dark dense outlined emit-value map-options :options="dashOptions" class="col" @update:model-value="updateProp('dash')" />
          </div>
          <div class="form-row">
            <span class="form-label">连接样式</span>
            <q-select v-model="formData.lineJoin" dark dense outlined emit-value map-options :options="lineJoinOptions" class="col" @update:model-value="updateProp('lineJoin')" />
          </div>
          <div class="form-row">
            <span class="form-label">末端样式</span>
            <q-select v-model="formData.lineCap" dark dense outlined emit-value map-options :options="lineCapOptions" class="col" @update:model-value="updateProp('lineCap')" />
          </div>
          <div class="form-row">
            <span class="form-label">透明度</span>
            <q-slider v-model="formData.globalAlpha" dark dense :min="0" :max="1" :step="0.1" class="col" @update:model-value="updateProp('globalAlpha')" />
          </div>
          <!-- 锚点 -->
          <div class="text-grey-6 text-caption q-mt-sm q-mb-xs">锚点</div>
          <div class="form-row">
            <span class="form-label">锚点颜色</span>
            <div class="row items-center no-wrap col">
              <q-input v-model="formData.anchorColor" dark dense outlined class="col" @update:model-value="updateProp('anchorColor')">
                <template #prepend>
                  <q-icon name="colorize" class="cursor-pointer">
                    <q-popup-proxy cover transition-show="scale" transition-hide="scale">
                      <q-color v-model="formData.anchorColor" dark @update:model-value="updateProp('anchorColor')" />
                    </q-popup-proxy>
                  </q-icon>
                </template>
              </q-input>
            </div>
          </div>
          <div class="form-row">
            <span class="form-label">锚点半径</span>
            <q-input v-model.number="formData.anchorRadius" dark dense outlined type="number" :min="0" :max="20" class="col" @update:model-value="updateProp('anchorRadius')" />
          </div>
        </div>
      </q-expansion-item>

      <!-- Hover/Active 样式 -->
      <q-expansion-item dense dark label="交互样式" icon="touch_app" header-class="text-grey-5">
        <div class="q-pa-xs">
          <div class="text-grey-6 text-caption q-mb-xs">悬停状态</div>
          <div class="form-row">
            <span class="form-label">线条颜色</span>
            <div class="row items-center no-wrap col">
              <q-input v-model="formData.hoverColor" dark dense outlined class="col" @update:model-value="updateProp('hoverColor')">
                <template #prepend>
                  <q-icon name="colorize" class="cursor-pointer">
                    <q-popup-proxy cover transition-show="scale" transition-hide="scale">
                      <q-color v-model="formData.hoverColor" dark @update:model-value="updateProp('hoverColor')" />
                    </q-popup-proxy>
                  </q-icon>
                </template>
              </q-input>
            </div>
          </div>
          <div class="form-row">
            <span class="form-label">背景颜色</span>
            <div class="row items-center no-wrap col">
              <q-input v-model="formData.hoverBackground" dark dense outlined class="col" @update:model-value="updateProp('hoverBackground')">
                <template #prepend>
                  <q-icon name="colorize" class="cursor-pointer">
                    <q-popup-proxy cover transition-show="scale" transition-hide="scale">
                      <q-color v-model="formData.hoverBackground" dark @update:model-value="updateProp('hoverBackground')" />
                    </q-popup-proxy>
                  </q-icon>
                </template>
              </q-input>
            </div>
          </div>
          <div class="form-row">
            <span class="form-label">文字颜色</span>
            <div class="row items-center no-wrap col">
              <q-input v-model="formData.hoverTextColor" dark dense outlined class="col" @update:model-value="updateProp('hoverTextColor')">
                <template #prepend>
                  <q-icon name="colorize" class="cursor-pointer">
                    <q-popup-proxy cover transition-show="scale" transition-hide="scale">
                      <q-color v-model="formData.hoverTextColor" dark @update:model-value="updateProp('hoverTextColor')" />
                    </q-popup-proxy>
                  </q-icon>
                </template>
              </q-input>
            </div>
          </div>
          <div class="text-grey-6 text-caption q-mt-sm q-mb-xs">选中状态</div>
          <div class="form-row">
            <span class="form-label">线条颜色</span>
            <div class="row items-center no-wrap col">
              <q-input v-model="formData.activeColor" dark dense outlined class="col" @update:model-value="updateProp('activeColor')">
                <template #prepend>
                  <q-icon name="colorize" class="cursor-pointer">
                    <q-popup-proxy cover transition-show="scale" transition-hide="scale">
                      <q-color v-model="formData.activeColor" dark @update:model-value="updateProp('activeColor')" />
                    </q-popup-proxy>
                  </q-icon>
                </template>
              </q-input>
            </div>
          </div>
          <div class="form-row">
            <span class="form-label">背景颜色</span>
            <div class="row items-center no-wrap col">
              <q-input v-model="formData.activeBackground" dark dense outlined class="col" @update:model-value="updateProp('activeBackground')">
                <template #prepend>
                  <q-icon name="colorize" class="cursor-pointer">
                    <q-popup-proxy cover transition-show="scale" transition-hide="scale">
                      <q-color v-model="formData.activeBackground" dark @update:model-value="updateProp('activeBackground')" />
                    </q-popup-proxy>
                  </q-icon>
                </template>
              </q-input>
            </div>
          </div>
          <div class="form-row">
            <span class="form-label">文字颜色</span>
            <div class="row items-center no-wrap col">
              <q-input v-model="formData.activeTextColor" dark dense outlined class="col" @update:model-value="updateProp('activeTextColor')">
                <template #prepend>
                  <q-icon name="colorize" class="cursor-pointer">
                    <q-popup-proxy cover transition-show="scale" transition-hide="scale">
                      <q-color v-model="formData.activeTextColor" dark @update:model-value="updateProp('activeTextColor')" />
                    </q-popup-proxy>
                  </q-icon>
                </template>
              </q-input>
            </div>
          </div>
        </div>
      </q-expansion-item>

      <!-- 文字 -->
      <q-expansion-item dense dark label="文字" icon="text_fields" header-class="text-grey-5">
        <div class="q-pa-xs">
          <div class="form-row form-row-full">
            <span class="form-label">文本内容</span>
            <q-input v-model="formData.text" dark dense outlined type="textarea" rows="2" class="full-width q-mt-xs" @update:model-value="updateProp('text')" />
          </div>
          <div class="form-row">
            <span class="form-label">字体</span>
            <q-input v-model="formData.fontFamily" dark dense outlined class="col" @update:model-value="updateProp('fontFamily')" />
          </div>
          <div class="row q-gutter-xs">
            <div class="col-6">
              <div class="form-row">
                <span class="form-label">字号</span>
                <q-input v-model.number="formData.fontSize" dark dense outlined type="number" :min="1" @update:model-value="updateProp('fontSize')" />
              </div>
            </div>
            <div class="col-6">
              <div class="form-row">
                <span class="form-label">行高</span>
                <q-input v-model.number="formData.lineHeight" dark dense outlined type="number" :min="0" :step="0.1" @update:model-value="updateProp('lineHeight')" />
              </div>
            </div>
          </div>
          <div class="form-row">
            <span class="form-label">文字颜色</span>
            <div class="row items-center no-wrap col">
              <q-input v-model="formData.textColor" dark dense outlined class="col" @update:model-value="updateProp('textColor')">
                <template #prepend>
                  <q-icon name="colorize" class="cursor-pointer">
                    <q-popup-proxy cover transition-show="scale" transition-hide="scale">
                      <q-color v-model="formData.textColor" dark @update:model-value="updateProp('textColor')" />
                    </q-popup-proxy>
                  </q-icon>
                </template>
              </q-input>
            </div>
          </div>
          <div class="form-row">
            <span class="form-label">文字背景</span>
            <div class="row items-center no-wrap col">
              <q-input v-model="formData.textBackground" dark dense outlined class="col" @update:model-value="updateProp('textBackground')">
                <template #prepend>
                  <q-icon name="colorize" class="cursor-pointer">
                    <q-popup-proxy cover transition-show="scale" transition-hide="scale">
                      <q-color v-model="formData.textBackground" dark @update:model-value="updateProp('textBackground')" />
                    </q-popup-proxy>
                  </q-icon>
                </template>
              </q-input>
            </div>
          </div>
          <div class="form-row">
            <span class="form-label">水平对齐</span>
            <q-btn-toggle v-model="formData.textAlign" dark dense flat spread :options="textAlignOptions" class="col" @update:model-value="updateProp('textAlign')" />
          </div>
          <div class="form-row">
            <span class="form-label">垂直对齐</span>
            <q-btn-toggle v-model="formData.textBaseline" dark dense flat spread :options="textBaselineOptions" class="col" @update:model-value="updateProp('textBaseline')" />
          </div>
          <div class="form-row">
            <span class="form-label">换行</span>
            <q-select v-model="formData.whiteSpace" dark dense outlined emit-value map-options :options="whiteSpaceOptions" class="col" @update:model-value="updateProp('whiteSpace')" />
          </div>
          <!-- 文字位置偏移 -->
          <div class="text-grey-6 text-caption q-mt-sm q-mb-xs">文字偏移</div>
          <div class="row q-gutter-xs">
            <div class="col-4">
              <div class="form-row">
                <span class="form-label">宽度</span>
                <q-input v-model.number="formData.textWidth" dark dense outlined type="number" :min="0" @update:model-value="updateProp('textWidth')" />
              </div>
            </div>
            <div class="col-4">
              <div class="form-row">
                <span class="form-label">左偏移</span>
                <q-input v-model.number="formData.textLeft" dark dense outlined type="number" @update:model-value="updateProp('textLeft')" />
              </div>
            </div>
            <div class="col-4">
              <div class="form-row">
                <span class="form-label">上偏移</span>
                <q-input v-model.number="formData.textTop" dark dense outlined type="number" @update:model-value="updateProp('textTop')" />
              </div>
            </div>
          </div>
          <div class="row q-gutter-xs items-center">
            <div class="col">
              <q-toggle v-model="formData.ellipsis" dark dense label="省略号" @update:model-value="updateProp('ellipsis')" />
            </div>
            <div class="col">
              <q-toggle v-model="formData.hiddenText" dark dense label="隐藏文字" @update:model-value="updateProp('hiddenText')" />
            </div>
          </div>
        </div>
      </q-expansion-item>

      <!-- 阴影 -->
      <q-expansion-item dense dark label="阴影" icon="blur_on" header-class="text-grey-5">
        <div class="q-pa-xs">
          <div class="form-row">
            <span class="form-label">阴影颜色</span>
            <div class="row items-center no-wrap col">
              <q-input v-model="formData.shadowColor" dark dense outlined class="col" @update:model-value="updateProp('shadowColor')">
                <template #prepend>
                  <q-icon name="colorize" class="cursor-pointer">
                    <q-popup-proxy cover transition-show="scale" transition-hide="scale">
                      <q-color v-model="formData.shadowColor" dark @update:model-value="updateProp('shadowColor')" />
                    </q-popup-proxy>
                  </q-icon>
                </template>
              </q-input>
            </div>
          </div>
          <div class="form-row">
            <span class="form-label">模糊半径</span>
            <q-input v-model.number="formData.shadowBlur" dark dense outlined type="number" :min="0" class="col" @update:model-value="updateProp('shadowBlur')" />
          </div>
          <div class="row q-gutter-xs">
            <div class="col-6">
              <div class="form-row">
                <span class="form-label">X偏移</span>
                <q-input v-model.number="formData.shadowOffsetX" dark dense outlined type="number" @update:model-value="updateProp('shadowOffsetX')" />
              </div>
            </div>
            <div class="col-6">
              <div class="form-row">
                <span class="form-label">Y偏移</span>
                <q-input v-model.number="formData.shadowOffsetY" dark dense outlined type="number" @update:model-value="updateProp('shadowOffsetY')" />
              </div>
            </div>
          </div>
          <q-toggle v-model="formData.textHasShadow" dark dense label="文字阴影" @update:model-value="updateProp('textHasShadow')" />
        </div>
      </q-expansion-item>

      <!-- 禁止 -->
      <q-expansion-item dense dark label="禁止操作" icon="block" header-class="text-grey-5">
        <div class="q-pa-xs">
          <div class="row q-gutter-xs">
            <div class="col-6">
              <q-toggle v-model="formData.disableInput" dark dense label="禁止编辑" @update:model-value="updateProp('disableInput')" />
            </div>
            <div class="col-6">
              <q-toggle v-model="formData.disableRotate" dark dense label="禁止旋转" @update:model-value="updateProp('disableRotate')" />
            </div>
          </div>
          <div class="row q-gutter-xs">
            <div class="col-6">
              <q-toggle v-model="formData.disableSize" dark dense label="禁止缩放" @update:model-value="updateProp('disableSize')" />
            </div>
            <div class="col-6">
              <q-toggle v-model="formData.disableAnchor" dark dense label="禁止锚点" @update:model-value="updateProp('disableAnchor')" />
            </div>
          </div>
        </div>
      </q-expansion-item>
    </div>
  </q-scroll-area>
</template>

<script setup>
import { reactive, watch } from "vue";
import { meta2dInstance, activePen, activePens } from "../../composables/useMeta2dEditor.js";
import { appearanceDefaults, lineJoinOptions, lineCapOptions, whiteSpaceOptions } from "../../composables/useMeta2dConfig.js";

const props = defineProps({
  multi: {
    type: Boolean,
    default: false,
  },
});

// ==================== 常量 ====================
const dashOptions = [
  { label: "实线", value: 0 },
  { label: "虚线 1", value: 1 },
  { label: "虚线 2", value: 2 },
  { label: "虚线 3", value: 3 },
  { label: "虚线 4", value: 4 },
];

const textAlignOptions = [
  { label: "左", value: "left" },
  { label: "中", value: "center" },
  { label: "右", value: "right" },
];

const textBaselineOptions = [
  { label: "上", value: "top" },
  { label: "中", value: "middle" },
  { label: "下", value: "bottom" },
];

// ==================== 表单数据 ====================
const formData = reactive({ ...appearanceDefaults });

// ==================== 方法 ====================
function mergeProps(pen) {
  if (!pen) return;
  Object.keys(formData).forEach((key) => {
    if (pen[key] !== undefined) {
      formData[key] = pen[key];
    } else {
      formData[key] = appearanceDefaults[key];
    }
  });
}

function updateProp(prop) {
  const m2d = meta2dInstance.value;
  const pen = activePen.value;
  if (!m2d || !pen) return;

  m2d.setValue({
    id: pen.id,
    [prop]: formData[prop],
  });
  m2d.render();
}

function align(type) {
  const m2d = meta2dInstance.value;
  const pens = activePens.value;
  if (!m2d || pens.length < 2) return;

  m2d.alignNodes(type, pens);
  m2d.render();
}

// ==================== Watch ====================
watch(activePen, (pen) => {
  if (pen) {
    mergeProps(pen);
  }
}, { immediate: true });

// 监听图元属性变化
watch(
  () => meta2dInstance.value,
  (m2d) => {
    if (m2d) {
      m2d.on("editPen", () => {
        if (activePen.value) {
          mergeProps(activePen.value);
        }
      });
    }
  },
  { immediate: true }
);
</script>

<style scoped>
.form-row {
  display: flex;
  align-items: center;
  margin-bottom: 8px;
}

.form-row-full {
  flex-direction: column;
  align-items: flex-start;
}

.form-label {
  width: 60px;
  flex-shrink: 0;
  font-size: 12px;
  color: #999;
}
</style>
