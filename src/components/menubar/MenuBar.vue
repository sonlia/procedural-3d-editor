<template>
  <q-toolbar class="menubar">
    <!-- Logo -->
    <div class="menubar-logo">
      <q-icon name="view_in_ar" size="20px" color="blue-4" />
      <span class="menubar-title">Procedural3D</span>
    </div>

    <q-separator vertical dark class="q-mx-sm" />

    <!-- File Menu -->
    <q-btn-dropdown flat dense label="File" no-icon-animation>
      <q-list dense>
        <q-item clickable v-close-popup @click="onNewProject">
          <q-item-section>New Project</q-item-section>
          <q-item-section side><span class="kbd">Ctrl+N</span></q-item-section>
        </q-item>
        <q-item clickable v-close-popup @click="onOpenProject">
          <q-item-section>Open Project</q-item-section>
          <q-item-section side><span class="kbd">Ctrl+O</span></q-item-section>
        </q-item>
        <q-item clickable v-close-popup @click="onSaveProject">
          <q-item-section>Save</q-item-section>
          <q-item-section side><span class="kbd">Ctrl+S</span></q-item-section>
        </q-item>
        <q-item clickable v-close-popup @click="onSaveAsProject">
          <q-item-section>Save As...</q-item-section>
          <q-item-section side><span class="kbd">Ctrl+Shift+S</span></q-item-section>
        </q-item>
        <q-separator />
        <q-item clickable v-close-popup @click="onImportModel">
          <q-item-section>Import Model (GLB/GLTF)</q-item-section>
        </q-item>
        <q-item clickable v-close-popup @click="onExportGLB">
          <q-item-section>Export Scene (GLB)</q-item-section>
        </q-item>
        <q-separator />
        <q-item clickable v-close-popup>
          <q-item-section>Export Static Package (Publish)</q-item-section>
        </q-item>
      </q-list>
    </q-btn-dropdown>

    <!-- Edit Menu -->
    <q-btn-dropdown flat dense label="Edit" no-icon-animation>
      <q-list dense>
        <q-item clickable v-close-popup @click="editorStore.undo()" :disable="!editorStore.canUndo">
          <q-item-section>Undo</q-item-section>
          <q-item-section side><span class="kbd">Ctrl+Z</span></q-item-section>
        </q-item>
        <q-item clickable v-close-popup @click="editorStore.redo()" :disable="!editorStore.canRedo">
          <q-item-section>Redo</q-item-section>
          <q-item-section side><span class="kbd">Ctrl+Shift+Z</span></q-item-section>
        </q-item>
        <q-separator />
        <q-item clickable v-close-popup @click="editorStore.clearSelection()">
          <q-item-section>Deselect All</q-item-section>
          <q-item-section side><span class="kbd">Esc</span></q-item-section>
        </q-item>
        <q-item clickable v-close-popup @click="onSelectAll">
          <q-item-section>Select All</q-item-section>
          <q-item-section side><span class="kbd">Ctrl+A</span></q-item-section>
        </q-item>
        <q-item clickable v-close-popup @click="onInvertSelection">
          <q-item-section>Invert Selection</q-item-section>
        </q-item>
        <q-separator />
        <q-item clickable v-close-popup @click="onDuplicate">
          <q-item-section>Duplicate</q-item-section>
          <q-item-section side><span class="kbd">Shift+D</span></q-item-section>
        </q-item>
        <q-item clickable v-close-popup @click="onDelete">
          <q-item-section>Delete</q-item-section>
          <q-item-section side><span class="kbd">Del</span></q-item-section>
        </q-item>
        <q-separator />
        <q-item clickable v-close-popup>
          <q-item-section>Project Settings</q-item-section>
        </q-item>
      </q-list>
    </q-btn-dropdown>

    <!-- Add Menu -->
    <q-btn-dropdown flat dense label="Add" no-icon-animation>
      <q-list dense>
        <q-item-label header class="text-uppercase" style="font-size:10px; color: var(--editor-text-muted);">Geometry</q-item-label>
        <q-item clickable v-close-popup v-for="prim in primitives" :key="prim.type" @click="addPrimitive(prim.type)">
          <q-item-section avatar><q-icon :name="prim.icon" size="16px" color="blue-4" /></q-item-section>
          <q-item-section>{{ prim.label }}</q-item-section>
          <q-item-section side><span class="kbd">{{ prim.shortcut }}</span></q-item-section>
        </q-item>
        <q-separator />
        <q-item-label header class="text-uppercase" style="font-size:10px; color: var(--editor-text-muted);">Light</q-item-label>
        <q-item clickable v-close-popup @click="addLight('point')">
          <q-item-section avatar><q-icon name="lightbulb" size="16px" color="yellow-4" /></q-item-section>
          <q-item-section>Point Light</q-item-section>
        </q-item>
        <q-item clickable v-close-popup @click="addLight('directional')">
          <q-item-section avatar><q-icon name="wb_sunny" size="16px" color="orange-4" /></q-item-section>
          <q-item-section>Directional Light</q-item-section>
        </q-item>
        <q-item clickable v-close-popup @click="addLight('spot')">
          <q-item-section avatar><q-icon name="flashlight_on" size="16px" color="blue-3" /></q-item-section>
          <q-item-section>Spot Light</q-item-section>
        </q-item>
        <q-separator />
        <q-item-label header class="text-uppercase" style="font-size:10px; color: var(--editor-text-muted);">Display Panel</q-item-label>
        <q-item clickable v-close-popup @click="addPanel('value_card')">
          <q-item-section avatar><q-icon name="dashboard" size="16px" color="green-4" /></q-item-section>
          <q-item-section>Value Card</q-item-section>
        </q-item>
        <q-item clickable v-close-popup @click="addPanel('text_label')">
          <q-item-section avatar><q-icon name="label" size="16px" color="teal-4" /></q-item-section>
          <q-item-section>Text Label</q-item-section>
        </q-item>
        <q-item clickable v-close-popup @click="addPanel('chart')">
          <q-item-section avatar><q-icon name="show_chart" size="16px" color="purple-4" /></q-item-section>
          <q-item-section>Chart Panel</q-item-section>
        </q-item>
        <q-item clickable v-close-popup @click="addPanel('status')">
          <q-item-section avatar><q-icon name="indicator" size="16px" color="red-4" /></q-item-section>
          <q-item-section>Status Indicator</q-item-section>
        </q-item>
        <q-separator />
        <q-item-label header class="text-uppercase" style="font-size:10px; color: var(--editor-text-muted);">Node</q-item-label>
        <q-item clickable v-close-popup @click="addEmptyNode">
          <q-item-section avatar><q-icon name="account_tree" size="16px" color="cyan-4" /></q-item-section>
          <q-item-section>Empty Node</q-item-section>
        </q-item>
      </q-list>
    </q-btn-dropdown>

    <!-- View Menu -->
    <q-btn-dropdown flat dense label="View" no-icon-animation>
      <q-list dense>
        <q-item-label header class="text-uppercase" style="font-size:10px; color: var(--editor-text-muted);">Camera</q-item-label>
        <q-item clickable v-close-popup @click="$emit('setView', 'perspective')">
          <q-item-section>Perspective</q-item-section>
          <q-item-section side><span class="kbd">Num 5</span></q-item-section>
        </q-item>
        <q-item clickable v-close-popup @click="$emit('setView', 'top')">
          <q-item-section>Top</q-item-section>
          <q-item-section side><span class="kbd">Num 7</span></q-item-section>
        </q-item>
        <q-item clickable v-close-popup @click="$emit('setView', 'front')">
          <q-item-section>Front</q-item-section>
          <q-item-section side><span class="kbd">Num 1</span></q-item-section>
        </q-item>
        <q-item clickable v-close-popup @click="$emit('setView', 'right')">
          <q-item-section>Right</q-item-section>
          <q-item-section side><span class="kbd">Num 3</span></q-item-section>
        </q-item>
        <q-separator />
        <q-item-label header class="text-uppercase" style="font-size:10px; color: var(--editor-text-muted);">Panels</q-item-label>
        <q-item clickable v-close-popup @click="toggleRightPanel">
          <q-item-section>Toggle Right Panel</q-item-section>
          <q-item-section side><span class="kbd">N</span></q-item-section>
        </q-item>
        <q-item clickable v-close-popup @click="toggleBottomPanel">
          <q-item-section>Toggle Bottom Panel</q-item-section>
          <q-item-section side><span class="kbd">B</span></q-item-section>
        </q-item>
      </q-list>
    </q-btn-dropdown>

    <q-space />

    <!-- Transform Space Toggle -->
    <q-btn-toggle
      flat dense no-wrap
      :model-value="editorStore.transformSpace"
      @update:model-value="editorStore.transformSpace = $event"
      :options="[
        { label: 'Local', value: 'local' },
        { label: 'World', value: 'world' }
      ]"
      toggle-color="blue-5"
      toggle-text-color="white"
      class="q-mr-sm"
      style="font-size: 11px;"
    />

    <q-separator vertical dark class="q-mx-sm" />

    <!-- Mode Indicator -->
    <div class="mode-indicator" :class="modeClass">
      <span class="dot"></span>
      <span>{{ modeLabel }}</span>
    </div>

    <q-space />

    <!-- Preview Button -->
    <q-btn
      flat dense no-wrap
      :icon="editorStore.appMode === 'design' ? 'play_arrow' : 'edit'"
      :label="editorStore.appMode === 'design' ? 'Preview' : 'Design'"
      :color="editorStore.appMode === 'design' ? 'green-4' : 'blue-4'"
      @click="togglePreview"
      class="q-mr-sm"
    />

    <!-- Publish Button -->
    <q-btn flat dense no-wrap icon="publish" label="Publish" color="purple-4" class="q-mr-sm" @click="onPublish">
      <q-tooltip>Export publishable static scene</q-tooltip>
    </q-btn>
  </q-toolbar>
