// ImportModel node — imports a 3D model file (any Three.js-supported format).
//
// Pattern (mirrors user's RAR pattern in upload/editor/nodeEditor/node/logicNode/jsBase/console.js):
//   - constructor: set properties + addOutput
//   - onExecute: read this.properties.url/format, build this.jsCode
//
// Generated JS runs inside the viewport's eval scope where THREE + ctx
// (fileCache + loaders) are available. Each format's loader is keyed in
// ctx.loaders by loaderKey (set up by Viewport).

import { NodeMeta, strProp, safeVarSuffix } from "../nodeMeta.js";
import { registerNode } from "../registry.js";
import { MODEL_FORMATS, getFormatDef } from "../modelFormats.js";

export class ImportModelNode extends NodeMeta {
  // Static widget metadata — PropertiesPanel reads this to render widgets.
  static widgets = [
    { name: "url", type: "file", label: "File" },
    {
      name: "format",
      type: "select",
      label: "Format",
      options: { values: MODEL_FORMATS.map((f) => f.value) },
      optionsFull: MODEL_FORMATS.map((f) => ({ value: f.value, label: f.label })),
    },
  ];

  constructor() {
    super();
    this.title = "Import Model";
    this.properties = { url: "", format: "GLTF" };
    this.addOutput("object", "object");
  }

  onExecute() {
    const id = this.id;
    const outVar = `__out_${safeVarSuffix(id)}`;
    const url = strProp(this, "url", "");
    const formatValue = strProp(this, "format", "GLTF");
    const fmt = getFormatDef(formatValue) || MODEL_FORMATS[0];

    if (!url) {
      this.jsCode = `const ${outVar} = null; // no url set`;
      return;
    }

    this.jsCode = `
// ImportModel #${id} (${fmt.label})
const ${outVar} = (() => {
  const url = ${JSON.stringify(url)};
  const loaderKey = ${JSON.stringify(fmt.loaderKey)};
  const cacheKey = loaderKey + ":" + url;
  if (!ctx.fileCache[cacheKey]) {
    const holder = new THREE.Group();
    holder.name = "import:" + url.split("/").pop();
    holder.userData.__importState = "loading";
    holder.userData.nodeId = ${id};
    ctx.fileCache[cacheKey] = holder;
    const onLoad = (raw) => {
      const cached = ctx.fileCache[cacheKey];
      while (cached.children.length) cached.remove(cached.children[0]);
      // Extract Object3D from loader result (format-specific)
      const obj = ${fmt.extract};
      if (obj && obj.isObject3D) {
        for (const child of [...obj.children]) {
          obj.remove(child);
          cached.add(child);
        }
        cached.position.copy(obj.position);
        cached.rotation.copy(obj.rotation);
        cached.scale.copy(obj.scale);
      }
      cached.userData.__importState = "ready";
    };
    const onError = (err) => {
      console.error("ImportModel load error (" + loaderKey + "):", err);
      ctx.fileCache[cacheKey].userData.__importState = "error";
    };
    try {
      const loader = ctx.loaders[loaderKey];
      if (!loader) {
        onError(new Error("Loader not registered: " + loaderKey));
      } else {
        loader.load(url, onLoad, undefined, onError);
      }
    } catch (e) { onError(e); }
  }
  const obj = ctx.fileCache[cacheKey];
  obj.userData.nodeId = ${id};
  return obj;
})();
`;
  }

  static get title() { return "Import Model"; }
  static get id() { return "model/import"; }
  static get treePath() { return "Model"; }
  static get color() { return "#22d3ee"; }
}

registerNode(ImportModelNode);
