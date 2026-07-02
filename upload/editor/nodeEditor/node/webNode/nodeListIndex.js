import { Subgraph, nodeMeta, uiNodeMeta } from "../nodeMetea.js";

const newNodeList = import.meta.glob(
  ["./**/*.js", "!./**/_*.js", "!./**/index.js"],
  { eager: true },
);
const baseNodeList = import.meta.glob("./**/index.js", { eager: true });

const merge = {};

// 只接收 prototype 继承自 Subgraph/nodeMeta/uiNodeMeta 的导出:
// 防止子目录里的纯工具函数 / 常量被误注册为 LiteGraph 节点导致 prototype 缺失抛错
function mergeValidNodes(target, sourceModule) {
  if (!sourceModule) return;
  Object.keys(sourceModule).forEach((exportKey) => {
    const exported = sourceModule[exportKey];
    if (
      exported &&
      (exported.prototype instanceof Subgraph ||
        exported.prototype instanceof nodeMeta ||
        exported.prototype instanceof uiNodeMeta)
    ) {
      target[exportKey] = exported;
    }
  });
}

Object.entries(baseNodeList).forEach(([_key, value]) => {
  if (value && value.nodeList) {
    mergeValidNodes(merge, value.nodeList);
  }
});

Object.entries(newNodeList).forEach(([_key, value]) => {
  mergeValidNodes(merge, value);
});

export default merge;
