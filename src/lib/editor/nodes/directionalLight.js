// DirectionalLight node — emits a THREE.DirectionalLight positioned by properties.

import { NodeMeta, numProp, strProp, vec3Prop, safeVarSuffix } from "../nodeMeta.js";
import { registerNode } from "../registry.js";

export class DirectionalLightNode extends NodeMeta {
  static widgets = [
    { name: "color", type: "color", label: "Color" },
    { name: "intensity", type: "number", label: "Intensity", min: 0, step: 0.1 },
    { name: "position", type: "vector3", label: "Position" },
  ];

  constructor() {
    super();
    this.title = "Directional Light";
    this.properties = {
      color: "#ffffff",
      intensity: 1.0,
      position: [5, 8, 4],
    };
    this.addOutput("light", "light");
  }

  onExecute() {
    const id = this.id;
    const outVar = `__out_${safeVarSuffix(id)}`;
    const idStr = JSON.stringify(String(id));
    const color = strProp(this, "color", "#ffffff");
    const intensity = numProp(this, "intensity", 1.0);
    const pos = vec3Prop(this, "position", [5, 8, 4]);
    this.jsCode = `
// DirectionalLight #${id}
const ${outVar} = new THREE.DirectionalLight(
  new THREE.Color(${JSON.stringify(color)}),
  ${intensity}
);
${outVar}.position.set(${pos[0]}, ${pos[1]}, ${pos[2]});
${outVar}.userData.nodeId = ${idStr};
`;
  }

  static get title() { return "Directional Light"; }
  static get id() { return "scene/directional_light"; }
  static get treePath() { return "Scene"; }
  static get color() { return "#fde047"; }
}

registerNode(DirectionalLightNode);
