"use client";

import { create } from "zustand";

// Simplified editor store — node graph logic will be added incrementally.
// For now we keep: graph reference, viewport state, selection, basic animation,
// simple undo/redo (snapshots), and workspace save/load.

export const useEditor = create((set, get) => ({
  // ---- graph (litegraph instance) ----
  graph: null,
  setGraph: (g) => set({ graph: g }),
  version: 0, // bump on any change to trigger re-render
  bumpVersion: () => set((s) => ({ version: s.version + 1 })),

  // ---- viewport ----
  displayMode: "solid", // solid | wireframe | points | xray | normals
  setDisplayMode: (m) => set({ displayMode: m }),
  gizmoMode: "translate", // translate | rotate | scale
  setGizmoMode: (m) => set({ gizmoMode: m }),
  // Multi-selection: array of object IDs (nodeId or uuid)
  selectedObjectIds: [],
  setSelectedObjectIds: (ids) => set({ selectedObjectIds: ids }),
  // Single selected object (for backward compat / properties panel)
  selectedObjectId: null,
  setSelectedObjectId: (id) => set({ selectedObjectId: id }),
  // Edit mode: 'object' | 'face' | 'vertex' | 'edge'
  editMode: "object",
  setEditMode: (m) => set({ editMode: m }),
  // Selected elements (vertex/edge/face indices)
  selectedElements: [],
  setSelectedElements: (els) => set({ selectedElements: els }),
  // Isolate mode: only show selected objects, hide/dim others
  isolateMode: false,
  setIsolateMode: (v) => set({ isolateMode: v }),
  // Active camera: 'default' (host camera) or a node ID
  activeCameraId: "default",
  setActiveCameraId: (id) => set({ activeCameraId: id }),
  // Datasheet highlight: { type: 'point'|'edge'|'face'|'vertex', id: number }
  // When set, viewport renders an overlay highlighting that element.
  datasheetHighlight: null,
  setDatasheetHighlight: (h) => set({ datasheetHighlight: h }),

  // ---- node selection ----
  selectedNodeIds: [],
  setSelectedNodeIds: (ids) => set({ selectedNodeIds: ids }),

  // ---- display flags ----
  // nodeId(s) marked as "display" — the viewport renders their output.
  displayFlags: [],
  toggleDisplayFlag: (nodeId) =>
    set((s) => {
      const has = s.displayFlags.includes(nodeId);
      return {
        displayFlags: has
          ? s.displayFlags.filter((id) => id !== nodeId)
          : [...s.displayFlags, nodeId],
        version: s.version + 1,
      };
    }),

  // ---- timeline / animation ----
  currentFrame: 0,
  isPlaying: false,
  fps: 24,
  frameRange: [0, 240],
  keyframes: {}, // { nodeId: { propName: [{ frame, value, interpolation }] } }
  selectedKeyframes: [],

  setCurrentFrame: (f) =>
    set((s) => ({
      currentFrame: Math.max(s.frameRange[0], Math.min(s.frameRange[1], f)),
    })),
  setIsPlaying: (p) => set({ isPlaying: p }),
  setFps: (f) => set({ fps: Math.max(1, Math.min(120, f)) }),
  setFrameRange: (r) => set({ frameRange: r }),
  setSelectedKeyframes: (ids) => set({ selectedKeyframes: ids }),

  addKeyframe: (nodeId, prop, frame, value) =>
    set((s) => {
      const k = cloneKeyframes(s.keyframes);
      const id = String(nodeId);
      if (!k[id]) k[id] = {};
      if (!k[id][prop]) k[id][prop] = [];
      const arr = k[id][prop];
      const existing = arr.findIndex((kf) => kf.frame === frame);
      if (existing >= 0) {
        arr[existing] = { ...arr[existing], value };
      } else {
        arr.push({ frame, value, interpolation: "linear" });
        arr.sort((a, b) => a.frame - b.frame);
      }
      return { keyframes: k, version: s.version + 1 };
    }),

  removeKeyframe: (nodeId, prop, index) =>
    set((s) => {
      const k = cloneKeyframes(s.keyframes);
      const id = String(nodeId);
      if (k[id]?.[prop]) {
        k[id][prop] = k[id][prop].filter((_, i) => i !== index);
        if (k[id][prop].length === 0) delete k[id][prop];
        if (Object.keys(k[id]).length === 0) delete k[id];
      }
      return { keyframes: k, version: s.version + 1 };
    }),

  moveKeyframe: (nodeId, prop, index, newFrame) =>
    set((s) => {
      const k = cloneKeyframes(s.keyframes);
      const id = String(nodeId);
      const arr = k[id]?.[prop];
      if (arr && arr[index]) {
        arr[index].frame = newFrame;
        arr.sort((a, b) => a.frame - b.frame);
      }
      return { keyframes: k, version: s.version + 1 };
    }),

  // ---- undo/redo (whole-graph snapshots) ----
  undoStack: [],
  redoStack: [],

  pushHistory: (description) =>
    set((s) => {
      const snap = snapshot(s);
      snap.description = description;
      return {
        undoStack: [...s.undoStack, snap].slice(-200),
        redoStack: [],
      };
    }),

  undo: () =>
    set((s) => {
      if (s.undoStack.length === 0) return s;
      const prev = s.undoStack[s.undoStack.length - 1];
      const current = snapshot(s);
      current.description = prev.description;
      if (s.graph && prev.graphData) {
        try {
          s.graph.configure(prev.graphData);
        } catch (e) {
          console.error("undo configure failed", e);
        }
      }
      return {
        undoStack: s.undoStack.slice(0, -1),
        redoStack: [...s.redoStack, current].slice(-200),
        keyframes: cloneKeyframes(prev.keyframes),
        frameRange: [...prev.frameRange],
        currentFrame: prev.currentFrame,
        version: s.version + 1,
      };
    }),

  redo: () =>
    set((s) => {
      if (s.redoStack.length === 0) return s;
      const next = s.redoStack[s.redoStack.length - 1];
      const current = snapshot(s);
      current.description = next.description;
      if (s.graph && next.graphData) {
        try {
          s.graph.configure(next.graphData);
        } catch (e) {
          console.error("redo configure failed", e);
        }
      }
      return {
        redoStack: s.redoStack.slice(0, -1),
        undoStack: [...s.undoStack, current].slice(-200),
        keyframes: cloneKeyframes(next.keyframes),
        frameRange: [...next.frameRange],
        currentFrame: next.currentFrame,
        version: s.version + 1,
      };
    }),

  // ---- workspace save/load ----
  loadWorkspace: (data) =>
    set((s) => {
      if (s.graph && data.graph) {
        try {
          s.graph.configure(data.graph);
        } catch (e) {
          console.error("load configure failed", e);
        }
      }
      return {
        keyframes: data.keyframes ?? {},
        frameRange: data.frameRange ?? [0, 240],
        currentFrame: data.currentFrame ?? 0,
        undoStack: [],
        redoStack: [],
        version: s.version + 1,
      };
    }),

  getWorkspace: () => {
    const s = get();
    return {
      graph: s.graph ? s.graph.serialize() : null,
      keyframes: s.keyframes,
      frameRange: s.frameRange,
      currentFrame: s.currentFrame,
    };
  },
}));

