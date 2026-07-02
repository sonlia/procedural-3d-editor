import { nodeMeta, uiNodeMeta } from "../nodeMetea.js";
import { Subgraph } from "../nodeMetea.js";

const newNodeList = import.meta.glob(
  ["./**/*.js", "!./**/_*.js", "!./**/index.js", "!./**/utils.js"],
  { eager: true },
);

const merge = {};

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

Object.entries(newNodeList).forEach(([key, value]) => {
  mergeValidNodes(merge, value);
});

export default merge;
