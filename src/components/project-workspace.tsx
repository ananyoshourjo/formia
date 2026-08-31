"use client";

import { type PointerEvent as ReactPointerEvent, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { ArrowLeft, Check, CircleAlert, Crosshair, ExternalLink, Hand, Hammer, LoaderCircle, Maximize2, Minus, Plus, RotateCcw } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type SelectedElement = {
  selectionId: string | null;
  tagName: string;
  id: string | null;
  className: string;
  text: string;
  textEditable: boolean;
  attributes: Record<string, string>;
  dimensions: Record<string, number>;
  styles: Record<string, string>;
  react: { name: string; props: unknown; source: string | null } | null;
  previewChanges: PreviewChange[];
};

type PreviewChange = {
  selectionId: string | null;
  tagName: string;
  source: string | null;
  text: string;
  changes: Array<{
    kind: "style" | "class" | "text";
    property?: string;
    from: string;
    to: string;
  }>;
};

type CodexStatus = {
  state: "idle" | "working" | "applied" | "failed";
  message: string;
};

type ProjectServerStatus = {
  state: "starting" | "ready" | "failed" | "stopped";
  url?: string;
  message: string;
};

type CanvasWheelInput = {
  deltaX: number;
  deltaY: number;
  deltaMode: number;
  ctrlKey: boolean;
  shiftKey: boolean;
  clientX?: number;
  clientY?: number;
};

const subscribeToRuntime = () => () => undefined;
const getDesktopSnapshot = () => Boolean(window.formiaDesktop?.isDesktop);
const getDesktopServerSnapshot = () => false;
const artboardSize = { width: 1440, height: 900 };
const minZoom = 0.1;
const maxZoom = 4;

function clampZoom(value: number) {
  return Math.min(maxZoom, Math.max(minZoom, value));
}

function PropertyGroup({ title, values }: { title: string; values: Record<string, unknown> }) {
  const entries = Object.entries(values);
  if (entries.length === 0) return null;

  return (
    <section className="border-b px-5 py-4 last:border-b-0">
      <h3 className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">{title}</h3>
      <dl className="space-y-2.5">
        {entries.map(([name, value]) => (
          <div key={name} className="grid grid-cols-[6rem_minmax(0,1fr)] gap-3 text-xs">
            <dt className="truncate text-muted-foreground" title={name}>{name}</dt>
            <dd className="min-w-0 whitespace-pre-wrap break-words font-mono">
              {typeof value === "string" || typeof value === "number" ? String(value) : JSON.stringify(value, null, 2)}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function EditableProperty({
  name,
  value,
  onCommit,
  onReset,
}: {
  name: string;
  value: string;
  onCommit: (value: string) => void;
  onReset: () => void;
}) {
  return (
    <div className="grid grid-cols-[5.5rem_minmax(0,1fr)_1.5rem] items-center gap-2 text-xs">
      <label className="truncate text-muted-foreground" title={name}>{name}</label>
      <Input
        value={value}
        aria-label={`Edit ${name}`}
        className="h-7 min-w-0 font-mono text-xs"
        onChange={(event) => onCommit(event.currentTarget.value)}
      />
      <Button type="button" variant="ghost" size="icon-xs" onClick={onReset} aria-label={`Reset ${name}`} title={`Reset ${name}`}>
        <RotateCcw />
      </Button>
    </div>
  );
}

function EditablePropertyGroup({
  title,
  values,
  onCommit,
  onReset,
}: {
  title: string;
  values: Record<string, string>;
  onCommit: (name: string, value: string) => void;
  onReset: (name: string) => void;
}) {
  const entries = Object.entries(values);
  if (entries.length === 0) return null;

  return (
    <section className="border-b px-5 py-4">
      <h3 className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">{title}</h3>
      <div className="space-y-2.5">
        {entries.map(([name, value]) => (
          <EditableProperty key={name} name={name} value={value} onCommit={(nextValue) => onCommit(name, nextValue)} onReset={() => onReset(name)} />
        ))}
      </div>
    </section>
  );
}

function PropertiesSidebar({
  selection,
  onApplyStyle,
  onResetStyle,
  onApplyClassName,
  onResetClassName,
  onApplyText,
  onResetText,
  onResetAll,
}: {
  selection: SelectedElement | null;
  onApplyStyle: (property: string, value: string) => void;
  onResetStyle: (property: string) => void;
  onApplyClassName: (value: string) => void;
  onResetClassName: () => void;
  onApplyText: (value: string) => void;
  onResetText: () => void;
  onResetAll: () => void;
}) {
  return (
    <aside className="flex h-screen w-80 shrink-0 flex-col border-l bg-background">
      <header className="shrink-0 border-b px-5 py-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-medium">Properties</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              {selection ? "Preview-only runtime values" : "Select an element in the canvas"}
            </p>
          </div>
          <Button type="button" variant="ghost" size="xs" onClick={onResetAll} disabled={!selection}>
            Reset preview
          </Button>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {selection ? (
          <>
            <section className="border-b px-5 py-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary" className="font-mono font-normal">{selection.tagName}</Badge>
                {selection.react?.name ? <span className="text-sm font-medium">{selection.react.name}</span> : null}
              </div>
              {selection.react?.source ? <p className="mt-2 break-all font-mono text-xs text-muted-foreground">{selection.react.source}</p> : null}
              {selection.text ? <p className="mt-3 line-clamp-3 text-xs leading-5 text-muted-foreground">{selection.text}</p> : null}
            </section>
            <PropertyGroup title="Identity" values={{ id: selection.id || "—" }} />
            <EditablePropertyGroup
              title="Class name"
              values={{ class: selection.className }}
              onCommit={(_name, value) => onApplyClassName(value)}
              onReset={onResetClassName}
            />
            {selection.react && typeof selection.react.props === "object" && selection.react.props !== null ? (
              <PropertyGroup title="React props" values={selection.react.props as Record<string, unknown>} />
            ) : null}
            <PropertyGroup title="Dimensions" values={selection.dimensions} />
            {selection.textEditable ? (
              <EditablePropertyGroup
                title="Text content"
                values={{ text: selection.text }}
                onCommit={(_name, value) => onApplyText(value)}
                onReset={onResetText}
              />
            ) : null}
            <EditablePropertyGroup
              title="Computed styles"
              values={selection.styles}
              onCommit={onApplyStyle}
              onReset={onResetStyle}
            />
            <PropertyGroup title="Attributes" values={selection.attributes} />
          </>
        ) : (
          <div className="flex h-full min-h-64 flex-col items-center justify-center px-8 text-center">
            <Crosshair className="mb-3 size-6 text-muted-foreground" strokeWidth={1.5} />
            <p className="text-xs leading-5 text-muted-foreground">
              Turn on Inspect, then click any visible element in the application.
            </p>
          </div>
        )}
      </div>
    </aside>
  );
}

export function ProjectWorkspace({
  active,
  projectName,
  projectPath,
  onBack,
}: {
  active: boolean;
  projectName: string;
  projectPath: string | null;
  onBack: () => void;
}) {
  const isDesktop = useSyncExternalStore(subscribeToRuntime, getDesktopSnapshot, getDesktopServerSnapshot);
  const [urlInput, setUrlInput] = useState("");
  const [canvasUrl, setCanvasUrl] = useState<string | null>(null);
  const [canvasKey, setCanvasKey] = useState(0);
  const [inspectMode, setInspectMode] = useState(false);
  const [selection, setSelection] = useState<SelectedElement | null>(null);
  const [codexStatus, setCodexStatus] = useState<CodexStatus>({ state: "idle", message: "" });
  const [projectServerStatus, setProjectServerStatus] = useState<ProjectServerStatus>({ state: "stopped", message: "" });
  const [zoom, setZoom] = useState(0.75);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [panMode, setPanMode] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  const canvasViewportRef = useRef<HTMLDivElement>(null);
  const panStartRef = useRef<{ pointerX: number; pointerY: number; panX: number; panY: number } | null>(null);
  const webviewRef = useRef<FormiaWebviewElement>(null);
  const zoomRef = useRef(0.75);
  const panRef = useRef({ x: 0, y: 0 });
  const zoomTargetRef = useRef(0.75);
  const panTargetRef = useRef({ x: 0, y: 0 });
  const viewportAnimationRef = useRef<number | null>(null);

  useEffect(() => () => {
    if (viewportAnimationRef.current !== null) cancelAnimationFrame(viewportAnimationRef.current);
  }, []);

  useEffect(() => {
    const webview = webviewRef.current;
    if (!webview) return;

    const syncInspectMode = () => webview.send("formia:set-inspect-mode", false);
    const receiveSelection = (event: Event) => {
      const message = event as FormiaWebviewEvent;
      if (message.channel === "formia:canvas-wheel") {
        handleWebviewWheel(message.args[0] as CanvasWheelInput);
        return;
      }
      if (message.channel === "formia:element-selected" || message.channel === "formia:element-updated") {
        setSelection(message.args[0] as SelectedElement);
      }
    };

    webview.addEventListener("did-finish-load", syncInspectMode);
    webview.addEventListener("ipc-message", receiveSelection);

    return () => {
      webview.removeEventListener("did-finish-load", syncInspectMode);
      webview.removeEventListener("ipc-message", receiveSelection);
    };
  }, [active, canvasKey, canvasUrl, isDesktop]);

  useEffect(() => {
    const unsubscribe = window.formiaDesktop?.onCodexStatus((status) => {
      setCodexStatus({ state: status.state, message: status.message });
      if (status.state === "applied") {
        sendCanvasMessage("formia:reset-overrides");
        setSelection(null);
        setCanvasKey((key) => key + 1);
      }
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    const unsubscribe = window.formiaDesktop?.onProjectServerStatus((status) => {
      setProjectServerStatus(status);
      if (status.state === "starting") {
        setUrlInput("");
        setCanvasUrl(null);
        setSelection(null);
      }
      if (status.url) {
        setUrlInput(status.url);
        setCanvasUrl(status.url);
        setCanvasKey((key) => key + 1);
        setSelection(null);
      }
      if (status.state === "failed") setCanvasUrl(null);
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    webviewRef.current?.send("formia:set-inspect-mode", inspectMode);
  }, [inspectMode]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.code === "Space" && !event.repeat && !(event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement)) {
        event.preventDefault();
        setPanMode(true);
      }
    }

    function handleKeyUp(event: KeyboardEvent) {
      if (event.code === "Space") setPanMode(false);
    }

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, []);

  function fitCanvas() {
    const viewport = canvasViewportRef.current;
    if (!viewport) return;

    const padding = 64;
    const nextZoom = clampZoom(Math.min(
      (viewport.clientWidth - padding) / artboardSize.width,
      (viewport.clientHeight - padding) / artboardSize.height,
    ));
    animateViewport(nextZoom, { x: 0, y: 0 });
  }

  function commitViewport(nextZoom: number, nextPan: { x: number; y: number }) {
    zoomRef.current = nextZoom;
    panRef.current = nextPan;
    setZoom(nextZoom);
    setPan(nextPan);
  }

  function cancelViewportAnimation() {
    if (viewportAnimationRef.current !== null) cancelAnimationFrame(viewportAnimationRef.current);
    viewportAnimationRef.current = null;
    zoomTargetRef.current = zoomRef.current;
    panTargetRef.current = panRef.current;
  }

  function animateViewport(nextZoom: number, nextPan: { x: number; y: number }) {
    zoomTargetRef.current = nextZoom;
    panTargetRef.current = nextPan;
    if (viewportAnimationRef.current !== null) return;

    const tick = () => {
      const targetZoom = zoomTargetRef.current;
      const targetPan = panTargetRef.current;
      const currentZoom = zoomRef.current;
      const currentPan = panRef.current;
      const nextRenderedZoom = currentZoom + (targetZoom - currentZoom) * 0.28;
      const nextRenderedPan = {
        x: currentPan.x + (targetPan.x - currentPan.x) * 0.28,
        y: currentPan.y + (targetPan.y - currentPan.y) * 0.28,
      };
      const settled = Math.abs(targetZoom - nextRenderedZoom) < 0.0005 &&
        Math.abs(targetPan.x - nextRenderedPan.x) < 0.05 &&
        Math.abs(targetPan.y - nextRenderedPan.y) < 0.05;

      if (settled) {
        commitViewport(targetZoom, targetPan);
        viewportAnimationRef.current = null;
        return;
      }

      commitViewport(nextRenderedZoom, nextRenderedPan);
      viewportAnimationRef.current = requestAnimationFrame(tick);
    };

    viewportAnimationRef.current = requestAnimationFrame(tick);
  }

  function zoomCanvas(amount: number) {
    animateViewport(clampZoom(zoomTargetRef.current + amount), panTargetRef.current);
  }

  function handleCanvasWheelInput(input: CanvasWheelInput) {
    const isMouseWheel = input.deltaMode !== 0 || Math.max(Math.abs(input.deltaX), Math.abs(input.deltaY)) >= 40;
    const isPinch = input.ctrlKey;

    if (input.shiftKey || (!isPinch && !isMouseWheel)) {
      const nextPan = {
        x: panTargetRef.current.x - input.deltaX,
        y: panTargetRef.current.y - input.deltaY,
      };
      panTargetRef.current = nextPan;
      commitViewport(zoomRef.current, nextPan);
      return;
    }

    const viewport = canvasViewportRef.current;
    if (!viewport) return;
    const bounds = viewport.getBoundingClientRect();
    const clientX = input.clientX ?? bounds.left + bounds.width / 2;
    const clientY = input.clientY ?? bounds.top + bounds.height / 2;
    const pointerX = clientX - bounds.left - bounds.width / 2;
    const pointerY = clientY - bounds.top - bounds.height / 2;
    const currentZoom = zoomTargetRef.current;
    const currentPan = panTargetRef.current;
    const worldX = (pointerX - currentPan.x) / currentZoom;
    const worldY = (pointerY - currentPan.y) / currentZoom;
    const normalizedDelta = Math.max(-160, Math.min(160, input.deltaY * (input.deltaMode === 1 ? 16 : input.deltaMode === 2 ? bounds.height : 1)));
    const nextZoom = clampZoom(currentZoom * Math.exp(-normalizedDelta * 0.0015));

    animateViewport(nextZoom, { x: pointerX - worldX * nextZoom, y: pointerY - worldY * nextZoom });
  }

  function handleCanvasWheel(event: React.WheelEvent<HTMLDivElement>) {
    event.preventDefault();
    handleCanvasWheelInput({
      deltaX: event.deltaX,
      deltaY: event.deltaY,
      deltaMode: event.deltaMode,
      ctrlKey: event.ctrlKey,
      shiftKey: event.shiftKey,
      clientX: event.clientX,
      clientY: event.clientY,
    });
  }

  function handleWebviewWheel(input: CanvasWheelInput) {
    const webview = webviewRef.current;
    if (!webview) return;

    const bounds = webview.getBoundingClientRect();
    const scaleX = bounds.width / artboardSize.width;
    const scaleY = bounds.height / artboardSize.height;
    handleCanvasWheelInput({
      ...input,
      clientX: bounds.left + (input.clientX || 0) * scaleX,
      clientY: bounds.top + (input.clientY || 0) * scaleY,
    });
  }

  function beginPan(event: ReactPointerEvent<HTMLElement>) {
    if (event.button !== 0 && event.button !== 1) return;
    cancelViewportAnimation();
    event.currentTarget.setPointerCapture(event.pointerId);
    panStartRef.current = { pointerX: event.clientX, pointerY: event.clientY, panX: panRef.current.x, panY: panRef.current.y };
    setIsPanning(true);
  }

  function movePan(event: ReactPointerEvent<HTMLElement>) {
    const start = panStartRef.current;
    if (!start) return;
    const nextPan = {
      x: start.panX + event.clientX - start.pointerX,
      y: start.panY + event.clientY - start.pointerY,
    };
    panTargetRef.current = nextPan;
    commitViewport(zoomRef.current, nextPan);
  }

  function endPan(event: ReactPointerEvent<HTMLElement>) {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    panStartRef.current = null;
    setIsPanning(false);
  }

  function loadCanvas() {
    try {
      const url = new URL(urlInput);
      if (url.protocol !== "http:" && url.protocol !== "https:") return;
      setCanvasUrl(url.toString());
      setCanvasKey((key) => key + 1);
      setSelection(null);
    } catch {
      return;
    }
  }

  function sendCanvasMessage(channel: string, ...args: unknown[]) {
    webviewRef.current?.send(channel, ...args);
  }

  function resetPreview() {
    sendCanvasMessage("formia:reset-overrides");
    setCodexStatus({ state: "idle", message: "" });
  }

  async function buildWithCodex() {
    if (!projectPath || !selection?.previewChanges?.length || !window.formiaDesktop) return;

    setCodexStatus({ state: "working", message: "Sending visual changes to Codex" });
    try {
      await window.formiaDesktop.buildWithCodex({
        projectPath,
        projectName,
        canvasUrl,
        selection,
        previewChanges: selection.previewChanges,
      });
    } catch (error) {
      setCodexStatus({
        state: "failed",
        message: error instanceof Error ? error.message : "Could not start Codex.",
      });
    }
  }

  function codexStatusLabel() {
    if (codexStatus.state === "working") return codexStatus.message || "Codex working";
    if (codexStatus.state === "applied") return "Applied and refreshed";
    if (codexStatus.state === "failed") return codexStatus.message || "Codex needs attention";
    return "";
  }

  function goBack() {
    void window.formiaDesktop?.stopProjectServer();
    onBack();
  }

  function projectStatusLabel() {
    if (projectServerStatus.state === "starting") return projectServerStatus.message || "Starting project";
    if (projectServerStatus.state === "ready") return "Project connected";
    if (projectServerStatus.state === "failed") return projectServerStatus.message || "Project server failed";
    return "";
  }

  return (
    <main className={active ? "flex h-screen overflow-hidden bg-muted/30" : "hidden"}>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center gap-3 border-b bg-background px-4">
          <Button variant="ghost" size="icon" onClick={goBack} aria-label="Back to project selection">
            <ArrowLeft />
          </Button>
          <div className="min-w-0">
            <h1 className="truncate text-sm font-medium">{projectName}</h1>
            <p className="text-xs text-muted-foreground">Canvas</p>
          </div>
        </header>

        <div className="flex shrink-0 items-center gap-2 border-b bg-background px-4 py-2">
          <form className="flex min-w-0 flex-1 items-center gap-2" onSubmit={(event) => { event.preventDefault(); loadCanvas(); }}>
            <Input
              value={urlInput}
              onChange={(event) => setUrlInput(event.target.value)}
              aria-label="Development server URL"
              className="h-8 max-w-xl font-mono text-xs"
            />
            <Button type="submit" variant="secondary" size="sm">Load</Button>
          </form>
          <Button type="button" variant="outline" size="icon-sm" onClick={() => { resetPreview(); setCanvasKey((key) => key + 1); setSelection(null); }} aria-label="Reload canvas">
            <RotateCcw />
          </Button>
          <Button
            type="button"
            size="sm"
            variant={inspectMode ? "default" : "outline"}
            onClick={() => setInspectMode((enabled) => !enabled)}
            disabled={!isDesktop}
          >
            <Crosshair />{inspectMode ? "Inspecting" : "Inspect"}
          </Button>
          <Button
            type="button"
            variant="default"
            size="sm"
            onClick={() => void buildWithCodex()}
            disabled={!isDesktop || !projectPath || !selection?.previewChanges?.length || codexStatus.state === "working"}
            aria-label="Build visual changes with Codex"
            title={!projectPath ? "Select the project from the desktop app to enable Build" : "Send staged visual changes to Codex"}
          >
            {codexStatus.state === "working" ? <LoaderCircle className="animate-spin" /> : <Hammer />}
            Build
          </Button>
          {codexStatus.state !== "idle" ? (
            <span
              role="status"
              className={`hidden max-w-56 items-center gap-1.5 truncate text-xs md:inline-flex ${codexStatus.state === "failed" ? "text-destructive" : "text-muted-foreground"}`}
              title={codexStatusLabel()}
            >
              {codexStatus.state === "working" ? <LoaderCircle className="size-3 animate-spin" /> : null}
              {codexStatus.state === "applied" ? <Check className="size-3 text-emerald-600" /> : null}
              {codexStatus.state === "failed" ? <CircleAlert className="size-3" /> : null}
              <span className="truncate">{codexStatusLabel()}</span>
            </span>
          ) : null}
          {projectServerStatus.state !== "stopped" ? (
            <span
              role="status"
              className={`hidden max-w-56 items-center gap-1.5 truncate text-xs md:inline-flex ${projectServerStatus.state === "failed" ? "text-destructive" : "text-muted-foreground"}`}
              title={projectStatusLabel()}
            >
              {projectServerStatus.state === "starting" ? <LoaderCircle className="size-3 animate-spin" /> : null}
              {projectServerStatus.state === "ready" ? <Check className="size-3 text-emerald-600" /> : null}
              {projectServerStatus.state === "failed" ? <CircleAlert className="size-3" /> : null}
              <span className="truncate">{projectStatusLabel()}</span>
            </span>
          ) : null}
          {canvasUrl ? (
            <Button asChild type="button" variant="outline" size="icon-sm">
              <a href={canvasUrl} target="_blank" rel="noreferrer" aria-label="Open application in a new tab"><ExternalLink /></a>
            </Button>
          ) : (
            <Button type="button" variant="outline" size="icon-sm" disabled aria-label="Open application in a new tab">
              <ExternalLink />
            </Button>
          )}
        </div>

        <div className="min-h-0 flex-1 p-4">
          <div
            ref={canvasViewportRef}
            className={`relative h-full w-full overflow-hidden border bg-muted/40 touch-none ${isPanning || panMode ? "cursor-grabbing" : "cursor-default"}`}
            onWheel={handleCanvasWheel}
            onPointerDown={(event) => {
              if (event.target === event.currentTarget || event.button === 1) beginPan(event);
            }}
            onPointerMove={movePan}
            onPointerUp={endPan}
            onPointerCancel={endPan}
          >
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 opacity-70"
              style={{ backgroundImage: "linear-gradient(to right, color-mix(in oklch, var(--border) 55%, transparent) 1px, transparent 1px), linear-gradient(to bottom, color-mix(in oklch, var(--border) 55%, transparent) 1px, transparent 1px)", backgroundSize: "24px 24px" }}
            />
            <div
              className="absolute"
              style={{
                left: "50%",
                top: "50%",
                width: artboardSize.width,
                height: artboardSize.height,
                transform: `translate(-50%, -50%) translate(${pan.x}px, ${pan.y}px)`,
              }}
            >
              <div
                className="h-full w-full shadow-2xl ring-1 ring-black/10"
                style={{ transform: `scale(${zoom})`, transformOrigin: "center center" }}
              >
                <div className="h-full w-full overflow-hidden bg-white">
                  {active && isDesktop && window.formiaDesktop && canvasUrl ? (
                    <webview
                      key={`${canvasUrl}-${canvasKey}`}
                      ref={webviewRef}
                      src={canvasUrl}
                      preload={window.formiaDesktop.inspectorPreloadUrl}
                      partition="persist:formia-canvas"
                      className="h-full w-full"
                    />
                  ) : canvasUrl ? (
                    <iframe key={`${canvasUrl}-${canvasKey}`} src={canvasUrl} title={`${projectName} application canvas`} className="h-full w-full" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-background px-10 text-center">
                      <div>
                        {projectServerStatus.state === "starting" ? <LoaderCircle className="mx-auto mb-3 size-5 animate-spin text-muted-foreground" /> : null}
                        {projectServerStatus.state === "failed" ? <CircleAlert className="mx-auto mb-3 size-5 text-destructive" /> : null}
                        <p className="text-sm font-medium">
                          {projectServerStatus.state === "failed" ? "Project server could not start" : "Starting project server"}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {projectServerStatus.state === "failed" ? "Check the status above for details." : "Formia will load the project here when it is ready."}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {panMode || isPanning ? (
              <div
                aria-label="Pan canvas"
                className="absolute inset-0 z-20 cursor-grab"
                onPointerDown={beginPan}
                onPointerMove={movePan}
                onPointerUp={endPan}
                onPointerCancel={endPan}
              />
            ) : null}

            <div className="absolute bottom-4 left-4 z-30 flex items-center gap-1 rounded-xl border bg-background/95 p-1 shadow-lg backdrop-blur">
              <Button type="button" variant={panMode ? "default" : "ghost"} size="icon-sm" onClick={() => setPanMode((enabled) => !enabled)} aria-label="Pan canvas" title="Pan canvas (Space + drag)">
                <Hand />
              </Button>
              <div className="mx-1 h-5 w-px bg-border" />
              <Button type="button" variant="ghost" size="icon-sm" onClick={() => zoomCanvas(-0.1)} disabled={zoom <= minZoom} aria-label="Zoom out">
                <Minus />
              </Button>
              <span className="min-w-12 text-center text-xs font-medium tabular-nums text-muted-foreground" aria-label={`Canvas zoom ${Math.round(zoom * 100)} percent`}>
                {Math.round(zoom * 100)}%
              </span>
              <Button type="button" variant="ghost" size="icon-sm" onClick={() => zoomCanvas(0.1)} disabled={zoom >= maxZoom} aria-label="Zoom in">
                <Plus />
              </Button>
              <div className="mx-1 h-5 w-px bg-border" />
              <Button type="button" variant="ghost" size="icon-sm" onClick={fitCanvas} aria-label="Fit artboard to canvas" title="Fit artboard to canvas">
                <Maximize2 />
              </Button>
            </div>
            <div className="pointer-events-none absolute bottom-5 right-5 z-10 hidden text-[11px] text-muted-foreground sm:block">
              Scroll to zoom · Pinch to zoom · Shift + scroll to pan · Space + drag
            </div>
          </div>
        </div>
      </div>

      <PropertiesSidebar
        selection={selection}
        onApplyStyle={(property, value) => sendCanvasMessage("formia:apply-style", { property, value })}
        onResetStyle={(property) => sendCanvasMessage("formia:reset-style", property)}
        onApplyClassName={(value) => sendCanvasMessage("formia:apply-class", value)}
        onResetClassName={() => sendCanvasMessage("formia:reset-class")}
        onApplyText={(value) => sendCanvasMessage("formia:apply-text", value)}
        onResetText={() => sendCanvasMessage("formia:reset-text")}
        onResetAll={resetPreview}
      />
    </main>
  );
}
