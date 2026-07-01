// Properties panel:
//  - Reads selected node from store
//  - Looks up its NodeMeta class in the registry to find widgets metadata
//  - Renders one editor per widget (number/string/color/vector3/select/file)
//  - Numeric (and vector3 component) properties show a "key" button that
//    adds a keyframe at the current frame
//
// Widget metadata is defined on the node class as a static `widgets` array,
// OR we infer widgets from properties (number/string/boolean/array) as a
// fallback for nodes that don't declare widgets.

import { useState, useRef } from "react";
import { useEditor } from "@/lib/editor/store";
import { findNodeClass } from "@/lib/editor/registry.js";
import { ALL_MODEL_EXTENSIONS, getFormatDef } from "@/lib/editor/modelFormats.js";

export function PropertiesPanel() {
  const selectedNodeIds = useEditor((s) => s.selectedNodeIds);
  const version = useEditor((s) => s.version);
  const graph = useEditor((s) => s.graph);
  void version;

  if (selectedNodeIds.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-zinc-500 text-xs p-4 text-center">
        <p>No node selected.</p>
        <p className="mt-1 text-zinc-600">
          Click a node in the graph to edit its properties.
        </p>
      </div>
    );
  }
  if (selectedNodeIds.length > 1) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-zinc-500 text-xs p-4 text-center">
        <p>{selectedNodeIds.length} nodes selected.</p>
        <p className="mt-1 text-zinc-600">Select a single node to edit properties.</p>
      </div>
    );
  }

  const nodeId = selectedNodeIds[0];
  const nodes = graph?.nodes ?? graph?._nodes ?? [];
  const node = nodes.find((n) => n.id === nodeId);
  if (!node) {
    return <div className="p-4 text-xs text-zinc-500">Node not found in graph.</div>;
  }
  const cls = findNodeClass(node.type);
  // Build widget list from class.widgets or infer from properties.
  let widgets = cls?.widgets;
  if (!widgets) {
    const props = node.properties ?? {};
    widgets = Object.keys(props).map((name) => {
      const v = props[name];
      if (typeof v === "number") return { name, type: "number" };
      if (Array.isArray(v) && v.length === 3) return { name, type: "vector3" };
      if (typeof v === "string" && v.startsWith("#") && v.length === 7) {
        return { name, type: "color" };
      }
      return { name, type: "string" };
    });
  }

  const setProp = (name, value) => {
    node.properties = { ...(node.properties ?? {}), [name]: value };
    useEditor.getState().bumpVersion();
  };
  const commit = (desc) => useEditor.getState().pushHistory(desc);
  const keyframe = (propName, value) => {
    const frame = useEditor.getState().currentFrame;
    useEditor.getState().pushHistory(`Keyframe ${propName}`);
    useEditor.getState().addKeyframe(nodeId, propName, frame, value);
  };
  const isKeyed = (propName) => {
    const k = useEditor.getState().keyframes[String(nodeId)];
    return !!k && !!k[propName] && k[propName].length > 0;
  };

  return (
    <div className="h-full flex flex-col">
      <div className="px-3 py-2 border-b border-zinc-800 bg-zinc-900/40">
        <div className="text-sm font-medium text-zinc-100 truncate">
          {node.title || cls?.title || node.type}
        </div>
        <div className="text-[10px] text-zinc-500 font-mono mt-0.5">
          {node.type} · id {nodeId}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {widgets.length === 0 ? (
          <div className="text-xs text-zinc-500 italic">
            This node has no editable properties.
          </div>
        ) : (
          widgets.map((w) => (
            <WidgetEditor
              key={w.name}
              widget={w}
              value={node.properties?.[w.name]}
              onChange={(v) => setProp(w.name, v)}
              onCommit={(desc) => commit(desc)}
              onKeyframe={(v) => keyframe(w.name, v)}
              isKeyed={isKeyed(w.name)}
              nodeId={nodeId}
              checkKeyed={isKeyed}
              allValues={node.properties}
            />
          ))
        )}
      </div>
    </div>
  );
}

