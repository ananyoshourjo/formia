"use client";

import { ProjectWorkspace, type ProjectWorkspaceProps } from "@/components/project-workspace";

export type DesktopWorkspaceProps = Omit<ProjectWorkspaceProps, "runtime">;

export function DesktopWorkspace(props: DesktopWorkspaceProps) {
  return <ProjectWorkspace {...props} runtime="desktop" />;
}
