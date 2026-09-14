"use client";

import { useEffect, useState, type CSSProperties } from "react";

import { WebDemoLauncher } from "@/components/web-demo-launcher";
import { WebDemoWorkspace } from "@/components/web-demo-workspace";
import { toolCursor } from "@/lib/tool-cursors";

export function WebDemoApp() {
  const [demoOpen, setDemoOpen] = useState(false);

  useEffect(() => {
    document.documentElement.style.setProperty("--formia-cursor", toolCursor("interact"));
    return () => {
      document.documentElement.style.removeProperty("--formia-cursor");
    };
  }, []);

  return (
    <div style={{ "--formia-cursor": toolCursor("interact") } as CSSProperties}>
      {demoOpen ? <WebDemoWorkspace onBack={() => setDemoOpen(false)} /> : <WebDemoLauncher onStart={() => setDemoOpen(true)} />}
    </div>
  );
}