</template>

<script setup>
import { computed } from 'vue'
import { SceneLoader, Vector3 } from '@babylonjs/core'
import { useEditorStore, EDIT_MODES, APP_MODES } from '../../stores/editorStore'
import { useSceneStore } from '../../stores/sceneStore'
import { useNodeStore } from '../../stores/nodeStore'
import PrimitiveFactory from '../../core/mesh/PrimitiveFactory.js'
import sceneManager from '../../core/scene/SceneManager.js'
import selectionManager from '../../core/editing/SelectionManager.js'
import { useTimelineStore } from '../../stores/timelineStore.js'

const emit = defineEmits(['setView'])

const editorStore = useEditorStore()
const sceneStore = useSceneStore()
const nodeStore = useNodeStore()
const timelineStore = useTimelineStore()

// 从 PrimitiveFactory 动态生成几何体菜单列表
const primitives = computed(() => {
  return PrimitiveFactory.TYPES.map(type => {
    const meta = PrimitiveFactory.METADATA[type] || {}
    return { type, label: meta.label || type, icon: meta.icon || 'view_in_ar', shortcut: '' }
  })
})

const modeLabel = computed(() => {
  switch (editorStore.editMode) {
    case EDIT_MODES.OBJECT: return 'Object Mode'
    case EDIT_MODES.PROCEDURAL_VERTEX: return 'Vertex Edit'
    case EDIT_MODES.PROCEDURAL_EDGE: return 'Edge Edit'
    case EDIT_MODES.PROCEDURAL_FACE: return 'Face Edit'
    case EDIT_MODES.INDEPENDENT: return 'Independent Edit'
    default: return 'Object Mode'
  }
})

