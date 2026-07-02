<template>
  <q-bar class="bg-grey-10  z-max" style="margin-bottom: 1px;" dark>

    <template v-if="showModeButtons">
      <q-btn flat dense :text-color="globalDisplayMode === 1 ? 'white' : 'grey-7'"
        :color="globalDisplayMode === 1 ? 'primary' : 'grey-9'" class="q-mr-xs" @click="setEditMode" icon="edit"
        size="sm">
        编辑
      </q-btn>

      <q-btn flat dense :text-color="globalDisplayMode === 0 ? 'white' : (canSlotEdit ? 'white' : 'grey-5')"
        class="q-mr-xs" @click="setSlotEditMode" :disable="!canSlotEdit" icon="edit_note" size="sm">
        槽编辑
      </q-btn>

      <q-btn flat dense :text-color="globalDisplayMode === 2 ? 'white' : 'grey-7'"
        :color="globalDisplayMode === 2 ? 'secondary' : 'grey-9'" class="q-mr-xs" @click="setPreviewMode"
        icon="visibility" size="sm">预览</q-btn>
    </template>

    <q-space />


    <q-btn flat dense :text-color="globalDisplayMode === 2 ? 'grey-5' : 'grey-7'"
      :class="globalDisplayMode === 2 ? 'q-mr-xs disabled' : 'q-mr-xs'"
      :color="globalDisplayMode === 2 ? 'grey-8' : 'grey-9'" @click="clear" :disable="globalDisplayMode === 2"
      icon="delete" v-if="showModeButtons">清空画布</q-btn>
    <q-btn flat dense :text-color="globalDisplayMode === 2 ? 'grey-5' : 'grey-7'"
      :class="globalDisplayMode === 2 ? 'q-mr-xs disabled' : 'q-mr-xs'"
      :color="globalDisplayMode === 2 ? 'grey-8' : 'grey-9'" @click="rest" :disable="globalDisplayMode === 2"
      icon="center_focus_strong" size="sm">画布复位</q-btn>
    <q-btn flat dense :text-color="showNodeHierarchy ? 'white' : 'grey-7'"
      :color="showNodeHierarchy ? 'orange' : 'grey-9'" class="q-mr-md" @click="toggleNodeHierarchy" icon="account_tree"
      v-if="showModeButtons">
      层级
    </q-btn>
    <q-select v-model="model" dark dense borderless use-input hide-selected fill-input input-debounce="300"
      new-value-mode="add-unique" :options="filteredOptions" placeholder="选择或输入尺寸" label-color="orange-4"
      color="orange-4" @update:model-value="update" @filter="filterSizes" :disable="globalDisplayMode === 2" :style="globalDisplayMode === 2
        ? 'opacity: 0.6; min-width: 125 0px; max-width: 135px;'
        : 'min-width: 125px; max-width: 128px;'
        " class="q-ml-sm" popup-content-class="text-grey-9" behavior="menu">
      <template v-slot:prepend>
        <q-icon name="aspect_ratio" size="12px" color="orange-4" />
      </template>
      <template v-slot:option="scope">
        <q-item v-bind="scope.itemProps" class="text-caption">
          <q-item-section avatar v-if="scope.opt.icon">
            <q-icon :name="scope.opt.icon" size="12px" />
          </q-item-section>
          <q-item-section>
            <q-item-label>{{ scope.opt.label || scope.opt }}</q-item-label>
            <q-item-label caption v-if="scope.opt.description">{{
              scope.opt.description
              }}</q-item-label>
          </q-item-section>
        </q-item>
      </template>
    </q-select>
  </q-bar>

  <!-- 槽编辑面包屑导航 -->
  <q-bar v-if="globalDisplayMode === 0" class="bg-grey-9 q-py-none" dark dense style="min-height: 24px;">
    <q-icon name="account_tree" size="12px" color="grey-6" class="q-mr-xs" />
    <template v-for="(item, index) in breadcrumbItems" :key="item.id || 'root'">
      <q-btn flat dense no-caps  text-color="grey-6" class="q-px-xs text-caption" style="font-size: 11px;"
        @click="handleBreadcrumbClick(index, item)">
        {{ item.name }}
      </q-btn>
      <q-icon v-if="index < breadcrumbItems.length - 1" name="chevron_right" size="12px" color="grey-7" />
    </template>
  </q-bar>

  <div class="row no-wrap fit" style="overflow: hidden; position: relative;">
    <div class="col" style="overflow: hidden; position: relative;">
      <dragZoom ref="dragZoomRef" style="margin-left: 15px; margin-top: 15px" v-if="globalDisplayMode !== 3">
        <div ref="dragAreaRef" :style="[resize, { position: 'absolute' }]" class="bg-white">
          <slot></slot>
        </div>
      </dragZoom>
    </div>

    <!-- UI节点层级树面板（右侧） -->
    <nodeHierarchyTree v-if="showNodeHierarchy" />
  </div>
