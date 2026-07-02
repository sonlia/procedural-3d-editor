<template>
  <div class="style-panel">
    <!-- 可滚动内容区 -->
    <div class="sections-scroll">
      <!-- 区 A: 子项布局 -->
      <section class="section-group section-group--container">
        <div class="section-group__head">
          <div class="section-group__title">子项布局</div>
        </div>
        <div class="section-group__body">
          <ContainerSection />
        </div>
      </section>

      <!-- 区 B: 在父级中（仅父级是 flex/grid 时显示） -->
      <section v-if="styleData.isParentFlex.value" class="section-group section-group--in-parent">
        <div class="section-group__head">
          <div class="section-group__title">🔗 在父级中</div>
          <div class="section-group__hint">父容器是弹性/网格布局，这里调"我占多少、排第几"</div>
        </div>
        <div class="section-group__body">
          <InParentSection />
        </div>
      </section>

      <!-- 区 C: 自身样式 -->
      <section class="section-group section-group--self">
        <div class="section-group__head">
          <div class="section-group__title">自身样式</div>
        </div>
        <div class="section-group__body">
          <SizeSection />
          <SpacingSection />
          <PositionSection />
          <AppearanceSection />
        </div>
      </section>

      <!-- 区 D: 其他 -->
      <section class="section-group section-group--other">
        <div class="section-group__head">
          <div class="section-group__title">⚙️ 其他</div>
          <div class="section-group__hint">可见性、滚动、鼠标、变换等行为</div>
        </div>
        <div class="section-group__body">
          <BehaviorSection />
        </div>
      </section>
    </div>

    <!-- 汇总（固定底部） -->
    <StyleSummary @open-css-editor="openCssEditor" />

    <!-- CSS编辑器弹窗 -->
    <q-dialog v-model="showCssEditor" class="css-editor-dialog">
      <q-card class="css-editor-card">
        <q-card-section class="row items-center q-pb-none">
          <div class="text-h6">CSS编辑器</div>
          <q-space />
          <q-btn dense flat icon="close" @click="showCssEditor = false" />
        </q-card-section>
        <q-separator />
        <q-card-section class="q-pa-none editor-section">
          <div class="editor-container">
            <codeEditorSrc v-if="showCssEditor" :value="cssEditorContent" lang="css" filename="custom.css"
              theme="vs-dark" @change="onCssChange" />
          </div>
        </q-card-section>
        <q-separator />
        <q-card-actions align="right">
          <q-btn dense flat label="取消" @click="showCssEditor = false" />
          <q-btn dense flat label="确认" color="primary" @click="saveCssChanges" />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </div>
</template>

<script setup>
import { ref, provide } from 'vue'
import { useStyleData } from './styleControls/useStyleData.js'
import codeEditorSrc from '../../codeEditor/CodeMirror/CodeMirror..vue'
import ContainerSection from './styleControls/ContainerSection.vue'
import InParentSection from './styleControls/InParentSection.vue'
import SpacingSection from './styleControls/SpacingSection.vue'
import PositionSection from './styleControls/PositionSection.vue'
import SizeSection from './styleControls/SizeSection.vue'
import AppearanceSection from './styleControls/AppearanceSection.vue'
import BehaviorSection from './styleControls/BehaviorSection.vue'
import StyleSummary from './styleControls/StyleSummary.vue'

const selectNode = defineModel()

if (!selectNode.value?.properties?.style) {
  selectNode.value.properties.style = ''
}

const styleData = useStyleData(selectNode)
provide('styleData', styleData)
provide('selectNode', selectNode)

// CSS编辑器
const showCssEditor = ref(false)
const cssEditorContent = ref('')

const openCssEditor = () => {
  let styleValue = selectNode.value.properties.style
  if (typeof styleValue !== 'string') {
    styleValue = ''
    selectNode.value.properties.style = ''
  }
  cssEditorContent.value = styleValue || ''
  showCssEditor.value = true
}

const onCssChange = (content) => {
  cssEditorContent.value = content
}

const saveCssChanges = () => {
  selectNode.value.properties.style = cssEditorContent.value
  showCssEditor.value = false
}
</script>

<style scoped>
.style-panel {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  color: white;
}

.sections-scroll {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 8px 6px 4px;
}

.sections-scroll::-webkit-scrollbar {
  width: 4px;
}

.sections-scroll::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.15);
  border-radius: 2px;
}

/* ===== 一级分区（4 大区） ===== */
.section-group {
  margin-bottom: 10px;
  background: rgba(255, 255, 255, 0.025);
  border-radius: 4px;
  overflow: hidden;
}

.section-group__head {
  padding: 8px 10px 6px;
  border-left: 4px solid;
  background: rgba(255, 255, 255, 0.04);
}

.section-group--container .section-group__head {
  border-left-color: #1976d2;
}

.section-group--in-parent .section-group__head {
  border-left-color: #9c27b0;
}

.section-group--self .section-group__head {
  border-left-color: #ff9800;
}

.section-group--other .section-group__head {
  border-left-color: #607d8b;
}

.section-group__title {
  font-size: 0.88em;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.92);
  line-height: 1.2;
}

.section-group__hint {
  font-size: 0.7em;
  color: rgba(255, 255, 255, 0.45);
  margin-top: 3px;
  line-height: 1.35;
}

.section-group__body {
  padding: 4px 0;
}

/* ===== 二级 sub-section（区 C 内部 4 个子板块沿用原样式） ===== */
.sections-scroll :deep(.section-header) {
  font-size: 0.78em;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.78);
  padding: 6px 12px;
  background: rgba(255, 255, 255, 0.02);
}

.sections-scroll :deep(.section-content) {
  padding: 6px 12px 10px;
}

/* CSS编辑器 */
.css-editor-card {
  width: 90vw;
  max-width: 1200px;
  height: 80vh;
  max-height: 800px;
  display: flex;
  flex-direction: column;
}

.editor-section {
  flex: 1;
  overflow: hidden;
  min-height: 400px;
}

.editor-container {
  height: 100%;
  width: 100%;
}
</style>
