<template>
  <div class="editor-container" :class="{ 'preview-mode': editorStore.appMode !== 'design' }">
    <!-- ==================== 设计模式 UI ==================== -->
    <MenuBar v-show="editorStore.appMode === 'design'" @set-view="onSetView" />
    <div class="editor-main" v-show="editorStore.appMode === 'design'">
      <LeftToolbar />
      <div class="editor-viewport-area">
        <!-- Viewport3D 始终保持单实例，避免预览切换时销毁/重建 3D 场景 -->
        <Viewport3D ref="viewportRef" :fullscreen="editorStore.appMode !== 'design'" />

        <div class="editor-bottom-area" v-show="editorStore.showBottomPanel">
          <BottomPanelTabs />
        </div>
      </div>
      <RightPropertyPanel v-show="editorStore.showRightPanel" />
    </div>
    <StatusBar v-show="editorStore.appMode === 'design'" />

    <!-- ==================== 预览/发布模式覆盖层 ==================== -->
    <div class="preview-exit-hint" v-if="editorStore.appMode === 'preview'">
      Press <span class="kbd">Esc</span> to exit preview
    </div>
  </div>
</template>

<script setup>
/**
 * App.vue - 编辑器根组件
 * 职责：布局组装、内核初始化、面板状态管理
 *
 * 关键设计：Viewport3D 保持单实例，通过 v-show 控制设计/预览模式。
 * 预览模式仅隐藏编辑器 UI，不销毁 3D 场景（避免重建、保留相机位置）。
 */
import { ref, onMounted, onUnmounted } from 'vue'
import { useEditorStore } from './stores/editorStore'
import { useSceneStore } from './stores/sceneStore'
import kernel from './core/kernel/EditorKernel.js'
import sceneManager from './core/scene/SceneManager.js'
import selectionManager from './core/editing/SelectionManager.js'
import undoRedoManager from './core/undo/UndoRedoManager.js'
import nodeEngine from './core/nodes/engine/NodeEngine.js'
import nodeRegistry from './core/nodes/registry/NodeRegistry.js'
import physicsWorld from './core/physics/PhysicsWorld.js'
import particleManager from './core/particles/ParticleManager.js'
import materialCompiler from './core/materials/MaterialCompiler.js'
import nodeSceneSync from './core/NodeSceneSync.js'
import modelingToolHandler from './core/editing/ModelingToolHandler.js'
import { useKeyboardShortcuts } from './composables/useKeyboardShortcuts.js'
import MenuBar from './components/menubar/MenuBar.vue'
import LeftToolbar from './components/toolbar/LeftToolbar.vue'
import Viewport3D from './components/viewport/Viewport3D.vue'
import RightPropertyPanel from './components/panels/RightPropertyPanel.vue'
import BottomPanelTabs from './components/panels/BottomPanelTabs.vue'
import StatusBar from './components/statusbar/StatusBar.vue'

const editorStore = useEditorStore()
const sceneStore = useSceneStore()
const viewportRef = ref(null)

// ---- 全局快捷键（composable） ----
useKeyboardShortcuts()

// ---- View 菜单回调 ----
function onSetView(view) {
  sceneManager.setViewPreset(view)
}

// ---- 初始化内核 ----
onMounted(async () => {
  // 注册核心模块
  kernel.registerModule('scene', sceneManager)
  kernel.registerModule('selection', selectionManager)
  kernel.registerModule('undoRedo', undoRedoManager)
  kernel.registerModule('nodeEngine', nodeEngine)
  kernel.registerModule('nodeRegistry', nodeRegistry)
  kernel.registerModule('physics', physicsWorld)
  kernel.registerModule('particles', particleManager)
  kernel.registerModule('materialCompiler', materialCompiler)
  kernel.registerModule('nodeSceneSync', nodeSceneSync)
  kernel.registerModule('modelingToolHandler', modelingToolHandler)

  await kernel.init()

  modelingToolHandler.startListening()

  sceneManager.onBeforeRender(() => {
    if (!physicsWorld.initialized && sceneManager.scene) {
      physicsWorld.init(sceneManager.scene)
    }
    if (!particleManager._scene && sceneManager.scene) {
      particleManager.init(sceneManager.scene)
    }
    if (!materialCompiler._scene && sceneManager.scene) {
      materialCompiler.init(sceneManager.scene)
    }
    nodeSceneSync.init()
  })

  // 添加演示数据
  sceneStore.addObject({ name: 'Cube', type: 'mesh', position: { x: 0, y: 0.5, z: 0 }, metadata: { primitiveType: 'box' } })
  sceneStore.addObject({ name: 'Sphere', type: 'mesh', position: { x: 3, y: 0.5, z: 0 }, metadata: { primitiveType: 'sphere' } })
  sceneStore.addObject({ name: 'Plane', type: 'mesh', position: { x: -3, y: 0, z: 0 }, metadata: { primitiveType: 'plane' } })
})

onUnmounted(async () => {
  await kernel.destroy()
})
</script>

<style scoped>
.editor-container {
  display: flex; flex-direction: column;
  width: 100%; height: 100%; overflow: hidden;
  position: relative;
}
.editor-main {
  display: flex; flex: 1; overflow: hidden;
}
.editor-viewport-area {
  flex: 1; display: flex; flex-direction: column;
  overflow: hidden; position: relative;
}
.editor-bottom-area {
  height: 280px; min-height: 100px;
  display: flex; flex-direction: column;
  border-top: 1px solid var(--editor-border);
  background: var(--editor-bg-panel);
}
.preview-mode { background: #000; }
.preview-mode .editor-main,
.preview-mode .editor-viewport-area { flex: 1; }
.preview-mode .editor-viewport-area { position: relative; }
.preview-mode .editor-viewport-area .viewport-container { position: absolute; inset: 0; }
.preview-exit-hint {
  position: absolute; top: 16px; right: 16px;
  padding: 6px 14px; background: rgba(20, 20, 40, 0.7);
  border-radius: 6px; font-size: 12px; color: var(--editor-text-secondary);
  backdrop-filter: blur(4px); animation: fade-in 0.3s ease; z-index: 100;
}
@keyframes fade-in {
  from { opacity: 0; transform: translateY(-8px); }
  to { opacity: 1; transform: translateY(0); }
}
</style>
