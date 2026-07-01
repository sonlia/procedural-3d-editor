"use client";

import { useState } from "react";
import { Boxes, FolderTree, Layers } from "lucide-react";
import { ModelsTab } from "./ModelsTab";
import { ResourcesTab } from "./ResourcesTab";
import { NodesTab } from "./NodesTab";

// Left panel — 3 tabs:
//   1. Models: tree view of the current graph's nodes (subgraphs expandable)
//   2. Resources: categorized asset library (models / materials / textures / ...)
//   3. Nodes: all registered node types — double-click to add to graph

const TABS = [
  { id: "models", label: "Models", icon: FolderTree, component: ModelsTab },
  { id: "resources", label: "Resources", icon: Boxes, component: ResourcesTab },
  { id: "nodes", label: "Nodes", icon: Layers, component: NodesTab },
];

export function LeftPanel() {
  const [activeTab, setActiveTab] = useState("models");
  const ActiveComponent = TABS.find((t) => t.id === activeTab)?.component ?? ModelsTab;

  return (
    <div className="h-full flex flex-col bg-zinc-950">
      {/* Tab header */}
      <div className="flex border-b border-zinc-800 shrink-0">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-[11px] font-medium uppercase tracking-wider transition-colors ${
                isActive
                  ? "text-cyan-400 border-b-2 border-cyan-400 bg-zinc-900/50"
                  : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900/30"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {tab.label}
            </button>
          );
        })}
      </div>
      {/* Tab content */}
      <div className="flex-1 min-h-0">
        <ActiveComponent />
      </div>
    </div>
  );
}
