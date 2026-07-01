// Three.js supported model formats — each entry maps a format name to its
// loader class + file extensions + how to extract the Object3D from the
// loader's result.

export const MODEL_FORMATS = [
  { value: "GLTF", label: "glTF / GLB", extensions: ".gltf,.glb", loaderKey: "gltf", extract: "gltf.scene" },
  { value: "OBJ", label: "OBJ", extensions: ".obj", loaderKey: "obj", extract: "obj" },
  { value: "FBX", label: "FBX", extensions: ".fbx", loaderKey: "fbx", extract: "obj" },
  { value: "STL", label: "STL", extensions: ".stl", loaderKey: "stl", extract: "new THREE.Mesh(obj, new THREE.MeshStandardMaterial({color:0xaaaaaa}))" },
  { value: "PLY", label: "PLY", extensions: ".ply", loaderKey: "ply", extract: "new THREE.Mesh(obj, new THREE.MeshStandardMaterial({color:0xaaaaaa,vertexColors:true}))" },
  { value: "Collada", label: "Collada (DAE)", extensions: ".dae", loaderKey: "collada", extract: "obj.scene" },
  { value: "3MF", label: "3MF", extensions: ".3mf", loaderKey: "threemf", extract: "obj" },
  { value: "VRML", label: "VRML / X3DV", extensions: ".vrml,.wrl", loaderKey: "vrml", extract: "obj" },
  { value: "PCD", label: "PCD (Point Cloud)", extensions: ".pcd", loaderKey: "pcd", extract: "obj" },
  { value: "PDB", label: "PDB (Protein)", extensions: ".pdb", loaderKey: "pdb", extract: "obj" },
  { value: "VTK", label: "VTK", extensions: ".vtk", loaderKey: "vtk", extract: "obj" },
  { value: "XYZ", label: "XYZ (Point Cloud)", extensions: ".xyz", loaderKey: "xyz", extract: "obj" },
  { value: "KMZ", label: "KMZ (Google Earth)", extensions: ".kmz", loaderKey: "kmz", extract: "obj.scene" },
  { value: "TDS", label: "3DS (Autodesk)", extensions: ".3ds", loaderKey: "tds", extract: "obj" },
  { value: "VOX", label: "VOX (MagicaVoxel)", extensions: ".vox", loaderKey: "vox", extract: "obj" },
  { value: "BVH", label: "BVH (Motion Capture)", extensions: ".bvh", loaderKey: "bvh", extract: "obj.scene" },
];

export function getFormatDef(value) {
  return MODEL_FORMATS.find((f) => f.value === value);
}

export const ALL_MODEL_EXTENSIONS = MODEL_FORMATS.map((f) => f.extensions).join(",");
