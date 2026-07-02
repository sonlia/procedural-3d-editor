/**
 * Meta2D 节点列表索引
 * 仅保留 3 个统一节点：图形、事件、动效
 */
import { ShapeNode, EventNode, AnimateNode } from "./meta2dUnifiedNodes.js";

export default {
  "meta2d/统一/图形节点": ShapeNode,
  "meta2d/统一/事件节点": EventNode,
  "meta2d/统一/动效节点": AnimateNode,
};
