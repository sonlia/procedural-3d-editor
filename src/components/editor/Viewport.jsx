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
  const [boxSelectRect, setBoxSelectRect] = useState({ visible: false });

  const displayMode = useEditor((s) => s.displayMode);
  const gizmoMode = useEditor((s) => s.gizmoMode);
  const displayFlags = useEditor((s) => s.displayFlags);

  const rendererRef = useRef(null);
  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const userGroupRef = useRef(null); // graph-produced scene's user content goes here
  const tcRef = useRef(null);
  const tcHelperRef = useRef(null);
  const wireframeRef = useRef(null); // wireframe overlay for selected object (legacy, unused)
  const selectionOverlaysRef = useRef(null); // group holding wireframe overlays for multi-select
  const multiSelectGroupRef = useRef(null); // temp group for multi-select gizmo
  const lastSelIdsRef = useRef(null); // track selection changes to avoid unnecessary rebuild
  const datasheetOverlayRef = useRef(null); // highlight overlay for datasheet selection
  const boxSelectRef = useRef(null); // box-select rectangle overlay
  const clockRef = useRef(null);
  const defaultLightRef = useRef(null); // auto-managed default lights
  const axesGizmoRef = useRef(null); // corner axes gizmo preview
  const uiOverlayRef = useRef(null); // Three.js UI overlay (Isolate/Display/Camera)
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
    // Hide center axes — replaced by a small corner gizmo
    // scene.add(new THREE.AxesHelper(2));

    // ---- corner axes gizmo (small preview in top-left) ----
    const axesScene = new THREE.Scene();
    const axesCam = new THREE.OrthographicCamera(-1.5, 1.5, 1.5, -1.5, 0.1, 10);
    axesCam.position.set(0, 0, 5);
    axesScene.add(new THREE.AxesHelper(1));
    axesGizmoRef.current = { scene: axesScene, camera: axesCam };

    // ---- Three.js UI overlay (Isolate / Display / Camera) ----
    // Drawn on a 2D canvas, used as CanvasTexture on a plane,
    // rendered via OrthographicCamera in the top-right corner.
    // The 2D canvas has Y=0 at top, but Three.js OrthographicCamera has Y=0 at bottom.
    // So we flip the texture on the plane (scale.y = -1).
    const uiCanvas = document.createElement("canvas");
    uiCanvas.width = 300;
    uiCanvas.height = 40;
    const uiCtx = uiCanvas.getContext("2d");
    const uiTex = new THREE.CanvasTexture(uiCanvas);
    uiTex.minFilter = THREE.LinearFilter;
    uiTex.magFilter = THREE.LinearFilter;
    uiTex.flipY = true; // Default: flip Y so canvas (Y=0 at top) maps to Three.js (Y=0 at bottom)
    const uiMat = new THREE.MeshBasicMaterial({ map: uiTex, transparent: true, depthTest: false });
    const uiGeo = new THREE.PlaneGeometry(300, 40);
    const uiMesh = new THREE.Mesh(uiGeo, uiMat);
    uiMesh.position.set(150, 20, 0);
    uiMesh.renderOrder = 2000;
    const uiScene = new THREE.Scene();
    uiScene.add(uiMesh);
    // Camera: Y=0 at top (matches canvas), Y=40 at bottom
    const uiCam = new THREE.OrthographicCamera(0, 300, 0, 40, -1, 1);
    uiCam.position.z = 1;
    // UI element layout (x, y, w, h in canvas pixels, y=0 is top)
    const uiElements = [
      { name: "isolate", x: 226, y: 8, w: 68, h: 24 },
      { name: "display", x: 148, y: 8, w: 68, h: 24 },
      { name: "camera", x: 6, y: 8, w: 132, h: 24 },
    ];
    uiOverlayRef.current = { canvas: uiCanvas, ctx: uiCtx, texture: uiTex, scene: uiScene, camera: uiCam, elements: uiElements };
    window._viewportUI = uiOverlayRef.current;
    const defaultDirLight = new THREE.DirectionalLight(0xffffff, 1.0);
    defaultDirLight.position.set(5, 8, 4);
    defaultDirLight.userData.__isDefault = true;
    scene.add(defaultDirLight);
    const defaultAmbLight = new THREE.AmbientLight(0x404040, 0.6);
    defaultAmbLight.userData.__isDefault = true;
    scene.add(defaultAmbLight);
    defaultLightRef.current = { dir: defaultDirLight, amb: defaultAmbLight };
    window._viewportDefaultLight = defaultLightRef.current;
    window._viewportScene = scene;

    // ---- default objects (created directly, not via graph) ----
    // These are always visible so the viewport shows something even if
    // LiteGraph graph evaluation fails.
    const defaultMat = new THREE.MeshStandardMaterial({ color: 0x4ade80, roughness: 0.4, metalness: 0.1 });
    const defBoxGeo = new THREE.BoxGeometry(1.5, 1.5, 1.5);
    const defBoxMesh = new THREE.Mesh(defBoxGeo, defaultMat);
    defBoxMesh.position.set(-1.5, 0, 0);
    defBoxMesh.castShadow = true;
    defBoxMesh.receiveShadow = true;
    defBoxMesh.userData.__isDefault = true;
    defBoxMesh.userData.nodeId = "__default_box";
    userGroup.add(defBoxMesh);

    const sphereMat = new THREE.MeshStandardMaterial({ color: 0x60a5fa, roughness: 0.3, metalness: 0.2 });
    const defSphereGeo = new THREE.SphereGeometry(0.9, 32, 16);
    const defSphereMesh = new THREE.Mesh(defSphereGeo, sphereMat);
    defSphereMesh.position.set(1.5, 0, 0);
    defSphereMesh.castShadow = true;
    defSphereMesh.receiveShadow = true;
    defSphereMesh.userData.__isDefault = true;
    defSphereMesh.userData.nodeId = "__default_sphere";
    userGroup.add(defSphereMesh);

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

    const clock = new THREE.Timer();
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
      if (selectionOverlaysRef.current) {
        selectionOverlaysRef.current.visible = !e.value;
      }
      // When gizmo is released, force selection overlay rebuild with new positions
      if (!e.value) {
        lastSelIdsRef.current = null; // force selChanged=true on next frame
      }
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

    // ---- selection wireframe overlays (for multi-select) ----
    const selectionOverlays = new THREE.Group();
    selectionOverlays.visible = true;
    selectionOverlaysRef.current = selectionOverlays;
    scene.add(selectionOverlays);

    // ---- datasheet highlight overlay (for point/edge/face highlighting) ----
    const datasheetOverlay = new THREE.Group();
    datasheetOverlay.visible = true;
    datasheetOverlayRef.current = datasheetOverlay;
    scene.add(datasheetOverlay);

    // ---- box-select overlay (CSS div, not Three.js — avoids NDC mismatch) ----
    // boxSelectRef stores { x, y, w, h, visible } for the CSS overlay
    boxSelectRef.current = { x: 0, y: 0, w: 0, h: 0, visible: false };

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
        // Walk up to find ancestor tagged with nodeId (set by nodes like ImportModel/Geometry)
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
        // Attach gizmo: prefer the hit Mesh itself (has geometry, draggable),
        // only fall back to tagged parent if hit is not a Mesh.
        // This prevents attaching to an empty Group container.
        const attachTarget = hit.isMesh ? hit : (tagged?.isObject3D ? tagged : hit);
        if (attachTarget.isObject3D && tc.object !== attachTarget) tc.attach(attachTarget);
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
      // Check if clicking on UI overlay first
      const uiHit = hitTestUI(e.clientX, e.clientY);
      if (uiHit) {
        handleUIClick(uiHit);
        e.preventDefault();
        return;
      }
      // Click outside dropdown closes it
      if (dropdownOpen.name) {
        dropdownOpen.name = null;
      }
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

    // ---- box-select cleanup (defensive: handles pointerup loss) ----
    const cancelBoxSelect = () => {
      boxSelectStateRef.current.active = false;
      if (boxSelectRef.current) boxSelectRef.current.visible = false;
      setBoxSelectRect({ visible: false });
      dom.style.cursor = "default";
    };
    const onPointerCancel = () => cancelBoxSelect();
    const onLostPointerCapture = () => cancelBoxSelect();

    const onPointerMove = (e) => {
      // Defensive: if mouse button released but pointerup missed, cancel box-select
      if (boxSelectStateRef.current.active && e.buttons === 0) {
        cancelBoxSelect();
        return;
      }
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

    // Update the box-select overlay using CSS coordinates (relative to canvas)
    const updateBoxSelectOverlay = (x1, y1, x2, y2) => {
      const rect = dom.getBoundingClientRect();
      const bs = boxSelectRef.current;
      if (!bs) return;
      bs.x = Math.min(x1, x2) - rect.left;
      bs.y = Math.min(y1, y2) - rect.top;
      bs.w = Math.abs(x2 - x1);
      bs.h = Math.abs(y2 - y1);
      bs.visible = true;
      // Force re-render of the CSS overlay
      setBoxSelectRect({ x: bs.x, y: bs.y, w: bs.w, h: bs.h, visible: true });
    };

    const onPointerUp = (e) => {
      const wasPanning = nav.isPanning;
      const wasOrbiting = nav.isOrbiting;
      nav.isPanning = false;
      nav.isOrbiting = false;
      dom.style.cursor = "default";
      const bs = boxSelectStateRef.current;
      if (bs.active) {
        bs.active = false;
        if (bs.moved) {
          performBoxSelect(bs.startX, bs.startY, e.clientX, e.clientY, bs.shift);
        } else if (
          !wasPanning &&
          !wasOrbiting &&
          !gizmoDraggingRef.current
        ) {
          raycastSelect(e);
        }
      }
      // Unconditionally hide overlay + reset active (defensive: covers all code paths)
      if (boxSelectRef.current) boxSelectRef.current.visible = false;
      setBoxSelectRect({ visible: false });
      boxSelectStateRef.current.active = false;
    };

    // Perform box selection: find all objects whose bounding sphere intersects
    // the screen-space rectangle. Uses camera.project() for accurate NDC mapping.
    const performBoxSelect = (x1, y1, x2, y2, shift) => {
      const rect = dom.getBoundingClientRect();
      // Convert screen coords to NDC (-1..1), Y flipped — same as overlay
      const ndcX1 = ((Math.min(x1, x2) - rect.left) / rect.width) * 2 - 1;
      const ndcX2 = ((Math.max(x1, x2) - rect.left) / rect.width) * 2 - 1;
      const ndcY1 = -((Math.max(y1, y2) - rect.top) / rect.height) * 2 + 1; // bottom
      const ndcY2 = -((Math.min(y1, y2) - rect.top) / rect.height) * 2 + 1; // top

      const store = useEditor.getState();
      const found = [];
      const foundNodeIds = [];
      const projVec = new THREE.Vector3();

      userGroup.traverse((o) => {
        if (!o.isObject3D || o === userGroup) return;
        if (o === wire || o === datasheetOverlayRef.current || o === selectionOverlaysRef.current) return;
        if (o.userData?.__isMultiSelect) return; // skip temp multi-select group
        // Skip default objects? No — include them too.

        // Use bounding sphere for more accurate selection
        let center;
        let radius = 0;
        if (o.geometry) {
          if (!o.geometry.boundingSphere) o.geometry.computeBoundingSphere();
          const bs = o.geometry.boundingSphere;
          if (bs && bs.radius > 0) {
            center = bs.center.clone();
            radius = bs.radius;
          }
        }
        if (!center) {
          center = new THREE.Vector3();
          o.getWorldPosition(center);
        } else {
          center.applyMatrix4(o.matrixWorld);
        }

        // Project center to NDC using the current camera
        projVec.copy(center).project(camera);

        // Check if the projected center is within the rectangle (with radius tolerance)
        // Convert world-space radius to approximate screen-space radius
        if (projVec.z >= -1 && projVec.z <= 1) {
          // Simple check: center point within rectangle
          if (projVec.x >= ndcX1 && projVec.x <= ndcX2 && projVec.y >= ndcY1 && projVec.y <= ndcY2) {
            let tagged = o;
            while (tagged && tagged.userData?.nodeId == null && tagged.parent) tagged = tagged.parent;
            const nodeId = tagged?.userData?.nodeId || o.uuid;
            const objId = String(nodeId);
            if (!found.includes(objId)) {
              found.push(objId);
              if (nodeId && !foundNodeIds.includes(nodeId)) foundNodeIds.push(nodeId);
            }
          }
        }
      });

      if (shift) {
        const current = store.selectedObjectIds;
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
    dom.addEventListener("pointercancel", onPointerCancel);
    dom.addEventListener("lostpointercapture", onLostPointerCapture);
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

    // Update datasheet highlight overlay
    const updateDatasheetOverlay = () => {
      const overlay = datasheetOverlayRef.current;
      if (!overlay) return;
      // Clear previous
      for (const child of [...overlay.children]) {
        overlay.remove(child);
        if (child.geometry) child.geometry.dispose();
        if (child.material) child.material.dispose();
      }
      const hl = useEditor.getState().datasheetHighlight;
      if (!hl || !hl.ids || hl.ids.length === 0) return;

      // Find the selected mesh
      const selId = useEditor.getState().selectedObjectId;
      if (!selId) return;
      let mesh = null;
      userGroup.traverse((o) => {
        if (!mesh && o.isMesh && (String(o.userData?.nodeId) === String(selId) || o.uuid === selId)) mesh = o;
      });
      if (!mesh || !mesh.geometry) return;
      mesh.updateMatrixWorld(true);
      const geo = mesh.geometry;
      const pos = geo.attributes.position;
      const index = geo.index;

      const highlightColor = 0xff8800;
      const mat = new THREE.MeshBasicMaterial({ color: highlightColor, depthTest: false, transparent: true, opacity: 0.8, side: THREE.DoubleSide });

      if (hl.type === "points") {
        const sphereGeo = new THREE.SphereGeometry(0.06, 10, 6);
        const sphereMat = new THREE.MeshBasicMaterial({ color: highlightColor, depthTest: false, transparent: true });
        for (const id of hl.ids) {
          if (id >= pos.count) continue;
          const v = new THREE.Vector3().fromBufferAttribute(pos, id).applyMatrix4(mesh.matrixWorld);
          const s = new THREE.Mesh(sphereGeo, sphereMat);
          s.position.copy(v);
          s.renderOrder = 999;
          overlay.add(s);
        }
      } else if (hl.type === "edges") {
        const edgeMat = new THREE.MeshBasicMaterial({ color: highlightColor, depthTest: false, transparent: true });
        const edgeGeo = new THREE.CylinderGeometry(0.025, 0.025, 1, 8);
        // Rebuild edge list to match datasheet's edge IDs
        const allEdges = [];
        const edgeSet = new Set();
        const triCount = index ? index.count / 3 : pos.count / 3;
        for (let i = 0; i < triCount; i++) {
          const a = index ? index.getX(i * 3) : i * 3;
          const b = index ? index.getX(i * 3 + 1) : i * 3 + 1;
          const c = index ? index.getX(i * 3 + 2) : i * 3 + 2;
          for (const [p1, p2] of [[a, b], [b, c], [c, a]]) {
            const key = p1 < p2 ? `${p1}-${p2}` : `${p2}-${p1}`;
            if (!edgeSet.has(key)) {
              edgeSet.add(key);
              allEdges.push({ p1: Math.min(p1, p2), p2: Math.max(p1, p2) });
            }
          }
        }
        for (const id of hl.ids) {
          const e = allEdges[id];
          if (!e) continue;
          const va = new THREE.Vector3().fromBufferAttribute(pos, e.p1).applyMatrix4(mesh.matrixWorld);
          const vb = new THREE.Vector3().fromBufferAttribute(pos, e.p2).applyMatrix4(mesh.matrixWorld);
          const dir = new THREE.Vector3().subVectors(vb, va);
          const len = dir.length();
          const cyl = new THREE.Mesh(edgeGeo, edgeMat);
          cyl.position.copy(va).add(vb).multiplyScalar(0.5);
          cyl.scale.set(1, len, 1);
          cyl.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
          cyl.renderOrder = 999;
          overlay.add(cyl);
        }
      } else if (hl.type === "faces") {
        for (const id of hl.ids) {
          if (!index) continue;
          const a = index.getX(id * 3);
          const b = index.getX(id * 3 + 1);
          const c = index.getX(id * 3 + 2);
          const va = new THREE.Vector3().fromBufferAttribute(pos, a).applyMatrix4(mesh.matrixWorld);
          const vb = new THREE.Vector3().fromBufferAttribute(pos, b).applyMatrix4(mesh.matrixWorld);
          const vc = new THREE.Vector3().fromBufferAttribute(pos, c).applyMatrix4(mesh.matrixWorld);
          const faceGeo = new THREE.BufferGeometry().setFromPoints([va, vb, vc]);
          faceGeo.setIndex([0, 1, 2]);
          const fm = new THREE.Mesh(faceGeo, mat);
          fm.renderOrder = 999;
          overlay.add(fm);
        }
      } else if (hl.type === "vertices") {
        // Vertices tab: highlight the specific vertex on a face
        const sphereGeo = new THREE.SphereGeometry(0.05, 8, 5);
        const sphereMat = new THREE.MeshBasicMaterial({ color: highlightColor, depthTest: false, transparent: true });
        // Rebuild vertex list to match datasheet's vertex IDs
        const allVerts = [];
        const triCount = index ? index.count / 3 : pos.count / 3;
        for (let i = 0; i < triCount; i++) {
          const a = index ? index.getX(i * 3) : i * 3;
          const b = index ? index.getX(i * 3 + 1) : i * 3 + 1;
          const c = index ? index.getX(i * 3 + 2) : i * 3 + 2;
          allVerts.push(a, b, c);
        }
        for (const id of hl.ids) {
          const ptId = allVerts[id];
          if (ptId == null || ptId >= pos.count) continue;
          const v = new THREE.Vector3().fromBufferAttribute(pos, ptId).applyMatrix4(mesh.matrixWorld);
          const s = new THREE.Mesh(sphereGeo, sphereMat);
          s.position.copy(v);
          s.renderOrder = 999;
          overlay.add(s);
        }
      } else if (hl.type === "groups") {
        // Groups tab: highlight all faces in the selected group(s)
        // geometry.groups[i] = { start, count, materialIndex }
        // start/count are in index-buffer terms; count/3 = number of triangles
        const geomGroups = geo.groups || [];
        for (const id of hl.ids) {
          const grp = geomGroups[id];
          if (!grp) continue;
          const triStart = grp.start / 3;
          const triCount = grp.count / 3;
          for (let t = triStart; t < triStart + triCount; t++) {
            if (!index) continue;
            const a = index.getX(t * 3);
            const b = index.getX(t * 3 + 1);
            const c = index.getX(t * 3 + 2);
            const va = new THREE.Vector3().fromBufferAttribute(pos, a).applyMatrix4(mesh.matrixWorld);
            const vb = new THREE.Vector3().fromBufferAttribute(pos, b).applyMatrix4(mesh.matrixWorld);
            const vc = new THREE.Vector3().fromBufferAttribute(pos, c).applyMatrix4(mesh.matrixWorld);
            const faceGeo = new THREE.BufferGeometry().setFromPoints([va, vb, vc]);
            faceGeo.setIndex([0, 1, 2]);
            const fm = new THREE.Mesh(faceGeo, mat);
            fm.renderOrder = 999;
            overlay.add(fm);
          }
        }
      }
    };

    // ---- Three.js UI overlay drawing + click handling ----
    const displayModes = ["solid", "wireframe", "points", "xray", "normals"];
    const displayLabels = { solid: "Solid", wireframe: "Wireframe", points: "Points", xray: "X-Ray", normals: "Normals" };
    // Dropdown state: which dropdown is open (null = closed)
    const dropdownOpen = { name: null };

    const getCameraList = () => {
      const st = useEditor.getState();
      const list = [{ id: "default", label: "Default Camera" }];
      const graph = st.graph;
      if (graph) {
        const nodes = graph._nodes || graph.nodes || [];
        for (const n of nodes) {
          if (n.type && n.type.includes("camera")) list.push({ id: n.id, label: n.title || "Camera" });
          if (n.subgraph) {
            const inner = n.subgraph._nodes || n.subgraph.nodes || [];
            for (const innerN of inner) {
              if (innerN.type && innerN.type.includes("camera")) {
                list.push({ id: innerN.id, label: (n.title || "SOP") + "/" + (innerN.title || "Cam") });
              }
            }
          }
        }
      }
      return list;
    };

    const drawUI = () => {
      const ov = uiOverlayRef.current;
      if (!ov) return;
      const ctx = ov.ctx;
      const st = useEditor.getState();
      // Expand canvas height if dropdown is open
      let maxH = 40;
      if (dropdownOpen.name === "display") maxH = 40 + displayModes.length * 22 + 4;
      else if (dropdownOpen.name === "camera") maxH = 40 + getCameraList().length * 22 + 4;
      if (ov.canvas.height !== maxH) {
        ov.canvas.height = maxH;
        ov.camera.bottom = maxH;
        ov.camera.updateProjectionMatrix();
        ov.texture.needsUpdate = true;
      }
      // Also resize the plane to match canvas
      const plane = ov.scene.children[0];
      if (plane && (plane.geometry.parameters.width !== 300 || plane.geometry.parameters.height !== maxH)) {
        plane.geometry.dispose();
        plane.geometry = new THREE.PlaneGeometry(300, maxH);
        plane.position.set(150, maxH / 2, 0);
      }
      ctx.clearRect(0, 0, 300, maxH);

      // Draw buttons (always on row 0)
      for (const el of ov.elements) {
        const isOpen = dropdownOpen.name === el.name;
        const isActive = (el.name === "isolate" && st.isolateMode) || isOpen;
        ctx.fillStyle = isActive ? "rgba(34,211,238,0.9)" : "rgba(0,0,0,0.7)";
        ctx.strokeStyle = isActive ? "#22d3ee" : "#3f3f46";
        ctx.lineWidth = 1;
        roundRect(ctx, el.x, el.y, el.w, el.h, 4);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = isActive ? "#000" : "#d4d4d8";
        ctx.font = "10px Tahoma, sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        let label = "";
        if (el.name === "isolate") label = st.isolateMode ? "Isolate ON" : "Isolate";
        else if (el.name === "display") label = displayLabels[st.displayMode] || st.displayMode;
        else if (el.name === "camera") {
          const cams = getCameraList();
          const cur = cams.find((c) => String(c.id) === String(st.activeCameraId));
          label = cur ? cur.label : "Default Cam";
        }
        // Draw label + dropdown arrow
        ctx.fillText(label, el.x + el.w / 2 - 6, el.y + el.h / 2);
        if (el.name !== "isolate") {
          // Small down arrow
          ctx.beginPath();
          const ax = el.x + el.w - 12;
          const ay = el.y + el.h / 2;
          ctx.moveTo(ax - 3, ay - 2);
          ctx.lineTo(ax + 3, ay - 2);
          ctx.lineTo(ax, ay + 2);
          ctx.closePath();
          ctx.fillStyle = isActive ? "#000" : "#71717a";
          ctx.fill();
        }
      }

      // Draw dropdown list if open
      if (dropdownOpen.name === "display") {
        const el = ov.elements.find((e) => e.name === "display");
        ctx.fillStyle = "rgba(20,20,25,0.95)";
        ctx.strokeStyle = "#3f3f46";
        roundRect(ctx, el.x, 34, el.w, displayModes.length * 22 + 4, 4);
        ctx.fill();
        ctx.stroke();
        displayModes.forEach((mode, i) => {
          const iy = 38 + i * 22;
          const isCur = st.displayMode === mode;
          if (isCur) {
            ctx.fillStyle = "rgba(34,211,238,0.2)";
            ctx.fillRect(el.x + 2, iy - 2, el.w - 4, 20);
          }
          ctx.fillStyle = isCur ? "#22d3ee" : "#d4d4d8";
          ctx.font = "10px Tahoma, sans-serif";
          ctx.textAlign = "left";
          ctx.textBaseline = "middle";
          ctx.fillText(displayLabels[mode], el.x + 8, iy + 8);
        });
      } else if (dropdownOpen.name === "camera") {
        const el = ov.elements.find((e) => e.name === "camera");
        const cams = getCameraList();
        ctx.fillStyle = "rgba(20,20,25,0.95)";
        ctx.strokeStyle = "#3f3f46";
        roundRect(ctx, el.x, 34, el.w, cams.length * 22 + 4, 4);
        ctx.fill();
        ctx.stroke();
        cams.forEach((cam, i) => {
          const iy = 38 + i * 22;
          const isCur = String(st.activeCameraId) === String(cam.id);
          if (isCur) {
            ctx.fillStyle = "rgba(34,211,238,0.2)";
            ctx.fillRect(el.x + 2, iy - 2, el.w - 4, 20);
          }
          ctx.fillStyle = isCur ? "#22d3ee" : "#d4d4d8";
          ctx.font = "10px Tahoma, sans-serif";
          ctx.textAlign = "left";
          ctx.textBaseline = "middle";
          ctx.fillText(cam.label, el.x + 8, iy + 8);
        });
      }
      ov.texture.needsUpdate = true;
    };

    const hitTestUI = (clientX, clientY) => {
      const ov = uiOverlayRef.current;
      if (!ov) return null;
      const rect = dom.getBoundingClientRect();
      const uiLeft = rect.right - 300;
      const uiTop = rect.top;
      const px = clientX - uiLeft;
      const py = clientY - uiTop;
      // Check buttons (row 0, y=8-32)
      for (const el of ov.elements) {
        if (px >= el.x && px <= el.x + el.w && py >= el.y && py <= el.y + el.h) {
          return { type: "button", name: el.name };
        }
      }
      // Check dropdown items
      if (dropdownOpen.name === "display") {
        const el = ov.elements.find((e) => e.name === "display");
        if (px >= el.x && px <= el.x + el.w && py >= 34 && py <= 34 + displayModes.length * 22 + 4) {
          const idx = Math.floor((py - 38) / 22);
          if (idx >= 0 && idx < displayModes.length) return { type: "item", name: "display", value: displayModes[idx] };
        }
      } else if (dropdownOpen.name === "camera") {
        const el = ov.elements.find((e) => e.name === "camera");
        const cams = getCameraList();
        if (px >= el.x && px <= el.x + el.w && py >= 34 && py <= 34 + cams.length * 22 + 4) {
          const idx = Math.floor((py - 38) / 22);
          if (idx >= 0 && idx < cams.length) return { type: "item", name: "camera", value: cams[idx].id };
        }
      }
      return null;
    };

    const handleUIClick = (hit) => {
      const st = useEditor.getState();
      if (hit.type === "button") {
        if (hit.name === "isolate") {
          st.setIsolateMode(!st.isolateMode);
        } else if (hit.name === "display") {
          dropdownOpen.name = dropdownOpen.name === "display" ? null : "display";
        } else if (hit.name === "camera") {
          dropdownOpen.name = dropdownOpen.name === "camera" ? null : "camera";
        }
      } else if (hit.type === "item") {
        if (hit.name === "display") {
          st.setDisplayMode(hit.value);
        } else if (hit.name === "camera") {
          st.setActiveCameraId(hit.value);
        }
        dropdownOpen.name = null;
      }
    };

    // Helper: rounded rectangle
    function roundRect(ctx, x, y, w, h, r) {
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.lineTo(x + w - r, y);
      ctx.quadraticCurveTo(x + w, y, x + w, y + r);
      ctx.lineTo(x + w, y + h - r);
      ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
      ctx.lineTo(x + r, y + h);
      ctx.quadraticCurveTo(x, y + h, x, y + h - r);
      ctx.lineTo(x, y + r);
      ctx.quadraticCurveTo(x, y, x + r, y);
      ctx.closePath();
    }

    const animate = () => {
      rafRef.current = requestAnimationFrame(animate);
      const clock = clockRef.current;
      clock.update();
      const time = clock.getElapsed();
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

      // ---- re-evaluate (DISABLED — using direct objects only, bypass LiteGraph) ----
      // Graph evaluation is skipped to avoid position resets from bgJsCode.
      // Default objects are created directly and managed by the viewport.
      // Graph evaluation will be re-enabled when LiteGraph integration is stable.
      /*
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
            // Validate geometries: dispose any with NaN positions
            if (ctx.__geometries) {
              for (const [key, geo] of Object.entries(ctx.__geometries)) {
                if (geo && geo.attributes && geo.attributes.position) {
                  const arr = geo.attributes.position.array;
                  let hasNaN = false;
                  for (let i = 0; i < Math.min(arr.length, 30); i++) {
                    if (Number.isNaN(arr[i])) { hasNaN = true; break; }
                  }
                  if (hasNaN) {
                    console.warn(`[bgJsCode] geometry ${key} has NaN positions, disposing`);
                    try { geo.dispose(); } catch {}
                    delete ctx.__geometries[key];
                    if (ctx.__meshes && ctx.__meshes[key]) {
                      ctx.__meshes[key].geometry = new THREE.BufferGeometry(); // empty fallback
                    }
                  }
                }
              }
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
          // Remove children no longer desired (but keep overlay + default + multiSelect)
          for (const child of [...userGroup.children]) {
            if (child === wire || child === datasheetOverlayRef.current || child === selectionOverlaysRef.current) continue;
            if (child.userData?.__isDefault) continue; // keep default objects
            if (child.userData?.__isMultiSelect) continue; // keep multi-select group
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
      */ // end disabled graph evaluation

      // ---- selection wireframe + gizmo (supports multi-select) ----
      // Only rebuild when selection actually changes, not every frame.
      // This prevents gizmo drag results from being overwritten.
      const selIds = store.selectedObjectIds;
      const selKey = selIds.join(",");
      const selChanged = lastSelIdsRef.current !== selKey;
      lastSelIdsRef.current = selKey;

      if (selChanged && !gizmoDraggingRef.current) {
      // Clear previous wireframe overlays
      while (selectionOverlaysRef.current.children.length > 0) {
        const child = selectionOverlaysRef.current.children[0];
        selectionOverlaysRef.current.remove(child);
        if (child.geometry) child.geometry.dispose();
        if (child.material) child.material.dispose();
      }

      // Clean up previous multi-select group (preserve world transforms)
      if (multiSelectGroupRef.current) {
        const oldGroup = multiSelectGroupRef.current;
        oldGroup.updateMatrixWorld(true);
        while (oldGroup.children.length > 0) {
          const child = oldGroup.children[0];
          // Don't remove first — attach() handles reparenting.
          // But we need to remove from oldGroup first, then attach to userGroup
          // while preserving world transform. The trick: save world position,
          // remove, then set position relative to userGroup.
          const worldPos = new THREE.Vector3();
          const worldQuat = new THREE.Quaternion();
          const worldScale = new THREE.Vector3();
          child.matrixWorld.decompose(worldPos, worldQuat, worldScale);
          oldGroup.remove(child);
          userGroup.add(child);
          // Restore world transform as local (userGroup is at origin)
          child.position.copy(worldPos);
          child.quaternion.copy(worldQuat);
          child.scale.copy(worldScale);
          child.updateMatrixWorld(true);
        }
        userGroup.remove(oldGroup);
        multiSelectGroupRef.current = null;
      }

      if (selIds.length > 0) {
        // Collect all selected meshes
        const selectedMeshes = [];
        for (const selId of selIds) {
          let found = null;
          userGroup.traverse((o) => {
            if (!found && (o.uuid === selId || String(o.userData?.nodeId) === selId)) {
              found = o;
            }
          });
          if (found) selectedMeshes.push(found);

          // Wireframe overlay
          if (found && found.isMesh && found.geometry) {
            try {
              const wfGeo = new THREE.WireframeGeometry(found.geometry);
              const wfMat = new THREE.LineBasicMaterial({ color: 0x00ffff, transparent: true, opacity: 0.9 });
              const wf = new THREE.LineSegments(wfGeo, wfMat);
              wf.position.copy(found.position);
              wf.rotation.copy(found.rotation);
              wf.scale.copy(found.scale);
              wf.renderOrder = 998;
              selectionOverlaysRef.current.add(wf);
            } catch {}
          } else if (found && found.isObject3D) {
            const box = new THREE.Box3().setFromObject(found);
            if (!box.isEmpty()) {
              const helper = new THREE.Box3Helper(box, 0x00ffff);
              helper.renderOrder = 998;
              selectionOverlaysRef.current.add(helper);
            }
          }
        }

        if (selectedMeshes.length === 1) {
          const target = selectedMeshes[0];
          if (target.isObject3D && tc.object !== target) {
            tc.attach(target);
          }
        } else if (selectedMeshes.length > 1) {
          // Multi-select: create temp Group at centroid
          const group = new THREE.Group();
          group.userData.__isMultiSelect = true;
          const center = new THREE.Vector3();
          let count = 0;
          for (const mesh of selectedMeshes) {
            const pos = new THREE.Vector3();
            mesh.getWorldPosition(pos);
            center.add(pos);
            count++;
          }
          center.divideScalar(count);
          group.position.copy(center);
          for (const mesh of selectedMeshes) {
            // Save world transform, then reparent to group
            const wp = new THREE.Vector3();
            const wq = new THREE.Quaternion();
            const ws = new THREE.Vector3();
            mesh.matrixWorld.decompose(wp, wq, ws);
            userGroup.remove(mesh);
            group.add(mesh);
            // Set local transform relative to group
            mesh.position.copy(wp).sub(center);
            mesh.quaternion.copy(wq);
            mesh.scale.copy(ws);
            mesh.updateMatrixWorld(true);
          }
          userGroup.add(group);
          multiSelectGroupRef.current = group;
          tc.attach(group);
        }
      } else {
        if (tc.object) tc.detach();
      }
      } // end if (selChanged && !gizmoDraggingRef.current)

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

      // ---- default light auto-management ----
      // If graph has any concrete light node (directional_light, point_light, etc.),
      // remove default lights. SOP/sop/lighting itself doesn't count — only the
      // light nodes INSIDE it do.
      if (graph) {
        let hasLightNode = false;
        const isLightNode = (type) => {
          if (!type) return false;
          // Match "Scene/scene/directional_light", "Scene/scene/point_light", etc.
          // but NOT "SOP/sop/lighting" (which is just a container)
          return type.includes("scene/directional_light") ||
                 type.includes("scene/point_light") ||
                 type.includes("scene/spot_light") ||
                 type.includes("scene/area_light") ||
                 type.includes("scene/environment");
        };
        const checkNodes = (nodes) => {
          for (const n of nodes || []) {
            if (isLightNode(n.type)) { hasLightNode = true; break; }
            if (n.subgraph) {
              checkNodes(n.subgraph._nodes || n.subgraph.nodes || []);
              if (hasLightNode) break;
            }
          }
        };
        checkNodes(graph._nodes || graph.nodes || []);

        const dl = defaultLightRef.current;
        if (dl) {
          if (hasLightNode) {
            if (dl.dir.parent) dl.dir.parent.remove(dl.dir);
            if (dl.amb.parent) dl.amb.parent.remove(dl.amb);
          } else {
            if (!dl.dir.parent) scene.add(dl.dir);
            if (!dl.amb.parent) scene.add(dl.amb);
          }
        }
      }

      // ---- datasheet highlight overlay ----
      updateDatasheetOverlay();

      renderer.render(scene, camera);

      // ---- stats (read right after main render, before axes overlay) ----
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

      // ---- corner axes gizmo + UI overlay ----
      const dpr = window.devicePixelRatio || 1;
      const w = renderer.domElement.width;
      const h = renderer.domElement.height;

      // Corner axes gizmo (bottom-left 80x80px)
      if (axesGizmoRef.current) {
        const ag = axesGizmoRef.current;
        ag.camera.position.copy(camera.position).sub(nav.target).normalize().multiplyScalar(5);
        ag.camera.lookAt(0, 0, 0);
        ag.camera.up.copy(camera.up);
        const size = 80 * dpr;
        renderer.autoClear = false;
        renderer.setScissorTest(true);
        renderer.setScissor(4 * dpr, 4 * dpr, size, size);
        renderer.setViewport(4 * dpr, 4 * dpr, size, size);
        ag.camera.aspect = 1;
        ag.camera.updateProjectionMatrix();
        renderer.render(ag.scene, ag.camera);
        renderer.setScissorTest(false);
        renderer.setViewport(0, 0, w, h);
        renderer.autoClear = true;
      }

      // Three.js UI overlay (top-right: Isolate/Display/Camera)
      drawUI();
      if (uiOverlayRef.current) {
        const ov = uiOverlayRef.current;
        const rect = dom.getBoundingClientRect();
        const canvasH = ov.canvas.height;
        // Plane position: top-right corner
        // Camera has top=0, bottom=rect.height (Y=0 at bottom, Y=height at top)
        // But flipY=false means texture Y=0 (top of canvas) maps to... 
        // Let's use standard Three.js: top=height, bottom=0 (Y up)
        // And flip texture back to normal
        ov.camera.left = 0;
        ov.camera.right = rect.width;
        ov.camera.top = rect.height;
        ov.camera.bottom = 0;
        ov.camera.updateProjectionMatrix();
        const plane = ov.scene.children[0];
        if (plane) {
          // Top-right: x = width - 150 (center of 300px), y = height - canvasH/2 (near top)
          plane.position.set(rect.width - 150, rect.height - canvasH / 2 - 2, 0);
        }
        renderer.autoClear = false;
        renderer.setScissorTest(true);
        renderer.setScissor(0, 0, w, h);
        renderer.setViewport(0, 0, w, h);
        renderer.render(ov.scene, ov.camera);
        renderer.setScissorTest(false);
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
      dom.removeEventListener("pointercancel", onPointerCancel);
      dom.removeEventListener("lostpointercapture", onLostPointerCapture);
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

      {/* Bottom-left: help text */}
      <div className="absolute bottom-2 left-2 z-10 bg-black/60 backdrop-blur-sm rounded px-2 py-1 text-[10px] font-mono text-zinc-400 pointer-events-none border border-zinc-700/50">
        LMB: select · Alt+LMB: orbit · Alt+RMB: pan · MMB: pan · Wheel: dolly · F: frame · A: frame all · W/E/R: gizmo · Space: play
      </div>

      {/* Box-select overlay (CSS div — exact pixel match with mouse drag) */}
      {boxSelectRect.visible && (
        <div
          className="absolute pointer-events-none border border-cyan-400 bg-cyan-400/15 z-20"
          style={{
            left: `${boxSelectRect.x}px`,
            top: `${boxSelectRect.y}px`,
            width: `${boxSelectRect.w}px`,
            height: `${boxSelectRect.h}px`,
          }}
        />
      )}
    </div>
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
