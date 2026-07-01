"use client";

import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { TopBar } from "./TopBar";
import { Viewport } from "./Viewport";
import { NodeGraph } from "./NodeGraph";
import { PropertiesPanel } from "./PropertiesPanel";
import { Datasheet } from "./Datasheet";
import { LeftPanel } from "./LeftPanel";
import { Timeline } from "./Timeline";

export function EditorShell() {
  return (
    <div className="h-screen w-screen flex flex-col bg-zinc-950 text-zinc-100 overflow-hidden">
      <TopBar />
      <div className="flex-1 min-h-0">
        <ResizablePanelGroup direction="horizontal" className="h-full">
          {/* Left: Tabbed Panel (Models / Resources / Nodes) */}
          <ResizablePanel defaultSize={18} minSize={12} maxSize={30}>
            <LeftPanel />
          </ResizablePanel>
          <ResizableHandle />
          {/* Center: Viewport (top) + NodeGraph (bottom) */}
          <ResizablePanel defaultSize={55} minSize={30}>
            <ResizablePanelGroup direction="vertical" className="h-full">
              <ResizablePanel defaultSize={55} minSize={20}>
                <Viewport />
              </ResizablePanel>
              <ResizableHandle />
              <ResizablePanel defaultSize={45} minSize={20}>
                <NodeGraph />
              </ResizablePanel>
            </ResizablePanelGroup>
          </ResizablePanel>
          <ResizableHandle />
          {/* Right: Properties (top) + Datasheet (bottom) */}
          <ResizablePanel defaultSize={27} minSize={15} maxSize={40}>
            <ResizablePanelGroup direction="vertical" className="h-full">
              <ResizablePanel defaultSize={45} minSize={20}>
                <PropertiesPanel />
              </ResizablePanel>
              <ResizableHandle />
              <ResizablePanel defaultSize={55} minSize={20}>
                <Datasheet />
              </ResizablePanel>
            </ResizablePanelGroup>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
      {/* Bottom Timeline (fixed 180px) */}
      <div className="h-[180px] shrink-0">
        <Timeline />
      </div>
    </div>
  );
}
