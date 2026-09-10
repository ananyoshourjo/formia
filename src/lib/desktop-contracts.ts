export type Project = {
  name: string;
  path: string | null;
  url?: string | null;
  error?: string;
};

export type RecentProject = {
  name: string;
  path: string;
};

export type CodexAvailability = {
  state: "checking" | "available" | "unavailable";
  message: string;
};

export type CodexStatus = {
  jobId?: string;
  state: "idle" | "working" | "applied" | "failed";
  message: string;
};

export type ProjectServerStatus = {
  state: "starting" | "ready" | "failed" | "stopped";
  url?: string;
  message: string;
};

export type CodexBuildRequest = {
  projectPath: string;
  projectName: string;
  canvasUrl: string | null;
  selection: unknown;
  previewChanges: unknown[];
};

export type CodexBuildResult = {
  jobId: string;
};

export function desktopErrorMessage(error: unknown, fallback: string) {
  if (!(error instanceof Error) || !error.message.trim()) return fallback;
  return error.message
    .replace(/^Error invoking remote method '[^']+':\s*/i, "")
    .replace(/^Error:\s*/i, "")
    .trim() || fallback;
}
