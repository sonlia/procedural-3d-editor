// SceneSOP — a Subgraph node that represents the scene.
// Double-click to enter the subgraph and add geometry/camera/light nodes inside.
// The subgraph's output is a THREE.Scene that the viewport renders.

import { Subgraph, safeVarSuffix } from "../nodeMeta.js";
import { registerNode } from "../registry.js";
import { LiteGraph } from "../litegraph.js";

export class SceneSOPNode extends Subgraph {
  constructor() {
    super();
    this.title = "Scene SOP";
    this.color = "#51cf66";
    // Output: a scene object
    this.addOutput("scene", "object");
    // Set up the inner subgraph with a default SceneOutput terminal node
    this._initInnerGraph();
  }

  _initInnerGraph() {
    // Add a SceneOutput terminal node inside the subgraph
    const out = LiteGraph.createNode("Output/output/scene");
    out.pos = [400, 200];
    this.subgraph.add(out);
    // Mark it as the subgraph output
    this.subgraph.output_node_type = "graph/output";
  }

  onExecute() {
    // Run the inner subgraph
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
      console.warn(`[SceneSOP ${this.id}] subgraph runStep failed:`, e);
    }

    // Collect jsCode + bgJsCode from inner nodes
    const innerNodes = this.subgraph._nodes_executable || this.subgraph._nodes || [];
    const jsCodeLines = [];
    const bgJsCodeLines = [];
    for (const n of innerNodes) {
      if (n.jsCode?.trim()) jsCodeLines.push(n.jsCode.trim());
      if (n.bgJsCode?.trim()) bgJsCodeLines.push(n.bgJsCode.trim());
    }

    // Expose the inner SceneOutput's result as our output
    const outVar = `__out_${safeVarSuffix(this.id)}`;
    const sceneOutNode = innerNodes.find((n) => n.type === "Output/output/scene");
    const sceneRef = sceneOutNode
      ? `__out_${safeVarSuffix(sceneOutNode.id)}`
      : "null";

    this.bgJsCode = bgJsCodeLines.join("\n\n");
    this.jsCode = `
// SceneSOP #${this.id}
${jsCodeLines.join("\n\n")}
const ${outVar} = ${sceneRef};
`;
  }

  static get title() { return "Scene SOP"; }
  static get id() { return "sop/scene"; }
  static get treePath() { return "SOP"; }
  static get color() { return "#51cf66"; }
}

registerNode(SceneSOPNode);