const modeClass = computed(() => {
  switch (editorStore.editMode) {
    case EDIT_MODES.OBJECT: return 'mode-object'
    case EDIT_MODES.PROCEDURAL_VERTEX:
    case EDIT_MODES.PROCEDURAL_EDGE:
    case EDIT_MODES.PROCEDURAL_FACE: return 'mode-procedural'
    case EDIT_MODES.INDEPENDENT: return 'mode-independent'
    default: return 'mode-object'
  }
})

// ---- Actions ----

function addPrimitive(type) {
  const nameMap = {
    box: 'Cube', sphere: 'Sphere', cylinder: 'Cylinder',
    cone: 'Cone', plane: 'Plane', torus: 'Torus', monkey: 'Suzanne',
    icosphere: 'Ico Sphere', capsule: 'Capsule'
  }
  sceneStore.addObject({
    name: `${nameMap[type] || type}`,
    type: 'mesh',
    position: { x: (Math.random() - 0.5) * 2, y: 0.5, z: (Math.random() - 0.5) * 2 },
    metadata: { primitiveType: type }
  })
}

function addLight(lightType) {
  const nameMap = { point: 'Point Light', directional: 'Directional Light', spot: 'Spot Light' }
  sceneStore.addObject({
    name: nameMap[lightType] || 'Light',
    type: 'light',
    position: { x: 0, y: 3, z: 0 },
    metadata: { lightType }
  })
}

