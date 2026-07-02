<template>
  <div class="behavior-section">
    <!-- 顶部清除按钮（无大标题，由父级 SectionGroup 提供） -->
    <div v-if="styleData.sectionHasValue('behavior')" class="clear-row">
      <q-space />
      <q-btn
        flat dense dark round
        icon="close"
        size="xs"
        color="grey-6"
        @click="styleData.clearSection('behavior')"
      >
        <q-tooltip>清除其他设置</q-tooltip>
      </q-btn>
    </div>

    <div class="section-content">
      <!-- 可见性 toggles -->
      <div class="q-mb-md">
        <div class="text-caption label-text q-mb-xs">可见性</div>
        <div class="row q-gutter-sm wrap">
          <q-checkbox
            v-for="opt in visibilityOptions"
            :key="opt.value"
            :model-value="(styleData.getValue('visibility') || []).includes(opt.value)"
            @update:model-value="styleData.toggleArrayValue('visibility', opt.value)"
            :label="opt.label"
            dense dark
            size="sm"
          />
        </div>
      </div>

      <q-separator dark class="q-my-sm" />

      <!-- 边框 toggles -->
      <div class="q-mb-md">
        <div class="text-caption label-text q-mb-xs">边框</div>
        <div class="row q-gutter-sm wrap">
          <q-checkbox
            v-for="opt in borderOptions"
            :key="opt.value"
            :model-value="(styleData.getValue('borderStyles') || []).includes(opt.value)"
            @update:model-value="styleData.toggleArrayValue('borderStyles', opt.value)"
            :label="opt.label"
            dense dark
            size="sm"
          />
        </div>
      </div>

      <q-separator dark class="q-my-sm" />

      <!-- 滚动 Scroll -->
      <div class="q-mb-md">
        <div class="text-caption label-text q-mb-xs">滚动</div>

        <!-- 全部 -->
        <div class="row items-center q-mb-xs">
          <span class="text-caption scroll-label">全部</span>
          <q-btn-toggle
            :model-value="styleData.getValue('scrollAll')"
            @update:model-value="val => styleData.setValue('scrollAll', val || undefined)"
            clearable
            no-caps
            spread
            toggle-color="primary"
            flat
            dense
            dark
            :options="scrollAllOptions"
            class="col compact-toggle"
          />
        </div>

        <!-- 纵向溢出隐藏 & 隐藏滚动条 -->
        <div class="row q-gutter-sm wrap">
          <q-checkbox
            :model-value="styleData.getValue('scrollY') === 'overflow-hidden-y'"
            @update:model-value="styleData.toggleValue('scrollY', 'overflow-hidden-y')"
            label="纵向溢出隐藏"
            dense dark
            size="sm"
          />
          <q-checkbox
            :model-value="styleData.getValue('hideScrollbar') === 'hide-scrollbar'"
            @update:model-value="styleData.toggleValue('hideScrollbar', 'hide-scrollbar')"
            label="隐藏滚动条"
            dense dark
            size="sm"
          />
        </div>
      </div>

      <q-separator dark class="q-my-sm" />

      <!-- 鼠标 Mouse -->
      <div class="q-mb-md">
        <div class="text-caption label-text q-mb-xs">鼠标</div>
        <q-btn-toggle
          :model-value="styleData.getValue('mouseStyles')"
          @update:model-value="val => styleData.setValue('mouseStyles', val || undefined)"
          clearable
          no-caps
          spread
          toggle-color="primary"
          flat
          dense
          dark
          :options="mouseOptions"
          class="compact-toggle"
        />
      </div>

      <q-separator dark class="q-my-sm" />

      <!-- 变换 Transform -->
      <div>
        <div class="text-caption label-text q-mb-xs">变换</div>

        <!-- Rotation -->
        <div class="q-mb-xs">
          <q-btn-group flat spread class="full-width">
            <q-btn
              v-for="opt in rotationOptions"
              :key="opt.value"
              flat dense dark
              :label="opt.label"
              size="sm"
              :color="styleData.getValue('transform') === opt.value ? 'primary' : 'grey-5'"
              @click="styleData.toggleValue('transform', opt.value)"
            />
          </q-btn-group>
        </div>

        <!-- Flip -->
        <q-btn-group flat spread class="full-width">
          <q-btn
            v-for="opt in flipOptions"
            :key="opt.value"
            flat dense dark
            :label="opt.label"
            size="sm"
            :color="styleData.getValue('transform') === opt.value ? 'primary' : 'grey-5'"
            @click="styleData.toggleValue('transform', opt.value)"
          />
        </q-btn-group>
      </div>
    </div>
  </div>
</template>

<script setup>
import { inject } from 'vue'

const styleData = inject('styleData')

// === Visibility ===
const visibilityOptions = [
  { label: '隐藏', value: 'hidden' },
  { label: '禁用', value: 'disabled' },
  { label: '透明', value: 'transparent' },
]

// === Border ===
const borderOptions = [
  { label: '圆角', value: 'rounded-borders' },
  { label: '移除边框', value: 'no-border' },
  { label: '移除阴影', value: 'no-box-shadow' },
]

// === Scroll All ===
const scrollAllOptions = [
  { label: '可见', value: undefined },
  { label: '隐藏', value: 'overflow-hidden' },
  { label: '滚动', value: 'scroll' },
  { label: '自动', value: 'overflow-auto' },
]

// === Mouse ===
const mouseOptions = [
  { label: '默认', value: undefined },
  { label: '指针', value: 'cursor-pointer' },
  { label: '禁用', value: 'cursor-not-allowed' },
  { label: '隐藏', value: 'cursor-none' },
]

// === Transform: Rotation ===
const rotationOptions = [
  { label: '45°', value: 'rotate-45' },
  { label: '90°', value: 'rotate-90' },
  { label: '180°', value: 'rotate-180' },
  { label: '270°', value: 'rotate-270' },
]

// === Transform: Flip ===
const flipOptions = [
  { label: '水平翻转', value: 'flip-horizontal' },
  { label: '垂直翻转', value: 'flip-vertical' },
]
</script>

<style scoped>
.behavior-section {
  padding-bottom: 4px;
}

.clear-row {
  display: flex;
  align-items: center;
  padding: 0 8px;
  margin-top: -2px;
}

.label-text {
  color: rgba(255, 255, 255, 0.55);
  font-size: 0.75em;
}

.scroll-label {
  width: 36px;
  min-width: 36px;
  color: rgba(255, 255, 255, 0.6);
  font-size: 0.75em;
}

/* Compact toggle buttons */
.compact-toggle {
  width: 100%;
}

.compact-toggle :deep(.q-btn) {
  font-size: 0.68em;
  padding: 2px 3px;
  min-height: 24px;
}
</style>
