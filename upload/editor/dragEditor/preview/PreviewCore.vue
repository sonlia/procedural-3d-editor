<template>
  <div class="preview-core" ref="previewContainer"></div>
</template>

<script setup>
import { ref, onMounted, watch, onUnmounted, useTemplateRef, computed, toRef } from "vue";
import { loadImportMap, getImportMap } from "../../codeStrategies/vueComponent/compile.js";
import {
  getCurrentRootPath,
} from "../../../leftWidget/folder/useFileTree.js";
import { useProjectMangerStore } from "src/stores/projectMange.js";
import codeStrategy from "../../codeStrategies/index.js";
import { createUpdateData } from "./previewUtils.js";
import { globalSlotEditNodeId } from "../composables/useSimpleInteraction.js";

import PreviewTemplate from "./preview.html?raw";

const projectStore = useProjectMangerStore();

// 获取项目运行的 baseurl（从 store 中获取，降级使用当前页面 host）
const getBaseUrl = () => {
  const runningUrl = projectStore.currentRunningUrl;
  if (runningUrl) {
    try {
      const url = new URL(runningUrl);
      return url.host;
    } catch (e) {
      console.warn("[Preview] Invalid running URL:", runningUrl);
    }
  }
  // 降级：使用当前页面 host
  return new URL(import.meta.url).host;
};

const getStudioUrl = () => `${window.location.protocol}//${window.location.host}`;

// Import Map 加载状态
const importMapLoaded = ref(false);

const previewContainer = useTemplateRef("previewContainer");
const emits = defineEmits(["iframe-ready"]);

let proxy = null;
let iframeElement = null;
let cleanupEventForwarding = null;

// Props: 支持两种模式
// 1. 直接传入 dataSource（用于 purePreviewContainer）
// 2. 传入 mode + selectedNodeId（用于 nestedDraggable）
const props = defineProps({
  dataSource: {
    type: String,
    default: "",
  },
  mode: {
    type: String,
    default: "",
    validator: (value) => !value || ["preview", "production", "slotEditor"].includes(value),
  },
  selectedNodeId: {
    type: String,
    default: null,
  },
});

// 将 props 转换为响应式 ref，以便传递给 createUpdateData
const modeRef = toRef(props, 'mode');

// 缓存 createUpdateData 返回的 computed（只创建一次）
// 注意：createUpdateData 返回的是 computed，不能在外层 computed 内部每次都调用
// 必须传入 ref 以保持响应式，createUpdateData 内部会用 unref 解包
const modeBasedDataSource = createUpdateData(modeRef, globalSlotEditNodeId);

// production 模式预览时，判断是否需要在启动脚本中包裹 QLayout 上下文
const needsLayoutWrapper = computed(() => {
  if (props.mode !== 'production') return false;
  const currentNodeId = projectStore.getCurrentSelect();
  const routeConfig = currentNodeId ? projectStore.getRouteConfig(currentNodeId) : null;
  return !!(routeConfig?.layoutId);
});

// 计算最终的数据源
const computedDataSource = computed(() => {
  // 优先使用直接传入的 dataSource
  if (props.dataSource) return props.dataSource;

  // 否则使用缓存的 mode 计算结果（modeBasedDataSource 内部会响应 modeRef 的变化）
  return modeBasedDataSource.value;
});

// 事件转发 - 用于 iframe 内的缩放等操作
function setupEventForwarding(iframe) {
  const iframeDoc = iframe.contentDocument;
  const eventListeners = [];
  const eventsToForward = ['wheel', 'pointerdown', 'pointerup', 'pointermove', 'contextmenu'];

  function forwardEvent(e) {
    // 阻止 contextmenu 和 wheel 的默认行为
    // wheel: 滚轮事件只用于外部缩放，iframe 内部滚动由用户通过滚动条手动操作
    if (e.type === 'contextmenu' || e.type === 'wheel') {
      e.preventDefault();
    }

    const iframeRect = iframe.getBoundingClientRect();
    const previewEl = previewContainer.value;
    const originalWidth = previewEl?.offsetWidth || iframe.offsetWidth;
    const originalHeight = previewEl?.offsetHeight || iframe.offsetHeight;

    const scaleX = iframeRect.width / originalWidth;
    const scaleY = iframeRect.height / originalHeight;

    if (scaleX === 0 || scaleY === 0 || !isFinite(scaleX) || !isFinite(scaleY)) {
      return;
    }

    const eventInit = {
      bubbles: true,
      cancelable: true,
      view: window,
      clientX: e.clientX * scaleX + iframeRect.left,
      clientY: e.clientY * scaleY + iframeRect.top,
      screenX: e.screenX,
      screenY: e.screenY,
      button: e.button,
      buttons: e.buttons,
      ctrlKey: e.ctrlKey,
      altKey: e.altKey,
      shiftKey: e.shiftKey,
      metaKey: e.metaKey,
    };

    if (e.type === 'wheel') {
      eventInit.deltaX = e.deltaX;
      eventInit.deltaY = e.deltaY;
      eventInit.deltaZ = e.deltaZ;
      eventInit.deltaMode = e.deltaMode;
    }

    let newEvent;
    if (e.type === 'wheel') {
      newEvent = new WheelEvent(e.type, eventInit);
    } else if (e.type.startsWith('pointer')) {
      newEvent = new PointerEvent(e.type, eventInit);
    } else {
      newEvent = new MouseEvent(e.type, eventInit);
    }

    const targetElement = previewContainer.value?.parentElement;
    if (targetElement) {
      targetElement.dispatchEvent(newEvent);
    }
  }

  eventsToForward.forEach(eventType => {
    const listener = (e) => forwardEvent(e);
    iframeDoc.addEventListener(eventType, listener, { passive: false, capture: true });
    eventListeners.push({ type: eventType, listener });
  });

  return () => {
    eventListeners.forEach(({ type, listener }) => {
      iframeDoc.removeEventListener(type, listener, { capture: true });
    });
  };
}

