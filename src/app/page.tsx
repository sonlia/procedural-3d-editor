"use client";

import dynamic from "next/dynamic";

// The editor uses browser-only APIs (Three.js, LiteGraph), so we load it
// dynamically with SSR disabled to avoid hydration issues.
const EditorShell = dynamic(
  () => import("@/components/editor/EditorShell").then((m) => m.EditorShell),
  {
    ssr: false,
    loading: () => (
      <div className="h-screen w-screen flex items-center justify-center bg-zinc-950 text-zinc-400 text-sm">
        Loading editor...
      </div>
    ),
  }
);

export default function Home() {
  return <EditorShell />;
}
