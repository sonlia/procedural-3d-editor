"use client";

import { FileBox } from "lucide-react";
import { useEditor } from "@/lib/editor/store";

// Simplified: lists nodes whose type starts with "sop/file" or "File" (case-insensitive).
// Node types will be defined later per user's spec.

export function ModelList() {
  const graph = useEditor((s) => s.graph);
  const version = useEditor((s) => s.version);
  const selectedObjectId = useEditor((s) => s.selectedObjectId);
  void version;

  const nodes = graph?.nodes ?? graph?._nodes ?? [];
  const fileNodes = nodes.filter(
    (n) =>
      n.type === "sop/file" ||
      n.type === "File" ||
      (typeof n.type === "string" && n.type.toLowerCase().includes("file"))
  );

  return (
    <div className="h-full flex flex-col bg-zinc-950">
      <div className="px-3 py-2 border-b border-zinc-800 text-[11px] font-medium uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
        <FileBox className="h-3.5 w-3.5" />
        Models
      </div>
      <div className="flex-1 overflow-y-auto">
        {fileNodes.length === 0 ? (
          <div className="p-3 text-[11px] text-zinc-500">
            No imported models yet.
            <div className="mt-1 text-zinc-600">
              Add a <span className="text-zinc-300">File</span> node from the
              graph&apos;s right-click menu to import models.
            </div>
          </div>
        ) : (
          <ul className="divide-y divide-zinc-900">
            {fileNodes.map((n) => {
              const url = String(n.properties?.url ?? "");
              const name = url ? url.split("/").pop() : "(no file)";
              const isSelected = selectedObjectId === String(n.id);
              return (
                <li
                  key={n.id}
                  className={`flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-zinc-900 ${
                    isSelected ? "bg-cyan-950/30" : ""
                  }`}
                  onClick={() => {
                    useEditor.getState().setSelectedNodeIds([n.id]);
                    useEditor.getState().setSelectedObjectId(String(n.id));
                  }}
                >
                  <FileBox className="h-3.5 w-3.5 text-zinc-400 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-zinc-200 truncate">{name}</div>
                    <div className="text-[10px] text-zinc-500 font-mono">
                      id {n.id} · {String(n.properties?.format ?? "GLTF")}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
      <div className="border-t border-zinc-800 p-2 text-[10px] text-zinc-600">
        Tip: Custom node types will be added here incrementally.
      </div>
    </div>
  );
}
