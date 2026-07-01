"use client";

import { useState } from "react";
import { ChevronRight, ChevronDown, Box, Lightbulb, Palette, Film, Database, Eye, EyeOff } from "lucide-react";
import { useEditor } from "@/lib/editor/store";

// Models tab — tree view of the current graph's nodes.
// Subgraph nodes are expandable (click chevron to see inner nodes).
// Click a node → select it (highlights in graph + shows properties on right).

function getNodeIcon(type) {
  if (type.includes("geometry") || type.includes("import")) return Box;
  if (type.includes("light")) return Lightbulb;
  if (type.includes("material")) return Palette;
  if (type.includes("camera")) return Film;
  if (type.includes("output") || type.includes("scene")) return Database;
  return Box;
}

function getNodeLabel(node) {
  return node.title || node.type?.split("/").pop() || "node";
}

export function ModelsTab() {
  const graph = useEditor((s) => s.graph);
  const version = useEditor((s) => s.version);
  const selectedNodeIds = useEditor((s) => s.selectedNodeIds);
  const displayFlags = useEditor((s) => s.displayFlags);
  void version;

  const nodes = graph?.nodes ?? graph?._nodes ?? [];

  return (
    <div className="h-full flex flex-col">
      <div className="flex-1 overflow-y-auto">
        {nodes.length === 0 ? (
          <div className="p-3 text-[11px] text-zinc-500">
            No nodes in graph.
            <div className="mt-1 text-zinc-600">
              Switch to <span className="text-zinc-300">Nodes</span> tab and double-click to add.
            </div>
          </div>
        ) : (
          <ul className="py-1">
            {nodes.map((n) => (
              <NodeTreeItem
                key={n.id}
                node={n}
                depth={0}
                selectedNodeIds={selectedNodeIds}
                displayFlags={displayFlags}
              />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function NodeTreeItem({ node, depth, selectedNodeIds, displayFlags }) {
  const [expanded, setExpanded] = useState(false);
  const hasSubgraph = !!node.subgraph;
  const isSelected = selectedNodeIds.includes(node.id);
  const isDisplay = displayFlags.includes(node.id);
  const Icon = getNodeIcon(node.type);
  const innerNodes = hasSubgraph
    ? (node.subgraph.nodes ?? node.subgraph._nodes ?? [])
    : [];

  return (
    <li>
      <div
        className={`flex items-center gap-1 px-2 py-1 cursor-pointer hover:bg-zinc-900 ${
          isSelected ? "bg-cyan-950/40 text-cyan-300" : "text-zinc-300"
        }`}
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
        onClick={() => {
          useEditor.getState().setSelectedNodeIds([node.id]);
          useEditor.getState().setSelectedObjectId(String(node.id));
          // Also select in LiteGraph canvas
          if (window._graphcanvas && window._graph) {
            window._graphcanvas.selectNodes([node]);
          }
        }}
      >
        {hasSubgraph ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setExpanded(!expanded);
            }}
            className="text-zinc-500 hover:text-zinc-300 shrink-0"
          >
            {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
          </button>
        ) : (
          <span className="w-3 shrink-0" />
        )}
        <Icon className="h-3.5 w-3.5 text-zinc-400 shrink-0" />
        <span className="flex-1 text-xs truncate">{getNodeLabel(node)}</span>
        {isDisplay && (
          <Eye className="h-3 w-3 text-cyan-400 shrink-0" />
        )}
      </div>
      {hasSubgraph && expanded && innerNodes.length > 0 && (
        <ul>
          {innerNodes.map((inner) => (
            <NodeTreeItem
              key={inner.id}
              node={inner}
              depth={depth + 1}
              selectedNodeIds={selectedNodeIds}
              displayFlags={displayFlags}
            />
          ))}
        </ul>
      )}
    </li>
  );
}
