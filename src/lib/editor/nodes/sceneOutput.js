// SceneOutput terminal node — collects objects/cameras/lights from its inputs
// and produces a THREE.Scene that the viewport renders.
//
// Inputs:
//   0: object — THREE.Object3D
//   1: camera — THREE.Camera
//   2: light  — THREE.Light

import { NodeMeta, inputVar, safeVarSuffix } from "../nodeMeta.js";
import { registerNode } from "../registry.js";

export class SceneOutputNode extends NodeMeta {
  constructor() {
    super();
    this.title = "Scene Output";
    this.properties = {};
    this.addInput("object", "object");
    this.addInput("camera", "camera");
    this.addInput("light", "light");
  }

  onExecute() {
    const id = this.id;
    const outVar = `__out_${safeVarSuffix(id)}`;
    const idStr = JSON.stringify(String(id));
    const objRef = inputVar(this, 0);
    const camRef = inputVar(this, 1);
    const lightRef = inputVar(this, 2);
    this.jsCode = `
// SceneOutput #${id} (terminal)
const ${outVar} = (() => {
  if (!ctx.__scenes) ctx.__scenes = {};
  let scene = ctx.__scenes[${idStr}];
  if (!scene) {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0a0a);
    ctx.__scenes[${idStr}] = scene;
  }
  let userGroup = scene.getObjectByName("__user__");
  if (!userGroup) {
    userGroup = new THREE.Group();
    userGroup.name = "__user__";
    scene.add(userGroup);
  }
  for (let i = userGroup.children.length - 1; i >= 0; i--) {
    const c = userGroup.children[i];
    if (c.userData && c.userData.__addedBySceneOutput) {
      userGroup.remove(c);
    }
  }
  const addObject = (obj) => {
    if (!obj) return;
    if (obj.isObject3D) {
      obj.userData.__addedBySceneOutput = true;
      userGroup.add(obj);
    }
  };
  addObject(${objRef});
  addObject(${lightRef});
  if (${camRef} && ${camRef}.isCamera) {
    scene.userData.__camera = ${camRef};
  } else {
    scene.userData.__camera = null;
  }
  scene.userData.nodeId = ${idStr};
  return scene;
})();
`;
  }

  static get title() { return "Scene Output"; }
  static get id() { return "output/scene"; }
  static get treePath() { return "Output"; }
  static get color() { return "#fde047"; }
}

registerNode(SceneOutputNode);
