<template>
  <div class="spacing-section">
    <!-- Section header -->
    <div class="section-header row items-center no-wrap">
      <span class="section-label">间距</span>
      <q-space />
      <q-btn
        v-if="styleData.sectionHasValue('spacing')"
        flat dense dark round
        icon="close"
        @click="styleData.clearSection('spacing')"
      >
        <q-tooltip>清除间距</q-tooltip>
      </q-btn>
    </div>

    <div class="section-content">
      <!-- ===== Padding ===== -->
      <div class="sub-section q-mb-md">
        <div class="row items-center q-mb-xs">
          <span class="control-label">内边距</span>
        </div>

        <!-- Unified padding mode -->
        <div v-if="paddingLinked" class="row items-center no-wrap q-gutter-xs">
          <q-btn
            flat dense dark round
            icon="link"
            @click="switchPaddingMode(false)"
          >
            <q-tooltip>切换到四边分别设置</q-tooltip>
          </q-btn>
          <q-btn
            v-for="size in SPACING_SIZES" :key="'pa-' + size"
            flat dense dark
            :label="size"
            :color="getActiveSize('padding', 'q-pa') === size ? 'primary' : undefined"
            class="size-btn"
            @click="styleData.toggleValue('padding', 'q-pa-' + size)"
          />
        </div>

        <!-- Per-side padding mode -->
        <div v-else>
          <div class="row items-center no-wrap q-gutter-xs q-mb-xs">
            <q-btn
              flat dense dark round
              icon="link_off"
              @click="switchPaddingMode(true)"
            >
              <q-tooltip>切换到统一设置</q-tooltip>
            </q-btn>
            <span class="text-caption text-grey-6">四边分别设置</span>
          </div>
          <div v-for="dir in paddingDirs" :key="dir.key" class="row items-center no-wrap q-gutter-xs q-mb-xs q-ml-md">
            <q-icon :name="dir.icon"  class="dir-icon" />
            <q-btn
              v-for="size in SPACING_SIZES" :key="dir.key + size"
              flat dense dark
              :label="size"
              :color="getActiveSize(dir.key, dir.prefix) === size ? 'primary' : undefined"
              class="size-btn"
              @click="styleData.toggleValue(dir.key, dir.prefix + '-' + size)"
            />
          </div>
        </div>
      </div>

      <q-separator dark class="q-my-sm" />

      <!-- ===== Margin ===== -->
      <div class="sub-section q-mb-md">
        <div class="row items-center q-mb-xs">
          <span class="control-label">外边距</span>
        </div>

        <!-- Unified margin mode -->
        <div v-if="marginLinked" class="row items-center no-wrap q-gutter-xs">
          <q-btn
            flat dense dark round
            icon="link"
            @click="switchMarginMode(false)"
          >
            <q-tooltip>切换到四边分别设置</q-tooltip>
          </q-btn>
          <q-btn
            v-for="size in SPACING_SIZES" :key="'ma-' + size"
            flat dense dark
            :label="size"
            :color="getActiveSize('margin', 'q-ma') === size ? 'primary' : undefined"
            class="size-btn"
            @click="styleData.toggleValue('margin', 'q-ma-' + size)"
          />
        </div>

        <!-- Per-side margin mode -->
        <div v-else>
          <div class="row items-center no-wrap q-gutter-xs q-mb-xs">
            <q-btn
              flat dense dark round
              icon="link_off"
              @click="switchMarginMode(true)"
            >
              <q-tooltip>切换到统一设置</q-tooltip>
            </q-btn>
            <span class="text-caption text-grey-6">四边分别设置</span>
          </div>
          <div v-for="dir in marginDirs" :key="dir.key" class="row items-center no-wrap q-gutter-xs q-mb-xs q-ml-md">
            <q-icon :name="dir.icon"  class="dir-icon" />
            <q-btn
              v-for="size in SPACING_SIZES" :key="dir.key + size"
              flat dense dark
              :label="size"
              :color="getActiveSize(dir.key, dir.prefix) === size ? 'primary' : undefined"
              class="size-btn"
              @click="styleData.toggleValue(dir.key, dir.prefix + '-' + size)"
            />
          </div>
        </div>
      </div>

      <!-- Smart prompt: gutter overlap warning -->
      <q-banner
        v-if="styleData.isParentFlex.value && parentHasGutter"
        dense rounded dark
        class="q-mt-xs gutter-warning"
      >
        <template v-slot:avatar>
          <q-icon name="info" size="sm" color="amber" />
        </template>
        <span class="text-caption">外边距会与父级间隙叠加</span>
      </q-banner>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, inject } from 'vue'
import { SPACING_SIZES } from './useStyleData.js'

const styleData = inject('styleData')

const paddingLinked = ref(true)
const marginLinked = ref(true)

// Direction definitions for per-side mode
const paddingDirs = [
  { key: 'paddingTop', prefix: 'q-pt', icon: 'arrow_upward' },
  { key: 'paddingRight', prefix: 'q-pr', icon: 'arrow_forward' },
  { key: 'paddingBottom', prefix: 'q-pb', icon: 'arrow_downward' },
  { key: 'paddingLeft', prefix: 'q-pl', icon: 'arrow_back' },
]

const marginDirs = [
  { key: 'marginTop', prefix: 'q-mt', icon: 'arrow_upward' },
  { key: 'marginRight', prefix: 'q-mr', icon: 'arrow_forward' },
  { key: 'marginBottom', prefix: 'q-mb', icon: 'arrow_downward' },
  { key: 'marginLeft', prefix: 'q-ml', icon: 'arrow_back' },
]

// Parse active size from a class value like 'q-pa-md' -> 'md'
const sizeRegex = /q-[pm][atrlb]-(none|xs|sm|md|lg|xl)$/

function getActiveSize(key, prefix) {
  const val = styleData.getValue(key)
  if (!val) return null
  const match = val.match(sizeRegex)
  return match ? match[1] : null
}

// Check if parent has gutter set (gutter is on parent's styleClass)
const parentHasGutter = computed(() => {
  return !!styleData.parentStyleClass.value?.gutter
})

// Mode switching: padding
function switchPaddingMode(toLinked) {
  if (toLinked) {
    // Switching to unified: clear per-side values
    paddingDirs.forEach(d => styleData.setValue(d.key, undefined))
  } else {
    // Switching to per-side: clear unified value
    styleData.setValue('padding', undefined)
  }
  paddingLinked.value = toLinked
}

// Mode switching: margin
function switchMarginMode(toLinked) {
  if (toLinked) {
    // Switching to unified: clear per-side values
    marginDirs.forEach(d => styleData.setValue(d.key, undefined))
  } else {
    // Switching to per-side: clear unified value
    styleData.setValue('margin', undefined)
  }
  marginLinked.value = toLinked
}
</script>

<style scoped>
.spacing-section {
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.section-label {
  user-select: none;
}

.sub-section {
  padding: 4px 0;
}

.control-label {
  font-size: 0.8em;
  color: rgba(255, 255, 255, 0.7);
  user-select: none;
}

.dir-icon {
  width: 20px;
  color: rgba(255, 255, 255, 0.5);
  flex-shrink: 0;
}

.size-btn {
  min-width: 0;
  min-height: 24px;
  padding: 1px 5px;
  font-size: 0.72em;
  text-transform: none;
}

.size-btn :deep(.q-btn__content) {
  min-width: 24px;
}

.gutter-warning {
  background: rgba(255, 193, 7, 0.1);
  border: 1px solid rgba(255, 193, 7, 0.2);
}

.gutter-warning .text-caption {
  color: rgba(255, 255, 255, 0.75);
}
</style>
