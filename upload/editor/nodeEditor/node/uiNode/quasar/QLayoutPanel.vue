<template>
  <BasePropertyPanel v-model="nodeData" code-filename="qlayout.generated.js" class="qlayout-panel">
    <div class="q-pa-sm column q-gutter-y-sm">
      <q-input :model-value="viewString" label="View value" readonly dense dark outlined @click="copyViewString">
        <template #append>
          <q-icon name="mdi-content-copy" class="cursor-pointer" size="sm" @click.stop="copyViewString">
            <q-tooltip>Copy</q-tooltip>
          </q-icon>
        </template>
      </q-input>

      <div>
        <div class="text-caption q-mb-xs text-grey-6">Presets:</div>
        <div class="row q-gutter-xs">
          <q-btn
            v-for="preset in viewPresets"
            :key="preset"
            size="sm"
            dense
            outline
            :label="preset"
            :color="viewString === preset ? 'primary' : ''"
            @click="applyPreset(preset)"
          />
        </div>
      </div>

      <div class="view-grid">
        <div v-for="(row, rowIdx) in grid" :key="rowIdx" class="view-row">
          <div
            v-for="(cell, colIdx) in row"
            :key="colIdx"
            class="view-cell"
            :class="getCellColorClass(rowIdx, colIdx)"
          >
            <template v-if="cell.fixed">
              <span class="cell-label">{{ cell.opts[0] }}</span>
            </template>
            <template v-else>
              <span
                v-for="opt in cell.opts"
                :key="opt"
                class="cell-label clickable"
                :class="{ active: getCellValue(cell.idx) === opt }"
                @click="setCellValue(cell.idx, opt)"
              >
                {{ opt }}
              </span>
            </template>
          </div>
        </div>
      </div>

      <div v-if="!isRealLayoutChildren" class="layout-section column q-gutter-y-xs">
        <div v-for="item in layoutPartRows" :key="item.key" class="layout-part-row">
          <q-toggle
            v-model="layoutBuilder[item.key].enabled"
            :label="item.label"
            dense
            dark
            class="layout-part-main"
            @update:model-value="syncLayoutBuilder"
          />
          <q-toggle
            v-if="layoutBuilder[item.key].enabled"
            v-model="layoutBuilder[item.key].slot"
            label="slot"
            dense
            dark
            @update:model-value="syncLayoutBuilder"
          />
          <q-input
            v-if="layoutBuilder[item.key].enabled"
            v-model="layoutBuilder[item.key].input"
            label="input"
            dense
            dark
            outlined
            debounce="250"
            class="layout-part-input"
            :disable="!layoutBuilder[item.key].slot"
            @update:model-value="syncLayoutBuilder"
          />
        </div>

        <div class="layout-part-row">
          <q-toggle
            v-model="layoutBuilder.navigationTabs.enabled"
            label="I want navigation tabs"
            dense
            dark
            class="layout-part-main"
            :disable="!layoutBuilder.header.enabled"
            @update:model-value="syncLayoutBuilder"
          />
          <q-toggle
            v-if="layoutBuilder.header.enabled && layoutBuilder.navigationTabs.enabled"
            v-model="layoutBuilder.navigationTabs.slot"
            label="slot"
            dense
            dark
            @update:model-value="syncLayoutBuilder"
          />
          <q-input
            v-if="layoutBuilder.header.enabled && layoutBuilder.navigationTabs.enabled"
            v-model="layoutBuilder.navigationTabs.input"
            label="input"
            dense
            dark
            outlined
            debounce="250"
            class="layout-part-input"
            :disable="!layoutBuilder.navigationTabs.slot"
            @update:model-value="syncLayoutBuilder"
          />
        </div>
      </div>

      <div v-if="!isRealLayoutChildren" class="layout-section column q-gutter-y-sm">
        <div class="section-title">Header</div>
        <q-toggle v-model="layoutBuilder.header.reveal" label="Header Reveal" dense dark :disable="!layoutBuilder.header.enabled" @update:model-value="syncLayoutBuilder" />
        <q-select v-model="layoutBuilder.header.separator" :options="separatorOptions" label="Separator type" dense dark outlined emit-value map-options :disable="!layoutBuilder.header.enabled" @update:model-value="syncLayoutBuilder" />
      </div>

      <div v-if="!isRealLayoutChildren" class="layout-section column q-gutter-y-sm">
        <div class="section-title">Footer</div>
        <q-toggle v-model="layoutBuilder.footer.reveal" label="Footer Reveal" dense dark :disable="!layoutBuilder.footer.enabled" @update:model-value="syncLayoutBuilder" />
        <q-select v-model="layoutBuilder.footer.separator" :options="separatorOptions" label="Separator type" dense dark outlined emit-value map-options :disable="!layoutBuilder.footer.enabled" @update:model-value="syncLayoutBuilder" />
      </div>

      <div v-if="!isRealLayoutChildren" class="layout-section column q-gutter-y-sm">
        <div class="section-title">Left-side Drawer</div>
        <q-toggle v-model="layoutBuilder.leftDrawer.showIfAbove" label="Show if above" dense dark :disable="!layoutBuilder.leftDrawer.enabled" @update:model-value="syncLayoutBuilder" />
        <q-toggle v-model="layoutBuilder.leftDrawer.overlay" label="Overlay mode" dense dark :disable="!layoutBuilder.leftDrawer.enabled" @update:model-value="syncLayoutBuilder" />
        <q-select v-model="layoutBuilder.leftDrawer.behavior" :options="behaviorOptions" label="Behavior" dense dark outlined emit-value map-options :disable="!layoutBuilder.leftDrawer.enabled" @update:model-value="syncLayoutBuilder" />
        <q-select v-model="layoutBuilder.leftDrawer.separator" :options="separatorOptions" label="Separator type" dense dark outlined emit-value map-options :disable="!layoutBuilder.leftDrawer.enabled" @update:model-value="syncLayoutBuilder" />
      </div>

      <div v-if="!isRealLayoutChildren" class="layout-section column q-gutter-y-sm">
        <div class="section-title">Right-side Drawer</div>
        <q-toggle v-model="layoutBuilder.rightDrawer.showIfAbove" label="Show if above" dense dark :disable="!layoutBuilder.rightDrawer.enabled" @update:model-value="syncLayoutBuilder" />
        <q-toggle v-model="layoutBuilder.rightDrawer.overlay" label="Overlay mode" dense dark :disable="!layoutBuilder.rightDrawer.enabled" @update:model-value="syncLayoutBuilder" />
        <q-select v-model="layoutBuilder.rightDrawer.behavior" :options="behaviorOptions" label="Behavior" dense dark outlined emit-value map-options :disable="!layoutBuilder.rightDrawer.enabled" @update:model-value="syncLayoutBuilder" />
        <q-select v-model="layoutBuilder.rightDrawer.separator" :options="separatorOptions" label="Separator type" dense dark outlined emit-value map-options :disable="!layoutBuilder.rightDrawer.enabled" @update:model-value="syncLayoutBuilder" />
      </div>

      <div class="text-caption text-grey-6">
        <div class="q-mb-xs"><strong>Uppercase</strong>: overlaps adjacent areas</div>
        <div class="q-mb-xs"><strong>Lowercase</strong>: sits beside adjacent areas</div>
        <div class="q-mb-xs"><strong>Example</strong>: <code class="text-orange q-mx-xs">lHh lpr fff</code> = Header overlaps both sides</div>
        <div class="text-grey-7 q-mt-sm">Click letters in each area to switch layout mode</div>
      </div>
    </div>
  </BasePropertyPanel>
