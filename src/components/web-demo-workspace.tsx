"use client";

import { ProjectWorkspace } from "@/components/project-workspace";

const demoCodexAvailability = {
  state: "unavailable" as const,
  message: "Build is available in the Formia desktop app.",
};

export function WebDemoWorkspace({ onBack }: { onBack: () => void }) {
  return (
    <ProjectWorkspace
      runtime="web-demo"
      active
      projectName="Shadcn Admin"
      projectPath={null}
      projectUrl="/demos/shadcn-admin"
      codexAvailability={demoCodexAvailability}
      onBack={onBack}
    />
  );
}
