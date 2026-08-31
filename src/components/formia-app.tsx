"use client";

import { useState } from "react";

import { ProjectSelector } from "@/components/project-selector";
import { ProjectWorkspace } from "@/components/project-workspace";

export function FormiaApp() {
  const [project, setProject] = useState<{ name: string; path: string | null; url?: string | null; error?: string } | null>(null);

  return (
    <>
      {project ? null : <ProjectSelector onOpen={setProject} />}
      <ProjectWorkspace
        active={Boolean(project)}
        projectName={project?.name || "Project"}
        projectPath={project?.path || null}
        onBack={() => setProject(null)}
      />
    </>
  );
}
