"use client";

import { type ChangeEvent, type InputHTMLAttributes, useRef, useState, useSyncExternalStore } from "react";
import { ArrowRightIcon, CircleNotchIcon, FolderOpenIcon, XIcon } from "@phosphor-icons/react";

import { Button } from "@/components/ui/button";
import { WindowControls } from "@/components/window-controls";

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
    <main className="min-h-screen bg-background text-foreground">
      <header className="formia-titlebar flex h-10 shrink-0 border-b border-border bg-white">
        <WindowControls />
      </header>
      <input
        ref={directoryInputRef}
        type="file"
        multiple
        className="sr-only"
        onChange={openProject}
        {...directoryInputProps}
      />
      <section className="flex min-h-[calc(100vh-2.5rem)] items-center justify-center px-6 py-12" aria-labelledby="recent-projects-heading">
        <div className="w-full max-w-xl">
          <div className="flex items-center justify-between gap-4">
            <h1 id="recent-projects-heading" className="text-xl font-medium tracking-tight">Recent projects</h1>
            <Button
              type="button"
              size="sm"
              onClick={() => {
                if (window.formiaDesktop) void selectProject();
                else directoryInputRef.current?.click();
              }}
            >
              <FolderOpenIcon />
              Open project
            </Button>
          </div>

          {recentProjects.length > 0 ? (
            <div className="mt-4 overflow-hidden rounded-xl border border-border">
              {recentProjects.map((project, index) => {
                const isOpening = openingPath === project.path;
                const error = recentError?.path === project.path ? recentError.message : null;
                return (
                  <div key={project.path} className={index > 0 ? "border-t border-border" : undefined}>
                    <div className="group flex items-center gap-1 px-2">
                      <button
                        type="button"
                        className="flex min-h-12 min-w-0 flex-1 items-center gap-3 rounded-lg px-2 text-left text-sm outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50"
                        disabled={Boolean(openingPath)}
                        onClick={() => void openRecentProject(project)}
                      >
                        <FolderOpenIcon className="size-4 shrink-0 text-muted-foreground" />
                        <span className="min-w-0 flex-1 truncate">{project.name}</span>
                        {isOpening ? <CircleNotchIcon className="size-4 shrink-0 animate-spin text-muted-foreground" /> : <ArrowRightIcon className="size-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />}
                      </button>
                      <Button
                        aria-label={`Remove ${project.name} from recent projects`}
                        variant="ghost"
                        size="icon-xs"
                        className="opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
                        onClick={() => removeRecentProject(project.path)}
                      >
                        <XIcon />
                      </Button>
                    </div>
                    {error ? <p className="truncate px-4 pb-2 text-xs text-destructive">{error}</p> : null}
                  </div>
                );
              })}
            </div>
          ) : null}
        </div>
      </section>
    </main>
  );
}