</template>

<script setup>
import { computed, onMounted } from 'vue'
import { useQuasar } from 'quasar'
import BasePropertyPanel from '../../../propertyPanel/BasePropertyPanel.vue'

const $q = useQuasar()
const nodeData = defineModel()

const defaultView = 'lHh Lpr lFf'
const viewPresets = ['lHh Lpr lFf', 'lHh lpr fff', 'hhh lpr fff']
const separatorOptions = [
  { label: 'None', value: 'none' },
  { label: 'Elevated', value: 'elevated' },
  { label: 'Bordered', value: 'bordered' },
]
const behaviorOptions = [
  { label: 'Behave Normal', value: 'default' },
  { label: 'Behave Desktop', value: 'desktop' },
  { label: 'Behave Mobile', value: 'mobile' },
]

const defaultLayoutBuilder = {
  header: { enabled: true, slot: true, input: '', reveal: false, separator: 'elevated' },
  footer: { enabled: true, slot: true, input: '', reveal: false, separator: 'elevated' },
  leftDrawer: { enabled: true, slot: true, input: '', overlay: false, showIfAbove: true, behavior: 'default', separator: 'bordered' },
  rightDrawer: { enabled: false, slot: true, input: '', overlay: false, showIfAbove: true, behavior: 'default', separator: 'bordered' },
  navigationTabs: { enabled: true, slot: true, input: '' },
}

