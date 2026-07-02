// Node base classes — mirrors the pattern from upload/editor/nodeEditor/node/nodeMetea.js
// but stripped of Vue/Quasar dependencies, kept minimal for the 3D editor.
//
// Each node:
//   - constructor(): set this.properties, addInput/addOutput, set this.title
//   - onExecute(): read this.getInputData(i) for upstream slot values, read
//     this.properties.xxx for properties, then set this.jsCode (a JS string
//     fragment that defines this node's output)
//   - static getters: title / id / treePath / color
//
// jsCode convention: each node emits code that defines a local variable
// named `__out_<id>` representing its output. Downstream nodes reference
// upstream outputs by `__out_<id>`.
//
// The codegen (codeStrategies/index.js) walks the graph in topo order,
// calls each node's onExecute(), then concatenates all jsCode fragments
// into one body. The viewport compiles this with new Function(...) and
// executes it each frame.

import { LGraphNode, LiteGraph } from "./litegraph.js";

export class NodeMeta extends LGraphNode {
  constructor() {
    super();
    if (!this.properties) this.properties = {};
    if (this.constructor.color) this.color = this.constructor.color;
    if (this.constructor.bgcolor) this.bgcolor = this.constructor.bgcolor;
  }

  // Default onExecute — subclasses override.
  onExecute() {
    this.jsCode = `const __out_${this.id} = null;`;
  }
}

// Subgraph base class — SOP-style nodes extend this. Double-click opens the
// inner graph for editing. The inner graph runs independently.
export class Subgraph extends NodeMeta {
  constructor() {
    super();
    this.output_node_type = "graph/output";
    this.subgraph = new LiteGraph.LGraph();
    this.subgraph._subgraph_node = this;
    this.subgraph._is_subgraph = true;

    this.subgraph.onTrigger = this.onSubgraphTrigger.bind(this);
    this.subgraph.onInputAdded = this.onSubgraphNewInput.bind(this);
    this.subgraph.onInputRenamed = this.onSubgraphRenamedInput.bind(this);
    this.subgraph.onInputTypeChanged = this.onSubgraphTypeChangeInput.bind(this);
    this.subgraph.onInputRemoved = this.onSubgraphRemovedInput.bind(this);
    this.subgraph.onOutputAdded = this.onSubgraphNewOutput.bind(this);
    this.subgraph.onOutputRenamed = this.onSubgraphRenamedOutput.bind(this);
    this.subgraph.onOutputTypeChanged = this.onSubgraphTypeChangeOutput.bind(this);
    this.subgraph.onOutputRemoved = this.onSubgraphRemovedOutput.bind(this);
    this.subgraph.onNodeAdded = this.onSubgraphStructureChanged.bind(this);
    this.subgraph.onNodeRemoved = this.onSubgraphStructureChanged.bind(this);
    this.subgraph.onConnectionChange = this.onSubgraphStructureChanged.bind(this);
  }

  // Double-click opens the inner graph in the canvas
  onDblClick(e, pos, graphcanvas) {
    const subgraph = this.subgraph;
    setTimeout(() => {
      graphcanvas.openSubgraph(subgraph);
    }, 10);
  }

  onExecute() {
    // Default subgraph execution: pipe inputs through, run inner graph, pipe outputs back.
    if (this.inputs) {
      for (let i = 0; i < this.inputs.length; i++) {
        const input = this.inputs[i];
        const value = this.getInputData(i);
        this.subgraph.setInputData(input.name, value);
      }
    }
    try {
      this.subgraph.runStep();
    } catch (e) {
      console.warn(`[Subgraph ${this.id}] runStep failed:`, e);
    }
    if (this.outputs) {
      for (let i = 0; i < this.outputs.length; i++) {
        const output = this.outputs[i];
        const value = this.subgraph.getOutputData(output.name);
        this.setOutputData(i, value);
      }
    }
    // Default jsCode so the parent graph codegen still produces a valid output var
    this.jsCode = `const __out_${this.id} = null; // subgraph (no jsCode)`;
  }

  sendEventToAllNodes(eventname, param, mode) {
    this.subgraph.sendEventToAllNodes(eventname, param, mode);
  }

  onSubgraphTrigger(event, param) {
    const slot = this.findOutputSlot(event);
    if (slot != -1) this.triggerSlot(slot);
  }

  onSubgraphStructureChanged() {
    this._dirty = true;
    this.graph?.setDirtyCanvas?.(true, true);
  }

  // Stub callbacks for input/output lifecycle (subclasses can override)
  onSubgraphNewInput(input) {}
  onSubgraphRenamedInput(input) {}
  onSubgraphTypeChangeInput(input) {}
  onSubgraphRemovedInput(input) {}
  onSubgraphNewOutput(output) {}
  onSubgraphRenamedOutput(output) {}
  onSubgraphTypeChangeOutput(output) {}
  onSubgraphRemovedOutput(output) {}
}

// ---------- helpers ----------

export function numProp(node, name, fallback = 0) {
  const v = node.properties?.[name];
  return typeof v === "number" && !Number.isNaN(v) ? v : fallback;
}

export function strProp(node, name, fallback = "") {
  const v = node.properties?.[name];
  return v == null ? fallback : String(v);
}

export function vec3Prop(node, name, fallback = [0, 0, 0]) {
  const v = node.properties?.[name];
  if (Array.isArray(v) && v.length >= 3) return v.map(Number);
  return [...fallback];
}

// Read an upstream slot value at runtime — used inside onExecute to embed
// upstream `__out_<safeId>` references into jsCode.
// Note: LiteGraph with use_uuids=true produces UUIDs containing hyphens,
// which are illegal in JS identifiers. We sanitize by replacing non-word chars
// with underscores.
// Also, the user's rewritten LiteGraph stores links as OBJECTS
// {id, origin_id, origin_slot, target_id, target_slot, type} not arrays.
export function inputVar(node, slotIndex) {
  if (!node.inputs || slotIndex >= node.inputs.length) return "null";
  const input = node.inputs[slotIndex];
  if (!input || input.link == null) return "null";
  const link = node.graph?.links?.[input.link];
  if (!link) return "null";
  // Support both link formats: object {origin_id} and array [_, origin_id, ...]
  const originId = link.origin_id ?? link[1];
  if (originId == null) return "null";
  const safeId = String(originId).replace(/[^a-zA-Z0-9_]/g, "_");
  return `__out_${safeId}`;
}

// Convert a node id to a safe JS variable name suffix.
export function safeVarSuffix(id) {
  return String(id).replace(/[^a-zA-Z0-9_]/g, "_");
}
