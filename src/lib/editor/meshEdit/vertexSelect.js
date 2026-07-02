// Vertex selection — place helper spheres at each unique vertex, raycast spheres.
// Reference: TertiusAxis MeshEdit.js addSpheresToVertices() + getVertices()
//
// Vertices are deduplicated by position. Each unique vertex gets a small sphere
// that can be raycast. Selected vertices are highlighted with a larger sphere.

import * as THREE from "three";

const SPHERE_RADIUS = 0.06;
const HOVER_COLOR = 0xff8800;
const SELECT_COLOR = 0x22d3ee;
const DEFAULT_COLOR = 0x888888;

export class VertexSelector {
  constructor() {
    this.spheres = [];        // { sphere, vertexIndex, pointIndices }
    this.group = null;        // THREE.Group containing all spheres
    this.targetMesh = null;
    this.vertices = [];       // unique vertex positions
    this.vertexToPoints = []; // vertexIndex → [pointIndex, ...]
    this.hoverSphere = null;
    this.selectedIndices = [];
  }

  setTarget(mesh) {
    this.targetMesh = mesh;
    this.clear();
    if (!mesh || !mesh.geometry) return;
    this._buildVertices();
    this._createSpheres();
  }

  _buildVertices() {
    const pos = this.targetMesh.geometry.attributes.position;
    this.vertices = [];
    this.vertexToPoints = [];
    // Deduplicate by position
    const seen = new Map();
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      const z = pos.getZ(i);
      const key = `${x.toFixed(5)},${y.toFixed(5)},${z.toFixed(5)}`;
      if (seen.has(key)) {
        this.vertexToPoints[seen.get(key)].push(i);
      } else {
        const vIdx = this.vertices.length;
        this.vertices.push({ x, y, z });
        this.vertexToPoints.push([i]);
        seen.set(key, vIdx);
      }
    }
  }

  _createSpheres() {
    this.group = new THREE.Group();
    this.group.userData.__isEditHelper = true;
    this.targetMesh.updateMatrixWorld(true);
    const sphereGeo = new THREE.SphereGeometry(SPHERE_RADIUS, 10, 6);
    const mat = new THREE.MeshBasicMaterial({
      color: DEFAULT_COLOR,
      depthTest: false,
      transparent: true,
      opacity: 0.8,
    });
    for (let i = 0; i < this.vertices.length; i++) {
      const v = this.vertices[i];
      const sphere = new THREE.Mesh(sphereGeo, mat.clone());
      // Position in mesh local space (group is child of mesh)
      sphere.position.set(v.x, v.y, v.z);
      sphere.userData.vertexIndex = i;
      sphere.userData.__isEditHelper = true;
      sphere.renderOrder = 999;
      this.group.add(sphere);
      this.spheres.push({ sphere, vertexIndex: i });
    }
    // Add group as child of mesh so it follows mesh transform
    this.targetMesh.add(this.group);
  }

  // raycast against spheres (not the mesh)
  raycast(raycaster) {
    if (!this.group) return null;
    const intersects = raycaster.intersectObjects(this.group.children, false);
    if (intersects.length > 0) {
      return intersects[0].object.userData.vertexIndex;
    }
    return null;
  }

  onHover(vertexIndex) {
    // Reset all to default
    for (const s of this.spheres) {
      s.sphere.material.color.setHex(DEFAULT_COLOR);
      s.sphere.scale.setScalar(1);
    }
    // Highlight selected
    for (const idx of this.selectedIndices) {
      if (this.spheres[idx]) {
        this.spheres[idx].sphere.material.color.setHex(SELECT_COLOR);
        this.spheres[idx].sphere.scale.setScalar(1.5);
      }
    }
    // Highlight hover
    if (vertexIndex != null && !this.selectedIndices.includes(vertexIndex)) {
      if (this.spheres[vertexIndex]) {
        this.spheres[vertexIndex].sphere.material.color.setHex(HOVER_COLOR);
        this.spheres[vertexIndex].sphere.scale.setScalar(1.3);
      }
    }
  }

  toggleSelect(vertexIndex) {
    if (vertexIndex == null) return;
    const idx = this.selectedIndices.indexOf(vertexIndex);
    if (idx >= 0) {
      this.selectedIndices.splice(idx, 1);
    } else {
      this.selectedIndices.push(vertexIndex);
    }
    this.onHover(null); // refresh colors
  }

  getSelectedIndices() {
    return [...this.selectedIndices];
  }

  clear() {
    if (this.group && this.group.parent) {
      this.group.parent.remove(this.group);
      // Dispose
      this.group.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
        if (o.material) o.material.dispose();
      });
    }
    this.group = null;
    this.spheres = [];
    this.vertices = [];
    this.vertexToPoints = [];
    this.selectedIndices = [];
  }

  dispose() {
    this.clear();
    this.targetMesh = null;
  }
}