const propNames = ['view']
const slotNames = ['default']
const layoutPartRows = [
  { key: 'header', label: 'QHeader' },
  { key: 'footer', label: 'QFooter' },
  { key: 'leftDrawer', label: 'left-side QDrawer' },
  { key: 'rightDrawer', label: 'right-side QDrawer' },
]
const layoutBuilderKeys = [...layoutPartRows.map(({ key }) => key), 'navigationTabs']
const grid = [
  [{ idx: 0, opts: ['h', 'l'] }, { idx: 1, opts: ['h', 'H'] }, { idx: 2, opts: ['h', 'r'] }],
  [{ idx: 4, opts: ['l', 'L'] }, { idx: 5, opts: ['p'], fixed: true }, { idx: 6, opts: ['r', 'R'] }],
  [{ idx: 8, opts: ['f', 'l'] }, { idx: 9, opts: ['f', 'F'] }, { idx: 10, opts: ['f', 'r'] }],
]

let pendingSync = false

const layoutBuilder = computed(() => {
  const node = nodeData.value
  if (!node) return cloneDefaultLayoutBuilder()
  ensureStructure(node)
  return node.properties.enhance.layoutBuilder
})

const isRealLayoutChildren = computed(() => !!nodeData.value?.properties?.enhance?.useRealLayoutChildren)

const viewString = computed({
  get: () => unwrapStringLiteral(nodeData.value?.properties?.props?.view?.value || JSON.stringify(defaultView)),
  set: (value) => {
    const node = nodeData.value
    if (!node) return
    ensureStructure(node)
    node.properties.props.view.value = JSON.stringify(normalizeViewString(value))
    syncLayoutBuilder()
  },
})

onMounted(() => {
  const node = nodeData.value
  if (!node) return
  ensureStructure(node)
  syncLayoutBuilder()
})

function cloneDefaultLayoutBuilder() {
  return JSON.parse(JSON.stringify(defaultLayoutBuilder))
}

function ensureStructure(node) {
  if (!node.properties) node.properties = {}
  if (!node.properties.props) node.properties.props = {}
  if (!node.properties.slots) node.properties.slots = {}
  if (!node.properties.enhance) node.properties.enhance = {}
  if (!node.properties.enhance.layoutBuilder) node.properties.enhance.layoutBuilder = cloneDefaultLayoutBuilder()
  if (!node.properties.props.view) {
    node.properties.props.view = { value: JSON.stringify(defaultView), data: '', disable: false, isSlot: false, outType: 'inputItem' }
  }

  Object.keys(node.properties.props).forEach((propName) => {
    if (!propNames.includes(propName)) delete node.properties.props[propName]
  })

  layoutBuilderKeys.forEach((key) => {
    const target = node.properties.enhance.layoutBuilder[key] || {}
    node.properties.enhance.layoutBuilder[key] = target
    Object.entries(defaultLayoutBuilder[key]).forEach(([field, defaultValue]) => {
      if (target[field] === undefined) target[field] = defaultValue
    })
    delete target.visible
    if (typeof target.input !== 'string') target.input = ''
  })

  if (!node.properties.enhance.layoutBuilder.header.enabled) {
    node.properties.enhance.layoutBuilder.navigationTabs.enabled = false
  }

  slotNames.forEach((slotName) => {
    if (node.properties.slots[slotName] === undefined) node.properties.slots[slotName] = false
  })
}

