"use client";

import { useEffect, useRef } from "react";
import { LGraph, LGraphCanvas, LiteGraph } from "@/lib/editor/litegraph.js";
import "litegraph.js/css/litegraph.css";
import { useEditor } from "@/lib/editor/store";
import { registerAllNodes } from "@/lib/editor/registry";
// Importing node files has the side-effect of registering them via registerNode().
import "@/lib/editor/nodes/importModel.js";
import "@/lib/editor/nodes/geometry.js";
import "@/lib/editor/nodes/camera.js";
import "@/lib/editor/nodes/directionalLight.js";
import "@/lib/editor/nodes/sceneOutput.js";
import "@/lib/editor/nodes/sceneSOP.js";
import "@/lib/editor/nodes/lightingSOP.js";
import "@/lib/editor/nodes/materialSOP.js";

// Node graph canvas — uses the user's rewritten LiteGraph (src/lib/editor/litegraph.js).
//
// Pattern (mirrors upload/editor/nodeEditor/composables/useLitegraphEditor.js):
//   - createIns(canvasRef) — instantiate LGraph + LGraphCanvas
//   - graphcanvas.startRendering() — internal RAF for canvas drawing
//   - graph.runStep() NOT called automatically — our Viewport drives evaluation
//     via compileGraph() each frame
//   - selection callbacks update the store
//   - onAfterChange bumps store.version so the Viewport re-evaluates

export function NodeGraph() {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);

  useEffect(() => {
    if (!canvasRef.current || !containerRef.current) return;

    // Register all custom node types
    registerAllNodes();

    // Create graph + canvas
    const graph = new LGraph();
    const canvas = new LGraphCanvas(canvasRef.current, graph, {
      autoresize: false,
    });

    // dark theme
    canvas.background_color = "#0a0a0a";
    canvas.default_connection_color = "#555555";
    canvas.default_link_color = "#888888";
    canvas.clear_background = true;
    canvas.allow_searchbox = true;
    canvas.allow_dragnodes = true;
    canvas.title_text_font = "12px Tahoma, sans-serif";

    // register in store + window globals (so codeStrategy & tests can read them)
    useEditor.getState().setGraph(graph);
    window._graph = graph;
    window._graphcanvas = canvas;
    window._editorStore = useEditor;

    // ---- selection ----
    const syncSelection = () => {
      const selMap = canvas.selected_nodes || {};
      // LiteGraph with use_uuids=true uses string UUIDs. Keep them as-is.
      const ids = Object.keys(selMap);
      useEditor.getState().setSelectedNodeIds(ids);
    };
    canvas.onNodeSelected = syncSelection;
    canvas.onNodeDeselected = syncSelection;
    canvas.onSelectionChange = syncSelection;

    // ---- change tracking (mirrors user's onAfterChange pattern) ----
    const markDirty = () => {
      // Mark all nodes dirty so onExecute runs again on next compile
      for (const n of graph._nodes || []) n._dirty = true;
      useEditor.getState().bumpVersion();
    };
    graph.onAfterChange = markDirty;
    graph.onAfterConnectionChange = markDirty;
    graph.onAfterAddedNode = () => {
      useEditor.getState().pushHistory("Add node");
      markDirty();
    };
    graph.onAfterRemovedNode = () => {
      useEditor.getState().pushHistory("Remove node");
      markDirty();
    };

    // ---- start canvas rendering ----
    canvas.startRendering();

    // ---- build a default starter graph so the viewport has something to show ----
    buildDefaultScene(graph);

    // ---- resize ----
    const resize = () => {
      const c = containerRef.current;
      const cv = canvasRef.current;
      if (!c || !cv) return;
      const w = c.clientWidth;
      const h = c.clientHeight;
      const dpr = window.devicePixelRatio || 1;
      cv.width = w * dpr;
      cv.height = h * dpr;
      cv.style.width = `${w}px`;
      cv.style.height = `${h}px`;
      canvas.resize(w, h);
      canvas.setDirty(true, true);
    };
    const ro = new ResizeObserver(resize);
    ro.observe(containerRef.current);
    resize();

    return () => {
      ro.disconnect();
      try { canvas.stopRendering(); } catch {}
      try { graph.stop(); } catch {}
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full bg-[#0a0a0a] overflow-hidden"
    >
      <canvas
        ref={canvasRef}
        className="lgraphcanvas absolute inset-0 w-full h-full"
        onContextMenu={(e) => e.preventDefault()}
      />
      <div className="absolute top-2 right-2 z-10 bg-black/60 backdrop-blur-sm rounded px-2 py-1 text-[10px] font-mono text-zinc-400 pointer-events-none border border-zinc-700/50">
        Double-click empty area to add nodes · drag from output to input to connect
      </div>
    </div>
  );
}

// Default scene: 3 empty SOP nodes + 2 standalone geometry nodes (Box + Sphere).
// SOP subgraphs are empty — user adds nodes inside by double-clicking.
// Viewport auto-adds a default camera + light when no light nodes exist.
function buildDefaultScene(graph) {
  for (const n of [...(graph.nodes ?? graph._nodes ?? [])]) graph.remove(n);
  graph.links = {};
  graph.last_node_id = 0;
  graph.last_link_id = 0;

  // Lighting SOP — empty (double-click to add lights inside)
  const lighting = LiteGraph.createNode("SOP/sop/lighting");
  lighting.pos = [60, 80];
  graph.add(lighting);

  // Material SOP — empty
  const material = LiteGraph.createNode("SOP/sop/material");
  material.pos = [60, 260];
  graph.add(material);

  // Scene SOP — empty
  const scene = LiteGraph.createNode("SOP/sop/scene");
  scene.pos = [60, 440];
  graph.add(scene);

  // Standalone Box geometry
  const box = LiteGraph.createNode("SOP/primitive/geometry");
  box.pos = [320, 80];
  box.properties = { type: "Box", width: 1.5, height: 1.5, depth: 1.5, segments: 1 };
  graph.add(box);

  // Standalone Sphere geometry
  const sphere = LiteGraph.createNode("SOP/primitive/geometry");
  sphere.pos = [320, 260];
  sphere.properties = { type: "Sphere", width: 1.5, height: 1.5, depth: 1.5, segments: 32 };
  graph.add(sphere);

  useEditor.getState().bumpVersion();
}
