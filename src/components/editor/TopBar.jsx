"use client";

import { useRef } from "react";
import {
  Box,
  Pause,
  Play,
  Redo2,
  RotateCcw,
  Save,
  Square,
  Undo2,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import { useEditor } from "@/lib/editor/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function TopBar() {
  const fileInputRef = useRef(null);
  const undoStack = useEditor((s) => s.undoStack);
  const redoStack = useEditor((s) => s.redoStack);
  const currentFrame = useEditor((s) => s.currentFrame);
  const frameRange = useEditor((s) => s.frameRange);
  const isPlaying = useEditor((s) => s.isPlaying);
  const fps = useEditor((s) => s.fps);

  const handleSave = () => {
    const ws = useEditor.getState().getWorkspace();
    const blob = new Blob([JSON.stringify(ws, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "workspace.json";
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Workspace saved");
  };

  const handleLoadClick = () => {
    fileInputRef.current?.click();
  };

  const handleLoadFile = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        useEditor.getState().loadWorkspace({
          graph: data.graph,
          keyframes: data.keyframes ?? {},
          frameRange: data.frameRange ?? [0, 240],
          currentFrame: data.currentFrame ?? 0,
        });
        useEditor.getState().bumpVersion();
        toast.success("Workspace loaded");
      } catch (err) {
        toast.error(
          `Failed to load: ${err instanceof Error ? err.message : String(err)}`
        );
      }
    };
    reader.readAsText(f);
    e.target.value = "";
  };

  return (
    <div className="h-12 shrink-0 flex items-center gap-2 px-3 bg-zinc-950 border-b border-zinc-800">
      <div className="flex items-center gap-1.5 mr-2">
        <div className="h-7 w-7 rounded bg-gradient-to-br from-cyan-400 to-emerald-500 flex items-center justify-center">
          <Box className="h-4 w-4 text-black" />
        </div>
        <span className="text-sm font-semibold text-zinc-100">NodeGraph3D</span>
      </div>

      <div className="h-6 w-px bg-zinc-800 mx-1" />

      <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={handleSave}>
        <Save className="h-3.5 w-3.5" />
        Save
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className="h-8 text-xs"
        onClick={handleLoadClick}
      >
        <Upload className="h-3.5 w-3.5" />
        Load
      </Button>
      <input
        ref={fileInputRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={handleLoadFile}
      />

      <div className="h-6 w-px bg-zinc-800 mx-1" />

      <Button
        variant="ghost"
        size="sm"
        className="h-8 text-xs"
        disabled={undoStack.length === 0}
        onClick={() => useEditor.getState().undo()}
        title="Undo (Ctrl+Z)"
      >
        <Undo2 className="h-3.5 w-3.5" />
        Undo
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className="h-8 text-xs"
        disabled={redoStack.length === 0}
        onClick={() => useEditor.getState().redo()}
        title="Redo (Ctrl+Y)"
      >
        <Redo2 className="h-3.5 w-3.5" />
        Redo
      </Button>

      <div className="h-6 w-px bg-zinc-800 mx-1" />

      <div className="flex-1" />

      <div className="flex items-center gap-2 text-xs text-zinc-300">
        <span className="text-zinc-500">Frame</span>
        <input
          type="range"
          min={frameRange[0]}
          max={frameRange[1]}
          value={currentFrame}
          onChange={(e) =>
            useEditor.getState().setCurrentFrame(Number(e.target.value))
          }
          className="w-40 accent-cyan-500"
        />
        <span className="font-mono text-zinc-400">
          {currentFrame} / {frameRange[1]}
        </span>
      </div>

      <div className="h-6 w-px bg-zinc-800 mx-1" />

      <div className="flex items-center gap-1">
        <span className="text-[10px] text-zinc-500">FPS</span>
        <Input
          type="number"
          value={fps}
          min={1}
          max={120}
          onChange={(e) => useEditor.getState().setFps(Number(e.target.value))}
          className="h-7 w-14 text-xs px-1.5"
        />
      </div>

      <Button
        size="icon"
        variant={isPlaying ? "default" : "outline"}
        className="h-8 w-8"
        onClick={() => useEditor.getState().setIsPlaying(!isPlaying)}
        title={isPlaying ? "Pause" : "Play"}
      >
        {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
      </Button>
      <Button
        size="icon"
        variant="outline"
        className="h-8 w-8"
        onClick={() => {
          useEditor.getState().setIsPlaying(false);
          useEditor.getState().setCurrentFrame(frameRange[0]);
        }}
        title="Stop"
      >
        <Square className="h-4 w-4" />
      </Button>
      <Button
        size="icon"
        variant="outline"
        className="h-8 w-8"
        onClick={() => {
          useEditor.getState().setCurrentFrame(frameRange[0]);
          useEditor.getState().setIsPlaying(true);
        }}
        title="Restart"
      >
        <RotateCcw className="h-4 w-4" />
      </Button>
    </div>
  );
}
