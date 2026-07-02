<template>
  <div class="in-parent-section">
    <!-- 顶部清除按钮（无大标题，标题由父级 SectionGroup 提供）-->
    <div v-if="styleData.sectionHasValue('inParent')" class="clear-row">
      <q-space />
      <q-btn
        flat dense dark round
        icon="close"
        size="xs"
        color="grey-6"
        @click="styleData.clearSection('inParent')"
      >
        <q-tooltip>清除"在父级中"设置</q-tooltip>
      </q-btn>
    </div>

    <div class="section-content">
      <!-- 弹性占比 -->
      <div class="q-mb-sm">
        <div class="control-label q-mb-xs">弹性占比</div>
        <div class="row q-gutter-xs flex-wrap">
          <q-btn
            v-for="opt in colSizeQuick" :key="opt.value"
            flat dense dark
            :label="opt.label"
            class="opt-btn"
            :color="styleData.getValue('colSize') === opt.value ? 'primary' : undefined"
            @click="styleData.toggleValue('colSize', opt.value)"
          />
          <q-select
            :model-value="colSizeNum"
            @update:model-value="v => styleData.setValue('colSize', v)"
            :options="colNumOptions"
            placeholder="列宽"
            dense dark borderless
            options-dense
            emit-value map-options
            clearable
            class="col-num-select"
            popup-content-class="bg-dark"
          />
        </div>
        <div class="hint-text q-mt-xs">我在父容器里占多大份（类似 Bootstrap col-N）</div>
      </div>

      <!-- 列偏移 -->
      <div class="q-mb-sm">
        <div class="control-label q-mb-xs">列偏移</div>
        <div class="row flex-wrap">
          <q-select
            :model-value="styleData.getValue('colOffset')"
            @update:model-value="v => styleData.setValue('colOffset', v)"
            :options="colOffsetOptions"
            placeholder="无偏移"
            dense dark borderless
            options-dense
            emit-value map-options
            clearable
            class="col-num-select"
            popup-content-class="bg-dark"
          />
        </div>
        <div class="hint-text q-mt-xs">我前面空出多少列（类似 Bootstrap offset-N）</div>
      </div>

      <!-- 可收缩 -->
      <div class="row q-gutter-sm q-mb-sm">
        <q-checkbox
          :model-value="styleData.getValue('colShrink') === 'col-shrink'"
          @update:model-value="() => styleData.toggleValue('colShrink', 'col-shrink')"
          label="可收缩"
          dense dark color="primary"
          class="flex-check"
        />
      </div>

      <!-- 自身对齐 + 顺序 -->
      <div class="row q-gutter-sm q-mb-sm">
        <div class="col">
          <div class="control-label q-mb-xs">自身对齐</div>
          <q-btn-group flat class="full-width">
            <q-btn
              v-for="opt in selfAlignOpts" :key="opt.value"
              flat dense dark no-caps
              :label="opt.label"
              class="flex-1"
              :color="styleData.getValue('selfAlign') === opt.value ? 'primary' : 'grey-7'"
              @click="styleData.toggleValue('selfAlign', opt.value)"
            />
          </q-btn-group>
        </div>
        <div class="col">
          <div class="control-label q-mb-xs">顺序</div>
          <q-btn-group flat class="full-width">
            <q-btn
              v-for="opt in orderOpts" :key="opt.value"
              flat dense dark no-caps
              :label="opt.label"
              class="flex-1"
              :color="styleData.getValue('order') === opt.value ? 'primary' : 'grey-7'"
              @click="styleData.toggleValue('order', opt.value)"
            />
          </q-btn-group>
        </div>
      </div>
      <div class="hint-text">"自身对齐"会覆盖父容器的对齐设置，只调整我自己</div>
    </div>
  </div>
</template>

<script setup>
import { computed, inject } from 'vue'

const styleData = inject('styleData')

const colSizeQuick = [
  { label: 'grow', value: 'col-grow' },
  { label: 'auto', value: 'col-auto' },
  { label: '等分', value: 'col' },
]

const colNumOptions = Array.from({ length: 12 }, (_, i) => ({
  label: `col-${i + 1}`,
  value: `col-${i + 1}`,
}))

const colOffsetOptions = Array.from({ length: 11 }, (_, i) => ({
  label: `offset-${i + 1}`,
  value: `offset-${i + 1}`,
}))

const colSizeNum = computed(() => {
  const val = styleData.getValue('colSize')
  return val?.startsWith('col-') && /^col-\d+$/.test(val) ? val : null
})

const selfAlignOpts = [
  { label: 'start', value: 'self-start' },
  { label: 'center', value: 'self-center' },
  { label: 'end', value: 'self-end' },
]

const orderOpts = [
  { label: '最前', value: 'order-first' },
  { label: '最后', value: 'order-last' },
]
</script>

<style scoped>
.in-parent-section {
  padding-bottom: 4px;
}

.clear-row {
  display: flex;
  align-items: center;
  padding: 0 8px;
  margin-top: -4px;
  margin-bottom: 4px;
}

.section-content {
  padding: 0 12px 8px;
}

.control-label {
  font-size: 0.8em;
  color: rgba(255, 255, 255, 0.7);
  user-select: none;
}

.hint-text {
  font-size: 0.68em;
  color: rgba(255, 255, 255, 0.4);
  line-height: 1.3;
  margin-top: 2px;
}

.opt-btn {
  min-width: 0;
  min-height: 24px;
  padding: 2px 8px;
  font-size: 0.74em;
  text-transform: none;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 3px;
}

.col-num-select {
  min-width: 72px;
  max-width: 80px;
}

:deep(.col-num-select .q-field__native) {
  font-size: 0.74em;
  color: rgba(255, 255, 255, 0.9);
  padding: 0 4px;
  min-height: 24px;
}

:deep(.col-num-select .q-field__control) {
  min-height: 24px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 3px;
}

.flex-check :deep(.q-checkbox__label) {
  font-size: 0.78em;
  color: rgba(255, 255, 255, 0.85);
}

:deep(.q-btn-group .q-btn) {
  font-size: 0.7em;
  min-height: 26px;
  padding: 2px 6px;
}
</style>
