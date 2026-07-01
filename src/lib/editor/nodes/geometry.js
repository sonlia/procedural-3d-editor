// GeometryNode — creates a primitive geometry (Box/Sphere/Cylinder/Plane/Cone/Torus)
// and wraps it in a default mesh so it can be added directly to the scene.
//
// Pattern: uses bgJsCode (runtime-executed code) to create the geometry + mesh,
// and jsCode (declarative) to expose the mesh as __out_<id> for downstream nodes.
//
// The viewport's bgJsCode executor runs this code with THREE + ctx in scope.

import { NodeMeta, numProp, strProp, safeVarSuffix } from "../nodeMeta.js";
import { registerNode } from "../registry.js";

export const GEOMETRY_TYPES = [
  { value: "Box", label: "Box (立方体)" },
  { value: "Sphere", label: "Sphere (球体)" },
  { value: "Cylinder", label: "Cylinder (圆柱)" },
  { value: "Plane", label: "Plane (平面)" },
  { value: "Cone", label: "Cone (圆锥)" },
  { value: "Torus", label: "Torus (圆环)" },
];

export class GeometryNode extends NodeMeta {
  static widgets = [
    {
      name: "type",
      type: "select",
      label: "Geometry Type",
      options: { values: GEOMETRY_TYPES.map((t) => t.value) },
      optionsFull: GEOMETRY_TYPES.map((t) => ({ value: t.value, label: t.label })),
    },
    { name: "width", type: "number", label: "Width / Diameter", min: 0.01, step: 0.1 },
    { name: "height", type: "number", label: "Height", min: 0.01, step: 0.1 },
    { name: "depth", type: "number", label: "Depth", min: 0.01, step: 0.1 },
    { name: "segments", type: "number", label: "Segments", min: 1, max: 128, step: 1 },
  ];

  constructor() {
    super();
    this.title = "Geometry";
    this.properties = {
      type: "Box",
      width: 1,
      height: 1,
      depth: 1,
      segments: 32,
    };
    // Output an Object3D (mesh) so it can connect directly to SceneOutput
    this.addOutput("object", "object");
  }

  onExecute() {
    const id = this.id;
    const idStr = JSON.stringify(String(id));
    const type = strProp(this, "type", "Box");
    const w = numProp(this, "width", 1);
    const h = numProp(this, "height", 1);
    const d = numProp(this, "depth", 1);
    const seg = Math.max(1, Math.floor(numProp(this, "segments", 32)));

    // Build the geometry creation expression based on type
    let geoCreate;
    switch (type) {
      case "Sphere":
        geoCreate = `new THREE.SphereGeometry(${Math.max(0.01, w / 2)}, ${seg}, ${Math.max(1, Math.floor(seg / 2))})`;
        break;
      case "Cylinder":
        geoCreate = `new THREE.CylinderGeometry(${Math.max(0.01, w / 2)}, ${Math.max(0.01, w / 2)}, ${Math.max(0.01, h)}, ${seg})`;
        break;
      case "Plane":
        geoCreate = `new THREE.PlaneGeometry(${Math.max(0.01, w)}, ${Math.max(0.01, h)}, ${seg}, ${seg})`;
        break;
      case "Cone":
        geoCreate = `new THREE.ConeGeometry(${Math.max(0.01, w / 2)}, ${Math.max(0.01, h)}, ${seg})`;
        break;
      case "Torus":
        geoCreate = `new THREE.TorusGeometry(${Math.max(0.01, w / 2)}, ${Math.max(0.01, h / 4)}, ${seg}, ${seg})`;
        break;
      case "Box":
      default:
        geoCreate = `new THREE.BoxGeometry(${Math.max(0.01, w)}, ${Math.max(0.01, h)}, ${Math.max(0.01, d)}, 1, 1, 1)`;
        break;
    }

    // bgJsCode: runtime code that creates geometry + mesh and stores in ctx.__meshes[id]
    this.bgJsCode = `
// GeometryNode #${id} (${type})
if (!ctx.__meshes) ctx.__meshes = {};
if (!ctx.__geometries) ctx.__geometries = {};
// Dispose old geometry if it exists
if (ctx.__geometries[${idStr}]) {
  try { ctx.__geometries[${idStr}].dispose(); } catch (e) {}
}
ctx.__geometries[${idStr}] = ${geoCreate};
// Create or reuse mesh
let __mesh = ctx.__meshes[${idStr}];
if (!__mesh) {
  const __mat = new THREE.MeshStandardMaterial({ color: 0x4ade80, roughness: 0.4, metalness: 0.1 });
  __mesh = new THREE.Mesh(ctx.__geometries[${idStr}], __mat);
  __mesh.castShadow = true;
  __mesh.receiveShadow = true;
  ctx.__meshes[${idStr}] = __mesh;
} else {
  __mesh.geometry = ctx.__geometries[${idStr}];
}
__mesh.userData.nodeId = ${idStr};
`;

    // jsCode: expose the mesh as __out_<safeVar> (reads from ctx.__meshes which bgJsCode populated)
    const outVar = `__out_${safeVarSuffix(id)}`;
    this.jsCode = `const ${outVar} = ctx.__meshes?.[${idStr}] || null;`;
  }

  static get title() { return "Geometry"; }
  static get id() { return "primitive/geometry"; }
  static get treePath() { return "SOP"; }
  static get color() { return "#4ade80"; }
}

registerNode(GeometryNode);

