"use client";

import { useState, useSyncExternalStore } from "react";
import { ArrowRightIcon, CircleNotchIcon, DownloadSimpleIcon, FolderOpenIcon, WarningCircleIcon, XIcon } from "@phosphor-icons/react";

import { Button } from "@/components/ui/button";
import { WindowControls } from "@/components/window-controls";
import { desktopErrorMessage, type CodexAvailability, type Project, type RecentProject } from "@/lib/desktop-contracts";
import { windowsInstallerUrl } from "@/lib/release";

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
  const recentProjects = useSyncExternalStore(subscribeToRecentProjects, readRecentProjects, () => emptyRecentProjects);
  const isDesktop = useSyncExternalStore(() => () => undefined, () => Boolean(window.formiaDesktop), () => false);
  const [openingPath, setOpeningPath] = useState<string | null>(null);
  const [recentError, setRecentError] = useState<{ path: string; message: string } | null>(null);
  const [openError, setOpenError] = useState<string | null>(null);

  async function selectProject() {
    if (!window.formiaDesktop) {
      setOpenError("Install the Formia desktop app to open and edit local projects.");
      return;
    }

    setOpenError(null);
    try {
      const project = await window.formiaDesktop.selectProject();
      if (project) {
        saveRecentProject(project);
        onOpen(project);
      }
    } catch (error) {
      setOpenError(desktopErrorMessage(error, "This project could not be opened."));
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
        message: desktopErrorMessage(error, "This project could not be opened."),
      });
    } finally {
      setOpeningPath(null);
    }
  }

  function openBuiltInDemo() {
    onOpen({ name: "Shadcn Admin", path: null, url: "/demos/shadcn-admin" });
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      {isDesktop ? (
        <header className="formia-titlebar flex h-10 shrink-0 border-b border-border bg-white">
          <WindowControls />
        </header>
      ) : null}
      <section className={`flex ${isDesktop ? "min-h-[calc(100vh-2.5rem)]" : "min-h-screen"} items-center justify-center px-6 py-12`} aria-labelledby="recent-projects-heading">
        <div className="w-full max-w-xl">
          <div className="flex items-center justify-between gap-4">
            <h1 id="recent-projects-heading" className="text-xl font-medium tracking-tight">Recent projects</h1>
            {isDesktop ? (
              <Button type="button" size="sm" onClick={() => void selectProject()}>
                <FolderOpenIcon />
                Open project
              </Button>
            ) : (
              <Button asChild size="sm">
                <a href={windowsInstallerUrl}>
                  <DownloadSimpleIcon />
                  Download Formia to Open Local Project
                </a>
              </Button>
            )}
          </div>

          {openError ? (
            <p className="mt-4 flex items-start gap-2 rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2.5 text-sm text-destructive" role="alert">
              <WarningCircleIcon className="mt-0.5 size-4 shrink-0" />
              <span>{openError}</span>
            </p>
          ) : null}

          {isDesktop && codexAvailability.state === "unavailable" ? (
            <div className="mt-4 rounded-lg border border-border bg-muted/30 px-3 py-2.5">
              <p className="flex items-center gap-2 text-sm font-medium">
                <WarningCircleIcon className="size-4 shrink-0 text-muted-foreground" />
                Build setup needed
              </p>
              <p className="mt-1 pl-6 text-xs leading-5 text-muted-foreground">{codexAvailability.message}</p>
            </div>
          ) : null}

          {!isDesktop ? (
            <div className="mt-4 overflow-hidden rounded-xl border border-border">
              <button
                type="button"
                className="flex min-h-12 w-full items-center gap-3 px-4 text-left text-sm outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/50"
                onClick={openBuiltInDemo}
              >
                <FolderOpenIcon className="size-4 shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1 truncate">Shadcn Admin</span>
              </button>
            </div>
          ) : recentProjects.length > 0 ? (
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
          ) : (
            <div className="mt-4 rounded-xl border border-dashed border-border px-4 py-5">
              <p className="text-sm text-muted-foreground">No recent project to show</p>
              <p className="text-sm font-medium">Visually edit your React site</p>
              <p className="mt-1 max-w-md text-sm leading-6 text-muted-foreground">Open a local Next.js or Vite project, make focused changes on the real running page, then use Build to turn them into code.</p>
              <p className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                {codexAvailability.state === "checking" ? <CircleNotchIcon className="size-3.5 animate-spin" /> : <span className={`size-2 rounded-full ${codexAvailability.state === "available" ? "bg-emerald-500" : "bg-muted-foreground/40"}`} />}
                {codexAvailability.state === "available" ? "Ready to build with Codex" : codexAvailability.state === "checking" ? "Checking Build availability" : "Visual editing is available; Build needs Codex"}
              </p>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
