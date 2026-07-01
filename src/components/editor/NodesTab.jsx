"use client";

import { useState, useMemo } from "react";
import { Search, Plus } from "lucide-react";
import { LiteGraph } from "@/lib/editor/litegraph.js";
import { getAllNodeClasses } from "@/lib/editor/registry";
import { useEditor } from "@/lib/editor/store";

// Nodes tab — lists all registered node types.
// Double-click or click + button to add the node to the current graph.

export function NodesTab() {
  const [search, setSearch] = useState("");
  const allClasses = getAllNodeClasses();

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return allClasses.filter((cls) => {
      const type = `${cls.treePath}/${cls.id}`;
      const label = (cls.title || cls.id || "").toLowerCase();
      return type.toLowerCase().includes(q) || label.includes(q);
    });
  }, [search, allClasses]);

  const addNode = (cls) => {
    const graph = window._graph;
    const canvas = window._graphcanvas;
    if (!graph) return;
    const type = `${cls.treePath}/${cls.id}`;
    let node = null;
    try {
      // Use LiteGraph.createNode (global from editor.js)
      node = LiteGraph.createNode(type);
    } catch (e) {
      console.error("createNode failed:", e);
      return;
    }
    if (!node) {
      console.error("createNode returned null for", type);
      return;
    }
    // Place at a random position near center
    node.pos = [200 + Math.random() * 100, 200 + Math.random() * 100];
    try {
      graph.add(node);
    } catch (e) {
      console.error("graph.add failed:", e);
      return;
    }
    // Select the new node
    if (canvas) {
      try { canvas.selectNodes([node]); } catch (e) {}
    }
    useEditor.getState().pushHistory(`Add ${cls.title}`);
    useEditor.getState().bumpVersion();
  };

  // Group by treePath (category)
  const grouped = useMemo(() => {
    const map = new Map();
    for (const cls of filtered) {
      const cat = cls.treePath || "Other";
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat).push(cls);
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [filtered]);

  return (
    <div className="h-full flex flex-col">
      {/* Search */}
      <div className="p-2 border-b border-zinc-800 shrink-0">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-zinc-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search nodes..."
            className="w-full h-7 bg-zinc-900 border border-zinc-800 rounded pl-7 pr-2 text-xs text-zinc-100 placeholder:text-zinc-600"
          />
        </div>
      </div>
      {/* Node list grouped by category */}
      <div className="flex-1 overflow-y-auto">
        {grouped.length === 0 ? (
          <div className="p-3 text-[11px] text-zinc-500 text-center">
            No nodes found.
          </div>
        ) : (
          grouped.map(([cat, classes]) => (
            <div key={cat}>
              <div className="px-2 py-1 bg-zinc-900/50 text-[10px] font-medium uppercase tracking-wider text-zinc-500 border-b border-zinc-800">
                {cat}
              </div>
              <ul>
                {classes.map((cls) => (
                  <li
                    key={cls.id}
                    className="flex items-center gap-2 px-2 py-1.5 cursor-pointer hover:bg-zinc-900 group"
                    onDoubleClick={() => addNode(cls)}
                  >
                    <div
                      className="h-2.5 w-2.5 rounded-sm shrink-0"
                      style={{ backgroundColor: cls.color || "#888" }}
                    />
                    <span className="flex-1 text-xs text-zinc-200 truncate">
                      {cls.title || cls.id}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        addNode(cls);
                      }}
                      className="opacity-0 group-hover:opacity-100 text-zinc-500 hover:text-cyan-400 transition-opacity"
                      title="Add to graph"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))
        )}
      </div>
      <div className="border-t border-zinc-800 p-2 text-[10px] text-zinc-600 shrink-0">
        Double-click or click + to add a node to the graph.
      </div>
    </div>
  );
}