</template>
<script setup>
import nodeHierarchyTree from "./nodeHierarchyTree.vue";
import {
  nextTick,
  onMounted,
} from "vue";
import { watch, ref, computed } from "vue";
import { clearGraph, getGraphInstance } from "src/components/editor/nodeEditor/composables/useLitegraphEditor.js";
import { useProjectStore, useProjectMangerStore } from "src/stores/projectMange.js";
import { useQuasar } from "quasar";
import dragZoom from "./dragZoom.vue";
import { findNearestAttribute } from "src/components/utils/util.js";
import { globalDisplayMode, selectedNodeId, globalSlotEditNodeId, breadcrumbItems, jumpToSlotEdit, exitSlotEdit, pushSlotEdit, slotEditStack, showNodeHierarchy } from "src/components/editor/dragEditor/composables/useSimpleInteraction.js";

const _project = useProjectStore();
const _projectManger = useProjectMangerStore();
const $q = useQuasar();

const dragZoomRef = ref();

// 定义 emit
const emit = defineEmits(['displayModeChange']);

// 定义 props
const props = defineProps({
  showModeButtons: {
    type: Boolean,
    default: true
  }
});

const { showModeButtons } = props;

// 计算是否可以槽编辑
// 槽编辑模式下保持可点击，或在编辑模式下选中节点时可点击
const canSlotEdit = computed(() => {
  // 槽编辑模式：选中了不同节点时可以进入该节点的槽编辑，或可退出
  if (globalDisplayMode.value === 0) {
    return true;
  }
  // 编辑模式：有选中节点时可进入槽编辑
  return globalDisplayMode.value === 1 && !!selectedNodeId.value;
});

// 添加调试：监听自己的 globalDisplayMode 变化并 emit
watch(globalDisplayMode, (newVal, oldVal) => {
  // emit 事件给父组件
  emit('displayModeChange', newVal);
}, { immediate: true });

let initSize = _project.pageSize();
let model = ref(initSize || "1920*1080");
let dragAreaRef = ref(null);

function nodeUnSelected() {
  document.querySelectorAll(".active").forEach((element) => {
    element.classList.remove("active");
  });

  const rootElement = document.querySelectorAll(".selectStyle");

  rootElement.forEach((element) => {
    element.classList.remove("selectStyle");
  });
}

onMounted(() => {
  initProj();

  // 使用 nextTick 确保 DOM 渲染完成
  nextTick(() => {
    if (dragAreaRef.value) {
      dragAreaRef.value.addEventListener(
        "click",
        (event) => {
          // 简化的点击处理，主要用于选中样式
          const info = findNearestAttribute(event.target);
          const rootElement = document.querySelectorAll(".selectStyle");

          rootElement.forEach((element) => {
            element.classList.remove("selectStyle");
          });

          // 只对有组件的区域添加选中样式，空白区域不做特殊处理
          if (info.el) {
            info.el.classList.add("selectStyle");
          }
        },
        true,
      );
    }
  });
});

const setPreviewMode = () => {
  slotEditStack.value = [];
  globalSlotEditNodeId.value = null;
  globalDisplayMode.value = 2;
};

