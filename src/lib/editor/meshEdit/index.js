// Mesh edit entry point — manages edit mode + delegates to selectors.

import { FaceSelector } from "./faceSelect.js";
import { VertexSelector } from "./vertexSelect.js";
import { EdgeSelector } from "./edgeSelect.js";

export { FaceSelector, VertexSelector, EdgeSelector };

export class MeshEditor {
  constructor(scene) {
    this.scene = scene;
    this.mode = "object"; // 'object' | 'face' | 'vertex' | 'edge'
    this.targetMesh = null;
    this.faceSelector = new FaceSelector();
    this.vertexSelector = new VertexSelector();
    this.edgeSelector = new EdgeSelector();
  }

  setMode(mode, mesh) {
    // Clean up previous mode
    this.faceSelector.dispose(this.scene);
    this.vertexSelector.dispose();
    this.edgeSelector.dispose();

    this.mode = mode;
    this.targetMesh = mesh;

    if (mode === "face" && mesh) {
      this.faceSelector.setTarget(mesh);
    } else if (mode === "vertex" && mesh) {
      this.vertexSelector.setTarget(mesh);
    } else if (mode === "edge" && mesh) {
      this.edgeSelector.setTarget(mesh);
    }
  }

  // Called on mouse move — returns hover info
  onHover(raycaster) {
    if (!this.targetMesh) return null;

    if (this.mode === "face") {
      const intersects = raycaster.intersectObject(this.targetMesh, false);
      return { type: "face", index: this.faceSelector.onHover(intersects, this.scene) };
    }
    if (this.mode === "vertex") {
      const idx = this.vertexSelector.raycast(raycaster);
      this.vertexSelector.onHover(idx);
      return { type: "vertex", index: idx };
    }
    if (this.mode === "edge") {
      const idx = this.edgeSelector.raycast(raycaster);
      this.edgeSelector.onHover(idx);
      return { type: "edge", index: idx };
    }
    return null;
  }

  // Called on click — returns selected indices
  onClick(raycaster, shiftKey) {
    if (!this.targetMesh) return null;

    if (this.mode === "face") {
      const intersects = raycaster.intersectObject(this.targetMesh, false);
      if (intersects.length > 0) {
        const faceIndex = intersects[0].faceIndex;
        if (!shiftKey) {
          // Clear previous selections
          this.faceSelector.clearAll(this.scene);
          this.faceSelector.setTarget(this.targetMesh);
        }
        this.faceSelector.onSelect(faceIndex, this.scene);
        return { type: "face", indices: this.faceSelector.getSelectedIndices() };
      }
      if (!shiftKey) {
        this.faceSelector.clearAll(this.scene);
        this.faceSelector.setTarget(this.targetMesh);
      }
      return { type: "face", indices: [] };
    }
    if (this.mode === "vertex") {
      const idx = this.vertexSelector.raycast(raycaster);
      if (idx != null) {
        if (!shiftKey) {
          this.vertexSelector.selectedIndices = [];
        }
        this.vertexSelector.toggleSelect(idx);
        return { type: "vertex", indices: this.vertexSelector.getSelectedIndices() };
      }
      if (!shiftKey) {
        this.vertexSelector.selectedIndices = [];
        this.vertexSelector.onHover(null);
      }
      return { type: "vertex", indices: [] };
    }
    if (this.mode === "edge") {
      const idx = this.edgeSelector.raycast(raycaster);
      if (idx != null) {
        if (!shiftKey) {
          this.edgeSelector.selectedKeys = [];
        }
        this.edgeSelector.toggleSelect(idx);
        return { type: "edge", indices: this.edgeSelector.getSelectedIndices() };
      }
      if (!shiftKey) {
        this.edgeSelector.selectedKeys = [];
        this.edgeSelector.onHover(null);
      }
      return { type: "edge", indices: [] };
    }
    return null;
  }

  dispose() {
    this.faceSelector.dispose(this.scene);
    this.vertexSelector.dispose();
    this.edgeSelector.dispose();
    this.targetMesh = null;
    this.mode = "object";
  }
}
