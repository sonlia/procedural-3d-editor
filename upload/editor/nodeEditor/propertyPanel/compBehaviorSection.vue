<script setup>
import { computed, onMounted, watch } from 'vue';
import {
  BEHAVIOR_DEFINITIONS,
  useBehaviorAttach,
} from '../../dragEditor/composables/useBehaviorAttach.js';
import { useDragEditorData } from '../../dragEditor/composables/useDragEditorData.js';
import { useEditorTabs } from '../../dragEditor/composables/useEditorTabs.js';
import { useProjectStore } from 'src/stores/projectMange.js';
import { centerOnNode } from '../composables/useLitegraphEditor.js';
import { pushSlotEdit } from '../../dragEditor/composables/useSimpleInteraction.js';

const nodeData = defineModel();

// 直接获取 dragEditor API 和标签页 API
const dragEditorApi = useDragEditorData();
const editorTabsApi = useEditorTabs();
const _project = useProjectStore();

const {
  attachedBehaviors,
  addBehavior,
  removeBehavior,
  detectUnmanagedBehaviors,
  adoptBehavior,
} = useBehaviorAttach(nodeData, dragEditorApi, editorTabsApi);

// 收编当前节点子树里"已存在但未纳入管理"的行为组件(拖拽添加 / 旧数据 / 历史孤儿),
// 使其出现在"已附加"列表并避免重复添加。detect 已自带"只扫当前节点 children + 排除已管理"逻辑,幂等安全
const syncUnmanagedBehaviors = () => {
  if (!nodeData.value) return;
  const schema = _project.getEditorData('dragEditor') || [];
  detectUnmanagedBehaviors(schema).forEach(({ nodeId, type }) => adoptBehavior(nodeId, type));
};

onMounted(syncUnmanagedBehaviors);
watch(() => nodeData.value?.id, syncUnmanagedBehaviors);

// 按钮定义列表
const behaviorButtons = computed(() =>
  Object.entries(BEHAVIOR_DEFINITIONS).map(([type, def]) => ({
    type,
    ...def,
  }))
);

// 添加行为
const handleAdd = (type) => {
  addBehavior(type);
};

const handleActivate = (behavior) => {
  if (!behavior?.nodeId) return;

  const behaviorLabel = BEHAVIOR_DEFINITIONS[behavior.type]?.label || behavior.type || behavior.nodeId;

  if (behavior.display === 'tab' && editorTabsApi) {
    if (!editorTabsApi.findTabByNodeId(behavior.nodeId)) {
      editorTabsApi.addTab({
        type: behavior.type,
        nodeId: behavior.nodeId,
        label: behaviorLabel,
      });
    }
    editorTabsApi.switchTab(`${behavior.type}-${behavior.nodeId}`);
  } else {
    pushSlotEdit(behavior.nodeId, behaviorLabel);
  }

  centerOnNode(behavior.nodeId, true);
};

// 删除行为
const handleRemove = (behaviorId) => {
  removeBehavior(behaviorId);
};
</script>

<template>
  <div class="behavior-section">
    <div class="row items-center full-width q-mb-xs">
      <span class="text-body2 text-weight-medium">行为附加</span>
    </div>

    <!-- 行为按钮组 -->
    <div class="row q-gutter-xs q-mb-sm" style="flex-wrap: wrap;">
      <q-btn
        v-for="btn in behaviorButtons"
        :key="btn.type"
        :icon="btn.icon"
        :label="btn.label"
        dense dark outline
        color="grey-7"
        size="sm"
        @click="handleAdd(btn.type)"
      >
        <q-tooltip :delay="800">添加 {{ btn.label }}</q-tooltip>
      </q-btn>
    </div>

    <!-- 已附加行为列表 -->
    <div v-if="attachedBehaviors.length > 0">
      <div class="text-caption text-grey-5 q-mb-xs">已附加：</div>
      <div
        v-for="bhv in attachedBehaviors"
        :key="bhv.id"
        class="behavior-item row items-center q-mb-xs q-pa-xs cursor-pointer"
        @click="handleActivate(bhv)"
      >
        <q-icon
          :name="BEHAVIOR_DEFINITIONS[bhv.type]?.icon || 'extension'"
          size="xs"
          class="q-mr-xs"
        />
        <span class="text-caption">
          {{ BEHAVIOR_DEFINITIONS[bhv.type]?.label || bhv.type }}
        </span>
        <q-badge
          v-if="bhv.display === 'tab'"
          label="标签页"
          color="blue-8"
          class="q-ml-xs"
          dense
        />
        <q-space />
        <q-btn
          icon="delete_outline"
          dense flat round
          size="xs"
          color="negative"
          @click.stop="handleRemove(bhv.id)"
        >
          <q-tooltip :delay="800">删除此行为</q-tooltip>
        </q-btn>
      </div>
    </div>

    <!-- 空状态 -->
    <div
      v-else
      class="text-caption text-grey-6 text-center q-pa-sm"
    >
      点击上方按钮为组件添加交互行为
    </div>
  </div>
</template>

<style scoped>
.behavior-item {
  background: rgba(255, 255, 255, 0.03);
  border-radius: 4px;
  border: 1px solid rgba(255, 255, 255, 0.08);
}
.behavior-item:hover {
  background: rgba(255, 255, 255, 0.06);
}
</style>