function addPanel(type) {
  const nameMap = {
    value_card: 'Value Card',
    text_label: 'Text Label',
    chart: 'Chart Panel',
    status: 'Status Indicator'
  }
  sceneStore.addObject({
    name: nameMap[type] || type,
    type: 'display_panel',
    position: { x: 0, y: 1, z: 0 },
    metadata: { panelType: type }
  })
}

function addEmptyNode() {
  nodeStore.addNode({
    type: 'empty',
    title: 'Empty Node',
    category: 'general',
    position: { x: 200 + Math.random() * 200, y: 100 + Math.random() * 100 },
    inputs: [],
    outputs: [],
    properties: {}
  })
}

function onNewProject() {
  sceneStore.clearScene()
  nodeStore.clearGraph()
}

function onSelectAll() {
  if (editorStore.editMode === EDIT_MODES.OBJECT) {
    selectionManager.selectObjects(sceneStore.objects.map(o => o.id))
  }
}

function onInvertSelection() {
  const allIds = sceneStore.objects.map(o => o.id)
  const selectedIds = selectionManager.state.selectedObjectIds
  const inverted = allIds.filter(id => !selectedIds.includes(id))
  selectionManager.selectObjects(inverted)
}

function onDuplicate() {
  const ids = [...selectionManager.state.selectedObjectIds]
  for (const id of ids) {
    const obj = sceneStore.objects.find(o => o.id === id)
    if (obj) {
      sceneStore.addObject({
        name: `${obj.name} (copy)`,
        type: obj.type,
        position: { ...obj.position, x: obj.position.x + 1 },
        rotation: { ...obj.rotation },
        scale: { ...obj.scale },
        metadata: { ...obj.metadata }
      })
    }
  }
}

function onDelete() {
  const ids = [...selectionManager.state.selectedObjectIds]
  ids.forEach(id => sceneStore.removeObject(id))
  selectionManager.clearSelection()
}

function togglePreview() {
  if (editorStore.appMode === APP_MODES.DESIGN) {
    editorStore.setAppMode(APP_MODES.PREVIEW)
  } else {
    editorStore.setAppMode(APP_MODES.DESIGN)
  }
}

function onPublish() {
  editorStore.setAppMode(APP_MODES.PUBLISH)
}

function toggleRightPanel() {
  editorStore.toggleRightPanel()
}

function toggleBottomPanel() {
  editorStore.toggleBottomPanel()
}

// ---- File I/O Actions (Babylon.js) ----