// ---- helpers ----

function cloneKeyframes(k) {
  return JSON.parse(JSON.stringify(k ?? {}));
}

function snapshot(state) {
  return {
    description: "",
    graphData: state.graph ? state.graph.serialize() : null,
    keyframes: cloneKeyframes(state.keyframes),
    frameRange: [...state.frameRange],
    currentFrame: state.currentFrame,
  };
}

// Sample a keyframe curve at a given frame (linear + bezier smoothstep).
export function sampleKeyframes(kfs, frame) {
  if (!kfs || kfs.length === 0) return null;
  if (frame <= kfs[0].frame) return kfs[0].value;
  if (frame >= kfs[kfs.length - 1].frame) return kfs[kfs.length - 1].value;
  for (let i = 0; i < kfs.length - 1; i++) {
    const a = kfs[i];
    const b = kfs[i + 1];
    if (frame >= a.frame && frame <= b.frame) {
      const t = (frame - a.frame) / (b.frame - a.frame || 1);
      if (a.interpolation === "step") return a.value;
      if (a.interpolation === "bezier") {
        const tt = t * t * (3 - 2 * t);
        return a.value + (b.value - a.value) * tt;
      }
      return a.value + (b.value - a.value) * t;
    }
  }
  return kfs[kfs.length - 1].value;
}
