/**
 * Meta2D component export strategy.
 *
 * Exports editor canvas data as a self-contained Vue SFC for project preview/runtime.
 * The runtime component registers the same Meta2D extended diagram pens as the editor,
 * otherwise sequence/class/flow/activity/echarts pens cannot render correctly.
 *
 * Runtime deps (@meta2d/* + echarts) and the /icon iconfont assets this SFC loads are
 * provided by the frontend-starter template at project creation, not copied at export time.
 */

import { getVueStudioHost, transformVueSfc } from "../shared/compile.js";

function generateSFC(options = {}) {
  const meta2dData = options.meta2dData || { pens: [] };
  const dataLiteral = JSON.stringify(meta2dData, null, 2);
  const initialLocked = 1;
  const meta2dOptions = {
    color: meta2dData.color || "#1890ff",
    activeColor: meta2dData.activeColor || "#40a9ff",
    hoverColor: meta2dData.hoverColor || "#69c0ff",
    anchorColor: meta2dData.anchorColor || "#1890ff",
    anchorRadius: meta2dData.anchorRadius ?? 4,
    anchorBackground: meta2dData.anchorBackground || "#fff",
    dockColor: meta2dData.dockColor || "#1890ff",
    dragColor: meta2dData.dragColor || "#1890ff",
    animateColor: meta2dData.animateColor || "#1890ff",
    textColor: meta2dData.textColor || "#ffffff",
    fontFamily:
      meta2dData.fontFamily ||
      '"Hiragino Sans GB", "Microsoft YaHei", "Helvetica Neue", Helvetica, Arial',
    fontSize: meta2dData.fontSize ?? 12,
    lineHeight: meta2dData.lineHeight ?? 1.5,
    textAlign: meta2dData.textAlign || "center",
    textBaseline: meta2dData.textBaseline || "middle",
    hoverCursor: meta2dData.hoverCursor || "pointer",
    disableInput: meta2dData.disableInput ?? false,
    disableRotate: meta2dData.disableRotate ?? false,
    disableAnchor: meta2dData.disableAnchor ?? false,
    autoAnchor: meta2dData.autoAnchor ?? true,
    disableEmptyLine: meta2dData.disableEmptyLine ?? true,
    disableRepeatLine: meta2dData.disableRepeatLine ?? true,
    disableScale: meta2dData.disableScale ?? false,
    disableTranslate: meta2dData.disableTranslate ?? false,
    minScale: meta2dData.minScale ?? 0.1,
    maxScale: meta2dData.maxScale ?? 10,
    keydown: meta2dData.keydown ?? true,
    background: meta2dData.background || "#1e1e1e",
    grid: meta2dData.grid ?? true,
    gridColor: meta2dData.gridColor || "#333333",
    gridSize: meta2dData.gridSize ?? 20,
    rule: meta2dData.rule ?? false,
    autoExpand: meta2dData.autoExpand ?? true,
    padding: meta2dData.padding ?? 100,
  };
  const optionsLiteral = JSON.stringify(meta2dOptions, null, 2);

  return `<template>
  <div ref="canvasRef" class="meta2d-page"></div>
</template>

<script setup>
import { ref, shallowRef, onMounted, onBeforeUnmount } from "vue";

const meta2dData = ${dataLiteral};
const meta2dOptions = ${optionsLiteral};
const initialLocked = ${initialLocked};

const canvasRef = ref(null);
const meta2d = shallowRef(null);
let Meta2dCtor = null;
let resizeObserver = null;
let diagramPensRegistered = false;
const iconFontCssList = [
  "/icon/通用图标/iconfont.css",
  "/icon/国家电网/iconfont.css",
  "/icon/电气工程/iconfont.css",
];

function ensureIconFontCss() {
  for (const href of iconFontCssList) {
    if (document.querySelector('link[href="' + href + '"]')) continue;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = href;
    document.head.appendChild(link);
  }
}

async function registerDiagramPens() {
  if (diagramPensRegistered) return;

  const core = await import("@meta2d/core");
  const [chart, sequence, classDiagram, flow, activity, echartsMod] =
    await Promise.all([
      import("@meta2d/chart-diagram"),
      import("@meta2d/sequence-diagram"),
      import("@meta2d/class-diagram"),
      import("@meta2d/flow-diagram"),
      import("@meta2d/activity-diagram"),
      import("echarts"),
    ]);

  core.register(classDiagram.classPens());
  core.register(sequence.sequencePens());
  core.registerCanvasDraw(sequence.sequencePensbyCtx());
  core.register(flow.flowPens());
  core.registerAnchors(flow.flowAnchors());
  core.register(activity.activityDiagram());
  core.registerCanvasDraw(activity.activityDiagramByCtx());
  chart.register(echartsMod);

  diagramPensRegistered = true;
}

function ensureMeta2d() {
  if (meta2d.value || !Meta2dCtor || !canvasRef.value) return;
  if (!canvasRef.value.clientWidth || !canvasRef.value.clientHeight) return;

  meta2d.value = new Meta2dCtor(canvasRef.value, meta2dOptions);
  meta2d.value.open(
    JSON.parse(
      JSON.stringify({
        ...meta2dData,
        locked: initialLocked,
      }),
    ),
  );
  meta2d.value.lock(initialLocked);
  meta2d.value.fitView();
}

onMounted(async () => {
  ({ Meta2d: Meta2dCtor } = await import("@meta2d/core"));
  ensureIconFontCss();
  await registerDiagramPens();

  resizeObserver = new ResizeObserver(() => {
    ensureMeta2d();
    meta2d.value?.resize();
  });

  resizeObserver.observe(canvasRef.value);
  ensureMeta2d();
});

onBeforeUnmount(() => {
  resizeObserver?.disconnect();
  resizeObserver = null;
  meta2d.value?.destroy();
  meta2d.value = null;
});
</script>

<style scoped>
.meta2d-page {
  display: block;
  width: 100%;
  height: 100%;
  min-height: 360px;
  background: ${JSON.stringify(meta2dOptions.background)};
}
</style>
`;
}

function compile(code, rootPath, baseUrl) {
  return transformVueSfc(code, rootPath, baseUrl);
}

function generatePreviewScript(_code, { importMap }) {
  const studioHost = getVueStudioHost();
  const studioPrefix = `http://${studioHost}`;
  const vuePath = importMap?.vue
    ? studioPrefix + importMap.vue
    : `${studioPrefix}/node_modules/.q-cache/dev-spa/vite-spa/deps/vue.js`;

  return `
import { createApp } from "${vuePath}";

const app = createApp(__sfc__);
window.__vueApp__ = app;
app.mount("#app");
`;
}

export default {
  type: "vue",
  hasDragEditor: false,
  compile,
  generateSFC,
  generatePreviewScript,
};
