"use client";

import { type ChangeEvent, type InputHTMLAttributes, useRef, useState, useSyncExternalStore } from "react";
import { ArrowLeftIcon, ArrowRightIcon, CheckIcon, CircleNotchIcon, FolderOpenIcon, SidebarSimpleIcon, WarningCircleIcon, XIcon } from "@phosphor-icons/react";

import { Button } from "@/components/ui/button";
import { Hint } from "@/components/ui/tooltip";
import { WindowControls } from "@/components/window-controls";

const directoryInputProps = {
  webkitdirectory: "",
  directory: "",
} as InputHTMLAttributes<HTMLInputElement>;

type Project = { name: string; path: string | null; url?: string | null; error?: string };
type RecentProject = { name: string; path: string };
type CodexAvailability = { state: "checking" | "available" | "unavailable"; message: string };

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

export function ProjectSelector({ codexAvailability, onOpen }: { codexAvailability: CodexAvailability; onOpen: (project: Project) => void }) {
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
      <header className="formia-titlebar flex h-10 shrink-0 items-center border-b border-border bg-white px-2">
        <div className="flex items-center gap-0.5">
          <Button type="button" variant="ghost" size="icon-sm" className="formia-no-drag rounded-[5px]" disabled aria-label="Show sidebars">
            <SidebarSimpleIcon className="size-4" />
          </Button>
          <Button type="button" variant="ghost" size="icon-sm" className="formia-no-drag rounded-[5px]" disabled aria-label="Back">
            <ArrowLeftIcon className="size-4" />
          </Button>
          <Button type="button" variant="ghost" size="icon-sm" className="formia-no-drag rounded-[5px]" disabled aria-label="Forward">
            <ArrowRightIcon className="size-4" />
          </Button>
        </div>
        <div className="mx-2 h-5 w-px bg-border" />
        <nav className="flex items-center gap-0.5 text-[13px]" aria-label="Application menu">
          <span className="rounded-[5px] px-2 py-1">File</span>
          <span className="rounded-[5px] px-2 py-1">Edit</span>
          <span className="rounded-[5px] px-2 py-1">View</span>
          <span className="rounded-[5px] px-2 py-1">Help</span>
        </nav>
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
      <div className="flex min-h-[calc(100vh-2.5rem)]">
        <aside className="hidden w-64 shrink-0 flex-col border-r border-border bg-sidebar p-3 md:flex">
          <div className="flex h-9 items-center px-2">
            <span className="text-sm font-semibold tracking-tight">Formia</span>
          </div>

          <Button
            type="button"
            variant="secondary"
            size="lg"
            className="mt-3 w-full justify-start"
            onClick={() => {
              if (window.formiaDesktop) void selectProject();
              else directoryInputRef.current?.click();
            }}
          >
            <FolderOpenIcon className="size-4 text-[#8f8f8f]" />
            Open project
          </Button>

          <section className="mt-8" aria-labelledby="recent-projects-heading">
            <p id="recent-projects-heading" className="px-2 text-xs font-medium text-muted-foreground">Recent projects</p>
            <div className="mt-2 space-y-0.5">
              {recentProjects.length > 0 ? recentProjects.map((project) => {
                const isOpening = openingPath === project.path;
                const error = recentError?.path === project.path ? recentError.message : null;
                return (
                  <div key={project.path} className="group">
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        className="flex min-h-9 min-w-0 flex-1 items-center gap-2 rounded-[10px] px-2.5 text-left text-sm font-normal outline-none transition-colors hover:bg-sidebar-accent focus-visible:ring-2 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50"
                        disabled={Boolean(openingPath)}
                        onClick={() => void openRecentProject(project)}
                      >
                        <FolderOpenIcon className="size-4 shrink-0 text-[#8f8f8f]" />
                        <span className="min-w-0 flex-1 truncate">{project.name}</span>
                        {isOpening ? <CircleNotchIcon className="size-4 shrink-0 animate-spin text-[#8f8f8f]" /> : <ArrowRightIcon className="size-4 shrink-0 text-[#8f8f8f] opacity-0 transition-opacity group-hover:opacity-100" />}
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
                    {error ? <Hint content={error}><p className="truncate px-2.5 pb-1 text-xs text-destructive">{error}</p></Hint> : null}
                  </div>
                );
              }) : (
                <p className="px-2.5 text-xs leading-5 text-muted-foreground">No recent projects</p>
              )}
            </div>
          </section>

          <div className="mt-auto border-t border-border px-2 pt-3">
            <p className="text-xs font-medium">Local workspace</p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">Inspect and edit projects on this device.</p>
          </div>
        </aside>

        <section className="flex min-w-0 flex-1 items-center justify-center px-6 py-12" aria-labelledby="open-project-heading">
          <div className="w-full max-w-xl">
            <div className="mb-10">
              <div className="mb-4 flex items-center gap-2 text-sm font-medium text-muted-foreground md:hidden">
                <span className="size-2 rounded-full bg-foreground" />
                Formia
              </div>
              <h1 id="open-project-heading" className="text-2xl font-normal tracking-tight">Open a project</h1>
              <p className="mt-2 text-sm text-muted-foreground">Choose a local React project to inspect and edit visually.</p>
              <Button className="mt-6" size="lg" onClick={() => {
                if (window.formiaDesktop) void selectProject();
                else directoryInputRef.current?.click();
              }}>
                <FolderOpenIcon />
                Select project
              </Button>
              <p className={`mt-4 flex items-center gap-1.5 text-xs ${codexAvailability.state === "unavailable" ? "text-destructive" : "text-muted-foreground"}`} role="status">
                {codexAvailability.state === "checking" ? <CircleNotchIcon className="size-3.5 animate-spin" /> : null}
                {codexAvailability.state === "available" ? <CheckIcon className="size-3.5 text-emerald-600" /> : null}
                {codexAvailability.state === "unavailable" ? <WarningCircleIcon className="size-3.5" /> : null}
                <span>{codexAvailability.message}</span>
              </p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
