<template>
  <div class="style-summary">
    <!-- Section Header -->
    <div class="section-header row items-center justify-between">
      <span>汇总 ({{ styleData.allClasses.value.length }})</span>
    </div>

    <div class="q-px-sm q-pb-sm">
      <!-- Class Chips -->
      <div class="chips-container q-mb-sm">
        <template v-if="styleData.allClasses.value.length > 0">
          <q-chip
            v-for="cls in styleData.allClasses.value"
            :key="cls"
            dense
            removable
            dark
            outline
            size="xs"
            color="grey-6"
            @remove="styleData.removeClass(cls)"
          >
            <span class="text-caption">{{ cls }}</span>
          </q-chip>
        </template>
        <div v-else class="text-caption text-grey-6 q-pa-sm">
          暂无样式类
        </div>
      </div>

      <!-- Action Buttons -->
      <div class="row q-gutter-sm">
        <q-btn
          flat dense dark
          icon="content_copy"
          label="复制"
          size="sm"
          color="grey-5"
          no-caps
          @click="copyClasses"
        />
        <q-btn
          flat dense dark
          icon="restart_alt"
          label="重置全部"
          size="sm"
          color="negative"
          no-caps
        >
          <q-popup-proxy dark>
            <q-banner dense dark class="bg-dark">
              <template #avatar>
                <q-icon name="warning" color="amber" size="sm" />
              </template>
              确定重置所有样式？
              <template #action>
                <q-btn
                  flat dense dark
                  label="确定"
                  color="negative"
                  size="sm"
                  no-caps
                  v-close-popup
                  @click="styleData.resetAll()"
                />
                <q-btn
                  flat dense dark
                  label="取消"
                  size="sm"
                  no-caps
                  v-close-popup
                />
              </template>
            </q-banner>
          </q-popup-proxy>
        </q-btn>
        <q-btn
          flat dense dark
          icon="code"
          label="CSS编辑器"
          size="sm"
          color="grey-5"
          no-caps
          @click="$emit('open-css-editor')"
        />
      </div>
    </div>
  </div>
</template>

<script setup>
import { inject } from 'vue'
import { useQuasar } from 'quasar'

defineEmits(['open-css-editor'])

const $q = useQuasar()
const styleData = inject('styleData')

const copyClasses = async () => {
  const text = styleData.allClasses.value.join(' ')
  if (!text) {
    $q.notify({ type: 'warning', message: '暂无样式类可复制', timeout: 1500 })
    return
  }
  try {
    await navigator.clipboard.writeText(text)
    $q.notify({ type: 'positive', message: '已复制到剪贴板', timeout: 1500 })
  } catch {
    $q.notify({ type: 'negative', message: '复制失败', timeout: 1500 })
  }
}
</script>

<style scoped>
.style-summary {
  background: rgba(255, 255, 255, 0.04);
  border-top: 2px solid rgba(255, 255, 255, 0.12);
}

.section-header {
  font-size: 0.85em;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.9);
  padding: 8px 12px;
  background: rgba(255, 255, 255, 0.02);
}

.chips-container {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  min-height: 32px;
  max-height: 80px;
  overflow-y: auto;
}
</style>