// 创建沙盒
async function createSandbox() {
  // 动态获取 baseurl
  const baseurl = getBaseUrl();
  const srcdoc = PreviewTemplate
    .replaceAll("--baseurl--", `http://${baseurl}/`)
    .replaceAll("--studio-url--", getStudioUrl());

  // 先加载 Import Map
  // 始终从当前编辑器服务加载 Import Map，因为它是编辑器提供的功能
  await loadImportMap();
  importMapLoaded.value = true;

  const template = document.createElement("iframe");
  template.setAttribute("frameborder", "0");
  template.setAttribute(
    "sandbox",
    [
      "allow-forms",
      "allow-modals",
      "allow-pointer-lock",
      "allow-popups",
      "allow-same-origin",
      "allow-scripts",
      "allow-top-navigation-by-user-activation",
    ].join(" "),
  );

  template.style = "width: 100%; height:100%";
  template.srcdoc = srcdoc;
  previewContainer.value?.appendChild(template);

  iframeElement = template;

  template.onload = () => {
    proxy = createProxy(template, baseurl);
    cleanupEventForwarding = setupEventForwarding(template);
    emits("iframe-ready", template);
  };
}

// 创建代理，监听数据变化并编译
function createProxy(iframe, baseurl) {
  let _iframe = iframe;
  let _compileId = 0; // 编译版本号，用于丢弃过时的编译结果

  const stopWatch = watch(
    () => computedDataSource.value,
    (code) => {
      // 跳过 null 值（表示 nodeEditorData 无效，不应更新）
      if (code === null) {
         return;
      }
       compile(code);
    },
    { immediate: true }
  );

  // 生成最终脚本
  function generateLastScript() {
    const importMap = getImportMap() || {};
    return codeStrategy.generatePreviewScript(null, { baseUrl: baseurl, importMap, hasLayout: needsLayoutWrapper.value });
  }

  function compile(code) {
    if (!_iframe) return;

    const currentId = ++_compileId;

    if (!code?.trim()) {
      _iframe.contentWindow?.postMessage(
        { type: "eval", code: [] },
        "*",
      );
      return;
    }

    const lastScript = generateLastScript();

    // 调用统一调度器编译（内部自动根据 codeStrategy 分发）
    codeStrategy.compile(code, getCurrentRootPath(), baseurl)
      .then((x) => {
        // 丢弃过时的编译结果，只发送最新的
        if (!_iframe || currentId !== _compileId) return;
        const codeToEval = [x + lastScript];
        _iframe.contentWindow?.postMessage({ type: "eval", code: codeToEval }, "*");
      })
      .catch((err) => {
        if (!_iframe || currentId !== _compileId) return;
        console.error("[Preview] Compile error:", err);
        _iframe?.contentWindow?.postMessage({
          type: "eval",
          code: [`console.error("Compile Error:", ${JSON.stringify(err.message || String(err))})`]
        }, "*");
      });
  }

  function destroy() {
    _iframe?.remove();
    _iframe = null;
    stopWatch?.();
  }

  return {
    compile,
    destroy,
  };
}

// 暴露 iframe 元素给父组件
defineExpose({
  getIframe: () => iframeElement,
});

onMounted(createSandbox);

// 监听项目 runningUrl 变化：端口不固定，每次启动都可能不同
// 当 runningUrl 变化时，需要重建 sandbox 以更新 <base> 标签
watch(
  () => projectStore.currentRunningUrl,
  (newUrl, oldUrl) => {
    if (newUrl === oldUrl) return;
    // 有新的 runningUrl 或 runningUrl 被清除，重建 sandbox
    cleanupEventForwarding?.();
    proxy?.destroy();
    iframeElement = null;
    proxy = null;
    cleanupEventForwarding = null;
    // 清空容器
    if (previewContainer.value) {
      previewContainer.value.innerHTML = "";
    }
    createSandbox();
  },
);

onUnmounted(() => {
  cleanupEventForwarding?.();
  proxy?.destroy();
});
</script>

<style scoped>
.preview-core {
  width: 100%;
  height: 100%;
  overflow: hidden;
}
</style>
