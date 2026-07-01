// Camera node — emits a THREE.PerspectiveCamera positioned by properties.

import { NodeMeta, numProp, vec3Prop, safeVarSuffix } from "../nodeMeta.js";
import { registerNode } from "../registry.js";

export class CameraNode extends NodeMeta {
  static widgets = [
    { name: "fov", type: "number", label: "FOV", min: 10, max: 170, step: 1 },
    { name: "near", type: "number", label: "Near", min: 0.01, step: 0.01 },
    { name: "far", type: "number", label: "Far", step: 1 },
    { name: "position", type: "vector3", label: "Position" },
    { name: "lookAt", type: "vector3", label: "Look At" },
  ];

  constructor() {
    super();
    this.title = "Camera";
    this.properties = {
      fov: 50, near: 0.1, far: 2000,
      position: [7, 5, 9], lookAt: [0, 0, 0],
    };
    this.addOutput("camera", "camera");
  }

  onExecute() {
    const id = this.id;
    const outVar = `__out_${safeVarSuffix(id)}`;
    const idStr = JSON.stringify(String(id));
    const fov = numProp(this, "fov", 50);
    const near = numProp(this, "near", 0.1);
    const far = numProp(this, "far", 2000);
    const pos = vec3Prop(this, "position", [7, 5, 9]);
    const la = vec3Prop(this, "lookAt", [0, 0, 0]);
    this.jsCode = `
// Camera #${id}
const ${outVar} = (() => {
  if (!ctx.__cameras) ctx.__cameras = {};
  let cam = ctx.__cameras[${idStr}];
  if (!cam) {
    cam = new THREE.PerspectiveCamera(${fov}, ctx.aspect || 1, ${near}, ${far});
    ctx.__cameras[${idStr}] = cam;
  }
  cam.fov = ${fov};
  cam.near = ${near};
  cam.far = ${far};
  cam.aspect = ctx.aspect || 1;
  cam.updateProjectionMatrix();
  cam.position.set(${pos[0]}, ${pos[1]}, ${pos[2]});
  cam.lookAt(${la[0]}, ${la[1]}, ${la[2]});
  cam.userData.nodeId = ${idStr};
  return cam;
})();
`;
  }

  static get title() { return "Camera"; }
  static get id() { return "scene/camera"; }
  static get treePath() { return "Scene"; }
  static get color() { return "#22d3ee"; }
}

registerNode(CameraNode);
