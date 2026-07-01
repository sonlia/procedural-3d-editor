// LightingSOP — a Subgraph node for lighting setup.
// Double-click to enter and add light nodes inside.

import { Subgraph, safeVarSuffix } from "../nodeMeta.js";
import { registerNode } from "../registry.js";
import { LiteGraph } from "../litegraph.js";

export class LightingSOPNode extends Subgraph {
  constructor() {
    super();
    this.title = "Lighting SOP";
    this.color = "#fde047";
    this.addOutput("lights", "light");
    this._initInnerGraph();
  }

  _initInnerGraph() {
    // Add a default directional light inside
    const light = LiteGraph.createNode("Scene/scene/directional_light");
    light.pos = [100, 100];
    this.subgraph.add(light);
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
      console.warn(`[LightingSOP ${this.id}] runStep failed:`, e);
    }

    const innerNodes = this.subgraph._nodes_executable || this.subgraph._nodes || [];
    const jsCodeLines = [];
    const bgJsCodeLines = [];
    const lightVars = [];
    for (const n of innerNodes) {
      if (n.jsCode?.trim()) {
        jsCodeLines.push(n.jsCode.trim());
        // Collect light output vars
        if (n.type?.includes("light")) {
          lightVars.push(`__out_${safeVarSuffix(n.id)}`);
        }
      }
      if (n.bgJsCode?.trim()) bgJsCodeLines.push(n.bgJsCode.trim());
    }

    const outVar = `__out_${safeVarSuffix(this.id)}`;
    this.bgJsCode = bgJsCodeLines.join("\n\n");
    this.jsCode = `
// LightingSOP #${this.id}
${jsCodeLines.join("\n\n")}
const ${outVar} = ${lightVars[0] || "null"};
`;
  }

  static get title() { return "Lighting SOP"; }
  static get id() { return "sop/lighting"; }
  static get treePath() { return "SOP"; }
  static get color() { return "#fde047"; }
}

registerNode(LightingSOPNode);
