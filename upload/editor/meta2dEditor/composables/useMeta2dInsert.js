/**
 * useMeta2dInsert.js
 * Meta2D「资源选择」特性逻辑层。
 * 职责:把资源节点 / SVG 文本 构造成 meta2d pen,并居中插入当前视图。
 * 只读 import meta2dInstance(不编辑 useMeta2dEditor.js,避免与并行 WIP 纠缠)。
 */
import { cloneDeep } from "lodash-es";
import { uid } from "quasar";
import { meta2dInstance } from "./useMeta2dEditor.js";
import { getResourceUrl } from "src/components/leftWidget/resources/useResourceTree.js";

/**
 * 把一组 pen 居中插入到当前视图中心并选中。
 * @param {Array} pens 世界坐标的 pen 数组(parseSvg 输出或自建)
 * @returns {Promise<Array>} 实际插入的 pen 列表
 */
export async function addPensAtViewCenter(pens) {
  const m2d = meta2dInstance.value;
  if (!m2d || !Array.isArray(pens) || pens.length === 0) return [];

  const list = cloneDeep(pens);
  const { scale, origin } = m2d.store.data;
  const { width: vw, height: vh } = m2d.canvas;

  // 视图中心反算到世界坐标
  const worldCx = (vw / 2 - origin.x) / scale;
  const worldCy = (vh / 2 - origin.y) / scale;

  // 根 pen(无 parentId);子 pen 是相对父的比例坐标,跟随父 pen,无需偏移
  const roots = list.filter((p) => !p.parentId);
  if (roots.length === 0) return [];
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of roots) {
    const x = p.x ?? 0;
    const y = p.y ?? 0;
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x + (p.width ?? 0));
    maxY = Math.max(maxY, y + (p.height ?? 0));
  }

  // 整体偏移,使根 pen 的 bbox 中心对齐视图中心
  const dx = worldCx - (minX + maxX) / 2;
  const dy = worldCy - (minY + maxY) / 2;
  for (const p of roots) {
    p.x = (p.x ?? 0) + dx;
    p.y = (p.y ?? 0) + dy;
  }

  await m2d.addPens(list, true, true); // history + abs(传世界坐标)
  m2d.active(roots);
  m2d.render();
  return list;
}

/** 构造图片 pen(世界坐标,左上角 0,0,100x100) */
function buildImagePen(image) {
  return { id: uid(), name: "image", x: 0, y: 0, width: 100, height: 100, image };
}

/**
 * SVG 文本 → pen 数组。优先 @meta2d/svg parseSvg(可编辑矢量),失败回退图片 pen。
 * @param {string} svgText
 * @param {string} [fallbackUrl] 回退图片 pen 的 url;无则用 data: url
 * @returns {Promise<Array>}
 */
export async function parseSvgTextToPens(svgText, fallbackUrl) {
  try {
    const { parseSvg } = await import("@meta2d/svg");
    const pens = parseSvg(svgText);
    if (Array.isArray(pens) && pens.length > 0) return pens;
    throw new Error("parseSvg empty");
  } catch {
    const url =
      fallbackUrl ||
      `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgText)}`;
    return [buildImagePen(url)];
  }
}

/** 插入一个资源节点(image 或 svg) */
export async function insertResource(node) {
  if (!node) return;
  const url = getResourceUrl(node);
  const type = node.type || node.meta?.type;
  const mime = node.meta?.mimeType || "";
  const isSvg = type === "svg" || mime === "image/svg+xml";

  if (isSvg) {
    let svgText = "";
    try {
      svgText = await fetch(url).then((r) => r.text());
    } catch {
      await addPensAtViewCenter([buildImagePen(url)]);
      return;
    }
    await addPensAtViewCenter(await parseSvgTextToPens(svgText, url));
  } else {
    await addPensAtViewCenter([buildImagePen(url)]);
  }
}