const setEditMode = () => {
  slotEditStack.value = [];
  globalSlotEditNodeId.value = null;
  globalDisplayMode.value = 1;
};

const toggleNodeHierarchy = () => {
  showNodeHierarchy.value = !showNodeHierarchy.value;
};

const setSlotEditMode = () => {
  if (!canSlotEdit.value) return;

  // 获取选中节点的显示名称
  const getNodeName = (nodeId) => {
    // 优先从 graph 中获取 title
    const graph = getGraphInstance();
    if (graph) {
      const litegraphNode = graph.getNodeById(nodeId);
      if (litegraphNode?.title) {
        return litegraphNode.title;
      }
    }

    // 回退：从 dragEditor 数据中获取 tag 或 type
    const dragData = _project.getEditorData("dragEditor") || [];
    const findNode = (nodes, id) => {
      for (const node of nodes) {
        if (node.id === id) return node;
        if (node.children) {
          if (Array.isArray(node.children)) {
            const found = findNode(node.children, id);
            if (found) return found;
          } else if (typeof node.children === 'object') {
            for (const slot in node.children) {
              if (Array.isArray(node.children[slot])) {
                const found = findNode(node.children[slot], id);
                if (found) return found;
              }
            }
          }
        }
      }
      return null;
    };
    const node = findNode(dragData, nodeId);
    if (node?.tag) return node.tag;
    if (node?.type) {
      const parts = node.type.split('/');
      return parts[parts.length - 1];
    }
    return nodeId;
  };

  // 已在槽编辑模式：切换目标或退出
  if (globalDisplayMode.value === 0) {
    const hasNewTarget = selectedNodeId.value &&
      selectedNodeId.value !== globalSlotEditNodeId.value;
    if (hasNewTarget) {
      // 切换到新节点的槽编辑，推入栈
      const nodeName = getNodeName(selectedNodeId.value);
      pushSlotEdit(selectedNodeId.value, nodeName);
    } else {
      // 退出槽编辑
      exitSlotEdit();
    }
    return;
  }

  // 从编辑模式进入槽编辑，清空栈并推入第一个节点
  slotEditStack.value = [];
  const nodeName = getNodeName(selectedNodeId.value);
  pushSlotEdit(selectedNodeId.value, nodeName);
};

// 面包屑点击处理
const handleBreadcrumbClick = (index, item) => {
  if (item.isRoot) {
    // 点击根节点，退出槽编辑
    exitSlotEdit();
  } else {
    // 跳转到指定层级（index - 1 因为 breadcrumbItems 第一个是根）
    jumpToSlotEdit(index - 1);
  }
};



const rest = () => dragZoomRef.value.reset();

// 设备尺寸预设
const deviceSizes = [
  // PC 桌面
  {
    label: "1920×1080",
    value: "1920*1080",
    description: "桌面 FHD",
    icon: "desktop_windows",
  },
  {
    label: "1366×768",
    value: "1366*768",
    description: "桌面 HD",
    icon: "desktop_windows",
  },
  {
    label: "1440×900",
    value: "1440*900",
    description: "桌面宽屏",
    icon: "desktop_windows",
  },
  {
    label: "1680×1050",
    value: "1680*1050",
    description: "桌面大屏",
    icon: "desktop_windows",
  },

  // 平板
  {
    label: "1024×768",
    value: "1024*768",
    description: "iPad 标准",
    icon: "tablet_mac",
  },
  {
    label: "1080×810",
    value: "1080*810",
    description: "iPad Air",
    icon: "tablet_mac",
  },
  {
    label: "1112×834",
    value: "1112*834",
    description: "iPad Pro 11",
    icon: "tablet_mac",
  },
  {
    label: "1366×1024",
    value: "1366*1024",
    description: "iPad Pro 12.9",
    icon: "tablet_mac",
  },

  // 手机
  {
    label: "375×667",
    value: "375*667",
    description: "iPhone SE",
    icon: "phone_android",
  },
  {
    label: "375×812",
    value: "375*812",
    description: "iPhone 12/13",
    icon: "phone_android",
  },
  {
    label: "390×844",
    value: "390*844",
    description: "iPhone 14",
    icon: "phone_android",
  },
  {
    label: "393×851",
    value: "393*851",
    description: "Android 旗舰",
    icon: "phone_android",
  },
  {
    label: "360×640",
    value: "360*640",
    description: "Android 标准",
    icon: "phone_android",
  },

  // 自定义
  {
    label: "自定义",
    value: "custom",
    description: "输入自定义尺寸",
    icon: "tune",
  },
];

