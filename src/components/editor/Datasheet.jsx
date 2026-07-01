"use client";

import { useMemo, useState } from "react";
import { useEditor } from "@/lib/editor/store";
import * as THREE from "three";

// Datasheet — displays geometry data of the selected object.
// Like Houdini's geometry spreadsheet: lists all vertices, points, edges, faces, and groups.

export function Datasheet() {
  const selectedObjectId = useEditor((s) => s.selectedObjectId);
  const version = useEditor((s) => s.version);
  const [tab, setTab] = useState("points");

  // Get the selected mesh's geometry data
  const data = useMemo(() => {
    if (!selectedObjectId) return null;
    // Find the mesh in the viewport's userGroup via window globals
    const userGroup = window._viewportUserGroup;
    if (!userGroup) return null;

    let mesh = null;
    userGroup.traverse((o) => {
      if (!mesh && o.isMesh && (String(o.userData?.nodeId) === String(selectedObjectId) || o.uuid === selectedObjectId)) {
        mesh = o;
      }
    });

    if (!mesh || !mesh.geometry) return null;
    return extractGeometryData(mesh.geometry, mesh.matrixWorld);
  }, [selectedObjectId, version]);

  if (!selectedObjectId) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-zinc-500 text-xs p-4 text-center">
        <p>No object selected.</p>
        <p className="mt-1 text-zinc-600">Click an object in the viewport to see its data.</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-zinc-500 text-xs p-4 text-center">
        <p>No geometry data available.</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-3 py-2 border-b border-zinc-800 bg-zinc-900/40 shrink-0">
        <div className="text-sm font-medium text-zinc-100">Datasheet</div>
        <div className="text-[10px] text-zinc-500 font-mono mt-0.5">
          {data.summary.points} pts · {data.summary.faces} faces · {data.summary.edges} edges
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-zinc-800 shrink-0">
        {["points", "vertices", "edges", "faces", "groups"].map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-1.5 text-[10px] font-medium uppercase tracking-wider transition-colors ${
              tab === t
                ? "text-cyan-400 border-b-2 border-cyan-400 bg-zinc-900/50"
                : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto min-h-0">
        {tab === "points" && <PointTable points={data.points} />}
        {tab === "vertices" && <VertexTable vertices={data.vertices} />}
        {tab === "edges" && <EdgeTable edges={data.edges} />}
        {tab === "faces" && <FaceTable faces={data.faces} />}
        {tab === "groups" && <GroupTable groups={data.groups} />}
      </div>
    </div>
  );
}

// Extract geometry data from THREE.BufferGeometry
function extractGeometryData(geometry, matrixWorld) {
  const pos = geometry.attributes.position;
  const index = geometry.index;
  if (!pos) return null;

  const points = [];
  const vertices = [];
  const faces = [];
  const edges = [];
  const edgeSet = new Set();

  // Extract points
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    // Apply world transform
    const v = new THREE.Vector3(x, y, z).applyMatrix4(matrixWorld);
    points.push({ id: i, x: v.x, y: v.y, z: v.z });
  }

  // Extract faces + vertices
  const triCount = index ? index.count / 3 : pos.count / 3;
  for (let i = 0; i < triCount; i++) {
    const a = index ? index.getX(i * 3) : i * 3;
    const b = index ? index.getX(i * 3 + 1) : i * 3 + 1;
    const c = index ? index.getX(i * 3 + 2) : i * 3 + 2;

    faces.push({ id: i, verts: [a, b, c], count: 3 });

    // Vertices (per-face vertex references)
    vertices.push({ faceId: i, vertId: 0, pointId: a });
    vertices.push({ faceId: i, vertId: 1, pointId: b });
    vertices.push({ faceId: i, vertId: 2, pointId: c });

    // Edges (unique, undirected)
    const faceEdges = [[a, b], [b, c], [c, a]];
    for (const [p1, p2] of faceEdges) {
      const key = p1 < p2 ? `${p1}-${p2}` : `${p2}-${p1}`;
      if (!edgeSet.has(key)) {
        edgeSet.add(key);
        edges.push({ id: edges.length, p1: Math.min(p1, p2), p2: Math.max(p1, p2) });
      }
    }
  }

  // Extract groups from geometry.groups (THREE.BufferGeometry groups = material slots)
  const groups = (geometry.groups || []).map((g, i) => ({
    id: i,
    name: `group_${i}`,
    start: g.start,
    count: g.count,
    materialIndex: g.materialIndex ?? 0,
  }));

  return {
    points,
    vertices,
    edges,
    faces,
    groups,
    summary: {
      points: points.length,
      vertices: vertices.length,
      edges: edges.length,
      faces: faces.length,
    },
  };
}

