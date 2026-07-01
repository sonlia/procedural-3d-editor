"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { TransformControls } from "three/examples/jsm/controls/TransformControls.js";
// All Three.js model loaders (one per format in MODEL_FORMATS)
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js";
import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader.js";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader.js";
import { PLYLoader } from "three/examples/jsm/loaders/PLYLoader.js";
import { ColladaLoader } from "three/examples/jsm/loaders/ColladaLoader.js";
import { ThreeMFLoader } from "three/examples/jsm/loaders/3MFLoader.js";
import { VRMLLoader } from "three/examples/jsm/loaders/VRMLLoader.js";
import { PCDLoader } from "three/examples/jsm/loaders/PCDLoader.js";
import { PDBLoader } from "three/examples/jsm/loaders/PDBLoader.js";
import { VTKLoader } from "three/examples/jsm/loaders/VTKLoader.js";
import { XYZLoader } from "three/examples/jsm/loaders/XYZLoader.js";
import { KMZLoader } from "three/examples/jsm/loaders/KMZLoader.js";
import { TDSLoader } from "three/examples/jsm/loaders/TDSLoader.js";
import { VOXLoader } from "three/examples/jsm/loaders/VOXLoader.js";
import { BVHLoader } from "three/examples/jsm/loaders/BVHLoader.js";
import { toast } from "sonner";
import { useEditor, sampleKeyframes } from "@/lib/editor/store";
import codeStrategy from "@/lib/editor/codeStrategies/index.js";

// Viewport:
//  - Three.js scene + camera + renderer
//  - Custom navigation: LMB=select, Alt+LMB=orbit, Alt+RMB=pan, MMB=pan, Wheel=dolly
//  - F=frame selected, A=frame all, W/E/R=gizmo modes
//  - Grid + axes (always present)
//  - Compiles the node graph into a function, runs it each frame, and renders
//    the resulting scene with the resulting camera (or falls back to the host
//    camera if the graph produces no camera)
//  - Selection raycaster identifies objects tagged with userData.nodeId