const filteredOptions = ref(deviceSizes);

// 过滤尺寸选项
const filterSizes = (val, update) => {
  if (val === "") {
    update(() => {
      filteredOptions.value = deviceSizes;
    });
    return;
  }

  update(() => {
    const needle = val.toLowerCase();
    filteredOptions.value = deviceSizes.filter(
      (size) =>
        (size.label && size.label.toLowerCase().indexOf(needle) > -1) ||
        (size.description &&
          size.description.toLowerCase().indexOf(needle) > -1) ||
        (size.value && size.value.toLowerCase().indexOf(needle) > -1),
    );
  });
};
const pageSize = computed(() => {
  return _project.pageSize().split("*");
});
const resize = computed(() => {
  return "height:" + pageSize.value[1] + "px;width:" + pageSize.value[0] + "px";
});

const initProj = () => {
  nodeUnSelected();
};

// 🔥 监听后端数据加载完成，重新初始化（解决时序问题）
watch(
  () => _projectManger.isInitialized,
  (isReady) => {
    if (isReady) {
      console.log("📡 [uiContainer] 后端数据加载完成，重新初始化");
      initProj();
    }
  },
  { immediate: true }
);

// 监听文件切换
watch(
  () => _project.projectData?.directory?.currentSelect,
  (val) => {
    if (val !== undefined) {
      initProj();
    }
  },
);

const update = (selectedValue) => {
  let sizeValue;

  // 处理选择的值
  if (typeof selectedValue === "object" && selectedValue.value) {
    sizeValue = selectedValue.value;
  } else if (typeof selectedValue === "string") {
    // 检查是否是自定义输入的格式（如 "800*600"）
    if (selectedValue.includes("*") || selectedValue.includes("×")) {
      sizeValue = selectedValue.replace("×", "*");
    } else {
      sizeValue = selectedValue;
    }
  } else {
    sizeValue = selectedValue;
  }

  // 如果是自定义选项，不设置具体尺寸
  if (sizeValue === "custom") {
    return;
  }

  // 验证格式并设置尺寸
  if (sizeValue && (sizeValue.includes("*") || sizeValue.includes("×"))) {
    const normalizedSize = sizeValue.replace("×", "*");
    _project.setPageSize(normalizedSize);
  } else if (sizeValue) {
    // 如果是纯文本输入，尝试解析
    _project.setPageSize(sizeValue);
  }
};

const clear = () => {
  $q.dialog({
    dark: true,
    title: '确认清空',
    message: '确定要清空画布吗？此操作不可撤销。',
    cancel: {
      label: '取消',
      flat: true,
      color: 'grey'
    },
    ok: {
      label: '清空',
      flat: true,
      color: 'negative'
    },
    persistent: true
  }).onOk(() => {
    // 直接更新 store 中的 dragEditor 数据
    _project.updateEditorData("dragEditor", []);
    // 清空节点图
    clearGraph();
  });
};

function nodeSelected(id) {
  if (dragAreaRef.value) {
    const elementWithNodeId = dragAreaRef.value.querySelector(
      `[nodeid="${id}"]`,
    );
    if (elementWithNodeId) {
      const rootElement = document.querySelectorAll(".selectStyle");

      rootElement.forEach((element) => {
        element.classList.remove("selectStyle");
      });

      elementWithNodeId.classList.add("selectStyle");
    }
  }
}

defineExpose({
  nodeUnSelected,
  nodeSelected,
  initProj,
  globalDisplayMode,
});

</script>