// --- Table components ---

function PointTable({ points }) {
  return (
    <table className="w-full text-[10px] font-mono">
      <thead className="sticky top-0 bg-zinc-900 text-zinc-500">
        <tr>
          <th className="text-left px-2 py-1">ID</th>
          <th className="text-right px-2 py-1">X</th>
          <th className="text-right px-2 py-1">Y</th>
          <th className="text-right px-2 py-1">Z</th>
        </tr>
      </thead>
      <tbody>
        {points.map((p) => (
          <tr key={p.id} className="border-b border-zinc-900 hover:bg-zinc-900/50">
            <td className="px-2 py-0.5 text-cyan-400">{p.id}</td>
            <td className="px-2 py-0.5 text-right text-zinc-300">{p.x.toFixed(4)}</td>
            <td className="px-2 py-0.5 text-right text-zinc-300">{p.y.toFixed(4)}</td>
            <td className="px-2 py-0.5 text-right text-zinc-300">{p.z.toFixed(4)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function VertexTable({ vertices }) {
  return (
    <table className="w-full text-[10px] font-mono">
      <thead className="sticky top-0 bg-zinc-900 text-zinc-500">
        <tr>
          <th className="text-left px-2 py-1">Face</th>
          <th className="text-left px-2 py-1">Vert</th>
          <th className="text-left px-2 py-1">Point</th>
        </tr>
      </thead>
      <tbody>
        {vertices.map((v, i) => (
          <tr key={i} className="border-b border-zinc-900 hover:bg-zinc-900/50">
            <td className="px-2 py-0.5 text-cyan-400">{v.faceId}</td>
            <td className="px-2 py-0.5 text-zinc-300">{v.vertId}</td>
            <td className="px-2 py-0.5 text-zinc-300">{v.pointId}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function EdgeTable({ edges }) {
  return (
    <table className="w-full text-[10px] font-mono">
      <thead className="sticky top-0 bg-zinc-900 text-zinc-500">
        <tr>
          <th className="text-left px-2 py-1">ID</th>
          <th className="text-left px-2 py-1">P1</th>
          <th className="text-left px-2 py-1">P2</th>
        </tr>
      </thead>
      <tbody>
        {edges.map((e) => (
          <tr key={e.id} className="border-b border-zinc-900 hover:bg-zinc-900/50">
            <td className="px-2 py-0.5 text-cyan-400">{e.id}</td>
            <td className="px-2 py-0.5 text-zinc-300">{e.p1}</td>
            <td className="px-2 py-0.5 text-zinc-300">{e.p2}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function FaceTable({ faces }) {
  return (
    <table className="w-full text-[10px] font-mono">
      <thead className="sticky top-0 bg-zinc-900 text-zinc-500">
        <tr>
          <th className="text-left px-2 py-1">ID</th>
          <th className="text-left px-2 py-1">Verts</th>
          <th className="text-left px-2 py-1">Indices</th>
        </tr>
      </thead>
      <tbody>
        {faces.map((f) => (
          <tr key={f.id} className="border-b border-zinc-900 hover:bg-zinc-900/50">
            <td className="px-2 py-0.5 text-cyan-400">{f.id}</td>
            <td className="px-2 py-0.5 text-zinc-300">{f.count}</td>
            <td className="px-2 py-0.5 text-zinc-300">{f.verts.join(", ")}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function GroupTable({ groups }) {
  if (!groups || groups.length === 0) {
    return (
      <div className="p-3 text-[11px] text-zinc-500 text-center">
        No groups defined on this geometry.
      </div>
    );
  }
  return (
    <table className="w-full text-[10px] font-mono">
      <thead className="sticky top-0 bg-zinc-900 text-zinc-500">
        <tr>
          <th className="text-left px-2 py-1">ID</th>
          <th className="text-left px-2 py-1">Name</th>
          <th className="text-right px-2 py-1">Start</th>
          <th className="text-right px-2 py-1">Count</th>
          <th className="text-right px-2 py-1">Mat</th>
        </tr>
      </thead>
      <tbody>
        {groups.map((g) => (
          <tr key={g.id} className="border-b border-zinc-900 hover:bg-zinc-900/50">
            <td className="px-2 py-0.5 text-cyan-400">{g.id}</td>
            <td className="px-2 py-0.5 text-zinc-300">{g.name}</td>
            <td className="px-2 py-0.5 text-right text-zinc-300">{g.start}</td>
            <td className="px-2 py-0.5 text-right text-zinc-300">{g.count}</td>
            <td className="px-2 py-0.5 text-right text-zinc-300">{g.materialIndex}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
