"use client";

import { useMemo, useState, useEffect } from "react";
import { useEditor } from "@/lib/editor/store";
import * as THREE from "three";

// Datasheet — Houdini-style geometry spreadsheet.
// 5 tabs: Points / Vertices / Edges / Faces / Groups
// Click a row to highlight that element in the viewport.
// Shift+click for multi-select.
// Points/Vertices/Faces show attribute columns: N (normal), Cd (color), UV.

export function Datasheet() {
  const selectedObjectId = useEditor((s) => s.selectedObjectId);
  const version = useEditor((s) => s.version);
  const setDatasheetHighlight = useEditor((s) => s.setDatasheetHighlight);
  const [tab, setTab] = useState("points");
  const [selectedRows, setSelectedRows] = useState(new Set());

  // Clear selection when tab or object changes
  useEffect(() => {
    setSelectedRows(new Set());
    setDatasheetHighlight(null);
  }, [tab, selectedObjectId, setDatasheetHighlight]);

  const data = useMemo(() => {
    if (!selectedObjectId) return null;
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

  // Update viewport highlight when row selection changes
  useEffect(() => {
    if (selectedRows.size === 0) {
      setDatasheetHighlight(null);
    } else {
      setDatasheetHighlight({ type: tab, ids: [...selectedRows] });
    }
  }, [selectedRows, tab, setDatasheetHighlight]);

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

  const handleRowClick = (id, shiftKey) => {
    setSelectedRows((prev) => {
      const next = new Set(prev);
      if (shiftKey) {
        if (next.has(id)) next.delete(id);
        else next.add(id);
      } else {
        next.clear();
        next.add(id);
      }
      return next;
    });
  };

  return (
    <div className="h-full flex flex-col">
      <div className="px-3 py-2 border-b border-zinc-800 bg-zinc-900/40 shrink-0">
        <div className="text-sm font-medium text-zinc-100">Datasheet</div>
        <div className="text-[10px] text-zinc-500 font-mono mt-0.5">
          {data.summary.points} pts · {data.summary.faces} faces · {data.summary.edges} edges
          {selectedRows.size > 0 && <span className="text-cyan-400 ml-2">| {selectedRows.size} selected</span>}
        </div>
      </div>

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

      <div className="flex-1 overflow-auto min-h-0">
        {tab === "points" && (
          <PointTable points={data.points} selectedRows={selectedRows} onRowClick={handleRowClick} />
        )}
        {tab === "vertices" && (
          <VertexTable vertices={data.vertices} selectedRows={selectedRows} onRowClick={handleRowClick} />
        )}
        {tab === "edges" && (
          <EdgeTable edges={data.edges} selectedRows={selectedRows} onRowClick={handleRowClick} />
        )}
        {tab === "faces" && (
          <FaceTable faces={data.faces} selectedRows={selectedRows} onRowClick={handleRowClick} />
        )}
        {tab === "groups" && <GroupTable groups={data.groups} />}
      </div>
    </div>
  );
}

function extractGeometryData(geometry, matrixWorld) {
  const pos = geometry.attributes.position;
  const index = geometry.index;
  if (!pos) return null;

  // Check for optional attributes
  const normalAttr = geometry.attributes.normal;
  const colorAttr = geometry.attributes.color;
  const uvAttr = geometry.attributes.uv;
  const hasNormals = !!normalAttr;
  const hasColors = !!colorAttr;
  const hasUVs = !!uvAttr;

  const points = [];
  const vertices = [];
  const faces = [];
  const edges = [];
  const edgeSet = new Set();

  for (let i = 0; i < pos.count; i++) {
    const v = new THREE.Vector3(pos.getX(i), pos.getY(i), pos.getZ(i)).applyMatrix4(matrixWorld);
    const pt = { id: i, x: v.x, y: v.y, z: v.z };
    if (hasNormals) {
      // Transform normal by world matrix (only rotation, not translation)
      const n = new THREE.Vector3(normalAttr.getX(i), normalAttr.getY(i), normalAttr.getZ(i));
      const normalMatrix = new THREE.Matrix3().getNormalMatrix(matrixWorld);
      n.applyMatrix3(normalMatrix).normalize();
      pt.nx = n.x; pt.ny = n.y; pt.nz = n.z;
    }
    if (hasColors) {
      pt.cr = colorAttr.getX(i);
      pt.cg = colorAttr.getY(i);
      pt.cb = colorAttr.getZ(i);
    }
    if (hasUVs) {
      pt.u = uvAttr.getX(i);
      pt.vv = uvAttr.getY(i);
    }
    points.push(pt);
  }

  const triCount = index ? index.count / 3 : pos.count / 3;
  for (let i = 0; i < triCount; i++) {
    const a = index ? index.getX(i * 3) : i * 3;
    const b = index ? index.getX(i * 3 + 1) : i * 3 + 1;
    const c = index ? index.getX(i * 3 + 2) : i * 3 + 2;

    const face = { id: i, verts: [a, b, c], count: 3 };
    // Face normal (if available, take from first vertex)
    if (hasNormals) {
      face.nx = normalAttr.getX(a);
      face.ny = normalAttr.getY(a);
      face.nz = normalAttr.getZ(a);
    }
    faces.push(face);

    vertices.push({ id: vertices.length, faceId: i, vertId: 0, pointId: a });
    vertices.push({ id: vertices.length, faceId: i, vertId: 1, pointId: b });
    vertices.push({ id: vertices.length, faceId: i, vertId: 2, pointId: c });

    const faceEdges = [[a, b], [b, c], [c, a]];
    for (const [p1, p2] of faceEdges) {
      const key = p1 < p2 ? `${p1}-${p2}` : `${p2}-${p1}`;
      if (!edgeSet.has(key)) {
        edgeSet.add(key);
        edges.push({ id: edges.length, p1: Math.min(p1, p2), p2: Math.max(p1, p2) });
      }
    }
  }

  const groups = (geometry.groups || []).map((g, i) => ({
    id: i,
    name: `group_${i}`,
    start: g.start,
    count: g.count,
    materialIndex: g.materialIndex ?? 0,
  }));

  return {
    points, vertices, edges, faces, groups,
    hasNormals, hasColors, hasUVs,
    summary: {
      points: points.length,
      vertices: vertices.length,
      edges: edges.length,
      faces: faces.length,
    },
  };
}

// --- Table components ---

function Th({ children }) {
  return <th className="text-left px-2 py-1 whitespace-nowrap">{children}</th>;
}
function Td({ children, className = "" }) {
  return <td className={`px-2 py-0.5 ${className}`}>{children}</td>;
}
function Row({ selected, onClick, children }) {
  return (
    <tr
      onClick={onClick}
      className={`border-b border-zinc-900 cursor-pointer ${
        selected ? "bg-cyan-950/40" : "hover:bg-zinc-900/50"
      }`}
    >
      {children}
    </tr>
  );
}

function PointTable({ points, selectedRows, onRowClick }) {
  return (
    <table className="w-full text-[10px] font-mono">
      <thead className="sticky top-0 bg-zinc-900 text-zinc-500">
        <tr>
          <Th>ID</Th>
          <Th>X</Th><Th>Y</Th><Th>Z</Th>
          {points[0]?.nx != null && <><Th>NX</Th><Th>NY</Th><Th>NZ</Th></>}
          {points[0]?.cr != null && <><Th>CR</Th><Th>CG</Th><Th>CB</Th></>}
          {points[0]?.u != null && <><Th>U</Th><Th>V</Th></>}
        </tr>
      </thead>
      <tbody>
        {points.map((p) => (
          <Row key={p.id} selected={selectedRows.has(p.id)} onClick={(e) => onRowClick(p.id, e.shiftKey)}>
            <Td className="text-cyan-400">{p.id}</Td>
            <Td className="text-right text-zinc-300">{p.x.toFixed(4)}</Td>
            <Td className="text-right text-zinc-300">{p.y.toFixed(4)}</Td>
            <Td className="text-right text-zinc-300">{p.z.toFixed(4)}</Td>
            {p.nx != null && <><Td className="text-right text-emerald-400">{p.nx.toFixed(3)}</Td><Td className="text-right text-emerald-400">{p.ny.toFixed(3)}</Td><Td className="text-right text-emerald-400">{p.nz.toFixed(3)}</Td></>}
            {p.cr != null && <><Td className="text-right text-orange-400">{p.cr.toFixed(3)}</Td><Td className="text-right text-orange-400">{p.cg.toFixed(3)}</Td><Td className="text-right text-orange-400">{p.cb.toFixed(3)}</Td></>}
            {p.u != null && <><Td className="text-right text-purple-400">{p.u.toFixed(3)}</Td><Td className="text-right text-purple-400">{p.vv.toFixed(3)}</Td></>}
          </Row>
        ))}
      </tbody>
    </table>
  );
}

function VertexTable({ vertices, selectedRows, onRowClick }) {
  return (
    <table className="w-full text-[10px] font-mono">
      <thead className="sticky top-0 bg-zinc-900 text-zinc-500">
        <tr>
          <Th>ID</Th><Th>Face</Th><Th>Vert</Th><Th>Point</Th>
        </tr>
      </thead>
      <tbody>
        {vertices.map((v) => (
          <Row key={v.id} selected={selectedRows.has(v.id)} onClick={(e) => onRowClick(v.id, e.shiftKey)}>
            <Td className="text-cyan-400">{v.id}</Td>
            <Td className="text-zinc-300">{v.faceId}</Td>
            <Td className="text-zinc-300">{v.vertId}</Td>
            <Td className="text-zinc-300">{v.pointId}</Td>
          </Row>
        ))}
      </tbody>
    </table>
  );
}

function EdgeTable({ edges, selectedRows, onRowClick }) {
  return (
    <table className="w-full text-[10px] font-mono">
      <thead className="sticky top-0 bg-zinc-900 text-zinc-500">
        <tr>
          <Th>ID</Th><Th>P1</Th><Th>P2</Th>
        </tr>
      </thead>
      <tbody>
        {edges.map((e) => (
          <Row key={e.id} selected={selectedRows.has(e.id)} onClick={(ev) => onRowClick(e.id, ev.shiftKey)}>
            <Td className="text-cyan-400">{e.id}</Td>
            <Td className="text-zinc-300">{e.p1}</Td>
            <Td className="text-zinc-300">{e.p2}</Td>
          </Row>
        ))}
      </tbody>
    </table>
  );
}

function FaceTable({ faces, selectedRows, onRowClick }) {
  return (
    <table className="w-full text-[10px] font-mono">
      <thead className="sticky top-0 bg-zinc-900 text-zinc-500">
        <tr>
          <Th>ID</Th><Th>Verts</Th><Th>Indices</Th>
          {faces[0]?.nx != null && <><Th>NX</Th><Th>NY</Th><Th>NZ</Th></>}
        </tr>
      </thead>
      <tbody>
        {faces.map((f) => (
          <Row key={f.id} selected={selectedRows.has(f.id)} onClick={(e) => onRowClick(f.id, e.shiftKey)}>
            <Td className="text-cyan-400">{f.id}</Td>
            <Td className="text-zinc-300">{f.count}</Td>
            <Td className="text-zinc-300">{f.verts.join(", ")}</Td>
            {f.nx != null && <><Td className="text-right text-emerald-400">{f.nx.toFixed(3)}</Td><Td className="text-right text-emerald-400">{f.ny.toFixed(3)}</Td><Td className="text-right text-emerald-400">{f.nz.toFixed(3)}</Td></>}
          </Row>
        ))}
      </tbody>
    </table>
  );
}

function GroupTable({ groups }) {
  if (!groups || groups.length === 0) {
    return <div className="p-3 text-[11px] text-zinc-500 text-center">No groups defined on this geometry.</div>;
  }
  return (
    <table className="w-full text-[10px] font-mono">
      <thead className="sticky top-0 bg-zinc-900 text-zinc-500">
        <tr>
          <Th>ID</Th><Th>Name</Th><Th>Start</Th><Th>Count</Th><Th>Mat</Th>
        </tr>
      </thead>
      <tbody>
        {groups.map((g) => (
          <tr key={g.id} className="border-b border-zinc-900 hover:bg-zinc-900/50">
            <Td className="text-cyan-400">{g.id}</Td>
            <Td className="text-zinc-300">{g.name}</Td>
            <Td className="text-right text-zinc-300">{g.start}</Td>
            <Td className="text-right text-zinc-300">{g.count}</Td>
            <Td className="text-right text-zinc-300">{g.materialIndex}</Td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
