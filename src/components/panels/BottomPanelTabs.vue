<template>
  <div class="bottom-panel-tabs">
    <div class="bottom-tab-bar">
      <div v-for="tab in tabs" :key="tab.id" class="bottom-tab" :class="{ active: activeTab === tab.id }" @click="editorStore.activeBottomTab = tab.id">
        <q-icon :name="tab.icon" size="14px" />
        <span>{{ tab.label }}</span>
      </div>
      <q-space />
      <div class="tab-actions">
        <template v-if="activeTab === 'nodes'">
          <q-btn flat dense size="xs" icon="add_box" @click="addDemoNode" title="Add Node" />
          <q-btn flat dense size="xs" icon="auto_graph" title="Auto Layout" />
          <q-btn flat dense size="xs" icon="cleaning_services" @click="clearNodeGraph" title="Clear Graph" />
        </template>
        <template v-if="activeTab === 'timeline'">
          <q-btn flat dense size="xs" icon="add" @click="addDemoTrack" title="Add Track" />
        </template>
      </div>
    </div>
    <div class="bottom-panel-content">
      <NodeEditor v-show="activeTab === 'nodes'" />
      <TimelinePanel v-show="activeTab === 'timeline'" />
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useNodeStore } from '../../stores/nodeStore'
import { useTimelineStore } from '../../stores/timelineStore'
import { useEditorStore } from '../../stores/editorStore'
import nodeRegistry from '../../core/nodes/registry/NodeRegistry.js'
import NodeEditor from '../nodes/NodeEditor.vue'
import TimelinePanel from '../timeline/TimelinePanel.vue'


const nodeStore = useNodeStore()
const timelineStore = useTimelineStore()
const editorStore = useEditorStore()
// activeTab 直接使用 store 中的值
const activeTab = computed(() => editorStore.activeBottomTab)

const tabs = [
  { id: 'nodes', label: 'Node Graph', icon: 'account_tree' },
  { id: 'timeline', label: 'Timeline', icon: 'timeline' }
]

const allTypes = nodeRegistry.getAllTypes()

function addDemoNode() {
  const typeDef = allTypes[Math.floor(Math.random() * allTypes.length)]
  const x = 100 + Math.random() * 400
  const y = 50 + Math.random() * 200
  nodeStore.addNodeFromRegistry(typeDef.typeId, { position: { x, y } })
}

function addDemoTrack() {
  const trackTypes = [
    { name: 'Position X', type: 'transform', targetProperty: 'position.x', color: '#ff6b6b' },
    { name: 'Position Y', type: 'transform', targetProperty: 'position.y', color: '#51cf66' },
    { name: 'Position Z', type: 'transform', targetProperty: 'position.z', color: '#339af0' },
    { name: 'Rotation Y', type: 'transform', targetProperty: 'rotation.y', color: '#fcc419' },
    { name: 'Scale', type: 'transform', targetProperty: 'scale', color: '#cc5de8' }
  ]
  timelineStore.addTrack(trackTypes[Math.floor(Math.random() * trackTypes.length)])
}

function clearNodeGraph() {
  nodeStore.clearGraph()
}


</script>

<style scoped>
.bottom-panel-tabs { display: flex; flex-direction: column; flex: 1; overflow: hidden; }
.bottom-tab-bar { display: flex; align-items: center; padding: 0 8px; background: var(--editor-bg-toolbar); border-bottom: 1px solid var(--editor-border); min-height: 30px; gap: 2px; }
.bottom-tab { display: flex; align-items: center; gap: 4px; padding: 4px 12px; font-size: 11px; font-weight: 600; color: var(--editor-text-muted); cursor: pointer; border-radius: 4px 4px 0 0; border-bottom: 2px solid transparent; transition: all 0.15s; }
.bottom-tab:hover { color: var(--editor-text-secondary); background: var(--editor-bg-hover); }
.bottom-tab.active { color: var(--editor-accent-light); border-bottom-color: var(--editor-accent); background: var(--editor-bg-panel); }
.tab-actions { display: flex; gap: 2px; }
.bottom-panel-content { flex: 1; overflow: hidden; position: relative; }
</style>
