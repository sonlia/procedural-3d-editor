"use client";

import { useState } from "react";
import { Boxes, Image, Palette, FileBox, Search } from "lucide-react";

// Resources tab — categorized asset library.
// Categories: Models / Materials / Textures (Maps) / HDRI / Scripts
// For MVP this is a static placeholder; in a real editor these would come from
// a project asset folder. Double-click an item to "use" it (future: drag onto graph).

const CATEGORIES = [
  { id: "models", label: "Models", icon: FileBox },
  { id: "materials", label: "Materials", icon: Palette },
  { id: "textures", label: "Textures / Maps", icon: Image },
  { id: "hdri", label: "HDRI", icon: Boxes },
  { id: "scripts", label: "Scripts", icon: Search },
];

const SAMPLE_RESOURCES = {
  models: [
    { name: "Default Cube", type: "GLTF", size: "12 KB" },
    { name: "Sphere", type: "GLTF", size: "8 KB" },
    { name: "Suzanne", type: "OBJ", size: "240 KB" },
  ],
  materials: [
    { name: "Standard White", type: "PBR", size: "—" },
    { name: "Metallic Blue", type: "PBR", size: "—" },
    { name: "Emissive Red", type: "PBR", size: "—" },
  ],
  textures: [
    { name: "Grid Pattern", type: "PNG", size: "1.2 MB" },
    { name: "Noise Normal", type: "PNG", size: "3.4 MB" },
    { name: "Brick Diffuse", type: "JPG", size: "680 KB" },
  ],
  hdri: [
    { name: "Studio Small", type: "HDR", size: "12 MB" },
    { name: "Sunset", type: "HDR", size: "24 MB" },
  ],
  "scripts": [
    { name: "Rotate Animation", type: "JS", size: "2 KB" },
    { name: "Wave Deformer", type: "JS", size: "4 KB" },
  ],
};

export function ResourcesTab() {
  const [activeCat, setActiveCat] = useState("models");
  const [search, setSearch] = useState("");

  const items = SAMPLE_RESOURCES[activeCat] ?? [];
  const filtered = search
    ? items.filter((i) => i.name.toLowerCase().includes(search.toLowerCase()))
    : items;

  return (
    <div className="h-full flex flex-col">
      {/* Category dropdown */}
      <div className="p-2 border-b border-zinc-800 space-y-2 shrink-0">
        <select
          value={activeCat}
          onChange={(e) => setActiveCat(e.target.value)}
          className="w-full h-7 bg-zinc-900 border border-zinc-800 rounded px-2 text-xs text-zinc-100"
        >
          {CATEGORIES.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </select>
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-zinc-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search..."
            className="w-full h-7 bg-zinc-900 border border-zinc-800 rounded pl-7 pr-2 text-xs text-zinc-100 placeholder:text-zinc-600"
          />
        </div>
      </div>
      {/* Resource list */}
      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="p-3 text-[11px] text-zinc-500 text-center">
            No resources found.
          </div>
        ) : (
          <ul className="divide-y divide-zinc-900">
            {filtered.map((item, i) => {
              const cat = CATEGORIES.find((c) => c.id === activeCat);
              const Icon = cat?.icon ?? FileBox;
              return (
                <li
                  key={i}
                  className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-zinc-900"
                  onDoubleClick={() => {
                    // Future: add appropriate node to graph based on category
                    console.log("Use resource:", item);
                  }}
                >
                  <Icon className="h-3.5 w-3.5 text-zinc-400 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-zinc-200 truncate">{item.name}</div>
                    <div className="text-[10px] text-zinc-500">
                      {item.type} · {item.size}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
      <div className="border-t border-zinc-800 p-2 text-[10px] text-zinc-600 shrink-0">
        Double-click a resource to add it to the graph.
      </div>
    </div>
  );
}