function onImportModel() {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = '.glb,.gltf,.obj,.stl,.fbx'
  input.onchange = (e) => {
    const file = e.target.files[0]
    if (!file) return
    const url = URL.createObjectURL(file)

    // Babylon.js SceneLoader 支持多种格式
    SceneLoader.ImportMesh('', '', url, sceneManager.scene, (meshes, particleSystems, skeletons) => {
      // 设置导入模型属性
      const rootMeshes = []
      let centerSum = new Vector3(0, 0, 0)
      let count = 0

      for (const mesh of meshes) {
        if (!mesh.parent) {
          rootMeshes.push(mesh)
          centerSum.addInPlace(mesh.position)
          count++
        }
        // 添加阴影
        if (sceneManager._shadowGenerator) {
          sceneManager._shadowGenerator.addShadowCaster(mesh)
        }
        mesh.receiveShadows = true
      }

      // 居中模型
      if (count > 0) {
        centerSum.scaleInPlace(1 / count)
        for (const m of rootMeshes) {
          m.position.subtractInPlace(centerSum)
        }
      }

      // 在 sceneStore 中创建引用对象
      if (rootMeshes.length > 0) {
        const obj = sceneStore.addObject({
          name: file.name.replace(/\.[^.]+$/, ''),
          type: 'mesh',
          position: { x: rootMeshes[0].position.x, y: rootMeshes[0].position.y, z: rootMeshes[0].position.z },
          metadata: { primitiveType: 'imported', sourceFile: file.name }
        })
        rootMeshes[0].metadata = rootMeshes[0].metadata || {}
        rootMeshes[0].metadata.objectId = obj.id
        rootMeshes[0].metadata.isImported = true
      }

      URL.revokeObjectURL(url)
      console.log(`[MenuBar] Imported ${meshes.length} meshes, ${skeletons.length} skeletons`)
    }, null, (err) => {
      console.error('[MenuBar] Import error:', err)
    })
  }
  input.click()
}

async function onExportGLB() {
  if (!sceneManager.scene || !sceneManager.engine) return

  try {
    // 使用 @babylonjs/serializers 的 GLTF2Export
    const { GLTF2Export } = await import('@babylonjs/serializers')
    const blob = await GLTF2Export.GLBAsync(sceneManager.scene, 'scene')
    downloadBlob(blob, 'scene.glb')
  } catch (err) {
    console.error('[MenuBar] GLB export error:', err)
  }
}

function onSaveProject() {
  const data = {
    version: '1.0',
    engine: 'babylonjs',
    scene: sceneStore.objects,
    nodeGraph: nodeStore.serializeGraph(),
    timeline: {
      startFrame: timelineStore.startFrame,
      endFrame: timelineStore.endFrame,
      fps: timelineStore.fps,
      loopMode: timelineStore.loopMode,
      tracks: timelineStore.tracks
    }
  }
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  downloadBlob(blob, 'project.json')
}

function onSaveAsProject() {
  onSaveProject()
}

function onOpenProject() {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = '.json'
  input.onchange = (e) => {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target.result)
        if (data.scene) {
          sceneStore.clearScene()
          data.scene.forEach(obj => sceneStore.addObject(obj))
        }
      } catch (err) {
        console.error('[MenuBar] Project load error:', err)
      }
    }
    reader.readAsText(file)
  }
  input.click()
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
</script>

<style scoped>
.menubar {
  background: var(--editor-bg-toolbar);
  border-bottom: 1px solid var(--editor-border);
  padding: 0 4px;
  height: 36px;
  min-height: 36px;
}

.menubar-logo {
  display: flex;
  align-items: center;
  gap: 8px;
  padding-right: 8px;
}

.menubar-title {
  font-size: 13px;
  font-weight: 700;
  background: linear-gradient(135deg, #5352ed, #7c7cf8);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  letter-spacing: 0.5px;
}

.q-btn-dropdown {
  font-size: 12px;
}

.q-list {
  min-width: 220px;
}
</style>