function unwrapStringLiteral(value) {
  const str = String(value || '')
  if ((str.startsWith('"') && str.endsWith('"')) || (str.startsWith("'") && str.endsWith("'"))) {
    return str.slice(1, -1)
  }
  return str
}

function normalizeViewString(value) {
  const compact = String(value || defaultView).replace(/\s/g, '')
  const chars = (compact + 'hhhlprfff').slice(0, 9).split('')
  return chars.slice(0, 3).join('') + ' ' + chars.slice(3, 6).join('') + ' ' + chars.slice(6, 9).join('')
}

function getCellValue(idx) {
  return viewString.value[idx] || ''
}

function setCellValue(idx, value) {
  const chars = viewString.value.split('')
  chars[idx] = value
  viewString.value = chars.join('')
}

function getCellColorClass(rowIdx, colIdx) {
  const cell = grid[rowIdx][colIdx]
  if (cell.fixed) return 'cell-page'
  const value = getCellValue(cell.idx)

  if (rowIdx === 0) return value === 'H' || value === 'h' ? 'cell-header' : 'cell-header-dim'
  if (rowIdx === 1) return value === 'L' || value === 'l' ? 'cell-drawer' : 'cell-drawer-dim'
  if (rowIdx === 2) return value === 'F' || value === 'f' ? 'cell-footer' : 'cell-footer-dim'
}

function syncLayoutBuilder() {
  const node = nodeData.value
  if (!node || pendingSync) return

  pendingSync = true
  requestAnimationFrame(() => {
    pendingSync = false
    ensureStructure(node)
    node.onExecute?.()
    node.graph?.setDirtyCanvas?.(true, true)
  })
}

function applyPreset(preset) {
  viewString.value = preset
}

function copyViewString() {
  navigator.clipboard.writeText(viewString.value)
  $q.notify({ message: 'Copied to clipboard', color: 'positive', position: 'top', timeout: 1000 })
}
</script>

<style scoped>
.layout-section {
  padding: 8px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 4px;
}

.section-title {
  color: rgba(255, 255, 255, 0.8);
  font-size: 12px;
  font-weight: 500;
}

.layout-part-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto minmax(96px, 140px);
  align-items: center;
  gap: 8px;
  min-height: 36px;
}

.layout-part-main {
  min-width: 0;
}

.layout-part-input {
  min-width: 0;
}

.view-grid {
  display: flex;
  flex-direction: column;
  gap: 2px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 4px;
  overflow: hidden;
}

.view-row {
  display: flex;
  gap: 2px;
}

.view-cell {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  min-height: 48px;
  padding: 8px;
  transition: all 0.2s;
}

.cell-label {
  font-size: 14px;
  font-weight: 600;
  user-select: none;
}

.cell-label.clickable {
  cursor: pointer;
  opacity: 0.5;
  transition: opacity 0.2s;
}

.cell-label.clickable:hover {
  opacity: 0.8;
}

.cell-label.clickable.active {
  opacity: 1;
  text-decoration: underline;
}

.cell-page {
  background: #2d4f2d;
}

.cell-header {
  background: #1976d2;
}

.cell-header-dim {
  background: rgba(25, 118, 210, 0.3);
}

.cell-drawer {
  background: #ff9800;
}

.cell-drawer-dim {
  background: rgba(255, 152, 0, 0.3);
}

.cell-footer {
  background: #616161;
}

.cell-footer-dim {
  background: rgba(97, 97, 97, 0.3);
}

code {
  padding: 2px 6px;
  border-radius: 3px;
  background: rgba(255, 255, 255, 0.1);
  font-family: 'Courier New', monospace;
  font-size: 12px;
}
</style>
