"use client";

import { useEffect, useRef, useState } from "react";
import { Pause, Play, Repeat, Square } from "lucide-react";
import { useEditor, sampleKeyframes } from "@/lib/editor/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// Timeline (canvas-based):
//  - Displays keyframe lanes per (nodeId, propName)
//  - Selection rule: 0 selected => all lanes, 1 => just that node, N => union
//  - Click diamond to select, drag to move, right-click to delete, shift-click to multi-select
//  - Click empty area to scrub playhead

export function Timeline() {
  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const [size, setSize] = useState({ w: 800, h: 140 });

  const isPlaying = useEditor((s) => s.isPlaying);
  const currentFrame = useEditor((s) => s.currentFrame);
  const frameRange = useEditor((s) => s.frameRange);
  const fps = useEditor((s) => s.fps);
  const keyframes = useEditor((s) => s.keyframes);
  const selectedNodeIds = useEditor((s) => s.selectedNodeIds);
  const selectedKeyframes = useEditor((s) => s.selectedKeyframes);
  const version = useEditor((s) => s.version);
  void version;

  const dragRef = useRef({
    type: "none",
    laneKey: "",
    kfIndex: -1,
    startFrame: 0,
    startX: 0,
    shifted: false,
  });

  // Build lanes based on selection rule.
  const lanes = [];
  const visibleNodeIds =
    selectedNodeIds.length === 0 ? null : selectedNodeIds;
  for (const [nodeIdStr, props] of Object.entries(keyframes)) {
    const nodeId = Number(nodeIdStr);
    if (visibleNodeIds !== null && !visibleNodeIds.includes(nodeId)) continue;
    for (const [propName, kfs] of Object.entries(props)) {
      if (!kfs || kfs.length === 0) continue;
      lanes.push({
        key: `${nodeId}:${propName}`,
        nodeId,
        propName,
        label: `Node ${nodeId} · ${propName}`,
        kfs,
      });
    }
  }

  // Resize observer
  useEffect(() => {
    const c = containerRef.current;
    if (!c) return;
    const ro = new ResizeObserver(() => {
      setSize({ w: c.clientWidth, h: c.clientHeight });
    });
    ro.observe(c);
    setSize({ w: c.clientWidth, h: c.clientHeight });
    return () => ro.disconnect();
  }, []);

  const labelWidth = 160;
  const laneHeight = 22;
  const topPad = 12;
  const [fStart, fEnd] = frameRange;
  const frameSpan = Math.max(1, fEnd - fStart);
  const xForFrame = (f) =>
    labelWidth + ((f - fStart) / frameSpan) * (size.w - labelWidth - 8);
  const frameForX = (x) =>
    fStart + ((x - labelWidth) / (size.w - labelWidth - 8)) * frameSpan;

  const draw = () => {
    const cv = canvasRef.current;
    if (!cv) return;
    const dpr = window.devicePixelRatio || 1;
    cv.width = size.w * dpr;
    cv.height = size.h * dpr;
    cv.style.width = `${size.w}px`;
    cv.style.height = `${size.h}px`;
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, size.w, size.h);

    // bg
    ctx.fillStyle = "#0a0a0a";
    ctx.fillRect(0, 0, size.w, size.h);

    // header
    ctx.fillStyle = "#18181b";
    ctx.fillRect(0, 0, size.w, topPad);
    ctx.fillStyle = "#52525b";
    ctx.font = "10px monospace";
    ctx.textBaseline = "middle";
    ctx.textAlign = "left";
    const tickStep = Math.max(1, Math.round(frameSpan / 10));
    for (let f = fStart; f <= fEnd; f += tickStep) {
      const x = xForFrame(f);
      ctx.fillText(`${f}`, x + 2, topPad / 2);
      ctx.fillStyle = "#27272a";
      ctx.fillRect(x, topPad, 1, size.h - topPad);
      ctx.fillStyle = "#52525b";
    }

    if (lanes.length === 0) {
      ctx.fillStyle = "#52525b";
      ctx.font = "11px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(
        "No keyframes. Click the ◇ icon next to a numeric property to keyframe it.",
        size.w / 2,
        size.h / 2
      );
      ctx.textAlign = "left";
      // still draw playhead
      drawPlayhead(ctx);
      return;
    }

    lanes.forEach((lane, idx) => {
      const y = topPad + idx * laneHeight + laneHeight / 2;
      if (idx % 2 === 0) {
        ctx.fillStyle = "#0f0f12";
        ctx.fillRect(0, topPad + idx * laneHeight, size.w, laneHeight);
      }
      // label
      ctx.fillStyle = "#a1a1aa";
      ctx.font = "10px monospace";
      ctx.textBaseline = "middle";
      ctx.textAlign = "left";
      ctx.fillText(lane.label, 4, y);
      // baseline
      ctx.strokeStyle = "#27272a";
      ctx.beginPath();
      ctx.moveTo(labelWidth, y);
      ctx.lineTo(size.w - 4, y);
      ctx.stroke();
      // curve preview
      ctx.strokeStyle = "#3f3f46";
      ctx.beginPath();
      lane.kfs.forEach((kf, i) => {
        const x = xForFrame(kf.frame);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();
      // diamonds
      lane.kfs.forEach((kf, i) => {
        const x = xForFrame(kf.frame);
        const selKey = `${lane.nodeId}:${lane.propName}:${i}`;
        const selected = selectedKeyframes.includes(selKey);
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(Math.PI / 4);
        ctx.fillStyle = selected ? "#22d3ee" : "#fbbf24";
        ctx.strokeStyle = selected ? "#06b6d4" : "#b45309";
        ctx.lineWidth = 1;
        ctx.fillRect(-4, -4, 8, 8);
        ctx.strokeRect(-4, -4, 8, 8);
        ctx.restore();
      });
    });

    drawPlayhead(ctx);
  };

  const drawPlayhead = (ctx) => {
    const px = xForFrame(currentFrame);
    ctx.strokeStyle = "#ef4444";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(px, 0);
    ctx.lineTo(px, size.h);
    ctx.stroke();
    ctx.fillStyle = "#ef4444";
    ctx.beginPath();
    ctx.moveTo(px - 4, 0);
    ctx.lineTo(px + 4, 0);
    ctx.lineTo(px, 6);
    ctx.closePath();
    ctx.fill();
  };

  useEffect(() => {
    draw();
  }, [size, currentFrame, frameRange, lanes, selectedKeyframes, isPlaying]);

  const onMouseDown = (e) => {
    const cv = canvasRef.current;
    if (!cv) return;
    const rect = cv.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    let hitLaneIdx = -1;
    let hitKfIdx = -1;
    lanes.forEach((lane, idx) => {
      const ly = topPad + idx * laneHeight + laneHeight / 2;
      if (Math.abs(y - ly) > 8) return;
      lane.kfs.forEach((kf, i) => {
        const kx = xForFrame(kf.frame);
        if (Math.abs(x - kx) < 6) {
          hitLaneIdx = idx;
          hitKfIdx = i;
        }
      });
    });
    if (hitLaneIdx >= 0) {
      const lane = lanes[hitLaneIdx];
      const selKey = `${lane.nodeId}:${lane.propName}:${hitKfIdx}`;
      if (e.shiftKey) {
        const sel = [...selectedKeyframes];
        const i = sel.indexOf(selKey);
        if (i >= 0) sel.splice(i, 1);
        else sel.push(selKey);
        useEditor.getState().setSelectedKeyframes(sel);
      } else if (!selectedKeyframes.includes(selKey)) {
        useEditor.getState().setSelectedKeyframes([selKey]);
      }
      dragRef.current = {
        type: "keyframe",
        laneKey: lane.key,
        kfIndex: hitKfIdx,
        startFrame: lane.kfs[hitKfIdx].frame,
        startX: x,
        shifted: e.shiftKey,
      };
    } else {
      const f = Math.round(frameForX(x));
      useEditor.getState().setCurrentFrame(Math.max(fStart, Math.min(fEnd, f)));
      dragRef.current = {
        type: "playhead",
        laneKey: "",
        kfIndex: -1,
        startFrame: f,
        startX: x,
        shifted: e.shiftKey,
      };
    }
  };

  const onMouseMove = (e) => {
    const cv = canvasRef.current;
    if (!cv) return;
    const rect = cv.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const d = dragRef.current;
    if (d.type === "playhead") {
      const f = Math.round(frameForX(x));
      useEditor.getState().setCurrentFrame(Math.max(fStart, Math.min(fEnd, f)));
    } else if (d.type === "keyframe") {
      const newFrame = Math.round(frameForX(x));
      const clamped = Math.max(fStart, Math.min(fEnd, newFrame));
      const lane = lanes.find((l) => l.key === d.laneKey);
      if (lane && lane.kfs[d.kfIndex] && lane.kfs[d.kfIndex].frame !== clamped) {
        useEditor.getState().moveKeyframe(lane.nodeId, lane.propName, d.kfIndex, clamped);
      }
    }
  };

  const onMouseUp = () => {
    if (dragRef.current.type === "keyframe") {
      useEditor.getState().pushHistory("Move keyframe");
    }
    dragRef.current.type = "none";
  };

  const onContextMenu = (e) => {
    e.preventDefault();
    const cv = canvasRef.current;
    if (!cv) return;
    const rect = cv.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    for (let idx = 0; idx < lanes.length; idx++) {
      const lane = lanes[idx];
      const ly = topPad + idx * laneHeight + laneHeight / 2;
      if (Math.abs(y - ly) > 8) continue;
      for (let i = 0; i < lane.kfs.length; i++) {
        const kx = xForFrame(lane.kfs[i].frame);
        if (Math.abs(x - kx) < 6) {
          useEditor.getState().pushHistory("Delete keyframe");
          useEditor.getState().removeKeyframe(lane.nodeId, lane.propName, i);
          return;
        }
      }
    }
  };

  return (
    <div className="h-full flex bg-zinc-950 border-t border-zinc-800">
      {/* Left: controls */}
      <div className="w-[200px] shrink-0 border-r border-zinc-800 p-2 flex flex-col gap-2">
        <div className="flex items-center gap-1">
          <Button
            size="icon"
            variant={isPlaying ? "default" : "outline"}
            className="h-7 w-7"
            onClick={() => useEditor.getState().setIsPlaying(!isPlaying)}
            title={isPlaying ? "Pause" : "Play"}
          >
            {isPlaying ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
          </Button>
          <Button
            size="icon"
            variant="outline"
            className="h-7 w-7"
            onClick={() => {
              useEditor.getState().setIsPlaying(false);
              useEditor.getState().setCurrentFrame(frameRange[0]);
            }}
            title="Stop"
          >
            <Square className="h-3.5 w-3.5" />
          </Button>
          <Button
            size="icon"
            variant="outline"
            className="h-7 w-7"
            onClick={() => useEditor.getState().setCurrentFrame(frameRange[0])}
            title="Loop indicator (always loops)"
          >
            <Repeat className="h-3.5 w-3.5" />
          </Button>
        </div>
        <div className="flex items-center gap-1 text-[10px] text-zinc-400">
          <span>Frame</span>
          <Input
            type="number"
            value={currentFrame}
            min={frameRange[0]}
            max={frameRange[1]}
            onChange={(e) =>
              useEditor.getState().setCurrentFrame(Number(e.target.value))
            }
            className="h-6 w-14 text-xs px-1.5"
          />
          <span className="text-zinc-500">/ {frameRange[1]}</span>
        </div>
        <div className="flex items-center gap-1 text-[10px] text-zinc-400">
          <span>FPS</span>
          <Input
            type="number"
            value={fps}
            min={1}
            max={120}
            onChange={(e) => useEditor.getState().setFps(Number(e.target.value))}
            className="h-6 w-14 text-xs px-1.5"
          />
        </div>
        <div className="flex items-center gap-1 text-[10px] text-zinc-400">
          <span>Range</span>
          <Input
            type="number"
            value={frameRange[0]}
            min={0}
            onChange={(e) =>
              useEditor.getState().setFrameRange([Number(e.target.value), frameRange[1]])
            }
            className="h-6 w-12 text-xs px-1.5"
          />
          <span>—</span>
          <Input
            type="number"
            value={frameRange[1]}
            min={frameRange[0] + 1}
            onChange={(e) =>
              useEditor.getState().setFrameRange([frameRange[0], Number(e.target.value)])
            }
            className="h-6 w-12 text-xs px-1.5"
          />
        </div>
      </div>
      {/* Middle: canvas */}
      <div ref={containerRef} className="flex-1 relative min-w-0">
        <canvas
          ref={canvasRef}
          className="absolute inset-0"
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          onMouseLeave={onMouseUp}
          onContextMenu={onContextMenu}
        />
      </div>
      {/* Right: summary */}
      <div className="w-[200px] shrink-0 border-l border-zinc-800 p-2 text-[10px] text-zinc-400">
        <div className="font-medium uppercase tracking-wider text-zinc-500 mb-1">
          {selectedNodeIds.length === 0
            ? "All keyframes"
            : `${selectedNodeIds.length} node(s) selected`}
        </div>
        <div className="text-zinc-500">{lanes.length} animated lane(s)</div>
        <div className="mt-2 text-zinc-600">
          Click a keyframe to select. Drag to move. Right-click to delete.
          Shift-click to multi-select.
        </div>
        <div className="mt-2 text-zinc-600">Current value preview:</div>
        {lanes.slice(0, 6).map((l) => {
          const v = sampleKeyframes(l.kfs, currentFrame);
          return (
            <div key={l.key} className="font-mono text-[10px] text-zinc-400">
              n{l.nodeId} {l.propName} = {v?.toFixed(2) ?? "—"}
            </div>
          );
        })}
      </div>
    </div>
  );
}