export function Viewport() {
  const containerRef = useRef(null);
  const [stats, setStats] = useState({ fps: 0, triangles: 0, drawCalls: 0 });

  const displayMode = useEditor((s) => s.displayMode);
  const gizmoMode = useEditor((s) => s.gizmoMode);
  const displayFlags = useEditor((s) => s.displayFlags);
  const isolateMode = useEditor((s) => s.isolateMode);
  const setIsolateMode = useEditor((s) => s.setIsolateMode);
  const activeCameraId = useEditor((s) => s.activeCameraId);
  const setActiveCameraId = useEditor((s) => s.setActiveCameraId);
  const version = useEditor((s) => s.version);

  const rendererRef = useRef(null);
  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const userGroupRef = useRef(null); // graph-produced scene's user content goes here
  const tcRef = useRef(null);
  const tcHelperRef = useRef(null);
  const wireframeRef = useRef(null); // wireframe overlay for selected object
  const boxSelectRef = useRef(null); // box-select rectangle overlay
  const clockRef = useRef(null);
  const boxSelectStateRef = useRef({ active: false, startX: 0, startY: 0, shift: false });
  const loadersRef = useRef({});
  const navRef = useRef({
    isPanning: false,
    isOrbiting: false,
    lastX: 0,
    lastY: 0,
    target: new THREE.Vector3(0, 0, 0),
    userNavigated: false,
    spherical: new THREE.Spherical(),
  });
  const gizmoDraggingRef = useRef(false);
  const displayModeRef = useRef(displayMode);
  const rafRef = useRef(0);
  // Persistent ctx (so __cameras/__scenes/__geometries/__meshes/__materials survive across frames)
  const ctxRef = useRef({
    __cameras: {},
    __scenes: {},
    __geometries: {},
    __meshes: {},
    __materials: {},
    fileCache: {},
    texCache: {},
  });

  useEffect(() => {
    displayModeRef.current = displayMode;
    applyDisplayMode(userGroupRef.current, displayMode);
  }, [displayMode]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // ---- renderer ----
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setClearColor(0x0a0a0a, 1);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.domElement.style.display = "block";
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // ---- scene + camera ----
    const scene = new THREE.Scene();
    sceneRef.current = scene;

    const userGroup = new THREE.Group();
    userGroup.name = "__user_scene__";
    userGroupRef.current = userGroup;
    window._viewportUserGroup = userGroup;
    scene.add(userGroup);

    // grid + axes (always present)
    const grid = new THREE.GridHelper(50, 50, 0x555555, 0x222222);
    grid.material.opacity = 0.5;
    grid.material.transparent = true;
    scene.add(grid);
    scene.add(new THREE.AxesHelper(2));

    // ---- host camera (fallback when graph has no camera) ----
    const camera = new THREE.PerspectiveCamera(
      50,
      container.clientWidth / Math.max(1, container.clientHeight),
      0.1,
      2000
    );
    camera.position.set(7, 5, 9);
    camera.lookAt(0, 0, 0);
    cameraRef.current = camera;

    const clock = new THREE.Clock();
    clockRef.current = clock;

    // Initialize all loaders (keys must match MODEL_FORMATS[].loaderKey)
    loadersRef.current = {
      gltf: new GLTFLoader(),
      obj: new OBJLoader(),
      fbx: new FBXLoader(),
      stl: new STLLoader(),
      ply: new PLYLoader(),
      collada: new ColladaLoader(),
      threemf: new ThreeMFLoader(),
      vrml: new VRMLLoader(),
      pcd: new PCDLoader(),
      pdb: new PDBLoader(),
      vtk: new VTKLoader(),
      xyz: new XYZLoader(),
      kmz: new KMZLoader(),
      tds: new TDSLoader(),
      vox: new VOXLoader(),
      bvh: new BVHLoader(),
    };

    // ---- TransformControls ----
    const tc = new TransformControls(camera, renderer.domElement);
    tcRef.current = tc;
    const tcHelper = tc.getHelper();
    tcHelperRef.current = tcHelper;
    scene.add(tcHelper);
    tc.setSize(0.8);
    tc.addEventListener("dragging-changed", (e) => {
      gizmoDraggingRef.current = e.value;
    });

    // ---- selection wireframe overlay ----
    const wireMat = new THREE.LineBasicMaterial({
      color: 0x00ffff,
      transparent: true,
      opacity: 0.9,
    });
    const wire = new THREE.LineSegments(new THREE.BufferGeometry(), wireMat);
    wire.visible = false;
    wire.userData.origMat = wireMat; // save for restoring after Box3Helper
    wireframeRef.current = wire;
    scene.add(wire);

    // ---- box-select overlay (2D rectangle in NDC space) ----
    // Uses a separate orthographic camera so it draws on top in screen space
    const boxOverlayScene = new THREE.Scene();
    const boxOverlayCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const boxMat = new THREE.MeshBasicMaterial({
      color: 0x22d3ee,
      transparent: true,
      opacity: 0.15,
      side: THREE.DoubleSide,
      depthTest: false,
      depthWrite: false,
    });
    const boxGeo = new THREE.PlaneGeometry(1, 1);
    const boxMesh = new THREE.Mesh(boxGeo, boxMat);
    boxMesh.visible = false;
    boxOverlayScene.add(boxMesh);
    boxSelectRef.current = boxMesh;
    boxSelectRef.current._scene = boxOverlayScene;
    boxSelectRef.current._camera = boxOverlayCam;

    // ---- custom navigation ----
    const dom = renderer.domElement;
    const nav = navRef.current;

    const updateSpherical = () => {
      const offset = new THREE.Vector3().copy(camera.position).sub(nav.target);
      nav.spherical.setFromVector3(offset);
    };
    updateSpherical();

    const getMouseNDC = (e) => {
      const rect = dom.getBoundingClientRect();
      return {
        x: ((e.clientX - rect.left) / rect.width) * 2 - 1,
        y: -((e.clientY - rect.top) / rect.height) * 2 + 1,
      };
    };

    const raycastSelect = (e) => {
      const ndc = getMouseNDC(e);
      const ray = new THREE.Raycaster();
      ray.setFromCamera(new THREE.Vector2(ndc.x, ndc.y), camera);
      const store = useEditor.getState();
      const isShift = e.shiftKey;

      // Object mode: select whole mesh/group
      const intersects = ray.intersectObject(userGroup, true);
      if (intersects.length > 0) {
        const hit = intersects[0].object;
        let tagged = hit;
        while (tagged && tagged.userData?.nodeId == null && tagged.parent) {
          tagged = tagged.parent;
        }
        const nodeId = tagged?.userData?.nodeId || hit.uuid;
        const objId = String(nodeId);
        if (isShift) {
          const current = store.selectedObjectIds;
          const newIds = current.includes(objId) ? current.filter((id) => id !== objId) : [...current, objId];
          store.setSelectedObjectIds(newIds);
          store.setSelectedObjectId(newIds[newIds.length - 1] || null);
          store.setSelectedNodeIds(newIds);
        } else {
          store.setSelectedObjectIds([objId]);
          store.setSelectedObjectId(objId);
          store.setSelectedNodeIds([nodeId]);
        }
        // Attach gizmo to the tagged root
        if (tagged.isObject3D && tc.object !== tagged) tc.attach(tagged);
        return;
      }
      if (!isShift) {
        store.setSelectedObjectIds([]);
        store.setSelectedObjectId(null);
        store.setSelectedNodeIds([]);
        if (tc.object) tc.detach();
      }
    };

    const onPointerDown = (e) => {
      if (gizmoDraggingRef.current || tc.axis !== null) return;
      if (e.button === 0 && e.altKey) {
        // Alt + 左键 = 旋转
        nav.isOrbiting = true;
        nav.lastX = e.clientX;
        nav.lastY = e.clientY;
        dom.style.cursor = "move";
        e.preventDefault();
      } else if (e.button === 2 && e.altKey) {
        // Alt + 右键 = 平移
        nav.isPanning = true;
        nav.lastX = e.clientX;
        nav.lastY = e.clientY;
        dom.style.cursor = "grabbing";
        e.preventDefault();
      } else if (e.button === 1) {
        // 中键 = 平移（保留习惯）
        nav.isPanning = true;
        nav.lastX = e.clientX;
        nav.lastY = e.clientY;
        dom.style.cursor = "grabbing";
        e.preventDefault();
      } else if (e.button === 0 && !e.altKey) {
        // 左键（无 Alt）= 选择 / 框选
        nav.lastX = e.clientX;
        nav.lastY = e.clientY;
        boxSelectStateRef.current = { active: true, startX: e.clientX, startY: e.clientY, shift: e.shiftKey, moved: false };
        // Don't preventDefault for left-click — let pointerup fire normally
      }
      // 右键（无 Alt）= 无操作（不旋转不平移）
    };

    const onPointerMove = (e) => {
      if (nav.isPanning) {
        const dx = e.clientX - nav.lastX;
        const dy = e.clientY - nav.lastY;
        nav.lastX = e.clientX;
        nav.lastY = e.clientY;
        const dist = camera.position.distanceTo(nav.target);
        const panScale = dist * 0.0015;
        const forward = new THREE.Vector3();
        camera.getWorldDirection(forward);
        const right = new THREE.Vector3().crossVectors(forward, camera.up).normalize();
        const up = camera.up.clone();
        const pan = new THREE.Vector3();
        pan.addScaledVector(right, -dx * panScale);
        pan.addScaledVector(up, dy * panScale);
        camera.position.add(pan);
        nav.target.add(pan);
        nav.userNavigated = true;
      } else if (nav.isOrbiting) {
        const dx = e.clientX - nav.lastX;
        const dy = e.clientY - nav.lastY;
        nav.lastX = e.clientX;
        nav.lastY = e.clientY;
        updateSpherical();
        nav.spherical.theta -= dx * 0.005;
        nav.spherical.phi -= dy * 0.005;
        nav.spherical.phi = Math.max(0.05, Math.min(Math.PI - 0.05, nav.spherical.phi));
        const offset = new THREE.Vector3().setFromSpherical(nav.spherical);
        camera.position.copy(nav.target).add(offset);
        camera.lookAt(nav.target);
        nav.userNavigated = true;
      } else if (boxSelectStateRef.current.active) {
        const bs = boxSelectStateRef.current;
        const dx = Math.abs(e.clientX - bs.startX);
        const dy = Math.abs(e.clientY - bs.startY);
        if (dx > 3 || dy > 3) {
          bs.moved = true;
          updateBoxSelectOverlay(bs.startX, bs.startY, e.clientX, e.clientY);
        }
      }
    };

    // Update the 2D box-select rectangle overlay (drawn on a separate orthographic overlay)
    const updateBoxSelectOverlay = (x1, y1, x2, y2) => {
      let overlay = boxSelectRef.current;
      if (!overlay) return;
      const rect = dom.getBoundingClientRect();
      // Normalize to NDC
      const nx1 = ((Math.min(x1, x2) - rect.left) / rect.width) * 2 - 1;
      const nx2 = ((Math.max(x1, x2) - rect.left) / rect.width) * 2 - 1;
      const ny1 = -((Math.min(y1, y2) - rect.top) / rect.height) * 2 + 1;
      const ny2 = -((Math.max(y1, y2) - rect.top) / rect.height) * 2 + 1;
      // Build a quad in NDC space
      const w = (nx2 - nx1) / 2;
      const h = (ny2 - ny1) / 2;
      const cx = (nx1 + nx2) / 2;
      const cy = (ny1 + ny2) / 2;
      overlay.position.set(cx, cy, 0);
      overlay.scale.set(w, h, 1);
      overlay.visible = true;
    };

    const onPointerUp = (e) => {
      const wasPanning = nav.isPanning;
      const wasOrbiting = nav.isOrbiting;
      nav.isPanning = false;
      nav.isOrbiting = false;
      dom.style.cursor = "default";
      // Handle left-button click (button 0) or any pointerup if box-select was active
      const bs = boxSelectStateRef.current;
      if (bs.active) {
        bs.active = false;
        if (bs.moved) {
          // Box select: raycast all objects in the rectangle
          performBoxSelect(bs.startX, bs.startY, e.clientX, e.clientY, bs.shift);
          if (boxSelectRef.current) boxSelectRef.current.visible = false;
        } else if (
          !wasPanning &&
          !wasOrbiting &&
          !gizmoDraggingRef.current
        ) {
          // Click select
          raycastSelect(e);
        }
      }
    };

    // Perform box selection: find all objects whose bounding sphere intersects the screen-space rectangle
    const performBoxSelect = (x1, y1, x2, y2, shift) => {
      const rect = dom.getBoundingClientRect();
      const nx1 = ((Math.min(x1, x2) - rect.left) / rect.width) * 2 - 1;
      const nx2 = ((Math.max(x1, x2) - rect.left) / rect.width) * 2 - 1;
      const ny1 = -((Math.max(y1, y2) - rect.top) / rect.height) * 2 + 1;
      const ny2 = -((Math.min(y1, y2) - rect.top) / rect.height) * 2 + 1;
      const store = useEditor.getState();
      const found = [];
      const foundNodeIds = [];
      userGroup.traverse((o) => {
        if (!o.isObject3D || o === userGroup) return;
        // Skip overlay meshes
        if (o === wire || o === boxSelectRef.current) return;
        // Get world position
        const pos = new THREE.Vector3();
        o.getWorldPosition(pos);
        // Project to NDC
        const ndc = pos.clone().project(camera);
        if (ndc.x >= nx1 && ndc.x <= nx2 && ndc.y >= ny1 && ndc.y <= ny2 && ndc.z < 1) {
          let tagged = o;
          while (tagged && tagged.userData?.nodeId == null && tagged.parent) tagged = tagged.parent;
          const nodeId = tagged?.userData?.nodeId || o.uuid;
          const objId = String(nodeId);
          if (!found.includes(objId)) {
            found.push(objId);
            if (nodeId && !foundNodeIds.includes(nodeId)) foundNodeIds.push(nodeId);
          }
        }
      });
      if (shift) {
        const current = store.selectedObjectIds;
        // Toggle: remove if already selected, add if not
        const merged = [...current];
        for (const id of found) {
          if (merged.includes(id)) merged.splice(merged.indexOf(id), 1);
          else merged.push(id);
        }
        store.setSelectedObjectIds(merged);
        store.setSelectedObjectId(merged[merged.length - 1] || null);
      } else {
        store.setSelectedObjectIds(found);
        store.setSelectedObjectId(found[found.length - 1] || null);
        store.setSelectedNodeIds(foundNodeIds);
      }
    };

    const onWheel = (e) => {
      e.preventDefault();
      const dist = camera.position.distanceTo(nav.target);
      const factor = Math.exp(e.deltaY * 0.001);
      const newDist = Math.max(0.1, dist * factor);
      const offset = new THREE.Vector3().subVectors(camera.position, nav.target);
      offset.normalize().multiplyScalar(newDist);
      camera.position.copy(nav.target).add(offset);
      nav.userNavigated = true;
    };

    const onContextMenu = (e) => e.preventDefault();

    dom.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    dom.addEventListener("wheel", onWheel, { passive: false });
    dom.addEventListener("contextmenu", onContextMenu);

    // ---- keyboard ----
    const frameSelected = () => {
      const selId = useEditor.getState().selectedObjectId;
      const target = new THREE.Vector3();
      let box = new THREE.Box3();
      if (selId != null) {
        userGroup.traverse((o) => {
          if (o.uuid === selId || String(o.userData?.nodeId) === selId) {
            const b = new THREE.Box3().setFromObject(o);
            if (!b.isEmpty()) box.union(b);
          }
        });
      }
      if (box.isEmpty()) box = new THREE.Box3().setFromObject(userGroup);
      if (box.isEmpty()) return;
      box.getCenter(target);
      const size = box.getSize(new THREE.Vector3()).length();
      const dist = Math.max(2, size * 1.8);
      const dir = new THREE.Vector3().subVectors(camera.position, target).normalize();
      if (dir.lengthSq() < 0.001) dir.set(1, 0.8, 1).normalize();
      camera.position.copy(target).addScaledVector(dir, dist);
      camera.lookAt(target);
      nav.target.copy(target);
      nav.userNavigated = true;
      updateSpherical();
    };

    const frameAll = () => {
      const box = new THREE.Box3().setFromObject(userGroup);
      if (box.isEmpty()) return;
      const target = new THREE.Vector3();
      box.getCenter(target);
      const size = box.getSize(new THREE.Vector3()).length();
      const dist = Math.max(3, size * 1.5);
      camera.position.set(target.x + dist * 0.8, target.y + dist * 0.6, target.z + dist);
      camera.lookAt(target);
      nav.target.copy(target);
      nav.userNavigated = true;
      updateSpherical();
    };

    const onKey = (e) => {
      const target = e.target;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }
      const store = useEditor.getState();
      if (e.key === "f" || e.key === "F") frameSelected();
      else if (e.key === "a" || e.key === "A") frameAll();
      else if (e.key === "w" || e.key === "W") store.setGizmoMode("translate");
      else if (e.key === "e" || e.key === "E") store.setGizmoMode("rotate");
      else if (e.key === "r" || e.key === "R") store.setGizmoMode("scale");
      else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) store.redo();
        else store.undo();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") {
        e.preventDefault();
        store.redo();
      } else if (e.key === " ") {
        e.preventDefault();
        store.setIsPlaying(!store.isPlaying);
      }
    };

    window.addEventListener("keydown", onKey);

    // ---- resize ----
    const ro = new ResizeObserver(() => {
      const w = container.clientWidth;
      const h = Math.max(1, container.clientHeight);
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    });
    ro.observe(container);

    // ---- render loop ----
    let frames = 0;
    let lastFpsTime = performance.now();
    let lastFrame = -1;
    let lastVersion = -1;

    const animate = () => {
      rafRef.current = requestAnimationFrame(animate);
      const clock = clockRef.current;
      const time = clock.getElapsedTime();
      const store = useEditor.getState();
      const graph = store.graph;

      // Set window._graph so codeStrategy can read it (matches user's RAR pattern)
      if (graph) window._graph = graph;

      // ---- sample keyframes -> write into node.properties ----
      if (graph && Object.keys(store.keyframes).length > 0) {
        for (const [nodeIdStr, props] of Object.entries(store.keyframes)) {
          const nodeId = Number(nodeIdStr);
          const node = (graph.nodes ?? graph._nodes ?? []).find((n) => n.id === nodeId);
          if (!node) continue;
          for (const [propName, kfs] of Object.entries(props)) {
            const v = sampleKeyframes(kfs, store.currentFrame);
            if (v == null) continue;
            if (propName.includes(".")) {
              const dotIdx = propName.indexOf(".");
              const base = propName.slice(0, dotIdx);
              const subStr = propName.slice(dotIdx + 1);
              const subIdx = Number(subStr);
              if (Array.isArray(node.properties[base])) {
                const arr = [...node.properties[base]];
                arr[subIdx] = v;
                node.properties[base] = arr;
              } else {
                node.properties[propName] = v;
              }
            } else {
              node.properties[propName] = v;
            }
          }
        }
      }

      // ---- re-evaluate ----
      const versionChanged = store.version !== lastVersion;
      const frameChanged = store.currentFrame !== lastFrame;
      const shouldReeval =
        !gizmoDraggingRef.current &&
        graph &&
        (versionChanged || frameChanged || store.isPlaying);

      if (shouldReeval && graph) {
        try {
          // 1. Mark all nodes dirty so onExecute runs again
          for (const n of graph._nodes || []) n._dirty = true;
          // 2. Run the graph (calls onExecute on each node in topo order)
          graph.runStep();
          // 3. Collect jsCode + bgJsCode via the code strategy
          const { jsCode, bgJsCode, importStr } = codeStrategy.afterStep();
          // 4. Build the runtime ctx
          const ctx = {
            time,
            frame: store.currentFrame,
            aspect: camera.aspect,
            fileCache: ctxRef.current.fileCache,
            texCache: ctxRef.current.texCache,
            loaders: loadersRef.current,
            __cameras: ctxRef.current.__cameras,
            __scenes: ctxRef.current.__scenes,
            __geometries: ctxRef.current.__geometries,
            __meshes: ctxRef.current.__meshes,
            __materials: ctxRef.current.__materials,
          };
          ctxRef.current = ctx;
          // 5. Execute bgJsCode first (creates geometries, materials, etc.)
          if (bgJsCode?.trim()) {
            try {
              const bgFn = new Function("THREE", "time", "frame", "ctx", bgJsCode);
              bgFn(THREE, time, store.currentFrame, ctx);
            } catch (e) {
              console.error("[bgJsCode] execution error:", e);
            }
          }
          // 6. Compile + execute jsCode (defines __out_<safeId> for topology)
          const safeVar = (id) => `__out_${String(id).replace(/[^a-zA-Z0-9_]/g, "_")}`;
          const body = `
"use strict";
${importStr ? importStr + "\n" : ""}
${jsCode || ""}
return {
  ${[...((graph._nodes || []).map((n) => `${JSON.stringify(String(n.id))}: typeof ${safeVar(n.id)} !== 'undefined' ? ${safeVar(n.id)} : null`))].join(",\n  ")}
};
`;
          const fn = new Function("THREE", "time", "frame", "ctx", body);
          const result = fn(THREE, time, store.currentFrame, ctx);

          // Sync userGroup children with display-flagged node outputs.
          // Instead of remove-all + re-add every frame (which breaks raycast
          // timing and thrashes matrices), we diff: remove children that are
          // no longer in the display outputs, add children that are new.
          const desiredChildren = new Set();
          let graphCamera = null;
          for (const displayNodeId of store.displayFlags) {
            const v = result?.[String(displayNodeId)];
            if (!v) continue;
            if (v.isScene) {
              const ug = v.getObjectByName("__user__");
              if (ug) {
                for (const c of [...ug.children]) {
                  if (c.userData?.__addedBySceneOutput) {
                    desiredChildren.add(c);
                    if (c.parent !== userGroup) {
                      ug.remove(c);
                      userGroup.add(c);
                    }
                  }
                }
              }
              if (v.userData?.__camera) graphCamera = v.userData.__camera;
            } else if (v.isObject3D) {
              desiredChildren.add(v);
              if (v.parent !== userGroup) {
                userGroup.add(v);
              }
            }
          }
          // Remove children no longer desired (but keep overlay meshes)
          for (const child of [...userGroup.children]) {
            if (child === wire) continue;
            if (!desiredChildren.has(child)) {
              userGroup.remove(child);
            }
          }

          // Apply display mode to graph-produced meshes
          applyDisplayMode(userGroup, displayModeRef.current);

          // Use graph camera if available; otherwise keep host camera position.
          if (graphCamera && !nav.userNavigated) {
            camera.position.copy(graphCamera.position);
            camera.quaternion.copy(graphCamera.quaternion);
            if (graphCamera.isPerspectiveCamera) {
              camera.fov = graphCamera.fov;
              camera.near = graphCamera.near;
              camera.far = graphCamera.far;
              camera.updateProjectionMatrix();
            }
            updateSpherical();
          }
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          if (!animate.__lastErr || time - animate.__lastErr > 2) {
            toast.error(`Eval error: ${msg}`);
            animate.__lastErr = time;
          }
        }
        lastVersion = store.version;
      }

      // ---- selection wireframe + gizmo ----
      const selId = store.selectedObjectId;
      if (selId != null) {
        let found = null;
        userGroup.traverse((o) => {
          if (!found && (o.uuid === selId || String(o.userData?.nodeId) === selId)) {
            found = o;
          }
        });
        if (found && found.isMesh && found.geometry) {
          try {
            const wfGeo = new THREE.WireframeGeometry(found.geometry);
            wire.geometry.dispose();
            wire.geometry = wfGeo;
            wire.material = wire.userData.origMat;
            wire.visible = true;
            wire.position.copy(found.position);
            wire.rotation.copy(found.rotation);
            wire.scale.copy(found.scale);
            if (wire.parent !== found.parent) {
              (found.parent ?? scene).add(wire);
            }
          } catch {
            wire.visible = false;
          }
        } else if (found && found.isObject3D) {
          const box = new THREE.Box3().setFromObject(found);
          if (!box.isEmpty()) {
            const helper = new THREE.Box3Helper(box, 0x00ffff);
            wire.geometry.dispose();
            wire.geometry = helper.geometry;
            wire.material = helper.material;
            wire.visible = true;
            wire.position.set(0, 0, 0);
            wire.rotation.set(0, 0, 0);
            wire.scale.set(1, 1, 1);
          }
        } else {
          wire.visible = false;
        }
        if (found && found.isObject3D && tc.object !== found && !gizmoDraggingRef.current) {
          tc.attach(found);
        }
      } else {
        wire.visible = false;
        if (tc.object && !gizmoDraggingRef.current) tc.detach();
      }

      // ---- playback ----
      if (store.isPlaying) {
        const next = store.currentFrame + 1;
        if (next > store.frameRange[1]) {
          store.setCurrentFrame(store.frameRange[0]);
        } else {
          store.setCurrentFrame(next);
        }
      }
      lastFrame = store.currentFrame;

      // ---- stats ----
      frames++;
      const now = performance.now();
      if (now - lastFpsTime >= 500) {
        const fps = Math.round((frames * 1000) / (now - lastFpsTime));
        setStats({
          fps,
          triangles: renderer.info.render.triangles,
          drawCalls: renderer.info.render.calls,
        });
        frames = 0;
        lastFpsTime = now;
      }

      // ---- isolate mode ----
      if (store.isolateMode && store.selectedObjectIds.length > 0) {
        userGroup.traverse((o) => {
          if (!o.isMesh) return;
          let tagged = o;
          while (tagged && tagged.userData?.nodeId == null && tagged.parent) tagged = tagged.parent;
          const objId = String(tagged?.userData?.nodeId || o.uuid);
          const isSelected = store.selectedObjectIds.includes(objId);
          if (!isSelected) {
            // Dim non-selected: make transparent
            if (!o.userData._origMat) o.userData._origMat = o.material;
            o.material = new THREE.MeshBasicMaterial({
              color: 0x444444,
              transparent: true,
              opacity: 0.1,
              wireframe: true,
            });
          } else {
            // Restore selected
            if (o.userData._origMat) {
              o.material = o.userData._origMat;
              delete o.userData._origMat;
            }
          }
        });
      } else {
        // Restore all
        userGroup.traverse((o) => {
          if (!o.isMesh) return;
          if (o.userData._origMat) {
            o.material = o.userData._origMat;
            delete o.userData._origMat;
          }
        });
      }

      renderer.render(scene, camera);

      // ---- box-select overlay render (on top, separate scene) ----
      if (boxSelectRef.current?._scene && boxSelectRef.current?._camera && boxSelectRef.current.visible) {
        renderer.autoClear = false;
        renderer.render(boxSelectRef.current._scene, boxSelectRef.current._camera);
        renderer.autoClear = true;
      }
    };
    animate();

    return () => {
      cancelAnimationFrame(rafRef.current);
      ro.disconnect();
      dom.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      dom.removeEventListener("wheel", onWheel);
      dom.removeEventListener("contextmenu", onContextMenu);
      window.removeEventListener("keydown", onKey);
      try { tc.detach(); } catch {}
      try { tc.dispose(); } catch {}
      scene.traverse((o) => {
        if (o.geometry) try { o.geometry.dispose(); } catch {}
        if (o.material) {
          const mats = Array.isArray(o.material) ? o.material : [o.material];
          mats.forEach((m) => { try { m.dispose(); } catch {} });
        }
      });
      renderer.dispose();
      if (renderer.domElement.parentElement === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  // gizmo mode
  useEffect(() => {
    if (tcRef.current) tcRef.current.setMode(gizmoMode);
  }, [gizmoMode]);

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full overflow-hidden bg-[#0a0a0a]"
    >
      {/* Top-left: stats */}
      <div className="absolute top-2 left-2 z-10 bg-black/60 backdrop-blur-sm rounded px-2 py-1 text-[11px] font-mono text-zinc-300 pointer-events-none border border-zinc-700/50">
        <div>FPS: {stats.fps}</div>
        <div>Tris: {stats.triangles.toLocaleString()}</div>
        <div>Calls: {stats.drawCalls}</div>
      </div>

      {/* Top-right: Display mode + Camera + Isolate */}
      <div className="absolute top-2 right-2 z-10 flex flex-col items-end gap-1.5">
        <div className="flex items-center gap-1.5">
          {/* Isolate toggle */}
          <button
            onClick={() => setIsolateMode(!isolateMode)}
            className={`px-2 py-1 text-[10px] font-medium rounded border transition-colors ${
              isolateMode
                ? "bg-cyan-500 text-black border-cyan-400"
                : "bg-black/60 text-zinc-400 border-zinc-700/50 hover:text-zinc-200"
            }`}
            title="Isolate selected (dim others)"
          >
            Isolate
          </button>
          {/* Display mode dropdown */}
          <select
            value={displayMode}
            onChange={(e) => useEditor.getState().setDisplayMode(e.target.value)}
            className="h-7 bg-black/60 backdrop-blur-sm border border-zinc-700/50 rounded px-1.5 text-[10px] text-zinc-200 cursor-pointer"
            title="Display mode"
          >
            <option value="solid">Solid</option>
            <option value="wireframe">Wireframe</option>
            <option value="points">Points</option>
            <option value="xray">X-Ray</option>
            <option value="normals">Normals</option>
          </select>
          {/* Camera selector */}
          <CameraSelector
            activeCameraId={activeCameraId}
            setActiveCameraId={setActiveCameraId}
            version={version}
          />
        </div>
      </div>

      {/* Bottom-left: help text */}
      <div className="absolute bottom-2 left-2 z-10 bg-black/60 backdrop-blur-sm rounded px-2 py-1 text-[10px] font-mono text-zinc-400 pointer-events-none border border-zinc-700/50">
        LMB: select · Alt+LMB: orbit · Alt+RMB: pan · MMB: pan · Wheel: dolly · F: frame · A: frame all · W/E/R: gizmo · Space: play
      </div>
    </div>
  );
}

// Camera selector — lists all Camera nodes in the graph + a "Default" option.
function CameraSelector({ activeCameraId, setActiveCameraId, version }) {
  void version;
  const graph = useEditor((s) => s.graph);
  const nodes = graph?.nodes ?? graph?._nodes ?? [];
  // Also look inside subgraphs for camera nodes
  const cameraNodes = [];
  for (const n of nodes) {
    if (n.type?.includes("camera")) cameraNodes.push(n);
    if (n.subgraph) {
      const inner = n.subgraph.nodes ?? n.subgraph._nodes ?? [];
      for (const innerN of inner) {
        if (innerN.type?.includes("camera")) {
          cameraNodes.push({ ...innerN, _label: `${n.title} / ${innerN.title || innerN.type}` });
        }
      }
    }
  }
  return (
    <select
      value={activeCameraId}
      onChange={(e) => setActiveCameraId(e.target.value)}
      className="h-7 bg-black/60 backdrop-blur-sm border border-zinc-700/50 rounded px-1.5 text-[10px] text-zinc-200 cursor-pointer"
      title="Active camera"
    >
      <option value="default">Default Camera</option>
      {cameraNodes.map((c) => (
        <option key={c.id} value={c.id}>
          {c._label || c.title || c.type?.split("/").pop()}
        </option>
      ))}
    </select>
  );
}

// Apply display mode (solid/wireframe/points/xray/normals) to all meshes in obj.
function applyDisplayMode(obj, mode) {
  if (!obj) return;
  obj.traverse((o) => {
    const mesh = o;
    if (!mesh.isMesh) return;
    if (!mesh.userData._origMat) mesh.userData._origMat = mesh.material;
    const orig = mesh.userData._origMat;
    mesh.visible = true;
    switch (mode) {
      case "solid":
        mesh.material = orig;
        if (orig) {
          orig.wireframe = false;
          orig.transparent = false;
          orig.opacity = 1;
          orig.depthWrite = true;
        }
        break;
      case "wireframe":
        mesh.material = orig;
        if (orig) orig.wireframe = true;
        break;
      case "xray":
        mesh.material = orig;
        if (orig) {
          orig.transparent = true;
          orig.opacity = 0.4;
          orig.depthWrite = false;
        }
        break;
      case "normals":
        mesh.material = new THREE.MeshNormalMaterial();
        break;
      case "points":
        mesh.material = new THREE.PointsMaterial({
          size: 0.05,
          sizeAttenuation: true,
          color: 0x22d3ee,
        });
        break;
    }
  });
}
