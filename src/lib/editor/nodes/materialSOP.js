// MaterialSOP — a Subgraph node for material setup.
// Double-click to enter and add material nodes inside.

import { Subgraph, safeVarSuffix } from "../nodeMeta.js";
import { registerNode } from "../registry.js";
import { LiteGraph } from "../litegraph.js";

export class MaterialSOPNode extends Subgraph {
  constructor() {
    super();
    this.title = "Material SOP";
    this.color = "#f87171";
    this.addOutput("material", "material");
    this._initInnerGraph();
  }

  _initInnerGraph() {
    // Empty for now — user adds material nodes inside
  }

  onExecute() {
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
      console.warn(`[MaterialSOP ${this.id}] runStep failed:`, e);
    }

    const innerNodes = this.subgraph._nodes_executable || this.subgraph._nodes || [];
    const jsCodeLines = [];
    const bgJsCodeLines = [];
    for (const n of innerNodes) {
      if (n.jsCode?.trim()) jsCodeLines.push(n.jsCode.trim());
      if (n.bgJsCode?.trim()) bgJsCodeLines.push(n.bgJsCode.trim());
    }

    const outVar = `__out_${safeVarSuffix(this.id)}`;
    this.bgJsCode = bgJsCodeLines.join("\n\n");
    this.jsCode = `
// MaterialSOP #${this.id}
${jsCodeLines.join("\n\n")}
const ${outVar} = null; // TODO: expose material output
`;
  }

  static get title() { return "Material SOP"; }
  static get id() { return "sop/material"; }
  static get treePath() { return "SOP"; }
  static get color() { return "#f87171"; }
}

registerNode(MaterialSOPNode);
