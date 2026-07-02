import { Subgraph, nodeMeta, uiNodeMeta } from "../nodeMetea.js";

const newNodeList = import.meta.glob(
  ["./**/*.js", "!./**/_*.js", "!./**/index.js", "!./**/utils.js"],
  { eager: true },
);
const baseNodeList = import.meta.glob("./**/index.js", { eager: true });

const merge = {};

// Helper function to check and merge valid node classes
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

// 自动处理当前目录及其子目录的js文件  baseNodeList加载 index.js 文件
// newNodeList 加载其他目录的js文件，
// 需要排除加载的加下划线
// 处理 baseNodeList
Object.entries(baseNodeList).forEach(([key, value]) => {
  if (value && value.nodeList) {
    mergeValidNodes(merge, value.nodeList);
  }
});

// 处理 newNodeList
Object.entries(newNodeList).forEach(([key, value]) => {
  mergeValidNodes(merge, value);
});

export default merge;
