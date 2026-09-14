"use client";

import { ArrowRightIcon, DownloadSimpleIcon, FolderOpenIcon } from "@phosphor-icons/react";

import { Button } from "@/components/ui/button";
import { windowsInstallerUrl } from "@/lib/release";

export function WebDemoLauncher({ onStart }: { onStart: () => void }) {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <section className="flex min-h-screen items-center justify-center px-6 py-12" aria-labelledby="demo-heading">
        <div className="w-full max-w-xl">
          <div className="flex items-center justify-between gap-4">
            <h1 id="demo-heading" className="text-xl font-medium tracking-tight">Browser demo</h1>
            <Button asChild size="sm">
              <a href={windowsInstallerUrl}>
                <DownloadSimpleIcon />
                Download Formia
              </a>
            </Button>
          </div>

          <div className="mt-4 overflow-hidden rounded-xl border border-border">
            <button
              type="button"
              className="group flex min-h-12 w-full items-center gap-3 px-4 text-left text-sm outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/50"
              onClick={onStart}
            >
              <FolderOpenIcon className="size-4 shrink-0 text-muted-foreground" />
              <span className="min-w-0 flex-1 truncate">Shadcn Admin</span>
              <ArrowRightIcon className="size-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
            </button>
          </div>

          <p className="mt-4 text-sm leading-6 text-muted-foreground">
            Try the visual editing workflow on this sample project. Changes in the browser are temporary; download Formia to open and edit your own local project.
          </p>
        </div>
      </section>
    </main>
  );
}
