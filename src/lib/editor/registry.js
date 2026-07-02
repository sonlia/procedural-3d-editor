// Node registry — collects all node classes (subclasses of NodeMeta).
// Mirrors the registration pattern in upload/editor/nodeEditor/node/index.js
// where each node file registers itself via registerNode(cls).

const REGISTRY = [];

export function registerNode(cls) {
  REGISTRY.push(cls);
  return cls;
}

export function getAllNodeClasses() {
  return REGISTRY;
}

// Look up a registered class by LiteGraph type string ("treePath/id").
export function findNodeClass(type) {
  for (const cls of REGISTRY) {
    const fullType = `${cls.treePath}/${cls.id}`;
    if (fullType === type) return cls;
    if (cls.id === type) return cls;
  }
  return null;
}

// Register all classes with LiteGraph. Call once on editor init.
import { LiteGraph } from "./litegraph.js";

let registered = false;
export function registerAllNodes() {
  if (registered) return;
  registered = true;
  for (const cls of REGISTRY) {
    const type = `${cls.treePath}/${cls.id}`;
    try {
      Object.defineProperty(cls, "category", {
        value: cls.treePath,
        writable: true,
        configurable: true,
      });
    } catch (e) {
      // ignore
    }
    LiteGraph.registerNodeType(type, cls);
  }
}
