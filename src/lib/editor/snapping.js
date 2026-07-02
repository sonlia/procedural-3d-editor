// Snapping module — vertex/edge snapping for object transforms.
// When enabled, moving an object near another object's vertex snaps to it.

import * as THREE from "three";

export class Snapper {
  constructor() {
    this.enabled = false;
    this.threshold = 0.3; // world-space distance threshold
    this.snapIndicator = null; // THREE.Mesh sphere to show snap point
  }

  // Collect all vertices from all meshes in userGroup (excluding the moving object)
  collectVertices(userGroup, excludeObject) {
    const verts = [];
    userGroup.traverse((o) => {
      if (!o.isMesh || o === excludeObject) return;
      if (o.userData?.__isDefault === false && o.userData?.__isMultiSelect) return;
      if (!o.geometry || !o.geometry.attributes.position) return;
      o.updateMatrixWorld(true);
      const pos = o.geometry.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        const v = new THREE.Vector3().fromBufferAttribute(pos, i);
        v.applyMatrix4(o.matrixWorld);
        verts.push(v);
      }
    });
    return verts;
  }

  // Find nearest vertex to the given world position, within threshold
  findNearest(worldPos, vertices) {
    if (!this.enabled || vertices.length === 0) return null;
    let nearest = null;
    let nearestDist = this.threshold;
    for (const v of vertices) {
      const d = worldPos.distanceTo(v);
      if (d < nearestDist) {
        nearestDist = d;
        nearest = v.clone();
      }
    }
    return nearest;
  }

  // Create or update the snap indicator (small sphere at snap point)
  updateIndicator(scene, snapPoint) {
    if (!this.snapIndicator) {
      const geo = new THREE.SphereGeometry(0.08, 12, 8);
      const mat = new THREE.MeshBasicMaterial({
        color: 0xff00ff,
        depthTest: false,
        transparent: true,
        opacity: 0.9,
      });
      this.snapIndicator = new THREE.Mesh(geo, mat);
      this.snapIndicator.renderOrder = 999;
      scene.add(this.snapIndicator);
    }
    if (snapPoint) {
      this.snapIndicator.position.copy(snapPoint);
      this.snapIndicator.visible = true;
    } else {
      this.snapIndicator.visible = false;
    }
  }

  dispose(scene) {
    if (this.snapIndicator) {
      scene.remove(this.snapIndicator);
      this.snapIndicator.geometry.dispose();
      this.snapIndicator.material.dispose();
      this.snapIndicator = null;
    }
  }
}

// Flip face normals of a geometry (reverses winding order)
export function flipNormals(geometry) {
  if (!geometry.index) {
    // Non-indexed: swap every 2 vertices in each triangle
    const pos = geometry.attributes.position;
    const arr = pos.array;
    for (let i = 0; i < arr.length; i += 9) {
      // Swap v1 and v2 (indices 3-5 with 6-8)
      const tmp = [arr[i + 3], arr[i + 4], arr[i + 5]];
      arr[i + 3] = arr[i + 6];
      arr[i + 4] = arr[i + 7];
      arr[i + 5] = arr[i + 8];
      arr[i + 6] = tmp[0];
      arr[i + 7] = tmp[1];
      arr[i + 8] = tmp[2];
    }
    pos.needsUpdate = true;
  } else {
    // Indexed: reverse each triangle's index order
    const idx = geometry.index;
    const arr = idx.array;
    for (let i = 0; i < arr.length; i += 3) {
      const tmp = arr[i + 1];
      arr[i + 1] = arr[i + 2];
      arr[i + 2] = tmp;
    }
    idx.needsUpdate = true;
  }
  // Recompute normals
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  geometry.computeBoundingBox();
}

// Mirror geometry along an axis ('x', 'y', or 'z')
export function mirrorGeometry(geometry, axis) {
  const pos = geometry.attributes.position;
  const arr = pos.array;
  const axisIndex = axis === "x" ? 0 : axis === "y" ? 1 : 2;
  for (let i = 0; i < arr.length; i += 3) {
    arr[i + axisIndex] = -arr[i + axisIndex];
  }
  pos.needsUpdate = true;
  // Flip normals after mirroring (mirroring inverts winding)
  flipNormals(geometry);
}
