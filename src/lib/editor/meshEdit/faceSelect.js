// Face selection — raycast mesh, highlight hovered face, select on click.
// Reference: TertiusAxis MeshEdit.js highlightFace() + addTriangle()
//
// Uses faceIndex to identify faces. Creates a highlight triangle overlay
// (orange semi-transparent) on the hovered/selected face.

import * as THREE from "three";

const HIGHLIGHT_COLOR = 0xff8800;
const SELECT_COLOR = 0x22d3ee;

export class FaceSelector {
  constructor() {
    this.hoverMesh = null;      // THREE.Mesh overlay for hover
    this.selectMeshes = [];     // THREE.Mesh overlays for selected faces
    this.targetMesh = null;     // the mesh being edited
  }

  setTarget(mesh) {
    this.targetMesh = mesh;
    this.clear();
  }

  // Create highlight overlay geometry for a face
  _createFaceOverlay(faceIndex, color, opacity) {
    if (!this.targetMesh || !this.targetMesh.geometry) return null;
    const geo = this.targetMesh.geometry;
    const pos = geo.attributes.position;
    const index = geo.index;

    let a, b, c;
    if (index) {
      a = index.getX(faceIndex * 3);
      b = index.getX(faceIndex * 3 + 1);
      c = index.getX(faceIndex * 3 + 2);
    } else {
      a = faceIndex * 3;
      b = faceIndex * 3 + 1;
      c = faceIndex * 3 + 2;
    }

    const va = new THREE.Vector3().fromBufferAttribute(pos, a);
    const vb = new THREE.Vector3().fromBufferAttribute(pos, b);
    const vc = new THREE.Vector3().fromBufferAttribute(pos, c);

    const overlayGeo = new THREE.BufferGeometry().setFromPoints([va, vb, vc]);
    overlayGeo.setIndex([0, 1, 2]);
    const mat = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity,
      depthTest: false,
      side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(overlayGeo, mat);
    mesh.renderOrder = 999;
    // Copy mesh transform so overlay aligns
    mesh.position.copy(this.targetMesh.position);
    mesh.rotation.copy(this.targetMesh.rotation);
    mesh.scale.copy(this.targetMesh.scale);
    return mesh;
  }

  // Called on mouse move — highlight hovered face
  onHover(intersects, scene) {
    // Remove old hover
    if (this.hoverMesh) {
      scene.remove(this.hoverMesh);
      this.hoverMesh.geometry.dispose();
      this.hoverMesh.material.dispose();
      this.hoverMesh = null;
    }
    if (intersects.length > 0 && intersects[0].faceIndex != null) {
      this.hoverMesh = this._createFaceOverlay(intersects[0].faceIndex, HIGHLIGHT_COLOR, 0.4);
      if (this.hoverMesh) scene.add(this.hoverMesh);
      return intersects[0].faceIndex;
    }
    return null;
  }

  // Called on click — select face
  onSelect(faceIndex, scene) {
    if (faceIndex == null) return;
    const overlay = this._createFaceOverlay(faceIndex, SELECT_COLOR, 0.6);
    if (overlay) {
      this.selectMeshes.push({ faceIndex, mesh: overlay });
      scene.add(overlay);
    }
  }

  // Remove selected face by index
  removeSelected(faceIndex, scene) {
    const idx = this.selectMeshes.findIndex((s) => s.faceIndex === faceIndex);
    if (idx >= 0) {
      const item = this.selectMeshes[idx];
      scene.remove(item.mesh);
      item.mesh.geometry.dispose();
      item.mesh.material.dispose();
      this.selectMeshes.splice(idx, 1);
    }
  }

  getSelectedIndices() {
    return this.selectMeshes.map((s) => s.faceIndex);
  }

  clear() {
    // subclasses will handle scene removal
    this.hoverMesh = null;
    this.selectMeshes = [];
  }

  clearAll(scene) {
    if (this.hoverMesh) {
      scene.remove(this.hoverMesh);
      this.hoverMesh.geometry.dispose();
      this.hoverMesh.material.dispose();
      this.hoverMesh = null;
    }
    for (const s of this.selectMeshes) {
      scene.remove(s.mesh);
      s.mesh.geometry.dispose();
      s.mesh.material.dispose();
    }
    this.selectMeshes = [];
  }

  dispose(scene) {
    this.clearAll(scene);
    this.targetMesh = null;
  }
}
