// Edge selection — place helper cylinders along each unique edge, raycast cylinders.
// Edges are extracted from face index pairs, deduplicated as undirected.
//
// Reference: TertiusAxis concept + our own edge extraction

import * as THREE from "three";

const CYL_RADIUS = 0.025;
const HOVER_COLOR = 0xff8800;
const SELECT_COLOR = 0x22d3ee;
const DEFAULT_COLOR = 0x888888;

export class EdgeSelector {
  constructor() {
    this.cylinders = [];     // { mesh, edgeKey, v1, v2 }
    this.group = null;
    this.targetMesh = null;
    this.edges = [];         // { v1, v2, key } unique edges (point indices)
    this.selectedKeys = [];
  }

  setTarget(mesh) {
    this.targetMesh = mesh;
    this.clear();
    if (!mesh || !mesh.geometry) return;
    this._buildEdges();
    this._createCylinders();
  }

  _buildEdges() {
    const geo = this.targetMesh.geometry;
    const index = geo.index;
    const pos = geo.attributes.position;
    const seen = new Set();
    this.edges = [];

    const triCount = index ? index.count / 3 : pos.count / 3;
    for (let i = 0; i < triCount; i++) {
      const a = index ? index.getX(i * 3) : i * 3;
      const b = index ? index.getX(i * 3 + 1) : i * 3 + 1;
      const c = index ? index.getX(i * 3 + 2) : i * 3 + 2;
      for (const [p1, p2] of [[a, b], [b, c], [c, a]]) {
        const key = p1 < p2 ? `${p1}-${p2}` : `${p2}-${p1}`;
        if (!seen.has(key)) {
          seen.add(key);
          this.edges.push({ v1: p1, v2: p2, key });
        }
      }
    }
  }

  _createCylinders() {
    this.group = new THREE.Group();
    this.group.userData.__isEditHelper = true;
    const cylGeo = new THREE.CylinderGeometry(CYL_RADIUS, CYL_RADIUS, 1, 6);
    const mat = new THREE.MeshBasicMaterial({
      color: DEFAULT_COLOR,
      depthTest: false,
      transparent: true,
      opacity: 0.7,
    });
    const pos = this.targetMesh.geometry.attributes.position;
    const up = new THREE.Vector3(0, 1, 0);

    for (let i = 0; i < this.edges.length; i++) {
      const edge = this.edges[i];
      const va = new THREE.Vector3().fromBufferAttribute(pos, edge.v1);
      const vb = new THREE.Vector3().fromBufferAttribute(pos, edge.v2);
      const dir = new THREE.Vector3().subVectors(vb, va);
      const len = dir.length();
      const center = new THREE.Vector3().addVectors(va, vb).multiplyScalar(0.5);

      const cyl = new THREE.Mesh(cylGeo, mat.clone());
      cyl.position.copy(center);
      cyl.scale.set(1, len, 1);
      cyl.quaternion.setFromUnitVectors(up, dir.normalize());
      cyl.userData.edgeIndex = i;
      cyl.userData.edgeKey = edge.key;
      cyl.userData.__isEditHelper = true;
      cyl.renderOrder = 999;
      this.group.add(cyl);
      this.cylinders.push({ mesh: cyl, edgeKey: edge.key, edgeIndex: i });
    }
    this.targetMesh.add(this.group);
  }

  raycast(raycaster) {
    if (!this.group) return null;
    const intersects = raycaster.intersectObjects(this.group.children, false);
    if (intersects.length > 0) {
      return intersects[0].object.userData.edgeIndex;
    }
    return null;
  }

  onHover(edgeIndex) {
    for (const c of this.cylinders) {
      c.mesh.material.color.setHex(DEFAULT_COLOR);
      c.mesh.scale.setScalar(1);
      c.mesh.scale.y = 1; // reset y after setScalar
    }
    // Re-apply y scale
    for (const c of this.cylinders) {
      // Recalculate proper scale
    }
    // Highlight selected
    for (const idx of this.selectedKeys) {
      if (this.cylinders[idx]) {
        this.cylinders[idx].mesh.material.color.setHex(SELECT_COLOR);
      }
    }
    if (edgeIndex != null && !this.selectedKeys.includes(edgeIndex)) {
      if (this.cylinders[edgeIndex]) {
        this.cylinders[edgeIndex].mesh.material.color.setHex(HOVER_COLOR);
      }
    }
  }

  toggleSelect(edgeIndex) {
    if (edgeIndex == null) return;
    const idx = this.selectedKeys.indexOf(edgeIndex);
    if (idx >= 0) {
      this.selectedKeys.splice(idx, 1);
    } else {
      this.selectedKeys.push(edgeIndex);
    }
    this.onHover(null);
  }

  getSelectedIndices() {
    return [...this.selectedKeys];
  }

  clear() {
    if (this.group && this.group.parent) {
      this.group.parent.remove(this.group);
      this.group.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
        if (o.material) o.material.dispose();
      });
    }
    this.group = null;
    this.cylinders = [];
    this.edges = [];
    this.selectedKeys = [];
  }

  dispose() {
    this.clear();
    this.targetMesh = null;
  }
}