function WidgetEditor({ widget, value, onChange, onCommit, onKeyframe, isKeyed, nodeId, checkKeyed, allValues }) {
  const label = widget.label ?? widget.name;
  const [fileInputKey, setFileInputKey] = useState(0);
  const fileInputRef = useRef(null);

  // For file widgets: figure out the right `accept` attribute based on the
  // current value of the sibling "format" property (if any).
  const acceptAttribute = (() => {
    if (widget.type !== "file") return "";
    if (allValues?.format) {
      const fmt = getFormatDef(allValues.format);
      if (fmt) return fmt.extensions;
    }
    return ALL_MODEL_EXTENSIONS;
  })();

  if (widget.type === "vector3") {
    const arr = Array.isArray(value) ? value : [0, 0, 0];
    return (
      <div className="space-y-1.5">
        <label className="text-[11px] text-zinc-400">{label}</label>
        <div className="grid grid-cols-3 gap-1">
          {["X", "Y", "Z"].map((axis, i) => {
            const subName = `${widget.name}.${i}`;
            const subKeyed = checkKeyed ? checkKeyed(subName) : false;
            return (
              <div key={axis} className="flex flex-col gap-1">
                <div className="flex items-center gap-1">
                  <span className="text-[9px] text-zinc-500 w-3">{axis}</span>
                  <input
                    type="number"
                    value={Number(arr[i] ?? 0)}
                    step={widget.step ?? 0.1}
                    onChange={(e) => {
                      const next = [...arr];
                      next[i] = Number(e.target.value);
                      onChange(next);
                    }}
                    onBlur={() => onCommit(`Edit ${label}.${axis}`)}
                    className="w-full h-7 bg-zinc-900 border border-zinc-800 rounded px-2 text-xs text-zinc-100"
                  />
                </div>
                <button
                  className={`text-[10px] px-1 py-0.5 rounded border self-end mb-1 ${
                    subKeyed
                      ? "bg-cyan-500 text-black border-cyan-400"
                      : "border-zinc-700 text-zinc-500 hover:text-zinc-300"
                  }`}
                  title={subKeyed ? "Keyed" : "Keyframe at current frame"}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    const frame = useEditor.getState().currentFrame;
                    useEditor.getState().pushHistory(`Keyframe ${subName}`);
                    useEditor.getState().addKeyframe(nodeId, subName, frame, Number(arr[i] ?? 0));
                  }}
                >
                  {subKeyed ? "◆" : "◇"}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <label className="text-[11px] text-zinc-400">{label}</label>
        {widget.type === "number" && (
          <button
            onClick={() => onKeyframe(value)}
            className={`text-[10px] px-1.5 py-0.5 rounded border ${
              isKeyed
                ? "bg-cyan-500 text-black border-cyan-400"
                : "border-zinc-700 text-zinc-500 hover:text-zinc-300"
            }`}
            title={isKeyed ? "Keyed" : "Keyframe at current frame"}
          >
            {isKeyed ? "◆" : "◇"}
          </button>
        )}
      </div>
      {renderWidgetInput()}
      {widget.type === "file" && (
        <input
          ref={fileInputRef}
          type="file"
          accept={acceptAttribute}
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            const url = URL.createObjectURL(f);
            onChange(url);
            onCommit(`Load ${label}: ${f.name}`);
            // Reset the input value so the same file can be selected again
            e.target.value = "";
          }}
        />
      )}
    </div>
  );

  function renderWidgetInput() {
    switch (widget.type) {
      case "number":
        return (
          <input
            type="number"
            value={Number(value ?? 0)}
            step={widget.step ?? 0.1}
            min={widget.min}
            max={widget.max}
            onChange={(e) => onChange(Number(e.target.value))}
            onBlur={() => onCommit(`Edit ${label}`)}
            className="w-full h-7 bg-zinc-900 border border-zinc-800 rounded px-2 text-xs text-zinc-100"
          />
        );
      case "string":
        return (
          <input
            type="text"
            value={String(value ?? "")}
            onChange={(e) => onChange(e.target.value)}
            onBlur={() => onCommit(`Edit ${label}`)}
            className="w-full h-7 bg-zinc-900 border border-zinc-800 rounded px-2 text-xs text-zinc-100"
          />
        );
      case "color":
        return (
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={String(value ?? "#000000")}
              onChange={(e) => onChange(e.target.value)}
              onBlur={() => onCommit(`Edit ${label}`)}
              className="h-7 w-10 bg-transparent border border-zinc-800 rounded cursor-pointer"
            />
            <span className="text-[11px] text-zinc-400 font-mono">
              {String(value ?? "#000000")}
            </span>
          </div>
        );
      case "select": {
        // Support both:
        //   options.values = ["GLTF", "OBJ", ...]  (plain strings)
        //   optionsFull    = [{value, label}, ...]  (richer labels)
        const plainOpts = widget.options?.values ?? [];
        const richOpts = widget.optionsFull ?? plainOpts.map((v) => ({ value: v, label: v }));
        return (
          <select
            value={String(value ?? "")}
            onChange={(e) => {
              onChange(e.target.value);
              onCommit(`Edit ${label}`);
            }}
            className="w-full h-7 bg-zinc-900 border border-zinc-800 rounded px-2 text-xs text-zinc-100"
          >
            {richOpts.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        );
      }
      case "file":
        return (
          <button
            onClick={(e) => {
              // Find the hidden file input that's a sibling of this button
              const container = e.target.closest("div");
              const inp = container?.querySelector('input[type="file"]');
              if (inp) inp.click();
              else if (fileInputRef.current) fileInputRef.current.click();
            }}
            className="w-full h-7 bg-zinc-900 border border-zinc-800 rounded px-2 text-xs text-zinc-200 hover:bg-zinc-800 text-left truncate"
          >
            {value ? `Replace: ${String(value).split("/").pop()}` : "Choose File..."}
          </button>
        );
      default:
        return (
          <div className="text-[11px] text-zinc-500 font-mono">
            {String(value)}
          </div>
        );
    }
  }
}
