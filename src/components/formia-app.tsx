"use client";

import { useEffect, useState, type CSSProperties } from "react";

import { ProjectSelector } from "@/components/project-selector";
import { ProjectWorkspace } from "@/components/project-workspace";
import { toolCursor } from "@/lib/tool-cursors";

type CodexAvailability = {
  state: "checking" | "available" | "unavailable";
  message: string;
};

export function FormiaApp() {
  const [project, setProject] = useState<{ name: string; path: string | null; url?: string | null; error?: string } | null>(null);
  const [codexAvailability, setCodexAvailability] = useState<CodexAvailability>({ state: "checking", message: "Checking for Codex" });

  useEffect(() => {
    document.documentElement.style.setProperty("--formia-cursor", toolCursor("interact"));
    return () => {
      document.documentElement.style.removeProperty("--formia-cursor");
    };
  }, []);

  useEffect(() => {
    const desktop = window.formiaDesktop;
    if (!desktop) {
      void Promise.resolve().then(() => {
        setCodexAvailability({ state: "unavailable", message: "Open Formia in the desktop app to connect to Codex." });
      });
      return;
    }

    let subscribed = true;
    const applyStatus = (status: CodexAvailability) => {
      if (subscribed) setCodexAvailability(status);
    };
    const unsubscribe = desktop.onCodexAvailability(applyStatus);
    void desktop.getCodexAvailability().then(applyStatus).catch(() => {
      applyStatus({ state: "unavailable", message: "Formia could not check whether Codex is available." });
    });

    return () => {
      subscribed = false;
      unsubscribe();
    };
  }, []);

  return (
    <div style={{ "--formia-cursor": toolCursor("interact") } as CSSProperties}>
      {project ? null : <ProjectSelector onOpen={setProject} />}
      <ProjectWorkspace
        active={Boolean(project)}
        projectName={project?.name || "Project"}
        projectPath={project?.path || null}
        codexAvailability={codexAvailability}
        onBack={() => setProject(null)}
      />
    </div>
  );
}
