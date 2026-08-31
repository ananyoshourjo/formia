"use client";

import { type ChangeEvent, type InputHTMLAttributes, useRef, useState, useSyncExternalStore } from "react";
import { ArrowRight, Clock3, FolderOpen, LoaderCircle, X } from "lucide-react";

import { Button } from "@/components/ui/button";

const directoryInputProps = {
  webkitdirectory: "",
  directory: "",
} as InputHTMLAttributes<HTMLInputElement>;

type Project = { name: string; path: string | null; url?: string | null; error?: string };
type RecentProject = { name: string; path: string };

const recentProjectsKey = "formia:recent-projects";
const recentProjectsEvent = "formia:recent-projects-changed";
const emptyRecentProjects: RecentProject[] = [];
let recentProjectsStorageValue = "";
let recentProjectsSnapshot = emptyRecentProjects;

function readRecentProjects(): RecentProject[] {
  if (typeof window === "undefined") return emptyRecentProjects;

  const storageValue = window.localStorage.getItem(recentProjectsKey) || "[]";
  if (storageValue === recentProjectsStorageValue) return recentProjectsSnapshot;

  try {
    const value: unknown = JSON.parse(storageValue);
    if (!Array.isArray(value)) {
      recentProjectsStorageValue = storageValue;
      recentProjectsSnapshot = emptyRecentProjects;
      return recentProjectsSnapshot;
    }
    recentProjectsStorageValue = storageValue;
    recentProjectsSnapshot = value.filter((project): project is RecentProject => (
      typeof project === "object" && project !== null &&
      typeof project.name === "string" && typeof project.path === "string" && project.path.length > 0
    )).slice(0, 5);
    return recentProjectsSnapshot;
  } catch {
    recentProjectsStorageValue = storageValue;
    recentProjectsSnapshot = emptyRecentProjects;
    return recentProjectsSnapshot;
  }
}

function subscribeToRecentProjects(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener(recentProjectsEvent, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(recentProjectsEvent, callback);
  };
}

function saveRecentProject(project: Project) {
  if (typeof window === "undefined" || !project.path) return;

  const nextProjects = [
    { name: project.name, path: project.path },
    ...readRecentProjects().filter((recent) => recent.path.toLowerCase() !== project.path?.toLowerCase()),
  ].slice(0, 5);
  window.localStorage.setItem(recentProjectsKey, JSON.stringify(nextProjects));
  window.dispatchEvent(new Event(recentProjectsEvent));
}

function removeRecentProject(projectPath: string) {
  const nextProjects = readRecentProjects().filter((project) => project.path.toLowerCase() !== projectPath.toLowerCase());
  window.localStorage.setItem(recentProjectsKey, JSON.stringify(nextProjects));
  window.dispatchEvent(new Event(recentProjectsEvent));
}

export function ProjectSelector({ onOpen }: { onOpen: (project: Project) => void }) {
  const directoryInputRef = useRef<HTMLInputElement>(null);
  const recentProjects = useSyncExternalStore(subscribeToRecentProjects, readRecentProjects, () => emptyRecentProjects);
  const [openingPath, setOpeningPath] = useState<string | null>(null);
  const [recentError, setRecentError] = useState<{ path: string; message: string } | null>(null);

  function openProject(event: ChangeEvent<HTMLInputElement>) {
    const firstFile = event.target.files?.[0];
    if (!firstFile) return;

    const projectName = firstFile.webkitRelativePath.split("/")[0] || "Untitled project";
    onOpen({ name: projectName, path: null });
  }

  async function selectProject() {
    const project = await window.formiaDesktop?.selectProject();
    if (project) {
      saveRecentProject(project);
      onOpen(project);
    }
  }

  async function openRecentProject(project: RecentProject) {
    if (!window.formiaDesktop) return;

    setOpeningPath(project.path);
    setRecentError(null);
    try {
      const openedProject = await window.formiaDesktop.openProject(project.path);
      saveRecentProject(openedProject);
      onOpen(openedProject);
    } catch (error) {
      setRecentError({
        path: project.path,
        message: error instanceof Error ? error.message : "This project could not be opened.",
      });
    } finally {
      setOpeningPath(null);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-12">
      <input
        ref={directoryInputRef}
        type="file"
        multiple
        className="sr-only"
        onChange={openProject}
        {...directoryInputProps}
      />
      <div className="w-full max-w-xl">
        <div className="mb-10">
          <p className="mb-3 text-sm font-medium text-muted-foreground">Formia</p>
          <h1 className="text-3xl font-semibold tracking-tight">Open a project</h1>
          <p className="mt-2 text-sm text-muted-foreground">Choose a local React project to inspect and edit visually.</p>
          <Button className="mt-6" size="lg" onClick={() => {
            if (window.formiaDesktop) void selectProject();
            else directoryInputRef.current?.click();
          }}>
            <FolderOpen />
            Select project
          </Button>
        </div>

        {recentProjects.length > 0 ? (
          <section aria-labelledby="recent-projects-heading">
            <div className="mb-3 flex items-center gap-2 text-sm font-medium" id="recent-projects-heading">
              <Clock3 className="size-4 text-muted-foreground" />
              Recent projects
            </div>
            <div className="overflow-hidden rounded-xl border border-border bg-card">
              {recentProjects.map((project, index) => {
                const isOpening = openingPath === project.path;
                const error = recentError?.path === project.path ? recentError.message : null;
                return (
                  <div key={project.path} className={index === 0 ? "" : "border-t border-border"}>
                    <div className="flex items-center gap-3 px-4 py-3">
                      <button
                        type="button"
                        className="flex min-w-0 flex-1 items-center gap-3 rounded-lg text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                        disabled={Boolean(openingPath)}
                        onClick={() => void openRecentProject(project)}
                      >
                        <FolderOpen className="size-4 shrink-0 text-muted-foreground" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium">{project.name}</span>
                          <span className="block truncate text-xs text-muted-foreground">{project.path}</span>
                          {error ? <span className="mt-1 block text-xs text-destructive">{error}</span> : null}
                        </span>
                        {isOpening ? <LoaderCircle className="size-4 shrink-0 animate-spin text-muted-foreground" /> : <ArrowRight className="size-4 shrink-0 text-muted-foreground" />}
                      </button>
                      <Button
                        aria-label={`Remove ${project.name} from recent projects`}
                        variant="ghost"
                        size="icon-xs"
                        onClick={() => removeRecentProject(project.path)}
                      >
                        <X />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        ) : null}
      </div>
    </main>
  );
}
