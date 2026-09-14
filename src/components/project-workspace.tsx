"use client";

import { createElement, type CSSProperties, type DragEvent as ReactDragEvent, type PointerEvent as ReactPointerEvent, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { AlignBottomIcon, AlignCenterHorizontalSimpleIcon, AlignCenterVerticalIcon, AlignCenterVerticalSimpleIcon, AngleIcon, ArrowClockwiseIcon, ArrowCounterClockwiseIcon, ArrowElbowDownLeftIcon, ArrowLeftIcon, ArrowLineDownIcon, ArrowLineLeftIcon, ArrowLineRightIcon, ArrowLineUpIcon, ArrowRightIcon, ArrowsInLineVerticalIcon, ArrowsOutLineHorizontalIcon, ArrowsOutLineVerticalIcon, BoundingBoxIcon, BrowserIcon, CaretDownIcon, CaretRightIcon, CheckIcon, CircleIcon, CircleNotchIcon, ClipboardTextIcon, ColumnsIcon, CompassIcon, CornersOutIcon, CrosshairSimpleIcon, CursorIcon, CursorTextIcon, DotIcon, DotsNineIcon, DownloadSimpleIcon, EraserIcon, EyeIcon, EyeSlashIcon, FlipHorizontalIcon, FlipVerticalIcon, FrameCornersIcon, GearSixIcon, GitCommitIcon, GridFourIcon, ImageIcon, LinkSimpleIcon, LinkSimpleHorizontalIcon, ListBulletsIcon, ListDashesIcon, ListNumbersIcon, MinusIcon, MouseScrollIcon, NavigationArrowIcon, ParagraphIcon, PathIcon, PlusIcon, PushPinIcon, RectangleIcon, RowsIcon, ShapesIcon, SidebarIcon, SidebarSimpleIcon, SplitHorizontalIcon, SplitVerticalIcon, SquareIcon, StackIcon, StackSimpleIcon, TableIcon, TerminalWindowIcon, TextHIcon, TextboxIcon, VideoCameraIcon, WarningCircleIcon } from "@phosphor-icons/react";
import type { Icon } from "@phosphor-icons/react";
import { AlignBottomFilled, AlignHorizontalCenterFilled, AlignLeft2Filled, AlignRight2Filled, AlignTopFilled } from "@mingcute/react/core-filled";
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react";
import { windowsInstallerUrl } from "@/lib/release";
import { AArrowUpIcon, CaseLowerIcon, CaseSensitiveIcon, CaseUpperIcon, FitToScreenIcon, MinusSignIcon, ParagraphSpacingIcon, TextAlignCenterIcon, TextAlignJustifyCenterIcon, TextAlignLeft01Icon, TextAlignLeftIcon, TextAlignRight01Icon, TextAlignRightIcon, TextStrikethroughIcon, TextUnderlineIcon, TextVariableFrontIcon, XLineTopIcon } from "@hugeicons/core-free-icons";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { ColorPicker } from "@/components/ui/color-picker";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Hint } from "@/components/ui/tooltip";
import { WindowControls } from "@/components/window-controls";
import { desktopErrorMessage, isCanvasKeyboardInput, isCanvasWheelInput, isLayerTreePayload, isPreviewStatePayload, isSelectionPayload, type CanvasMessageArgs, type CanvasMessageChannel, type CodexAvailability, type CodexStatus, type ProjectServerStatus } from "@/lib/desktop-contracts";
import { toolCursor, type ToolName } from "@/lib/tool-cursors";

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
  styleOrigins?: Record<string, "inline" | "computed">;
  parentLayout: { display: string } | null;
  react: { name: string; props: unknown; source: string | null } | null;
  previewChanges: PreviewChange[];
};

type PreviewChange = {
  selectionId: string | null;
  insertionId?: string | null;
  tagName: string;
  source: string | null;
  text: string;
  changes: Array<{
    kind: "style" | "class" | "text" | "structure";
    property?: string;
    operation?: "move" | "delete" | "duplicate" | "insert";
    from: string;
    to: string;
    intent?: "replace-primary-font-family";
    preserveFallbacks?: boolean;
    primaryFont?: string;
    elementType?: "text";
    elementTagName?: "p";
    content?: string;
    position?: { left: number; top: number };
    sourceContext?: unknown;
    previewParent?: unknown;
  }>;
};

type LayerNode = {
  selectionId: string;
  tagName: string;
  name: string;
  detail: string | null;
  children: LayerNode[];
};

type LayerDropTarget = {
  type: "before" | "inside" | "after";
  selectionId: string | null;
  parentId: string | null;
  beforeSelectionId: string | null;
};

const workspaceTools: Array<{ name: ToolName; label: string; shortcut: string; icon: typeof CursorIcon; weight: "fill" | "regular" }> = [
  { name: "interact", label: "Interact", shortcut: "I", icon: CursorIcon, weight: "regular" },
  { name: "select", label: "Select", shortcut: "S", icon: NavigationArrowIcon, weight: "regular" },
  { name: "text", label: "Text", shortcut: "T", icon: CursorTextIcon, weight: "regular" },
];

type CanvasWheelInput = {
  deltaX: number;
  deltaY: number;
  deltaMode: number;
  ctrlKey: boolean;
  shiftKey: boolean;
  clientX?: number;
  clientY?: number;
};

type CanvasKeyboardInput = {
  code: string;
  key: string;
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
  repeat: boolean;
  targetIsEditable: boolean;
};

type WorkspaceShortcutInput = CanvasKeyboardInput & {
  preventDefault?: () => void;
};

const artboardWidth = 1440;
const minimumArtboardHeight = 900;

export type WorkspaceRuntime = "desktop" | "web-demo";

function projectSessionPartition(projectPath: string | null) {
  const value = (projectPath || "untitled").toLowerCase();
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `persist:formia-canvas-${(hash >>> 0).toString(16)}`;
}
const minZoom = 0.1;
const maxZoom = 4;

function clampZoom(value: number) {
  return Math.min(maxZoom, Math.max(minZoom, value));
}

function isEditableKeyboardTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement;
}

const inspectorSectionClass = "border-b border-border px-3 py-2.5";
const inspectorHeadingClass = "text-[14px] leading-4 font-medium text-foreground";
const inspectorTitleClass = `mb-2 ${inspectorHeadingClass}`;
const inspectorLabelClass = "text-[12px] leading-4 font-normal text-muted-foreground";
const inspectorFieldClass = "min-w-0 rounded-[5px] border border-border bg-background px-2 text-[14px] leading-4 text-foreground shadow-none";
const scrubNumberPattern = /^(-?(?:\d+(?:\.\d*)?|\.\d+))([a-z%]*)$/i;

function numericScrubValue(value: string | undefined, allowUnit = false) {
  const match = value?.trim().match(scrubNumberPattern);
  if (!match || (!allowUnit && match[2])) return null;
  const parsed = Number(match[1]);
  return Number.isFinite(parsed) ? parsed : null;
}

function scrubPrecision(step: number) {
  const decimal = String(step).split(".")[1]?.length || 0;
  return 10 ** decimal;
}

function formatScrubValue(value: number, step: number) {
  const precision = scrubPrecision(step);
  return String(Math.round(value * precision) / precision);
}

function useNumericScrub<T extends HTMLElement>({ value, onScrub, step = 1, allowUnit = false, preventDefaultOnStart = false }: { value: string | undefined; onScrub: (value: string) => void; step?: number; allowUnit?: boolean; preventDefaultOnStart?: boolean }) {
  const scrubStart = useRef<{ pointerId: number; startX: number; startValue: number; lastValue: number } | null>(null);
  const scrubTarget = useRef<T | null>(null);
  const cleanupListeners = useRef<(() => void) | null>(null);
  const initialValue = numericScrubValue(value, allowUnit);
  const canScrub = initialValue !== null;

  useEffect(() => () => {
    cleanupListeners.current?.();
  }, []);

  function updateScrub(clientX: number, shiftKey: boolean, altKey: boolean) {
    const start = scrubStart.current;
    if (!start) return;
    const modifier = shiftKey ? 0.1 : altKey ? 10 : 1;
    const activeStep = step * modifier;
    const nextValue = Math.round((start.startValue + (clientX - start.startX) * activeStep) / activeStep) * activeStep;
    if (nextValue === start.lastValue) return;
    start.lastValue = nextValue;
    onScrub(formatScrubValue(nextValue, activeStep));
  }

  function finishScrub(pointerId: number) {
    if (scrubStart.current?.pointerId !== pointerId) return;
    scrubStart.current = null;
    const target = scrubTarget.current;
    scrubTarget.current = null;
    cleanupListeners.current?.();
    if (target?.hasPointerCapture(pointerId)) target.releasePointerCapture(pointerId);
  }

  function handlePointerDown(event: ReactPointerEvent<T>) {
    if (!canScrub || initialValue === null || event.button !== 0) return;
    cleanupListeners.current?.();
    scrubStart.current = { pointerId: event.pointerId, startX: event.clientX, startValue: initialValue, lastValue: initialValue };
    scrubTarget.current = event.currentTarget;
    event.currentTarget.setPointerCapture(event.pointerId);
    if (preventDefaultOnStart) event.preventDefault();

    const handleWindowMove = (moveEvent: PointerEvent) => {
      if (moveEvent.pointerId !== event.pointerId) return;
      updateScrub(moveEvent.clientX, moveEvent.shiftKey, moveEvent.altKey);
      moveEvent.preventDefault();
    };
    const handleWindowEnd = (endEvent: PointerEvent) => {
      if (endEvent.pointerId === event.pointerId) finishScrub(endEvent.pointerId);
    };
    cleanupListeners.current = () => {
      window.removeEventListener("pointermove", handleWindowMove);
      window.removeEventListener("pointerup", handleWindowEnd);
      window.removeEventListener("pointercancel", handleWindowEnd);
      cleanupListeners.current = null;
    };
    window.addEventListener("pointermove", handleWindowMove);
    window.addEventListener("pointerup", handleWindowEnd);
    window.addEventListener("pointercancel", handleWindowEnd);
  }

  function handlePointerMove(event: ReactPointerEvent<T>) {
    const start = scrubStart.current;
    if (!start || start.pointerId !== event.pointerId) return;
    updateScrub(event.clientX, event.shiftKey, event.altKey);
    event.preventDefault();
  }

  function handlePointerEnd(event: ReactPointerEvent<T>) {
    finishScrub(event.pointerId);
  }

  return { canScrub, handlePointerDown, handlePointerMove, handlePointerEnd };
}

function NumericScrubLabel({ children, htmlFor, name, value, onScrub, step = 1, allowUnit = false, className }: { children: React.ReactNode; htmlFor?: string; name: string; value: string | undefined; onScrub: (value: string) => void; step?: number; allowUnit?: boolean; className?: string }) {
  const scrub = useNumericScrub<HTMLLabelElement>({ value, onScrub, step, allowUnit, preventDefaultOnStart: true });
  const scrubClassName = scrub.canScrub ? "cursor-ew-resize select-none [&_svg]:cursor-ew-resize" : "";

  return (
    <Hint content={scrub.canScrub ? `${name} — drag to adjust` : name}>
      <label htmlFor={htmlFor} className={`${className || ""} ${scrubClassName}`} onPointerDown={scrub.handlePointerDown} onPointerUp={scrub.handlePointerEnd} onPointerCancel={scrub.handlePointerEnd}>
        {children}
      </label>
    </Hint>
  );
}

function useMouseScrub({ value, onScrub, step = 1 }: { value: string; onScrub: (value: string) => void; step?: number }) {
  const scrubStart = useRef<{ startX: number; startValue: number; lastValue: number } | null>(null);
  const cleanupListeners = useRef<(() => void) | null>(null);
  const initialValue = numericScrubValue(value);
  const canScrub = initialValue !== null;

  useEffect(() => () => {
    cleanupListeners.current?.();
  }, []);

  function finishScrub() {
    scrubStart.current = null;
    cleanupListeners.current?.();
  }

  function handleMouseDown(event: React.MouseEvent<HTMLDivElement>) {
    if (!canScrub || initialValue === null || event.button !== 0) return;
    cleanupListeners.current?.();
    scrubStart.current = { startX: event.clientX, startValue: initialValue, lastValue: initialValue };
    event.preventDefault();

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const start = scrubStart.current;
      if (!start) return;
      const modifier = moveEvent.shiftKey ? 0.1 : moveEvent.altKey ? 10 : 1;
      const activeStep = step * modifier;
      const nextValue = Math.round((start.startValue + (moveEvent.clientX - start.startX) * activeStep) / activeStep) * activeStep;
      if (nextValue === start.lastValue) return;
      start.lastValue = nextValue;
      moveEvent.preventDefault();
      onScrub(formatScrubValue(nextValue, activeStep));
    };
    const handleMouseUp = () => finishScrub();
    cleanupListeners.current = () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      cleanupListeners.current = null;
    };
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  }

  return { canScrub, handleMouseDown };
}

function PropertyGroup({ title, values }: { title: string; values: Record<string, unknown> }) {
  const entries = Object.entries(values);
  if (entries.length === 0) return null;

  return (
    <section className={inspectorSectionClass}>
      <h3 className={inspectorTitleClass}>{title}</h3>
      <dl className="space-y-1">
        {entries.map(([name, value]) => (
          <div key={name} className="space-y-1">
            <Hint content={name}><dt className={`${inspectorLabelClass} truncate`}>{name}</dt></Hint>
            <dd className={`${inspectorFieldClass} min-h-7 whitespace-pre-wrap break-words py-1`}>
              {typeof value === "string" || typeof value === "number" ? String(value) : JSON.stringify(value, null, 2)}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function resizeContentTextarea(textarea: HTMLTextAreaElement | null) {
  if (!textarea) return;
  textarea.style.height = "0px";
  textarea.style.height = `${Math.max(28, textarea.scrollHeight)}px`;
}

function ContentGroup({
  value,
  onCommit,
  onReset,
}: {
  value: string;
  onCommit: (value: string) => void;
  onReset: () => void;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const pendingSelection = useRef<{ value: string; start: number | null; end: number | null } | null>(null);

  useLayoutEffect(() => {
    resizeContentTextarea(textareaRef.current);
  }, [value]);

  useLayoutEffect(() => {
    const pending = pendingSelection.current;
    const textarea = textareaRef.current;
    if (!pending) return;
    pendingSelection.current = null;
    if (!textarea || document.activeElement !== textarea) return;

    const offset = textarea.value.length - pending.value.length;
    const start = pending.start === null ? null : Math.max(0, Math.min(textarea.value.length, pending.start + offset));
    const end = pending.end === null ? null : Math.max(0, Math.min(textarea.value.length, pending.end + offset));
    if (start !== null && end !== null) textarea.setSelectionRange(start, end);
  }, [value]);

  return (
    <section className={inspectorSectionClass}>
      <h3 className={inspectorTitleClass}>Content</h3>
      <div className="group relative">
        <textarea
          ref={textareaRef}
          value={value}
          rows={1}
          aria-label="Edit content"
          className={`${inspectorFieldClass} block h-7 w-full resize-none overflow-hidden py-1 pr-7 font-normal transition-colors hover:bg-muted/30 focus:bg-muted/25 focus:outline-none focus:ring-1 focus:ring-foreground/5`}
          onChange={(event) => {
            pendingSelection.current = {
              value: event.currentTarget.value,
              start: event.currentTarget.selectionStart,
              end: event.currentTarget.selectionEnd,
            };
            onCommit(event.currentTarget.value);
            resizeContentTextarea(event.currentTarget);
          }}
          onBlur={() => {
            pendingSelection.current = null;
          }}
        />
        <Hint content="Reset content">
          <Button type="button" variant="ghost" size="icon-xs" className="absolute right-1 top-1/2 size-4 -translate-y-1/2 rounded bg-background p-0 text-muted-foreground opacity-0 transition-opacity hover:opacity-100 focus-visible:opacity-100" onClick={onReset} aria-label="Reset content">
            <ArrowCounterClockwiseIcon className="size-3.5" />
          </Button>
        </Hint>
      </div>
    </section>
  );
}

const typographyUnits = [
  { value: "px", label: "Pixels" },
  { value: "rem", label: "Rem" },
  { value: "em", label: "Em" },
  { value: "%", label: "Percent" },
  { value: "vw", label: "Viewport width" },
  { value: "vh", label: "Viewport height" },
] as const;

const lineHeightUnits = [
  { value: "unitless", label: "Unitless" },
  ...typographyUnits,
] as const;

type TypographyMetricUnit = string;

const defaultFontFamilies = [
  "Arial",
  "Calibri",
  "Courier New",
  "Georgia",
  "Helvetica Neue",
  "Inter",
  "Segoe UI",
  "Tahoma",
  "Times New Roman",
  "Verdana",
  "ui-monospace",
  "ui-sans-serif",
] as const;

function firstFontFamily(value: string | undefined) {
  const normalized = value?.trim() || "";
  let quote = "";

  for (let index = 0; index < normalized.length; index += 1) {
    const character = normalized[index];
    if ((character === "'" || character === '"') && normalized[index - 1] !== "\\") {
      quote = quote === character ? "" : quote || character;
    } else if (character === "," && !quote) {
      return normalized.slice(0, index).trim().replace(/^['"]|['"]$/g, "");
    }
  }

  return normalized.replace(/^['"]|['"]$/g, "");
}

function replacePrimaryFontFamily(value: string | undefined, nextFamily: string) {
  const normalizedNextFamily = nextFamily.trim();
  if (!normalizedNextFamily) return value || "";

  const currentValue = value?.trim() || "";
  let quote = "";
  let separatorIndex = -1;

  for (let index = 0; index < currentValue.length; index += 1) {
    const character = currentValue[index];
    if ((character === "'" || character === '"') && currentValue[index - 1] !== "\\") {
      quote = quote === character ? "" : quote || character;
    } else if (character === "," && !quote) {
      separatorIndex = index;
      break;
    }
  }

  const primary = /[\s,]/.test(normalizedNextFamily) ? `"${normalizedNextFamily.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"` : normalizedNextFamily;
  return `${primary}${separatorIndex >= 0 ? currentValue.slice(separatorIndex) : ""}`;
}

function fontFamilyStyleValue(font: string) {
  return /^[a-z][a-z0-9-]*$/i.test(font) ? font : `"${font.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

function FontPickerField({ selection, onApplyStyle, onResetStyle }: { selection: SelectedElement; onApplyStyle: (property: string, value: string) => void; onResetStyle: (property: string) => void }) {
  const [fontFamilies, setFontFamilies] = useState<string[]>([...defaultFontFamilies]);
  const currentValue = selection.styles.fontFamily || "";
  const currentFamily = firstFontFamily(currentValue);

  useEffect(() => {
    const desktop = window.formiaDesktop;
    if (!desktop) return;

    let active = true;
    void desktop.getInstalledFonts().then((installedFonts) => {
      if (active && installedFonts.length > 0) setFontFamilies(installedFonts);
    });

    return () => {
      active = false;
    };
  }, []);

  const availableFonts = currentFamily && !fontFamilies.includes(currentFamily) ? [currentFamily, ...fontFamilies] : fontFamilies;

  return (
    <DropdownMenu>
      <div className="group relative grid h-7 min-w-0 grid-cols-[minmax(0,1fr)_1.5rem] items-center rounded-[5px] border border-border bg-background px-2 transition-colors hover:bg-muted/30 focus-within:bg-muted/25 focus-within:ring-1 focus-within:ring-foreground/5">
        <Input id="typography-font-family" value={currentFamily} aria-label="Edit primary font family" className="h-4 min-w-0 w-full overflow-hidden text-ellipsis whitespace-nowrap rounded-none border-0 bg-transparent p-0 pr-1 text-[14px] leading-4 font-normal shadow-none focus-visible:ring-0" onChange={(event) => onApplyStyle("fontFamily", replacePrimaryFontFamily(currentValue, event.currentTarget.value))} />
        <Hint content="Choose installed font">
          <DropdownMenuTrigger asChild>
            <Button type="button" variant="ghost" size="icon-xs" className="absolute right-0.5 top-1/2 size-5 -translate-y-1/2 rounded p-0 text-muted-foreground hover:bg-muted/50 hover:text-foreground focus-visible:ring-1 focus-visible:ring-foreground/10" aria-label="Choose installed font">
              <CaretDownIcon className="size-3" />
            </Button>
          </DropdownMenuTrigger>
        </Hint>
        <Hint content="Reset font family">
          <Button type="button" variant="ghost" size="icon-xs" className="absolute right-6 top-1/2 size-4 -translate-y-1/2 rounded bg-background p-0 text-muted-foreground opacity-0 transition-opacity hover:opacity-100 focus-visible:opacity-100" onClick={() => onResetStyle("fontFamily")} aria-label="Reset font family">
            <ArrowCounterClockwiseIcon className="size-3.5" />
          </Button>
        </Hint>
      </div>
      <DropdownMenuContent align="start" sideOffset={4} className="scrollbar-hidden max-h-72 min-w-[16rem] max-w-[calc(100vw-1rem)] overflow-y-auto rounded-[5px] p-0.5 shadow-none ring-1 ring-foreground/10">
        <DropdownMenuLabel className="px-2 py-1 text-[11px]">Installed fonts</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={availableFonts.includes(currentFamily) ? currentFamily : ""} onValueChange={(font) => onApplyStyle("fontFamily", replacePrimaryFontFamily(currentValue, font))}>
          {availableFonts.map((font) => (
            <DropdownMenuRadioItem key={font} value={font} className="rounded-[3px] px-2 py-1 text-[14px]" style={{ fontFamily: fontFamilyStyleValue(font), contentVisibility: "auto" }}>
              {font}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function parseTypographyMetric(value: string | undefined, fallback: string, units: readonly { value: string; label: string }[], allowNormal: boolean) {
  const normalized = value?.trim() || fallback;
  if (allowNormal && normalized.toLowerCase() === "normal") return { inputValue: "normal", unit: "normal" as TypographyMetricUnit };

  const numeric = normalized.match(/^(-?(?:\d+(?:\.\d*)?|\.\d+))([a-z%]*)$/i);
  if (!numeric) return { inputValue: normalized, unit: "px" as TypographyMetricUnit };

  const unit = numeric[2] === "" && units.some((option) => option.value === "unitless")
    ? "unitless"
    : units.some((option) => option.value === numeric[2]) ? numeric[2] : "px";
  return { inputValue: numeric[1], unit };
}

function TypographyMetricField({
  icon,
  name,
  value,
  fallback,
  units,
  allowNormal = false,
  onCommit,
  onReset,
}: {
  icon: IconSvgElement;
  name: string;
  value: string | undefined;
  fallback: string;
  units: readonly { value: string; label: string }[];
  allowNormal?: boolean;
  onCommit: (value: string) => void;
  onReset: () => void;
}) {
  const parsed = parseTypographyMetric(value, fallback, units, allowNormal);
  const selectedUnitLabel = parsed.unit === "normal"
    ? "Normal"
    : units.find((option) => option.value === parsed.unit)?.label || "Custom";

  function commitInput(inputValue: string) {
    const nextValue = inputValue.trim();
    if (allowNormal && nextValue.toLowerCase() === "normal") {
      onCommit("normal");
      return;
    }

    const unit = parsed.unit === "normal" ? (units[0]?.value || "px") : parsed.unit;
    onCommit(`${nextValue || fallback}${unit === "unitless" ? "" : unit}`);
  }

  function chooseUnit(unit: string) {
    if (allowNormal && unit === "normal") {
      onCommit("normal");
      return;
    }

    const inputValue = parsed.unit === "normal" ? fallback : parsed.inputValue;
    onCommit(`${inputValue}${unit === "unitless" ? "" : unit}`);
  }

  return (
    <div className="group relative grid h-7 min-w-0 grid-cols-[1.75rem_minmax(0,1fr)] items-center rounded-[5px] border border-border bg-background px-2 shadow-none transition-colors hover:bg-muted/30 focus-within:bg-muted/25 focus-within:ring-1 focus-within:ring-foreground/5">
      <NumericScrubLabel htmlFor={`typography-${name}`} name={name} value={parsed.inputValue} onScrub={commitInput} step={name === "line-height" ? 0.1 : 1} allowUnit className="grid size-3.5 place-items-center text-muted-foreground [&>svg]:block"><HugeiconsIcon icon={icon} size={15} strokeWidth={1.8} /></NumericScrubLabel>
      <Input
        id={`typography-${name}`}
        value={parsed.inputValue}
        aria-label={`Edit ${name}`}
        className="h-4 min-w-0 w-full overflow-hidden text-ellipsis whitespace-nowrap appearance-none rounded-none border-0 bg-transparent p-0 pr-8 text-[14px] leading-4 font-normal tabular-nums shadow-none focus:overflow-x-auto focus:text-clip focus-visible:ring-0 md:text-[14px]"
        onChange={(event) => commitInput(event.currentTarget.value)}
      />
      <Hint content={`Reset ${name}`}>
        <Button type="button" variant="ghost" size="icon-xs" className="absolute right-5 top-1/2 size-4 -translate-y-1/2 rounded bg-background p-0 text-muted-foreground opacity-0 transition-opacity hover:opacity-100 focus-visible:opacity-100" onClick={onReset} aria-label={`Reset ${name}`}>
          <ArrowCounterClockwiseIcon className="size-3.5" />
        </Button>
      </Hint>
      <DropdownMenu>
        <Hint content={`Unit: ${selectedUnitLabel}`}>
          <DropdownMenuTrigger asChild>
            <Button type="button" variant="ghost" size="icon-xs" className="absolute right-0.5 top-1/2 size-4 -translate-y-1/2 rounded p-0 text-muted-foreground hover:bg-muted/50 hover:text-foreground focus-visible:ring-1 focus-visible:ring-foreground/10" aria-label={`Choose ${name} unit`}>
              <CaretDownIcon className="size-3" />
            </Button>
          </DropdownMenuTrigger>
        </Hint>
        <DropdownMenuContent align="end" sideOffset={4} className="w-40 rounded-[5px] p-0.5 shadow-none ring-1 ring-foreground/10">
          <DropdownMenuLabel className="px-2 py-1 text-[11px]">Units</DropdownMenuLabel>
          <DropdownMenuRadioGroup value={parsed.unit} onValueChange={chooseUnit}>
            {units.map((option) => <DropdownMenuRadioItem key={option.value || "unitless"} value={option.value} className="rounded-[3px] px-2 py-1 text-[12px]">{option.label}</DropdownMenuRadioItem>)}
            {allowNormal ? <DropdownMenuRadioItem value="normal" className="rounded-[3px] px-2 py-1 text-[12px]">Normal</DropdownMenuRadioItem> : null}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

const fontWeightOptions = [
  { value: "100", label: "100 Thin" },
  { value: "200", label: "200 Extra light" },
  { value: "300", label: "300 Light" },
  { value: "400", label: "400 Regular" },
  { value: "500", label: "500 Medium" },
  { value: "600", label: "600 Semi bold" },
  { value: "700", label: "700 Bold" },
  { value: "800", label: "800 Extra bold" },
  { value: "900", label: "900 Black" },
  { value: "normal", label: "Normal" },
  { value: "bold", label: "Bold" },
] as const;

type TypographyIconOption = { value: string; label: string; icon: IconSvgElement };

const textAlignOptions: readonly TypographyIconOption[] = [
  { value: "left", label: "Left", icon: TextAlignLeftIcon },
  { value: "center", label: "Center", icon: TextAlignCenterIcon },
  { value: "right", label: "Right", icon: TextAlignRightIcon },
  { value: "justify", label: "Justify", icon: TextAlignJustifyCenterIcon },
  { value: "start", label: "Start", icon: TextAlignLeft01Icon },
  { value: "end", label: "End", icon: TextAlignRight01Icon },
];

const textTransformOptions: readonly TypographyIconOption[] = [
  { value: "none", label: "None", icon: MinusSignIcon },
  { value: "uppercase", label: "Uppercase", icon: CaseUpperIcon },
  { value: "lowercase", label: "Lowercase", icon: CaseLowerIcon },
  { value: "capitalize", label: "Capitalize", icon: CaseSensitiveIcon },
];

const textDecorationOptions: readonly TypographyIconOption[] = [
  { value: "none", label: "None", icon: MinusSignIcon },
  { value: "underline", label: "Underline", icon: TextUnderlineIcon },
  { value: "line-through", label: "Strike through", icon: TextStrikethroughIcon },
  { value: "overline", label: "Overline", icon: XLineTopIcon },
];

function TypographyWeightField({ value, onCommit }: { value: string | undefined; onCommit: (value: string) => void }) {
  const currentValue = value || "400";
  const selectedWeight = fontWeightOptions.some((option) => option.value === currentValue) ? currentValue : "";

  return (
    <DropdownMenu>
      <div className="group relative grid h-7 min-w-0 grid-cols-[1.25rem_minmax(0,1fr)_1.5rem] items-center gap-1 rounded-[5px] border border-border bg-background px-2 transition-colors hover:bg-muted/30 focus-within:bg-muted/25 focus-within:ring-1 focus-within:ring-foreground/5">
        <NumericScrubLabel htmlFor="typography-font-weight" name="font-weight" value={currentValue} onScrub={onCommit} className="grid size-3.5 place-items-center text-muted-foreground"><HugeiconsIcon icon={TextVariableFrontIcon} size={15} strokeWidth={1.8} /></NumericScrubLabel>
        <Input id="typography-font-weight" value={currentValue} aria-label="Edit font weight" className="h-4 min-w-0 w-full overflow-hidden text-ellipsis whitespace-nowrap appearance-none rounded-none border-0 bg-transparent p-0 text-[14px] leading-4 font-normal tabular-nums shadow-none focus:overflow-x-auto focus:text-clip focus-visible:ring-0 md:text-[14px]" onChange={(event) => onCommit(event.currentTarget.value)} />
        <Hint content="Choose font weight">
          <DropdownMenuTrigger asChild>
            <Button type="button" variant="ghost" size="icon-xs" className="absolute right-0.5 top-1/2 size-5 -translate-y-1/2 rounded p-0 text-muted-foreground hover:bg-muted/50 hover:text-foreground focus-visible:ring-1 focus-visible:ring-foreground/10" aria-label="Choose font weight">
              <CaretDownIcon className="size-3" />
            </Button>
          </DropdownMenuTrigger>
        </Hint>
      </div>
      <DropdownMenuContent align="end" sideOffset={4} className="w-40 rounded-[5px] p-0.5 shadow-none ring-1 ring-foreground/10">
        <DropdownMenuLabel className="px-2 py-1 text-[11px]">Font weight</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={selectedWeight} onValueChange={onCommit}>
          {fontWeightOptions.map((option) => <DropdownMenuRadioItem key={option.value} value={option.value} className="rounded-[3px] px-2 py-1 text-[12px]">{option.label}</DropdownMenuRadioItem>)}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function TypographyIconSegmentedField({ label, name, value, options, onChange }: { label: string; name: string; value: string | undefined; options: readonly TypographyIconOption[]; onChange: (value: string) => void }) {
  return (
    <div className="space-y-1">
      <LayoutLabel>{label}</LayoutLabel>
      <div className={layoutControlSurface} style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }} role="group" aria-label={name}>
        {options.map((option) => (
          <Hint key={option.value} content={option.label}>
            <Button type="button" variant="ghost" size="icon-xs" className={layoutControlButton} onClick={() => onChange(option.value)} aria-label={option.label} aria-pressed={value === option.value}>
              <HugeiconsIcon icon={option.icon} size={15} strokeWidth={1.8} />
            </Button>
          </Hint>
        ))}
      </div>
    </div>
  );
}

function TypographyGroup({ selection, onApplyStyle, onResetStyle }: { selection: SelectedElement; onApplyStyle: (property: string, value: string) => void; onResetStyle: (property: string) => void }) {
  return (
    <section className={inspectorSectionClass}>
      <h3 className={inspectorTitleClass}>Typography</h3>
      <div className="space-y-1">
        <FontPickerField selection={selection} onApplyStyle={onApplyStyle} onResetStyle={onResetStyle} />

        <div className="grid grid-cols-2 gap-1">
          <TypographyMetricField icon={AArrowUpIcon} name="font-size" value={selection.styles.fontSize} fallback="16" units={typographyUnits} onCommit={(value) => onApplyStyle("fontSize", value)} onReset={() => onResetStyle("fontSize")} />
          <TypographyWeightField value={selection.styles.fontWeight} onCommit={(value) => onApplyStyle("fontWeight", value)} />
        </div>

        <div className="grid grid-cols-2 gap-1">
          <TypographyMetricField icon={ParagraphSpacingIcon} name="line-height" value={selection.styles.lineHeight} fallback="1.2" units={lineHeightUnits} allowNormal onCommit={(value) => onApplyStyle("lineHeight", value)} onReset={() => onResetStyle("lineHeight")} />
          <TypographyMetricField icon={FitToScreenIcon} name="letter-spacing" value={selection.styles.letterSpacing} fallback="0" units={typographyUnits} allowNormal onCommit={(value) => onApplyStyle("letterSpacing", value)} onReset={() => onResetStyle("letterSpacing")} />
        </div>

        <TypographyIconSegmentedField label="Align" name="Text alignment" value={selection.styles.textAlign} options={textAlignOptions} onChange={(value) => onApplyStyle("textAlign", value)} />

        <div className="grid grid-cols-2 gap-1">
          <TypographyIconSegmentedField label="Transform" name="Text transform" value={selection.styles.textTransform} options={textTransformOptions} onChange={(value) => onApplyStyle("textTransform", value)} />
          <TypographyIconSegmentedField label="Decoration" name="Text decoration" value={selection.styles.textDecorationLine} options={textDecorationOptions} onChange={(value) => onApplyStyle("textDecorationLine", value)} />
        </div>
      </div>
    </section>
  );
}

type RgbaColorValue = { r: number; g: number; b: number; a: number };

function clampColorChannel(value: number) {
  return Math.min(255, Math.max(0, Math.round(value)));
}

function colorAlpha(value: string | undefined) {
  const normalized = value?.trim() || "";
  const parsed = Number.parseFloat(normalized.endsWith("%") ? normalized.slice(0, -1) : normalized);
  if (!Number.isFinite(parsed)) return 1;
  return Math.min(1, Math.max(0, normalized.endsWith("%") ? parsed / 100 : parsed));
}

function labToRgba(lightness: number, a: number, b: number, alpha: number): RgbaColorValue {
  const epsilon = 216 / 24389;
  const kappa = 24389 / 27;
  const f = (value: number) => value ** 3 > epsilon ? value ** 3 : (116 * value - 16) / kappa;
  const fy = (lightness + 16) / 116;
  const fx = fy + a / 500;
  const fz = fy - b / 200;
  const x = f(fx) * 0.96422;
  const y = f(fy);
  const z = f(fz) * 0.82521;
  const d65X = 0.9555766 * x - 0.0230393 * y + 0.0631636 * z;
  const d65Y = -0.0282895 * x + 1.0099416 * y + 0.0210077 * z;
  const d65Z = 0.0122982 * x - 0.020483 * y + 1.3299098 * z;
  const linear = [
    3.2406 * d65X - 1.5372 * d65Y - 0.4986 * d65Z,
    -0.9689 * d65X + 1.8758 * d65Y + 0.0415 * d65Z,
    0.0557 * d65X - 0.204 * d65Y + 1.057 * d65Z,
  ];
  const toSrgb = (channel: number) => (channel <= 0.0031308 ? 12.92 * channel : 1.055 * channel ** (1 / 2.4) - 0.055) * 255;
  return { r: clampColorChannel(toSrgb(linear[0])), g: clampColorChannel(toSrgb(linear[1])), b: clampColorChannel(toSrgb(linear[2])), a: Math.min(1, Math.max(0, alpha)) };
}

function parseLabColor(value: string): RgbaColorValue | null {
  const match = value.match(/^lab\(\s*([^)]*)\)$/i);
  if (!match) return null;

  const parts = match[1].replace("/", " / ").trim().split(/\s+/);
  const slashIndex = parts.indexOf("/");
  const channels = slashIndex >= 0 ? parts.slice(0, slashIndex) : parts;
  if (channels.length < 3) return null;

  const lightnessValue = Number.parseFloat(channels[0]);
  const aValue = Number.parseFloat(channels[1]);
  const bValue = Number.parseFloat(channels[2]);
  const alpha = colorAlpha(slashIndex >= 0 ? parts[slashIndex + 1] : "1");
  if (![lightnessValue, aValue, bValue, alpha].every(Number.isFinite)) return null;

  return labToRgba(
    channels[0].endsWith("%") ? lightnessValue : lightnessValue,
    channels[1].endsWith("%") ? aValue * 1.25 : aValue,
    channels[2].endsWith("%") ? bValue * 1.25 : bValue,
    alpha,
  );
}

function rgbaColorToHex({ r, g, b, a }: RgbaColorValue) {
  const channel = (value: number) => clampColorChannel(value).toString(16).padStart(2, "0");
  return `#${channel(r)}${channel(g)}${channel(b)}${a < 0.995 ? channel(a * 255) : ""}`;
}

function parseRgbColor(value: string): RgbaColorValue | null {
  const match = value.match(/^rgba?\(\s*([^)]*)\)$/i);
  if (!match) return null;

  const parts = match[1].replaceAll(",", " ").replace("/", " / ").trim().split(/\s+/);
  const slashIndex = parts.indexOf("/");
  const channels = slashIndex >= 0 ? parts.slice(0, slashIndex) : parts;
  if (channels.length < 3) return null;

  const parseChannel = (channel: string) => {
    const parsed = Number.parseFloat(channel);
    return Number.isFinite(parsed) ? Math.min(255, Math.max(0, channel.endsWith("%") ? parsed * 2.55 : parsed)) : null;
  };
  const r = parseChannel(channels[0]);
  const g = parseChannel(channels[1]);
  const b = parseChannel(channels[2]);
  const alpha = colorAlpha(slashIndex >= 0 ? parts[slashIndex + 1] : channels[3] || "1");
  if (r === null || g === null || b === null) return null;

  return { r, g, b, a: alpha };
}

function parseHslColor(value: string): RgbaColorValue | null {
  const match = value.match(/^hsla?\(\s*([^)]*)\)$/i);
  if (!match) return null;

  const parts = match[1].replaceAll(",", " ").replace("/", " / ").trim().split(/\s+/);
  const slashIndex = parts.indexOf("/");
  const channels = slashIndex >= 0 ? parts.slice(0, slashIndex) : parts;
  if (channels.length < 3) return null;

  const hue = Number.parseFloat(channels[0]);
  const saturation = Number.parseFloat(channels[1]);
  const lightness = Number.parseFloat(channels[2]);
  const alpha = colorAlpha(slashIndex >= 0 ? parts[slashIndex + 1] : channels[3] || "1");
  if (![hue, saturation, lightness, alpha].every(Number.isFinite)) return null;

  const s = Math.min(1, Math.max(0, saturation / 100));
  const l = Math.min(1, Math.max(0, lightness / 100));
  const chroma = (1 - Math.abs(2 * l - 1)) * s;
  const segment = (((hue % 360) + 360) % 360) / 60;
  const secondary = chroma * (1 - Math.abs((segment % 2) - 1));
  const matchValue = l - chroma / 2;
  let red = 0;
  let green = 0;
  let blue = 0;
  if (segment < 1) [red, green, blue] = [chroma, secondary, 0];
  else if (segment < 2) [red, green, blue] = [secondary, chroma, 0];
  else if (segment < 3) [red, green, blue] = [0, chroma, secondary];
  else if (segment < 4) [red, green, blue] = [0, secondary, chroma];
  else if (segment < 5) [red, green, blue] = [secondary, 0, chroma];
  else [red, green, blue] = [chroma, 0, secondary];

  return { r: (red + matchValue) * 255, g: (green + matchValue) * 255, b: (blue + matchValue) * 255, a: alpha };
}

function colorHexValue(value: string | undefined) {
  const normalized = value?.trim().toLowerCase() || "";
  const hex = normalized.match(/^#([0-9a-f]{3,8})$/i)?.[1];
  if (hex) {
    if (hex.length === 3) return `#${hex.split("").map((digit) => `${digit}${digit}`).join("")}`;
    if (hex.length === 4) return `#${hex.split("").map((digit) => `${digit}${digit}`).join("")}`;
    if (hex.length >= 6) return `#${hex.slice(0, 8)}`;
  }

  const rgb = parseRgbColor(normalized);
  if (rgb) return rgbaColorToHex(rgb);
  const hsl = parseHslColor(normalized);
  if (hsl) return rgbaColorToHex(hsl);
  const lab = parseLabColor(normalized);
  if (lab) return rgbaColorToHex(lab);
  if (normalized === "transparent") return "#00000000";

  return "#000000";
}

function displayedColorHexValue(value: string | undefined) {
  return colorHexValue(value).toUpperCase();
}

function ColorField({ label, name, property, value, onApplyStyle, onResetStyle }: { label: string; name: string; property: string; value: string | undefined; onApplyStyle: (property: string, value: string) => void; onResetStyle: (property: string) => void }) {
  return (
    <div className="space-y-1">
      <Hint content={`Edit ${name} color`}>
        <label htmlFor={`color-${property}`} className={inspectorLabelClass}>{label}</label>
      </Hint>
      <div className="group relative flex h-7 min-w-0 items-center gap-1 rounded-[5px] border border-border bg-background px-2 shadow-none transition-colors hover:bg-muted/30 focus-within:border-border focus-within:bg-muted/25 focus-within:shadow-none focus-within:ring-1 focus-within:ring-foreground/5">
        <ColorPicker value={colorHexValue(value)} onChange={(next) => onApplyStyle(property, next)} ariaLabel={`Choose ${name} color`} />
        <Input
          id={`color-${property}`}
          value={displayedColorHexValue(value)}
          aria-label={`Edit ${name} color value`}
          placeholder="transparent"
          className="h-4 min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap rounded-none border-0 bg-transparent p-0 pr-6 text-[12px] leading-4 font-normal shadow-none focus:overflow-x-auto focus:text-clip focus-visible:ring-0 md:text-[12px]"
          onChange={(event) => onApplyStyle(property, event.currentTarget.value)}
        />
        <Hint content={`Reset ${name} color`}>
          <Button type="button" variant="ghost" size="icon-xs" className="absolute right-1 top-1/2 size-4 -translate-y-1/2 rounded bg-background p-0 text-muted-foreground opacity-0 transition-opacity hover:opacity-100 focus-visible:opacity-100" onClick={() => onResetStyle(property)} aria-label={`Reset ${name} color`}>
            <ArrowCounterClockwiseIcon className="size-3.5" />
          </Button>
        </Hint>
      </div>
    </div>
  );
}

function ColorGroup({ selection, onApplyStyle, onResetStyle }: { selection: SelectedElement; onApplyStyle: (property: string, value: string) => void; onResetStyle: (property: string) => void }) {
  return (
    <section className={inspectorSectionClass}>
      <h3 className={inspectorTitleClass}>Color</h3>
      <div className="space-y-1">
        <ColorField label="Foreground" name="foreground" property="color" value={selection.styles.color} onApplyStyle={onApplyStyle} onResetStyle={onResetStyle} />
        <ColorField label="Background" name="background" property="backgroundColor" value={selection.styles.backgroundColor} onApplyStyle={onApplyStyle} onResetStyle={onResetStyle} />
      </div>
    </section>
  );
}

const borderStyleOptions = [
  { value: "none", label: "None" },
  { value: "solid", label: "Solid" },
  { value: "dashed", label: "Dashed" },
  { value: "dotted", label: "Dotted" },
  { value: "double", label: "Double" },
] as const;

const borderUnits = [
  { value: "px", label: "Pixels" },
  { value: "rem", label: "Rem" },
  { value: "em", label: "Em" },
] as const;

const borderRadiusUnits = [...borderUnits, { value: "%", label: "Percent" }] as const;

function BorderStyleField({ value, onChange, onReset }: { value: string | undefined; onChange: (value: string) => void; onReset: () => void }) {
  return (
    <div className="space-y-1">
      <Hint content="border-style"><label htmlFor="border-style" className={inspectorLabelClass}>Style</label></Hint>
      <div className="group relative flex h-7 min-w-0 items-center rounded-[5px] border border-border bg-background px-2 shadow-none transition-colors hover:bg-muted/30 focus-within:border-border focus-within:bg-muted/25 focus-within:shadow-none focus-within:ring-1 focus-within:ring-foreground/5">
        <Select value={value || "none"} onValueChange={onChange}>
          <SelectTrigger id="border-style" size="sm" aria-label="Edit border style" className="h-7 min-w-0 w-full items-center justify-start gap-1 rounded-none border-0 bg-transparent p-0 pr-8 text-[14px] leading-none font-normal text-foreground shadow-none focus-visible:ring-0 [&>svg]:hidden">
            <SelectValue />
          </SelectTrigger>
          <SelectContent position="popper" className="rounded-[5px] p-0.5 shadow-none ring-1 ring-foreground/10">
            {borderStyleOptions.map((option) => <SelectItem key={option.value} value={option.value} className="rounded-[3px] px-2 py-1 text-[14px]">{option.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Hint content="Reset border style">
          <Button type="button" variant="ghost" size="icon-xs" className="absolute right-5 top-1/2 z-10 size-4 -translate-y-1/2 rounded bg-background p-0 text-muted-foreground opacity-0 transition-opacity hover:opacity-100 focus-visible:opacity-100" onClick={onReset} aria-label="Reset border style">
            <ArrowCounterClockwiseIcon className="size-3.5" />
          </Button>
        </Hint>
        <span className="pointer-events-none absolute right-0.5 top-1/2 z-10 flex size-4 -translate-y-1/2 items-center justify-center text-muted-foreground" aria-hidden="true">
          <CaretDownIcon className="size-3" />
        </span>
      </div>
    </div>
  );
}

function BorderGroup({ selection, onApplyStyle, onResetStyle }: { selection: SelectedElement; onApplyStyle: (property: string, value: string) => void; onResetStyle: (property: string) => void }) {
  return (
    <section className={inspectorSectionClass}>
      <h3 className={inspectorTitleClass}>Border</h3>
      <div className="space-y-1">
        <BorderStyleField value={selection.styles.borderStyle} onChange={(value) => onApplyStyle("borderStyle", value)} onReset={() => onResetStyle("borderStyle")} />
        <div className="grid grid-cols-2 gap-1">
          <SizingLayoutField label="Width" icon={<GitCommitIcon className="size-3.5" aria-hidden="true" />} name="border-width" value={selection.styles.borderWidth} fallback={1} unitOptions={borderUnits} keywordOptions={[]} onCommit={(value, unit) => onApplyStyle("borderWidth", sizingCssValue(value, unit, 1, []))} onReset={() => onResetStyle("borderWidth")} />
          <SizingLayoutField label="Radius" icon={<CornersOutIcon className="size-3.5" aria-hidden="true" />} name="border-radius" value={selection.styles.borderRadius} fallback={0} unitOptions={borderRadiusUnits} keywordOptions={[]} onCommit={(value, unit) => onApplyStyle("borderRadius", sizingCssValue(value, unit, 0, []))} onReset={() => onResetStyle("borderRadius")} />
        </div>
        <ColorField label="Color" name="border" property="borderColor" value={selection.styles.borderColor} onApplyStyle={onApplyStyle} onResetStyle={onResetStyle} />
      </div>
    </section>
  );
}

function CompactLayoutField({
  label,
  name,
  value,
  onCommit,
  onReset,
  suffix,
  wideLabel = false,
  inlineLabel,
  scrubbable = true,
}: {
  label: React.ReactNode;
  name: string;
  value: string;
  onCommit: (value: string) => void;
  onReset: () => void;
  suffix?: string;
  wideLabel?: boolean;
  inlineLabel?: boolean;
  scrubbable?: boolean;
}) {
  const isInline = inlineLabel ?? typeof label !== "string";
  const controlContents = (
    <>
      <Input id={`layout-${name}`} value={value} aria-label={`Edit ${name}`} className={`h-4 min-w-0 w-full overflow-hidden text-ellipsis whitespace-nowrap appearance-none rounded-none border-0 bg-transparent p-0 ${suffix ? "pr-7" : "pr-5"} text-[14px] leading-4 font-normal tabular-nums shadow-none focus:overflow-x-auto focus:text-clip focus-visible:ring-0 md:text-[14px]`} onChange={(event) => onCommit(event.currentTarget.value)} />
      {suffix ? <span className="-ml-1 text-[14px] leading-4 text-muted-foreground">{suffix}</span> : null}
      <Hint content={`Reset ${name}`}>
        <Button type="button" variant="ghost" size="icon-xs" className={`pointer-events-none absolute top-1/2 size-4 -translate-y-1/2 rounded bg-background p-0 text-muted-foreground opacity-0 transition-opacity group-hover:pointer-events-auto group-hover:opacity-100 focus-visible:pointer-events-auto focus-visible:opacity-100 ${suffix ? "right-5" : "right-1"}`} onClick={onReset} aria-label={`Reset ${name}`}>
          <ArrowCounterClockwiseIcon className="size-3.5" />
        </Button>
      </Hint>
    </>
  );

  if (!isInline) {
    return (
      <div className="space-y-1">
        {scrubbable === false ? <Hint content={name}><label htmlFor={`layout-${name}`} className={inspectorLabelClass}>{label}</label></Hint> : <NumericScrubLabel htmlFor={`layout-${name}`} name={name} value={value} onScrub={onCommit} className={inspectorLabelClass}>{label}</NumericScrubLabel>}
        <div className="group relative flex h-7 min-w-0 items-center rounded-[5px] border border-border bg-background px-2 shadow-none transition-colors hover:bg-muted/30 focus-within:border-border focus-within:bg-muted/25 focus-within:shadow-none focus-within:ring-1 focus-within:ring-foreground/5">
          {controlContents}
        </div>
      </div>
    );
  }

  return (
    <div className={`group relative grid h-7 min-w-0 items-center rounded-[5px] border border-border bg-background px-2 shadow-none transition-colors hover:bg-muted/30 focus-within:border-border focus-within:bg-muted/25 focus-within:shadow-none focus-within:ring-1 focus-within:ring-foreground/5 ${wideLabel ? "grid-cols-[1.75rem_minmax(0,1fr)_auto]" : "grid-cols-[0.875rem_minmax(0,1fr)_auto] gap-x-2"}`}>
      {scrubbable === false ? <Hint content={name}><label htmlFor={`layout-${name}`} className={`${wideLabel ? "text-left" : "grid size-3.5 place-items-center"} text-[14px] leading-none font-normal text-muted-foreground [&>svg]:block`}>{label}</label></Hint> : <NumericScrubLabel htmlFor={`layout-${name}`} name={name} value={value} onScrub={onCommit} className={`${wideLabel ? "text-left" : "grid size-3.5 place-items-center"} text-[14px] leading-none font-normal text-muted-foreground [&>svg]:block`}>{label}</NumericScrubLabel>}
      {controlContents}
    </div>
  );
}

function GridPlacementField({ label, name, value, onCommit, onReset }: { label: string; name: string; value: string; onCommit: (value: string) => void; onReset: () => void }) {
  const isAuto = value.trim() === "auto";
  const isNumber = /^-?(?:\d+(?:\.\d*)?|\.\d+)$/.test(value.trim());
  const selectedUnit = isAuto ? "auto" : isNumber ? "number" : "";

  function chooseUnit(unit: string) {
    if (unit === "auto") {
      onCommit("auto");
      return;
    }
    if (unit === "number" && isAuto) onCommit("1");
  }

  return (
    <DropdownMenu>
      <div className="space-y-1">
        <Hint content={label}><label htmlFor={`layout-${name}`} className={inspectorLabelClass}>{label}</label></Hint>
        <div className="group relative flex h-7 min-w-0 items-center rounded-[5px] border border-border bg-background px-2 shadow-none transition-colors hover:bg-muted/30 focus-within:border-border focus-within:bg-muted/25 focus-within:shadow-none focus-within:ring-1 focus-within:ring-foreground/5">
          <Input id={`layout-${name}`} value={value} aria-label={`Edit ${name}`} className="h-4 min-w-0 w-full overflow-hidden text-ellipsis whitespace-nowrap appearance-none rounded-none border-0 bg-transparent p-0 pr-8 text-[14px] leading-4 font-normal tabular-nums shadow-none focus:overflow-x-auto focus:text-clip focus-visible:ring-0 md:text-[14px]" onChange={(event) => onCommit(event.currentTarget.value)} />
          <Hint content={`Reset ${name}`}>
            <Button type="button" variant="ghost" size="icon-xs" className="absolute right-5 top-1/2 size-4 -translate-y-1/2 rounded bg-background p-0 text-muted-foreground opacity-0 transition-opacity hover:opacity-100 focus-visible:opacity-100" onClick={onReset} aria-label={`Reset ${name}`}>
              <ArrowCounterClockwiseIcon className="size-3.5" />
            </Button>
          </Hint>
          <Hint content={`Choose ${name} value`}>
            <DropdownMenuTrigger asChild>
              <Button type="button" variant="ghost" size="icon-xs" className="absolute right-0.5 top-1/2 size-4 -translate-y-1/2 rounded p-0 text-muted-foreground hover:bg-muted/50 hover:text-foreground focus-visible:ring-1 focus-visible:ring-foreground/10" aria-label={`Choose ${name} value`}>
                <CaretDownIcon className="size-3" />
              </Button>
            </DropdownMenuTrigger>
          </Hint>
        </div>
      </div>
      <DropdownMenuContent align="end" sideOffset={4} className="w-40 rounded-[5px] p-0.5 shadow-none ring-1 ring-foreground/10">
        <DropdownMenuLabel className="px-2 py-1 text-[11px]">Units</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={selectedUnit === "number" ? "number" : ""} onValueChange={chooseUnit}>
          <DropdownMenuRadioItem value="number" className="rounded-[3px] px-2 py-1 text-[12px]">Number</DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="px-2 py-1 text-[11px]">Placement</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={selectedUnit === "auto" ? "auto" : ""} onValueChange={chooseUnit}>
          <DropdownMenuRadioItem value="auto" className="rounded-[3px] px-2 py-1 text-[12px]">Auto</DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

const sizingUnits = [
  { value: "px", label: "Pixels" },
  { value: "%", label: "Percent" },
  { value: "rem", label: "Rem" },
  { value: "em", label: "Em" },
  { value: "vw", label: "Viewport width" },
  { value: "vh", label: "Viewport height" },
] as const;

const sizingKeywords = [
  { value: "auto", label: "Auto", inputValue: "auto" },
  { value: "-webkit-fill-available", label: "Fill", inputValue: "fill" },
  { value: "fit-content", label: "Fit", inputValue: "fit" },
  { value: "stretch", label: "Stretch", inputValue: "stretch" },
  { value: "min-content", label: "Min content", inputValue: "min" },
  { value: "max-content", label: "Max content", inputValue: "max" },
] as const;

const gapKeywords = [
  { value: "normal", label: "Normal", inputValue: "normal" },
] as const;

const zIndexUnits = [
  { value: "number", label: "Number" },
] as const;

const zIndexKeywords = [
  { value: "auto", label: "Auto", inputValue: "auto" },
] as const;

const insetKeywords = [
  { value: "auto", label: "Auto", inputValue: "auto" },
] as const;

type SizingUnit = string;
type SizingOption = { readonly value: string; readonly label: string; readonly inputValue?: string };

function parseSizingValue(value: string | undefined, fallback: number, unitOptions: readonly SizingOption[] = sizingUnits, keywordOptions: readonly SizingOption[] = sizingKeywords, defaultUnit = "px") {
  const normalized = value?.trim() || `${fallback}${defaultUnit === "number" ? "" : defaultUnit}`;
  const keyword = keywordOptions.find((option) => option.value === normalized);
  if (keyword) return { inputValue: keyword.inputValue || keyword.value, unit: keyword.value };

  const numeric = normalized.match(/^(-?(?:\d+(?:\.\d*)?|\.\d+))([a-z%]*)$/i);
  if (!numeric) return { inputValue: normalized, unit: "px" as SizingUnit };

  const unit = unitOptions.some((option) => option.value === numeric[2]) ? numeric[2] : numeric[2] === "" && defaultUnit === "number" ? "number" : "px";
  return { inputValue: numeric[1], unit };
}

function sizingCssValue(inputValue: string, unit: SizingUnit, fallback: number, keywordOptions: readonly SizingOption[] = sizingKeywords) {
  const keyword = keywordOptions.find((option) => option.value === unit);
  if (keyword) return keyword.value;
  const value = inputValue.trim() || `${fallback}`;
  if (unit === "number") return value;
  return `${value}${unit}`;
}

function SizingLayoutField({
  label,
  name,
  value,
  fallback,
  onCommit,
  onReset,
  unitOptions = sizingUnits,
  keywordOptions = sizingKeywords,
  defaultUnit = "px",
  compactLabel = false,
  inlineLabel,
  hideLabel = false,
  scrubbable = true,
  icon,
}: {
  label: React.ReactNode;
  name: string;
  value: string | undefined;
  fallback: number;
  onCommit: (inputValue: string, unit: SizingUnit) => void;
  onReset: () => void;
  unitOptions?: readonly SizingOption[];
  keywordOptions?: readonly SizingOption[];
  defaultUnit?: string;
  compactLabel?: boolean;
  inlineLabel?: boolean;
  hideLabel?: boolean;
  scrubbable?: boolean;
  icon?: React.ReactNode;
}) {
  const parsed = parseSizingValue(value, fallback, unitOptions, keywordOptions, defaultUnit);
  const selectedKeyword = keywordOptions.find((option) => option.value === parsed.unit);
  const selectedUnitLabel = selectedKeyword?.label || unitOptions.find((option) => option.value === parsed.unit)?.label || "Custom";
  const isInline = inlineLabel ?? (compactLabel || typeof label !== "string");

  function chooseUnit(unit: string) {
    const nextUnit = unit as SizingUnit;
    const keyword = keywordOptions.find((option) => option.value === nextUnit);
    const nextInputValue = keyword ? (keyword.inputValue || keyword.value) : (Number.isFinite(Number.parseFloat(parsed.inputValue)) ? parsed.inputValue : `${fallback}`);
    onCommit(nextInputValue, nextUnit);
  }

  const field = (
    <DropdownMenu>
      <div className={`group relative min-w-0 rounded-[5px] border border-border bg-background px-2 shadow-none transition-colors hover:bg-muted/30 focus-within:border-border focus-within:bg-muted/25 focus-within:shadow-none focus-within:ring-1 focus-within:ring-foreground/5 ${isInline ? `grid h-7 items-center ${compactLabel ? "grid-cols-[0.875rem_minmax(0,1fr)] gap-x-2" : "grid-cols-[1.75rem_minmax(0,1fr)]"}` : "flex h-7 items-center gap-2"}`}>
        {isInline ? (scrubbable === false ? <Hint content={String(label)}><label htmlFor={`layout-${name}`} className={`${compactLabel ? "grid size-3.5 place-items-center [&>svg]:block" : ""} text-[14px] leading-4 font-normal text-muted-foreground`}>{label}</label></Hint> : <NumericScrubLabel htmlFor={`layout-${name}`} name={name} value={parsed.inputValue} onScrub={(nextValue) => onCommit(nextValue, parsed.unit)} allowUnit className={`${compactLabel ? "grid size-3.5 place-items-center [&>svg]:block" : ""} text-[14px] leading-4 font-normal text-muted-foreground`}>{label}</NumericScrubLabel>) : icon ? <NumericScrubLabel htmlFor={`layout-${name}`} name={name} value={parsed.inputValue} onScrub={(nextValue) => onCommit(nextValue, parsed.unit)} allowUnit className="grid size-3.5 shrink-0 place-items-center text-muted-foreground [&>svg]:block">{icon}</NumericScrubLabel> : null}
        <Input
          id={`layout-${name}`}
          value={parsed.inputValue}
          aria-label={`Edit ${name}`}
          className="h-4 min-w-0 w-full overflow-hidden text-ellipsis whitespace-nowrap appearance-none rounded-none border-0 bg-transparent p-0 pr-8 text-[14px] leading-4 font-normal tabular-nums shadow-none focus:overflow-x-auto focus:text-clip focus-visible:ring-0 md:text-[14px]"
          onChange={(event) => onCommit(event.currentTarget.value, parsed.unit)}
        />
        <Hint content={`Reset ${name}`}>
          <Button type="button" variant="ghost" size="icon-xs" className="absolute right-5 top-1/2 size-4 -translate-y-1/2 rounded bg-background p-0 text-muted-foreground opacity-0 transition-opacity hover:opacity-100 focus-visible:opacity-100" onClick={onReset} aria-label={`Reset ${name}`}>
            <ArrowCounterClockwiseIcon className="size-3.5" />
          </Button>
        </Hint>
        <Hint content={`Unit: ${selectedUnitLabel}`}>
          <DropdownMenuTrigger asChild>
            <Button type="button" variant="ghost" size="icon-xs" className="absolute right-0.5 top-1/2 size-4 -translate-y-1/2 rounded p-0 text-muted-foreground hover:bg-muted/50 hover:text-foreground focus-visible:ring-1 focus-visible:ring-foreground/10" aria-label={`Choose ${name} unit`}>
              <CaretDownIcon className="size-3" />
            </Button>
          </DropdownMenuTrigger>
        </Hint>
      </div>
      <DropdownMenuContent align="end" sideOffset={4} className="w-40 rounded-[5px] p-0.5 shadow-none ring-1 ring-foreground/10">
        <DropdownMenuLabel className="px-2 py-1 text-[11px]">Units</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={parsed.unit} onValueChange={chooseUnit}>
          {unitOptions.map((option) => <DropdownMenuRadioItem key={option.value} value={option.value} className="rounded-[3px] px-2 py-1 text-[12px]">{option.label}</DropdownMenuRadioItem>)}
        </DropdownMenuRadioGroup>
        {keywordOptions.length > 0 ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="px-2 py-1 text-[11px]">Sizing</DropdownMenuLabel>
            <DropdownMenuRadioGroup value={parsed.unit} onValueChange={chooseUnit}>
              {keywordOptions.map((option) => <DropdownMenuRadioItem key={option.value} value={option.value} className="rounded-[3px] px-2 py-1 text-[12px]">{option.label}</DropdownMenuRadioItem>)}
            </DropdownMenuRadioGroup>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );

  if (!isInline && !hideLabel) {
    return (
      <div className="space-y-1">
        <Hint content={String(label)}><label htmlFor={`layout-${name}`} className={inspectorLabelClass}>{label}</label></Hint>
        {field}
      </div>
    );
  }

  return field;
}

function LayoutSelectField({
  label,
  name,
  value,
  options,
  onChange,
}: {
  label: string;
  name: string;
  value: string | undefined;
  options: readonly { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-1">
      <Hint content={name}><label className={inspectorLabelClass}>{label}</label></Hint>
      <Select value={value || options[0]?.value} onValueChange={onChange}>
        <SelectTrigger aria-label={`Edit ${name}`} className={`${inspectorFieldClass} h-7 w-full px-2 font-normal hover:bg-muted/30 focus-visible:ring-1 focus-visible:ring-foreground/5`}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent position="popper" className="rounded-[5px] p-0.5 shadow-none ring-1 ring-foreground/10">
          {options.map((option) => <SelectItem key={option.value} value={option.value} className="rounded-[3px] px-2 py-1 text-[14px]">{option.label}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );
}

function LayoutLabel({ children }: { children: React.ReactNode }) {
  return <p className={inspectorLabelClass}>{children}</p>;
}

function CompactLayoutSelectField({ label, name, value, options, onChange }: { label: React.ReactNode; name: string; value: string | undefined; options: readonly { value: string; label: string }[]; onChange: (value: string) => void }) {
  return (
    <div className="group relative grid h-7 min-w-0 grid-cols-[0.875rem_minmax(0,1fr)] items-center gap-x-2 rounded-[5px] border border-border bg-background px-2 shadow-none transition-colors hover:bg-muted/30 focus-within:border-border focus-within:bg-muted/25 focus-within:shadow-none focus-within:ring-1 focus-within:ring-foreground/5">
      <Hint content={name}><span className="grid size-3.5 place-items-center text-[14px] leading-none font-normal text-muted-foreground [&>svg]:block">{label}</span></Hint>
      <Select value={value || options[0]?.value} onValueChange={onChange}>
        <SelectTrigger size="sm" aria-label={`Edit ${name}`} className="h-7 min-w-0 w-full items-center justify-start gap-1 rounded-none border-0 bg-transparent p-0 pr-5 text-[14px] leading-none font-normal text-foreground shadow-none focus-visible:ring-0 [&>svg]:hidden">
          <SelectValue />
        </SelectTrigger>
        <SelectContent position="popper" className="rounded-[5px] p-0.5 shadow-none ring-1 ring-foreground/10">
          {options.map((option) => <SelectItem key={option.value} value={option.value} className="rounded-[3px] px-2 py-1 text-[14px]">{option.label}</SelectItem>)}
        </SelectContent>
      </Select>
      <span className="pointer-events-none absolute right-0.5 top-1/2 z-10 flex size-4 -translate-y-1/2 items-center justify-center text-muted-foreground" aria-hidden="true">
        <CaretDownIcon className="size-3" />
      </span>
    </div>
  );
}

type SpacingProperty = "marginTop" | "marginRight" | "marginBottom" | "marginLeft" | "paddingTop" | "paddingRight" | "paddingBottom" | "paddingLeft";

const spacingValuePattern = /^(-?(?:\d+(?:\.\d*)?|\.\d+))([a-z%]*)$/i;

function spacingInputValue(value: string | undefined) {
  const normalized = value?.trim() || "0px";
  return normalized.match(spacingValuePattern)?.[1] || normalized;
}

function spacingCssValue(inputValue: string, currentValue: string | undefined) {
  const value = inputValue.trim();
  if (!value) return "0px";
  const numericValue = value.match(spacingValuePattern);
  const currentUnit = currentValue?.trim().match(spacingValuePattern)?.[2] || "px";
  if (numericValue) return numericValue[2] ? value : `${value}${currentUnit}`;
  if (/^(?:auto|inherit|initial|unset|revert)$/i.test(value) || /^[a-z-]+\(.*\)$/i.test(value)) return value;
  return `${value}${currentUnit}`;
}

function SpacingField({
  property,
  label,
  value,
  className,
  onCommit,
}: {
  property: SpacingProperty;
  label: string;
  value: string | undefined;
  className: string;
  onCommit: (property: SpacingProperty, value: string, currentValue: string | undefined) => void;
}) {
  const inputValue = spacingInputValue(value);
  const scrub = useMouseScrub({
    value: inputValue,
    onScrub: (nextValue) => onCommit(property, nextValue, value),
  });

  return (
    <div
      className={`group touch-none flex min-w-0 items-center justify-center ${scrub.canScrub ? "cursor-ew-resize select-none" : ""} ${className}`}
      onMouseDown={scrub.handleMouseDown}
    >
      <Input
        id={`spacing-${property}`}
        value={inputValue}
        aria-label={`${label} ${property}`}
        className="relative z-10 h-5 w-8 cursor-text rounded-[3px] border-transparent bg-transparent px-0.5 text-center text-[11px] font-normal tabular-nums shadow-none hover:border-border hover:bg-background focus-visible:border-border focus-visible:bg-background focus-visible:ring-1 focus-visible:ring-foreground/5"
        onMouseDown={(event) => event.stopPropagation()}
        onChange={(event) => onCommit(property, event.currentTarget.value, value)}
      />
    </div>
  );
}

function SpacingGroup({
  selection,
  onApplyStyle,
}: {
  selection: SelectedElement;
  onApplyStyle: (property: string, value: string) => void;
}) {
  const [spacingLinked, setSpacingLinked] = useState(false);

  function commitSpacing(property: SpacingProperty, value: string, currentValue: string | undefined) {
    const cssValue = spacingCssValue(value, currentValue);
    onApplyStyle(property, cssValue);

    if (!spacingLinked) return;

    const pairedProperty: Partial<Record<SpacingProperty, SpacingProperty>> = {
      marginTop: "marginBottom",
      marginBottom: "marginTop",
      marginLeft: "marginRight",
      marginRight: "marginLeft",
      paddingTop: "paddingBottom",
      paddingBottom: "paddingTop",
      paddingLeft: "paddingRight",
      paddingRight: "paddingLeft",
    };
    onApplyStyle(pairedProperty[property] || property, cssValue);
  }

  return (
    <div className="space-y-1">
      <div className="flex h-4 items-center justify-between">
        <LayoutLabel>Spacing</LayoutLabel>
        <Hint content={spacingLinked ? "Unlock spacing pairs" : "Lock spacing pairs"}>
          <Button type="button" variant="ghost" size="icon-xs" className={`size-4 rounded p-0 transition-colors focus-visible:ring-1 focus-visible:ring-foreground/10 ${spacingLinked ? "bg-muted/60 text-foreground ring-1 ring-foreground/10" : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"}`} onClick={() => setSpacingLinked((current) => !current)} aria-label={spacingLinked ? "Unlock spacing pairs" : "Lock spacing pairs"} aria-pressed={spacingLinked}>
            <LinkSimpleHorizontalIcon className="size-3" />
          </Button>
        </Hint>
      </div>
      <div className="relative h-28 min-w-0 overflow-hidden rounded-[5px] border border-border bg-muted/25">
        <span className="pointer-events-none absolute left-1 top-0.5 z-20 text-[8px] uppercase leading-3 text-muted-foreground">Margin</span>
        <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          <polygon points="0,0 100,0 82,24 18,24" fill="var(--muted)" fillOpacity="0.72" stroke="var(--border)" strokeWidth="0.7" vectorEffect="non-scaling-stroke" />
          <polygon points="0,0 18,24 18,76 0,100" fill="var(--muted)" fillOpacity="0.72" stroke="var(--border)" strokeWidth="0.7" vectorEffect="non-scaling-stroke" />
          <polygon points="100,0 100,100 82,76 82,24" fill="var(--muted)" fillOpacity="0.72" stroke="var(--border)" strokeWidth="0.7" vectorEffect="non-scaling-stroke" />
          <polygon points="18,76 82,76 100,100 0,100" fill="var(--muted)" fillOpacity="0.72" stroke="var(--border)" strokeWidth="0.7" vectorEffect="non-scaling-stroke" />
          <rect x="18" y="24" width="64" height="52" fill="var(--background)" fillOpacity="0.62" stroke="var(--border)" strokeWidth="0.7" vectorEffect="non-scaling-stroke" />
          <polygon points="18,24 82,24 65.5,46 34.5,46" fill="var(--muted)" fillOpacity="0.45" stroke="var(--border)" strokeWidth="0.7" vectorEffect="non-scaling-stroke" />
          <polygon points="18,24 34.5,46 34.5,54 18,76" fill="var(--muted)" fillOpacity="0.45" stroke="var(--border)" strokeWidth="0.7" vectorEffect="non-scaling-stroke" />
          <polygon points="82,24 82,76 65.5,54 65.5,46" fill="var(--muted)" fillOpacity="0.45" stroke="var(--border)" strokeWidth="0.7" vectorEffect="non-scaling-stroke" />
          <polygon points="34.5,54 65.5,54 82,76 18,76" fill="var(--muted)" fillOpacity="0.45" stroke="var(--border)" strokeWidth="0.7" vectorEffect="non-scaling-stroke" />
          <rect x="34.5" y="46" width="31" height="8" rx="1.5" fill="var(--background)" stroke="var(--border)" strokeWidth="0.7" vectorEffect="non-scaling-stroke" />
        </svg>
        <SpacingField property="marginTop" label="Margin top" value={selection.styles.marginTop} className="absolute inset-x-0 top-0 z-10 h-6" onCommit={commitSpacing} />
        <SpacingField property="marginLeft" label="Margin left" value={selection.styles.marginLeft} className="absolute inset-y-6 left-0 z-10 w-[18%]" onCommit={commitSpacing} />
        <SpacingField property="marginRight" label="Margin right" value={selection.styles.marginRight} className="absolute inset-y-6 right-0 z-10 w-[18%]" onCommit={commitSpacing} />
        <SpacingField property="marginBottom" label="Margin bottom" value={selection.styles.marginBottom} className="absolute inset-x-0 bottom-0 z-10 h-6" onCommit={commitSpacing} />
        <span className="pointer-events-none absolute left-[calc(18%+4px)] top-[calc(24%+2px)] z-20 text-[8px] uppercase leading-3 text-muted-foreground">Padding</span>
        <SpacingField property="paddingTop" label="Padding top" value={selection.styles.paddingTop} className="absolute left-[18%] right-[18%] top-[24%] z-10 h-6" onCommit={commitSpacing} />
        <SpacingField property="paddingLeft" label="Padding left" value={selection.styles.paddingLeft} className="absolute inset-y-[46%] left-[18%] z-10 w-[16.5%]" onCommit={commitSpacing} />
        <SpacingField property="paddingRight" label="Padding right" value={selection.styles.paddingRight} className="absolute inset-y-[46%] right-[18%] z-10 w-[16.5%]" onCommit={commitSpacing} />
        <SpacingField property="paddingBottom" label="Padding bottom" value={selection.styles.paddingBottom} className="absolute left-[18%] right-[18%] bottom-[24%] z-10 h-6" onCommit={commitSpacing} />
      </div>
    </div>
  );
}

const overflowOptions = [
  { value: "visible", label: "Visible", icon: EyeIcon },
  { value: "hidden", label: "Hidden", icon: EyeSlashIcon },
  { value: "scroll", label: "Scroll", icon: MouseScrollIcon },
  { value: "auto", label: "Auto", icon: GearSixIcon },
] as const;

const positioningOptions = [
  { value: "static", label: "Static", icon: RowsIcon },
  { value: "relative", label: "Relative", icon: CrosshairSimpleIcon },
  { value: "absolute", label: "Absolute", icon: BoundingBoxIcon },
  { value: "fixed", label: "Fixed", icon: PushPinIcon },
] as const;

const boxSizingOptions = [
  { value: "content-box", label: "Content-box" },
  { value: "border-box", label: "Border-box" },
] as const;

function normalizeJustifyContent(value: string | undefined) {
  if (value === "center" || value === "flex-start" || value === "flex-end" || value === "space-between" || value === "space-around" || value === "space-evenly") return value;
  if (value === "start") return "flex-start";
  if (value === "end") return "flex-end";
  return "flex-start";
}

const layoutControlSurface = "flex h-7 overflow-hidden rounded-[5px] border border-border bg-muted/35 p-0.5 shadow-none";
const layoutControlButton = "h-full flex-1 rounded-[3px] text-muted-foreground leading-4 shadow-none transition-colors aria-pressed:bg-background aria-pressed:text-foreground aria-pressed:shadow-none aria-pressed:ring-1 aria-pressed:ring-foreground/5";

function OverflowField({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <div className="space-y-1">
      <LayoutLabel>Overflow</LayoutLabel>
      <div className={layoutControlSurface} role="group" aria-label="Overflow">
        {overflowOptions.map(({ value: optionValue, label, icon: Icon }) => (
          <Hint key={optionValue} content={label}>
            <Button type="button" variant="ghost" size="icon-xs" className={layoutControlButton} onClick={() => onChange(optionValue)} aria-label={`Overflow ${label}`} aria-pressed={value === optionValue}>
              <Icon className="size-3.5" aria-hidden="true" />
            </Button>
          </Hint>
        ))}
      </div>
    </div>
  );
}

function PositioningField({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <div className="space-y-1">
      <LayoutLabel>Positioning</LayoutLabel>
      <div className={layoutControlSurface} role="group" aria-label="Positioning">
        {positioningOptions.map(({ value: optionValue, label, icon: Icon }) => (
          <Hint key={optionValue} content={label}>
            <Button type="button" variant="ghost" size="icon-xs" className={layoutControlButton} onClick={() => onChange(optionValue)} aria-label={`Positioning ${label}`} aria-pressed={value === optionValue}>
              <Icon className="size-3.5" aria-hidden="true" />
            </Button>
          </Hint>
        ))}
      </div>
    </div>
  );
}

type TransformType = "rotate" | "scale" | "skew";

type TransformItem = {
  id: number;
  type: TransformType;
  rotation: string;
  flipHorizontal: boolean;
  flipVertical: boolean;
  scaleX: string;
  scaleY: string;
  skewX: string;
  skewY: string;
};

const transformOptions = [
  { value: "rotate", label: "Rotate" },
  { value: "scale", label: "Scale" },
  { value: "skew", label: "Skew" },
] as const;

function createTransformItem(id: number, type: TransformType = "rotate"): TransformItem {
  return {
    id,
    type,
    rotation: "0",
    flipHorizontal: false,
    flipVertical: false,
    scaleX: "1",
    scaleY: "1",
    skewX: "0",
    skewY: "0",
  };
}

function transformNumber(value: string, fallback: number) {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function transformValue(value: string, fallback: number) {
  return String(transformNumber(value, fallback));
}

function serializeTransform(item: TransformItem) {
  if (item.type === "scale") return `scale(${transformValue(item.scaleX, 1)}, ${transformValue(item.scaleY, 1)})`;
  if (item.type === "skew") return `skew(${transformNumber(item.skewX, 0)}deg, ${transformNumber(item.skewY, 0)}deg)`;

  return [
    `rotate(${transformNumber(item.rotation, 0)}deg)`,
    item.flipHorizontal ? "scaleX(-1)" : "",
    item.flipVertical ? "scaleY(-1)" : "",
  ].filter(Boolean).join(" ");
}

function serializeTransforms(transforms: TransformItem[]) {
  return transforms.length > 0 ? transforms.map(serializeTransform).join(" ") : "none";
}

function parseTransformArguments(value: string) {
  return value.split(/[,\s]+/).map((part) => part.trim()).filter(Boolean);
}

function parseTransformValue(value: string | undefined) {
  const normalized = value?.trim();
  if (!normalized || normalized === "none") return [];

  const transforms: TransformItem[] = [];
  let nextId = 1;
  const functionPattern = /([a-z]+)\(([^)]*)\)/gi;
  let match = functionPattern.exec(normalized);

  while (match) {
    const [, name, argumentString] = match;
    const args = parseTransformArguments(argumentString);

    if (name.toLowerCase() === "rotate") {
      transforms.push({ ...createTransformItem(nextId++), rotation: args[0]?.replace(/deg$/i, "") || "0" });
    } else if (name.toLowerCase() === "scale") {
      transforms.push({
        ...createTransformItem(nextId++, "scale"),
        scaleX: args[0] || "1",
        scaleY: args[1] || args[0] || "1",
      });
    } else if (name.toLowerCase() === "skew") {
      transforms.push({
        ...createTransformItem(nextId++, "skew"),
        skewX: args[0]?.replace(/deg$/i, "") || "0",
        skewY: args[1]?.replace(/deg$/i, "") || "0",
      });
    } else if (name.toLowerCase() === "scaleX" && args[0] === "-1") {
      const previousRotate = transforms.findLast((item) => item.type === "rotate");
      if (previousRotate) previousRotate.flipHorizontal = true;
    } else if (name.toLowerCase() === "scaleY" && args[0] === "-1") {
      const previousRotate = transforms.findLast((item) => item.type === "rotate");
      if (previousRotate) previousRotate.flipVertical = true;
    }

    match = functionPattern.exec(normalized);
  }

  return transforms;
}

function TransformRow({
  item,
  onTypeChange,
  onUpdate,
  onRemove,
  onReset,
}: {
  item: TransformItem;
  onTypeChange: (type: TransformType) => void;
  onUpdate: (patch: Partial<TransformItem>) => void;
  onRemove: () => void;
  onReset: () => void;
}) {
  const transformControl = item.type === "rotate" ? (
    <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_1.75rem_1.75rem] gap-1">
      <CompactLayoutField label={<AngleIcon className="size-3.5" aria-hidden="true" />} name={`rotation-${item.id}`} value={item.rotation} onCommit={(value) => onUpdate({ rotation: value })} onReset={onReset} />
      <Hint content="Flip horizontal">
        <Button type="button" variant="ghost" size="icon-xs" className="size-7 rounded-[5px] border border-border bg-muted/35 text-muted-foreground shadow-none aria-pressed:bg-background aria-pressed:text-foreground aria-pressed:shadow-none aria-pressed:ring-1 aria-pressed:ring-foreground/5" onClick={() => onUpdate({ flipHorizontal: !item.flipHorizontal })} aria-label="Flip horizontal" aria-pressed={item.flipHorizontal}><FlipHorizontalIcon className="size-3.5" /></Button>
      </Hint>
      <Hint content="Flip vertical">
        <Button type="button" variant="ghost" size="icon-xs" className="size-7 rounded-[5px] border border-border bg-muted/35 text-muted-foreground shadow-none aria-pressed:bg-background aria-pressed:text-foreground aria-pressed:shadow-none aria-pressed:ring-1 aria-pressed:ring-foreground/5" onClick={() => onUpdate({ flipVertical: !item.flipVertical })} aria-label="Flip vertical" aria-pressed={item.flipVertical}><FlipVerticalIcon className="size-3.5" /></Button>
      </Hint>
    </div>
  ) : item.type === "scale" ? (
    <div className="grid min-w-0 grid-cols-2 gap-1">
      <CompactLayoutField label="X" name={`scale-x-${item.id}`} value={item.scaleX} inlineLabel onCommit={(value) => onUpdate({ scaleX: value })} onReset={onReset} />
      <CompactLayoutField label="Y" name={`scale-y-${item.id}`} value={item.scaleY} inlineLabel onCommit={(value) => onUpdate({ scaleY: value })} onReset={onReset} />
    </div>
  ) : (
    <div className="grid min-w-0 grid-cols-2 gap-1">
      <CompactLayoutField label="X" name={`skew-x-${item.id}`} value={item.skewX} inlineLabel onCommit={(value) => onUpdate({ skewX: value })} onReset={onReset} />
      <CompactLayoutField label="Y" name={`skew-y-${item.id}`} value={item.skewY} inlineLabel onCommit={(value) => onUpdate({ skewY: value })} onReset={onReset} />
    </div>
  );

  return (
    <div className="grid min-w-0 grid-cols-[5rem_minmax(0,1fr)_1.75rem] gap-1">
      <Select value={item.type} onValueChange={(value) => onTypeChange(value as TransformType)}>
        <SelectTrigger size="sm" aria-label={`Transform ${item.id} type`} className="h-7 w-full min-w-0 !rounded-[5px] border-border bg-muted/35 px-2 py-0 text-[14px] leading-4 font-normal text-foreground shadow-none hover:bg-muted/50 focus-visible:ring-1 focus-visible:ring-foreground/5">
          <SelectValue />
        </SelectTrigger>
        <SelectContent position="popper" className="rounded-[5px] p-0.5 shadow-none ring-1 ring-foreground/10">
          {transformOptions.map((option) => <SelectItem key={option.value} value={option.value} className="rounded-[3px] px-2 py-1 text-[14px]">{option.label}</SelectItem>)}
        </SelectContent>
      </Select>
      {transformControl}
      <Hint content="Remove transform">
        <Button type="button" variant="ghost" size="icon-xs" className="size-7 rounded-[5px] border border-border bg-muted/35 text-muted-foreground shadow-none hover:bg-muted/50 hover:text-foreground focus-visible:ring-1 focus-visible:ring-foreground/5" onClick={onRemove} aria-label={`Remove ${item.type} transform`}>
          <MinusIcon className="size-3.5" />
        </Button>
      </Hint>
    </div>
  );
}

function LayoutGroup({
  selection,
  onApplyStyle,
  onResetStyle,
}: {
  selection: SelectedElement;
  onApplyStyle: (property: string, value: string) => void;
  onResetStyle: (property: string) => void;
}) {
  const [transforms, setTransforms] = useState<TransformItem[]>(() => parseTransformValue(selection.styles.transform));
  const nextTransformId = useRef(transforms.length + 1);
  const [aspectRatioLocked, setAspectRatioLocked] = useState(false);
  const [aspectRatio, setAspectRatio] = useState<number | null>(null);
  const [moreOptionsOpen, setMoreOptionsOpen] = useState(false);

  function commitTransforms(nextTransforms: TransformItem[]) {
    setTransforms(nextTransforms);
    onApplyStyle("transform", serializeTransforms(nextTransforms));
  }

  function updateTransform(id: number, patch: Partial<TransformItem>) {
    commitTransforms(transforms.map((item) => item.id === id ? { ...item, ...patch } : item));
  }

  function updateTransformType(id: number, type: TransformType) {
    updateTransform(id, { type });
  }

  function addTransform() {
    const id = nextTransformId.current++;
    setTransforms((current) => [...current, createTransformItem(id)]);
  }

  function removeTransform(id: number) {
    commitTransforms(transforms.filter((item) => item.id !== id));
  }

  function resetTransform() {
    setTransforms([]);
    onResetStyle("transform");
  }

  function toggleAspectRatio() {
    if (aspectRatioLocked) {
      setAspectRatioLocked(false);
      return;
    }

    const width = Number(selection.dimensions.width);
    const height = Number(selection.dimensions.height);
    if (width > 0 && height > 0) {
      setAspectRatio(width / height);
      setAspectRatioLocked(true);
    }
  }

  function commitSizing(property: "width" | "height" | "minWidth" | "minHeight", inputValue: string, unit: SizingUnit) {
    const fallback = property === "width" || property === "minWidth" ? selection.dimensions.width : selection.dimensions.height;
    onApplyStyle(property, sizingCssValue(inputValue, unit, fallback));

    if (!aspectRatioLocked || !aspectRatio || (property !== "width" && property !== "height")) return;

    const numericValue = Number.parseFloat(inputValue);
    if (!Number.isFinite(numericValue)) return;

    const otherProperty = property === "width" ? "height" : "width";
    const otherFallback = otherProperty === "width" ? selection.dimensions.width : selection.dimensions.height;
    const otherValue = property === "width" ? numericValue / aspectRatio : numericValue * aspectRatio;
    const otherSizing = parseSizingValue(selection.styles[otherProperty], otherFallback);
    const otherUnit = sizingUnits.some((option) => option.value === otherSizing.unit) ? otherSizing.unit : "px";
    const roundedOtherValue = Math.round(otherValue * 100) / 100;
    onApplyStyle(otherProperty, `${roundedOtherValue}${otherUnit}`);
  }

  function commitInset(property: "top" | "bottom" | "right" | "left", inputValue: string, unit: SizingUnit) {
    onApplyStyle(property, sizingCssValue(inputValue, unit, 0, insetKeywords));
  }

  const alignmentValues = ["flex-start", "center", "flex-end"] as const;
  const alignmentIcons = [
    [AlignLeft2Filled, AlignTopFilled, AlignRight2Filled],
    [AlignLeft2Filled, AlignHorizontalCenterFilled, AlignRight2Filled],
    [AlignLeft2Filled, AlignBottomFilled, AlignRight2Filled],
  ] as const;
  const normalizedAlignItems = selection.styles.alignItems === "start" ? "flex-start" : selection.styles.alignItems === "end" ? "flex-end" : selection.styles.alignItems;
  const alignIndex = Math.max(0, alignmentValues.indexOf(normalizedAlignItems as typeof alignmentValues[number]));
  const justifyContent = normalizeJustifyContent(selection.styles.justifyContent);
  const justifyIndex = Math.max(0, alignmentValues.indexOf(justifyContent as typeof alignmentValues[number]));
  const positionMode = selection.styles.position || "static";
  const isFlexContainer = selection.styles.display === "flex" || selection.styles.display === "inline-flex";
  const isFlexItem = selection.parentLayout?.display === "flex" || selection.parentLayout?.display === "inline-flex";
  const isGridContainer = selection.styles.display === "grid" || selection.styles.display === "inline-grid";
  const isGridItem = selection.parentLayout?.display === "grid" || selection.parentLayout?.display === "inline-grid";
  const isColumnFlex = isFlexContainer && (selection.styles.flexDirection === "column" || selection.styles.flexDirection === "column-reverse");
  const quickAlignActive = alignmentValues.includes(normalizedAlignItems as typeof alignmentValues[number]) && alignmentValues.includes(justifyContent as typeof alignmentValues[number]);
  const alignItemsValue = normalizedAlignItems || "normal";
  const alignContentValue = selection.styles.alignContent || "normal";

  function applyAlignment(row: number, column: number) {
    if (isColumnFlex) {
      onApplyStyle("alignItems", alignmentValues[column]);
      onApplyStyle("justifyContent", alignmentValues[row]);
      return;
    }
    onApplyStyle("alignItems", alignmentValues[row]);
    onApplyStyle("justifyContent", alignmentValues[column]);
  }

  return (
    <section className={inspectorSectionClass}>
      <div className="mb-2">
        <h3 className={inspectorHeadingClass}>Layout</h3>
      </div>
      <div className="space-y-2">
        <div className="space-y-1">
          <LayoutLabel>Position</LayoutLabel>
          <div className="grid grid-cols-2 gap-1">
            <CompactLayoutField label="X" name="x" value={`${selection.dimensions.x}`} inlineLabel onCommit={(value) => onApplyStyle("x", value)} onReset={() => onResetStyle("x")} />
            <CompactLayoutField label="Y" name="y" value={`${selection.dimensions.y}`} inlineLabel onCommit={(value) => onApplyStyle("y", value)} onReset={() => onResetStyle("y")} />
          </div>
        </div>

        <div className="space-y-1">
          <div className="flex h-4 items-center justify-between">
            <LayoutLabel>Size</LayoutLabel>
            <Hint content={aspectRatioLocked ? "Unlock aspect ratio" : "Lock aspect ratio"}>
              <Button type="button" variant="ghost" size="icon-xs" className={`size-4 rounded p-0 transition-colors focus-visible:ring-1 focus-visible:ring-foreground/10 ${aspectRatioLocked ? "bg-muted/60 text-foreground ring-1 ring-foreground/10" : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"}`} onClick={toggleAspectRatio} aria-label={aspectRatioLocked ? "Unlock aspect ratio" : "Lock aspect ratio"} aria-pressed={aspectRatioLocked}>
                <LinkSimpleHorizontalIcon className="size-3" />
              </Button>
            </Hint>
          </div>
          <div className="grid grid-cols-2 gap-1 items-center">
            <SizingLayoutField label="W" name="width" value={selection.styles.width} fallback={selection.dimensions.width} inlineLabel onCommit={(value, unit) => commitSizing("width", value, unit)} onReset={() => onResetStyle("width")} />
            <SizingLayoutField label="H" name="height" value={selection.styles.height} fallback={selection.dimensions.height} inlineLabel onCommit={(value, unit) => commitSizing("height", value, unit)} onReset={() => onResetStyle("height")} />
          </div>
          <div className="grid grid-cols-2 gap-1">
            <SizingLayoutField label={<ArrowLineRightIcon className="size-3.5" aria-hidden="true" />} name="min-width" value={selection.styles.minWidth} fallback={0} inlineLabel onCommit={(value, unit) => commitSizing("minWidth", value, unit)} onReset={() => onResetStyle("minWidth")} />
            <SizingLayoutField label={<ArrowLineUpIcon className="size-3.5" aria-hidden="true" />} name="min-height" value={selection.styles.minHeight} fallback={0} inlineLabel onCommit={(value, unit) => commitSizing("minHeight", value, unit)} onReset={() => onResetStyle("minHeight")} />
          </div>
        </div>

        <SpacingGroup selection={selection} onApplyStyle={onApplyStyle} />

        <div className="space-y-1">
          <LayoutLabel>Display</LayoutLabel>
          <div className={layoutControlSurface} role="group" aria-label="Display">
            {[["block", SquareIcon], ["flex", DotsNineIcon], ["grid", GridFourIcon], ["none", EyeSlashIcon]].map(([value, Icon]) => (
              <Hint key={value as string} content={`Display ${value}`}>
                <Button key={value as string} type="button" variant="ghost" size="icon-xs" className={layoutControlButton} onClick={() => onApplyStyle("display", value as string)} aria-label={`Display ${value}`} aria-pressed={selection.styles.display === value}><Icon className="size-3.5" /></Button>
              </Hint>
            ))}
          </div>
        </div>

        {isFlexContainer || (isFlexItem && moreOptionsOpen) ? (
          <div className="mt-2 space-y-2 pt-2">
            {isFlexContainer ? (
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-1">
                  <div className="space-y-1">
                    <LayoutLabel>Flex direction</LayoutLabel>
                    <div className={layoutControlSurface} role="group" aria-label="Flex direction">
                      <Hint content="Row">
                        <Button type="button" variant="ghost" size="icon-xs" className={layoutControlButton} onClick={() => onApplyStyle("flexDirection", "row")} aria-label="Flex direction row" aria-pressed={selection.styles.flexDirection === "row"}><ColumnsIcon className="size-3.5" /></Button>
                      </Hint>
                      <Hint content="Column">
                        <Button type="button" variant="ghost" size="icon-xs" className={layoutControlButton} onClick={() => onApplyStyle("flexDirection", "column")} aria-label="Flex direction column" aria-pressed={selection.styles.flexDirection === "column"}><RowsIcon className="size-3.5" /></Button>
                      </Hint>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <LayoutLabel>Flex wrap</LayoutLabel>
                    <div className={layoutControlSurface} role="group" aria-label="Flex wrap">
                      <Hint content="No wrap">
                        <Button type="button" variant="ghost" size="icon-xs" className={layoutControlButton} onClick={() => onApplyStyle("flexWrap", "nowrap")} aria-label="Flex no wrap" aria-pressed={selection.styles.flexWrap !== "wrap"}><ArrowsOutLineHorizontalIcon className="size-3.5" /></Button>
                      </Hint>
                      <Hint content="Wrap">
                        <Button type="button" variant="ghost" size="icon-xs" className={layoutControlButton} onClick={() => onApplyStyle("flexWrap", "wrap")} aria-label="Flex wrap" aria-pressed={selection.styles.flexWrap === "wrap"}><ArrowElbowDownLeftIcon className="size-3.5" /></Button>
                      </Hint>
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 items-stretch gap-1">
                  <div className="flex min-h-0 flex-col gap-1">
                    <LayoutLabel>Alignment</LayoutLabel>
                    <div className="grid min-h-0 flex-1 w-full grid-cols-3 gap-0.5 rounded-[5px] border border-border bg-muted/35 p-0.5" role="group" aria-label="Alignment">
                      {alignmentValues.flatMap((alignValue, row) => alignmentIcons[row].map((AlignmentIcon, column) => {
                        const justifyValue = alignmentValues[column];
                        const selected = quickAlignActive && (isColumnFlex ? row === justifyIndex && column === alignIndex : row === alignIndex && column === justifyIndex);
                        return (
                          <Button key={`${alignValue}-${justifyValue}`} type="button" variant="ghost" size="icon-xs" className="h-full min-h-[30px] w-full rounded-[3px] text-muted-foreground shadow-none hover:bg-transparent" onClick={() => applyAlignment(row, column)} aria-label={`Alignment ${alignValue}, justify ${justifyValue}`} aria-pressed={selected}>
                            {selected ? <AlignmentIcon className="size-3.5" aria-hidden="true" /> : <DotIcon className="size-3.5" aria-hidden="true" />}
                          </Button>
                        );
                      }))}
                    </div>
                  </div>
                  <div className="space-y-2 pt-5">
                    <CompactLayoutSelectField label={<AlignCenterVerticalSimpleIcon className="size-3.5" aria-hidden="true" />} name="justify-content" value={justifyContent} options={[
                      { value: "flex-start", label: "Flex start" },
                      { value: "flex-end", label: "Flex end" },
                      { value: "center", label: "Center" },
                      { value: "space-between", label: "Space between" },
                      { value: "space-around", label: "Space around" },
                      { value: "space-evenly", label: "Space evenly" },
                    ]} onChange={(value) => onApplyStyle("justifyContent", value)} />
                    <CompactLayoutSelectField label={<AlignCenterHorizontalSimpleIcon className="size-3.5" aria-hidden="true" />} name="align-items" value={alignItemsValue} options={[
                      { value: "normal", label: "Normal" },
                      { value: "stretch", label: "Stretch" },
                      { value: "flex-start", label: "Flex start" },
                      { value: "flex-end", label: "Flex end" },
                      { value: "center", label: "Center" },
                      { value: "baseline", label: "Baseline" },
                    ]} onChange={(value) => onApplyStyle("alignItems", value)} />
                    <CompactLayoutSelectField label={<AlignCenterVerticalIcon className="size-3.5" aria-hidden="true" />} name="align-content" value={alignContentValue} options={[
                      { value: "stretch", label: "Stretch" },
                      { value: "normal", label: "Normal" },
                      { value: "flex-start", label: "Flex start" },
                      { value: "flex-end", label: "Flex end" },
                      { value: "center", label: "Center" },
                      { value: "space-between", label: "Space between" },
                      { value: "space-around", label: "Space around" },
                      { value: "space-evenly", label: "Space evenly" },
                    ]} onChange={(value) => onApplyStyle("alignContent", value)} />
                    <SizingLayoutField label="Gap" icon={<SplitHorizontalIcon className="size-3.5" aria-hidden="true" />} hideLabel name="gap" value={selection.styles.gap} fallback={0} keywordOptions={gapKeywords} onCommit={(value, unit) => onApplyStyle("gap", sizingCssValue(value, unit, 0, gapKeywords))} onReset={() => onResetStyle("gap")} />
                  </div>
                </div>
              </div>
            ) : null}
            {isFlexItem && moreOptionsOpen ? (
              <div className="space-y-1">
                <div className="grid grid-cols-2 gap-1">
                  <CompactLayoutField label="Grow" name="flex-grow" value={selection.styles.flexGrow} scrubbable={false} onCommit={(value) => onApplyStyle("flexGrow", value)} onReset={() => onResetStyle("flexGrow")} />
                  <CompactLayoutField label="Shrink" name="flex-shrink" value={selection.styles.flexShrink} scrubbable={false} onCommit={(value) => onApplyStyle("flexShrink", value)} onReset={() => onResetStyle("flexShrink")} />
                  <SizingLayoutField label="Basis" name="flex-basis" value={selection.styles.flexBasis} fallback={0} scrubbable={false} onCommit={(value, unit) => onApplyStyle("flexBasis", sizingCssValue(value, unit, 0))} onReset={() => onResetStyle("flexBasis")} />
                  <CompactLayoutField label="Order" name="order" value={selection.styles.order} scrubbable={false} onCommit={(value) => onApplyStyle("order", value)} onReset={() => onResetStyle("order")} />
                </div>
                <LayoutSelectField label="Align self" name="align-self" value={selection.styles.alignSelf} options={[
                  { value: "auto", label: "Auto" },
                  { value: "flex-start", label: "Flex start" },
                  { value: "flex-end", label: "Flex end" },
                  { value: "center", label: "Center" },
                  { value: "baseline", label: "Baseline" },
                  { value: "stretch", label: "Stretch" },
                ]} onChange={(value) => onApplyStyle("alignSelf", value)} />
              </div>
            ) : null}
          </div>
        ) : null}
        {(isGridContainer || isGridItem) && moreOptionsOpen ? (
          <div className="mt-2 space-y-2 pt-2">
            {isGridContainer ? (
              <div className="space-y-1">
                <div className="grid grid-cols-2 gap-1">
                  <CompactLayoutField label="Columns" name="grid-template-columns" value={selection.styles.gridTemplateColumns} onCommit={(value) => onApplyStyle("gridTemplateColumns", value)} onReset={() => onResetStyle("gridTemplateColumns")} />
                  <CompactLayoutField label="Rows" name="grid-template-rows" value={selection.styles.gridTemplateRows} onCommit={(value) => onApplyStyle("gridTemplateRows", value)} onReset={() => onResetStyle("gridTemplateRows")} />
                  <SizingLayoutField label="Row gap" icon={<SplitHorizontalIcon className="size-3.5" aria-hidden="true" />} name="row-gap" value={selection.styles.rowGap} fallback={0} keywordOptions={[]} onCommit={(value, unit) => onApplyStyle("rowGap", sizingCssValue(value, unit, 0, []))} onReset={() => onResetStyle("rowGap")} />
                  <SizingLayoutField label="Column gap" icon={<SplitVerticalIcon className="size-3.5" aria-hidden="true" />} name="column-gap" value={selection.styles.columnGap} fallback={0} keywordOptions={[]} onCommit={(value, unit) => onApplyStyle("columnGap", sizingCssValue(value, unit, 0, []))} onReset={() => onResetStyle("columnGap")} />
                </div>
                <LayoutSelectField label="Auto placement" name="grid-auto-flow" value={selection.styles.gridAutoFlow} options={[
                  { value: "row", label: "Row" },
                  { value: "column", label: "Column" },
                  { value: "dense", label: "Dense" },
                  { value: "row dense", label: "Row dense" },
                  { value: "column dense", label: "Column dense" },
                ]} onChange={(value) => onApplyStyle("gridAutoFlow", value)} />
              </div>
            ) : null}
      {isGridItem && moreOptionsOpen ? (
        <div className="space-y-1">
                <div className="grid grid-cols-2 gap-1">
                  <GridPlacementField label="Column start" name="grid-column-start" value={selection.styles.gridColumnStart} onCommit={(value) => onApplyStyle("gridColumnStart", value)} onReset={() => onResetStyle("gridColumnStart")} />
                  <GridPlacementField label="Column end" name="grid-column-end" value={selection.styles.gridColumnEnd} onCommit={(value) => onApplyStyle("gridColumnEnd", value)} onReset={() => onResetStyle("gridColumnEnd")} />
                  <GridPlacementField label="Row start" name="grid-row-start" value={selection.styles.gridRowStart} onCommit={(value) => onApplyStyle("gridRowStart", value)} onReset={() => onResetStyle("gridRowStart")} />
                  <GridPlacementField label="Row end" name="grid-row-end" value={selection.styles.gridRowEnd} onCommit={(value) => onApplyStyle("gridRowEnd", value)} onReset={() => onResetStyle("gridRowEnd")} />
                </div>
                <LayoutSelectField label="Justify self" name="justify-self" value={selection.styles.justifySelf} options={[
                  { value: "auto", label: "Auto" },
                  { value: "start", label: "Start" },
                  { value: "end", label: "End" },
                  { value: "center", label: "Center" },
                  { value: "stretch", label: "Stretch" },
                ]} onChange={(value) => onApplyStyle("justifySelf", value)} />
                <LayoutSelectField label="Align self" name="align-self" value={selection.styles.alignSelf} options={[
                  { value: "auto", label: "Auto" },
                  { value: "start", label: "Start" },
                  { value: "end", label: "End" },
                  { value: "center", label: "Center" },
                  { value: "stretch", label: "Stretch" },
                ]} onChange={(value) => onApplyStyle("alignSelf", value)} />
              </div>
            ) : null}
          </div>
        ) : null}
        {!moreOptionsOpen ? (
          <Button type="button" variant="outline" className="h-7 w-full rounded-[5px] px-2 text-[13px] font-normal shadow-none hover:bg-muted/30 focus-visible:ring-1 focus-visible:ring-foreground/5" onClick={() => setMoreOptionsOpen(true)}>
            More options
          </Button>
        ) : null}
        <div className="space-y-2">
          {moreOptionsOpen ? (
            <LayoutSelectField label="Box sizing" name="box-sizing" value={selection.styles.boxSizing} options={boxSizingOptions} onChange={(value) => onApplyStyle("boxSizing", value)} />
          ) : null}
          <div className="space-y-1">
          <PositioningField value={positionMode} onChange={(value) => onApplyStyle("position", value)} />
          {positionMode !== "static" ? (
            <div className="space-y-1 pt-1">
              <LayoutLabel>Inset</LayoutLabel>
              <div className="grid grid-cols-2 gap-1">
                <SizingLayoutField label={<ArrowLineUpIcon className="size-3.5" aria-hidden="true" />} name="top" value={selection.styles.top} fallback={0} keywordOptions={insetKeywords} inlineLabel onCommit={(value, unit) => commitInset("top", value, unit)} onReset={() => onResetStyle("top")} />
                <SizingLayoutField label={<ArrowLineDownIcon className="size-3.5" aria-hidden="true" />} name="bottom" value={selection.styles.bottom} fallback={0} keywordOptions={insetKeywords} inlineLabel onCommit={(value, unit) => commitInset("bottom", value, unit)} onReset={() => onResetStyle("bottom")} />
                <SizingLayoutField label={<ArrowLineRightIcon className="size-3.5" aria-hidden="true" />} name="right" value={selection.styles.right} fallback={0} keywordOptions={insetKeywords} inlineLabel onCommit={(value, unit) => commitInset("right", value, unit)} onReset={() => onResetStyle("right")} />
                <SizingLayoutField label={<ArrowLineLeftIcon className="size-3.5" aria-hidden="true" />} name="left" value={selection.styles.left} fallback={0} keywordOptions={insetKeywords} inlineLabel onCommit={(value, unit) => commitInset("left", value, unit)} onReset={() => onResetStyle("left")} />
              </div>
            </div>
          ) : null}
          </div>
          <div className="grid grid-cols-2 items-end gap-1">
            <SizingLayoutField label="Z-index" icon={<StackSimpleIcon className="size-3.5" aria-hidden="true" />} name="z-index" value={selection.styles.zIndex} fallback={0} unitOptions={zIndexUnits} keywordOptions={zIndexKeywords} defaultUnit="number" onCommit={(value, unit) => onApplyStyle("zIndex", sizingCssValue(value, unit, 0, zIndexKeywords))} onReset={() => onResetStyle("zIndex")} />
            <OverflowField value={selection.styles.overflow || "visible"} onChange={(value) => onApplyStyle("overflow", value)} />
          </div>
          <div className="space-y-1">
          <div className="flex h-4 items-center justify-between">
            <LayoutLabel>Transform</LayoutLabel>
            <Hint content="Add transform">
              <Button type="button" variant="ghost" size="icon-xs" className="size-4 rounded p-0 text-muted-foreground hover:bg-muted/50 hover:text-foreground focus-visible:ring-1 focus-visible:ring-foreground/10" onClick={addTransform} aria-label="Add transform">
                <PlusIcon className="size-3" />
              </Button>
            </Hint>
          </div>
          <div className="space-y-1">
            {transforms.map((item) => (
              <TransformRow
                key={item.id}
                item={item}
                onTypeChange={(type) => updateTransformType(item.id, type)}
                onUpdate={(patch) => updateTransform(item.id, patch)}
                onRemove={() => removeTransform(item.id)}
                onReset={resetTransform}
              />
            ))}
          </div>
          </div>
        </div>
      </div>
    </section>
  );
}

type BuildIndicator = "up-to-date" | "due" | "unavailable" | "checking";

function getBuildIndicator(codexAvailability: CodexAvailability, hasPendingChanges: boolean): BuildIndicator {
  if (codexAvailability.state === "unavailable") return "unavailable";
  if (codexAvailability.state === "checking") return "checking";
  return hasPendingChanges ? "due" : "up-to-date";
}

function buildIndicatorClass(indicator: BuildIndicator) {
  if (indicator === "unavailable") return "bg-red-500";
  if (indicator === "checking" || indicator === "due") return "bg-amber-500";
  return "bg-emerald-500";
}

function buildIndicatorLabel(indicator: BuildIndicator) {
  if (indicator === "unavailable") return "Codex is unavailable; you cannot build";
  if (indicator === "checking") return "Checking whether Codex is available";
  if (indicator === "due") return "Build is due";
  return "Build is up to date";
}

function getLayerIcon(tagName: string): Icon {
  switch (tagName.toLowerCase()) {
    case "div":
      return FrameCornersIcon;
    case "aside":
      return SidebarIcon;
    case "nav":
      return CompassIcon;
    case "header":
      return RowsIcon;
    case "main":
      return BrowserIcon;
    case "section":
      return StackIcon;
    case "footer":
      return AlignBottomIcon;
    case "button":
      return RectangleIcon;
    case "form":
      return ClipboardTextIcon;
    case "input":
    case "textarea":
      return TextboxIcon;
    case "h1":
    case "h2":
    case "h3":
    case "h4":
    case "h5":
    case "h6":
      return TextHIcon;
    case "p":
      return ParagraphIcon;
    case "a":
      return LinkSimpleIcon;
    case "img":
      return ImageIcon;
    case "video":
      return VideoCameraIcon;
    case "ul":
      return ListBulletsIcon;
    case "ol":
      return ListNumbersIcon;
    case "li":
      return ListDashesIcon;
    case "table":
      return TableIcon;
    case "tr":
      return RowsIcon;
    case "td":
    case "th":
      return ColumnsIcon;
    case "svg":
      return ShapesIcon;
    case "path":
      return PathIcon;
    case "rect":
      return SquareIcon;
    case "circle":
      return CircleIcon;
    case "span":
      return TextHIcon;
    default:
      return FrameCornersIcon;
  }
}

function LayerIcon({ tagName }: { tagName: string }) {
  return createElement(getLayerIcon(tagName), {
    "aria-hidden": true,
    className: "size-3.5 shrink-0 text-muted-foreground",
  });
}

function collectExpandableLayerIds(nodes: LayerNode[], ids = new Set<string>()) {
  for (const node of nodes) {
    if (node.children.length > 0) ids.add(node.selectionId);
    collectExpandableLayerIds(node.children, ids);
  }
  return ids;
}

function findLayerAncestorIds(nodes: LayerNode[], targetId: string, ancestors = new Set<string>()): Set<string> | null {
  for (const node of nodes) {
    if (node.selectionId === targetId) return ancestors;

    if (node.children.length > 0) {
      const nextAncestors = new Set(ancestors);
      nextAncestors.add(node.selectionId);
      const result = findLayerAncestorIds(node.children, targetId, nextAncestors);
      if (result) return result;
    }
  }

  return null;
}

function LayerRow({
  node,
  depth,
  parentId,
  nextSiblingId,
  selectedId,
  collapsedIds,
  draggedId,
  dropTarget,
  onToggle,
  onSelect,
  onHighlight,
  onClearHighlight,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
}: {
  node: LayerNode;
  depth: number;
  parentId: string | null;
  nextSiblingId: string | null;
  selectedId: string | null;
  collapsedIds: Set<string>;
  draggedId: string | null;
  dropTarget: LayerDropTarget | null;
  onToggle: (selectionId: string) => void;
  onSelect: (selectionId: string) => void;
  onHighlight: (selectionId: string) => void;
  onClearHighlight: () => void;
  onDragStart: (event: ReactDragEvent<HTMLButtonElement>, selectionId: string) => void;
  onDragOver: (event: ReactDragEvent<HTMLDivElement>, node: LayerNode, parentId: string | null, nextSiblingId: string | null) => void;
  onDrop: (event: ReactDragEvent<HTMLDivElement>, node: LayerNode, parentId: string | null, nextSiblingId: string | null) => void;
  onDragEnd: () => void;
}) {
  const hasChildren = node.children.length > 0;
  const collapsed = collapsedIds.has(node.selectionId);
  const selected = selectedId === node.selectionId;
  const isInsideTarget = dropTarget?.type === "inside" && dropTarget.selectionId === node.selectionId;
  const isBeforeTarget = dropTarget?.type === "before" && dropTarget.selectionId === node.selectionId;
  const isAfterTarget = dropTarget?.type === "after" && dropTarget.selectionId === node.selectionId;
  const rowRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (selected) rowRef.current?.scrollIntoView({ block: "nearest" });
  }, [selected]);

  return (
    <div ref={rowRef}>
      {isBeforeTarget ? <div className="h-0.5 rounded-full bg-foreground" style={{ marginLeft: `${depth * 12 + 26}px` }} /> : null}
      <div
        className={`group flex min-w-0 items-center gap-0.5 rounded-[5px] ${selected ? "bg-accent text-accent-foreground" : "hover:bg-muted/40"} ${isInsideTarget ? "ring-1 ring-foreground/30" : ""} ${draggedId === node.selectionId ? "opacity-40" : ""}`}
        style={{ paddingLeft: `${depth * 12 + 2}px` }}
        onMouseEnter={() => onHighlight(node.selectionId)}
        onMouseLeave={onClearHighlight}
        onDragOver={(event) => onDragOver(event, node, parentId, nextSiblingId)}
        onDrop={(event) => onDrop(event, node, parentId, nextSiblingId)}
      >
        <button
          type="button"
          className={`flex size-5 shrink-0 items-center justify-center rounded-[3px] text-muted-foreground ${hasChildren ? "hover:bg-background/80 hover:text-foreground" : "invisible"}`}
          onClick={() => {
            if (hasChildren) onToggle(node.selectionId);
          }}
          aria-label={collapsed ? `Expand ${node.name}` : `Collapse ${node.name}`}
          tabIndex={hasChildren ? 0 : -1}
        >
          {collapsed ? <CaretRightIcon className="size-3" /> : <CaretDownIcon className="size-3" />}
        </button>
        <button
          type="button"
          draggable
          className="flex min-w-0 flex-1 cursor-default items-center gap-1.5 rounded-[3px] px-1.5 py-1 text-left text-[12px] leading-4 outline-none focus-visible:ring-1 focus-visible:ring-ring"
          onClick={() => onSelect(node.selectionId)}
          onDragStart={(event) => onDragStart(event, node.selectionId)}
           onDragEnd={onDragEnd}
           aria-current={selected ? "true" : undefined}
           aria-label={`${node.tagName.toLowerCase()} ${node.name}`}
         >
          <LayerIcon tagName={node.tagName} />
          <span className="min-w-0 truncate font-normal">{node.name}</span>
          {node.detail ? <span className="min-w-0 truncate text-muted-foreground">{node.detail}</span> : null}
        </button>
      </div>
      {hasChildren && !collapsed ? (
        <div>
          {node.children.map((child, index) => (
            <LayerRow
              key={child.selectionId}
              node={child}
              depth={depth + 1}
              parentId={node.selectionId}
              nextSiblingId={node.children[index + 1]?.selectionId || null}
              selectedId={selectedId}
              collapsedIds={collapsedIds}
              draggedId={draggedId}
              dropTarget={dropTarget}
              onToggle={onToggle}
              onSelect={onSelect}
              onHighlight={onHighlight}
              onClearHighlight={onClearHighlight}
              onDragStart={onDragStart}
              onDragOver={onDragOver}
              onDrop={onDrop}
              onDragEnd={onDragEnd}
            />
          ))}
        </div>
      ) : null}
      {isAfterTarget ? <div className="h-0.5 rounded-full bg-foreground" style={{ marginLeft: `${depth * 12 + 26}px` }} /> : null}
    </div>
  );
}

function LayerPanel({
  className,
  canvasUrl,
  layerTree,
  selection,
  onSelectLayer,
  onHighlightLayer,
  onClearLayerHighlight,
  onMoveLayer,
}: {
  className?: string;
  canvasUrl: string | null;
  layerTree: LayerNode[];
  selection: SelectedElement | null;
  onSelectLayer: (selectionId: string) => void;
  onHighlightLayer: (selectionId: string) => void;
  onClearLayerHighlight: () => void;
  onMoveLayer: (payload: { sourceSelectionId: string; targetParentId: string | null; beforeSelectionId: string | null }) => void;
}) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set());
  const [collapsedBySelection, setCollapsedBySelection] = useState<{ selectionId: string | null; ids: Set<string> }>(() => ({ selectionId: null, ids: new Set() }));
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<LayerDropTarget | null>(null);
  const selectedId = selection?.selectionId || null;
  const selectedAncestorIds = selectedId ? findLayerAncestorIds(layerTree, selectedId) : null;
  const selectedCollapsedIds = collapsedBySelection.selectionId === selectedId ? collapsedBySelection.ids : new Set<string>();
  const visibleExpandedIds = new Set(expandedIds);
  for (const selectionId of selectedAncestorIds || []) {
    if (!selectedCollapsedIds.has(selectionId)) visibleExpandedIds.add(selectionId);
  }
  for (const selectionId of selectedCollapsedIds) visibleExpandedIds.delete(selectionId);
  const collapsedIds = collectExpandableLayerIds(layerTree);
  for (const selectionId of visibleExpandedIds) collapsedIds.delete(selectionId);

  function toggleLayer(selectionId: string) {
    const isSelectedAncestor = selectedAncestorIds?.has(selectionId) || false;
    if (isSelectedAncestor) {
      setCollapsedBySelection((current) => {
        const next = new Set(current.selectionId === selectedId ? current.ids : []);
        if (visibleExpandedIds.has(selectionId)) next.add(selectionId);
        else next.delete(selectionId);
        return { selectionId: selectedId, ids: next };
      });
      return;
    }

    setExpandedIds((current) => {
      const next = new Set(current);
      if (next.has(selectionId)) next.delete(selectionId);
      else next.add(selectionId);
      return next;
    });
  }

  function expandAllLayers() {
    setExpandedIds(collectExpandableLayerIds(layerTree));
    setCollapsedBySelection({ selectionId: selectedId, ids: new Set() });
  }

  function collapseAllLayers() {
    setExpandedIds(new Set());
    setCollapsedBySelection({ selectionId: selectedId, ids: new Set(selectedAncestorIds || []) });
  }

  function getDropTarget(event: ReactDragEvent<HTMLDivElement>, node: LayerNode, parentId: string | null, nextSiblingId: string | null): LayerDropTarget | null {
    if (!draggedId || draggedId === node.selectionId) return null;

    const bounds = event.currentTarget.getBoundingClientRect();
    const relativeY = bounds.height > 0 ? (event.clientY - bounds.top) / bounds.height : 0.5;
    if (relativeY < 0.25) return { type: "before", selectionId: node.selectionId, parentId, beforeSelectionId: node.selectionId };
    if (relativeY > 0.75) return { type: "after", selectionId: node.selectionId, parentId, beforeSelectionId: nextSiblingId };
    return { type: "inside", selectionId: node.selectionId, parentId: node.selectionId, beforeSelectionId: null };
  }

  function handleDragStart(event: ReactDragEvent<HTMLButtonElement>, selectionId: string) {
    setDraggedId(selectionId);
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", selectionId);
  }

  function handleDragOver(event: ReactDragEvent<HTMLDivElement>, node: LayerNode, parentId: string | null, nextSiblingId: string | null) {
    const target = getDropTarget(event, node, parentId, nextSiblingId);
    if (!target) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    setDropTarget(target);
  }

  function handleDrop(event: ReactDragEvent<HTMLDivElement>, node: LayerNode, parentId: string | null, nextSiblingId: string | null) {
    event.preventDefault();
    const target = getDropTarget(event, node, parentId, nextSiblingId);
    if (draggedId && target) {
      onMoveLayer({
        sourceSelectionId: draggedId,
        targetParentId: target.parentId,
        beforeSelectionId: target.beforeSelectionId,
      });
    }
    setDraggedId(null);
    setDropTarget(null);
  }

  function handleDragEnd() {
    setDraggedId(null);
    setDropTarget(null);
  }

  function handleRootDragOver(event: ReactDragEvent<HTMLDivElement>) {
    if (!draggedId) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    setDropTarget({ type: "inside", selectionId: null, parentId: null, beforeSelectionId: null });
  }

  function handleRootDrop(event: ReactDragEvent<HTMLDivElement>) {
    event.preventDefault();
    if (draggedId) onMoveLayer({ sourceSelectionId: draggedId, targetParentId: null, beforeSelectionId: null });
    handleDragEnd();
  }

  return (
    <aside className={`flex h-full w-64 shrink-0 flex-col border-r border-border bg-white text-foreground ${className || ""}`}>
      <div className="scrollbar-hidden min-h-0 flex-1 overflow-y-auto px-1.5 py-2">
        <div className="flex items-center gap-2 px-1.5 pb-2">
          <h2 className={`${inspectorHeadingClass} min-w-0 flex-1`}>Layers</h2>
          <Hint content="Expand all layers">
            <Button type="button" variant="ghost" size="icon-xs" className="size-4 shrink-0 rounded p-0 text-muted-foreground hover:bg-muted/50 hover:text-foreground focus-visible:ring-1 focus-visible:ring-foreground/10" onClick={expandAllLayers} disabled={!canvasUrl || layerTree.length === 0} aria-label="Expand all layers">
              <ArrowsOutLineVerticalIcon className="size-3" />
            </Button>
          </Hint>
          <Hint content="Collapse all layers">
            <Button type="button" variant="ghost" size="icon-xs" className="size-4 shrink-0 rounded p-0 text-muted-foreground hover:bg-muted/50 hover:text-foreground focus-visible:ring-1 focus-visible:ring-foreground/10" onClick={collapseAllLayers} disabled={!canvasUrl || layerTree.length === 0} aria-label="Collapse all layers">
              <ArrowsInLineVerticalIcon className="size-3" />
            </Button>
          </Hint>
        </div>
        {canvasUrl && layerTree.length > 0 ? (
          <>
            {layerTree.map((node, index) => (
              <LayerRow
                key={node.selectionId}
                node={node}
                depth={0}
                parentId={null}
                nextSiblingId={layerTree[index + 1]?.selectionId || null}
                selectedId={selection?.selectionId || null}
                collapsedIds={collapsedIds}
                draggedId={draggedId}
                dropTarget={dropTarget}
                onToggle={toggleLayer}
                onSelect={onSelectLayer}
                onHighlight={onHighlightLayer}
                onClearHighlight={onClearLayerHighlight}
                onDragStart={handleDragStart}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                onDragEnd={handleDragEnd}
              />
            ))}
            <div
              aria-label="Drop at page root"
              className={`mt-2 min-h-7 ${dropTarget?.selectionId === null ? "bg-muted/60" : ""}`}
              onDragOver={handleRootDragOver}
              onDrop={handleRootDrop}
            />
          </>
        ) : null}
      </div>
    </aside>
  );
}

function WorkspaceToolbar({
  className,
  activeTool,
  isDesktop,
  canvasUrl,
  onSelectTool,
}: {
  className?: string;
  activeTool: ToolName;
  isDesktop: boolean;
  canvasUrl: string | null;
  onSelectTool: (tool: ToolName) => void;
}) {
  return (
    <aside className={`flex h-full w-11 shrink-0 flex-col items-center border-r border-border bg-white pt-2 ${className || ""}`} aria-label="Workspace tools">
      {workspaceTools.map(({ name, label, shortcut, icon: Icon, weight }) => (
        <Hint key={name} content={`${label} (${shortcut})`}>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className={`rounded-[5px] border text-muted-foreground hover:text-foreground ${activeTool === name ? "border-border bg-transparent text-foreground hover:bg-transparent" : "border-transparent"}`}
            onClick={() => onSelectTool(name)}
            disabled={!isDesktop && !canvasUrl}
            aria-pressed={activeTool === name}
            aria-label={label}
          >
            <Icon weight={weight} />
          </Button>
        </Hint>
      ))}
    </aside>
  );
}

function WorkspaceTopbar({
  sidebarsVisible,
  canGoBack,
  canGoForward,
  onToggleSidebars,
  onBack,
  onForward,
}: {
  sidebarsVisible: boolean;
  canGoBack: boolean;
  canGoForward: boolean;
  onToggleSidebars: () => void;
  onBack: () => void;
  onForward: () => void;
}) {
  return (
    <header className="formia-titlebar z-40 flex h-10 shrink-0 items-center border-b border-border bg-white pl-2 text-foreground">
      <div className="flex items-center gap-0.5">
        <Hint content={sidebarsVisible ? "Hide sidebars" : "Show sidebars"}>
          <Button type="button" variant="ghost" size="icon-sm" className="formia-no-drag rounded-[5px]" onClick={onToggleSidebars} aria-label={sidebarsVisible ? "Hide sidebars" : "Show sidebars"} aria-pressed={sidebarsVisible}>
            <SidebarSimpleIcon className="size-4" />
          </Button>
        </Hint>
        <Hint content="Back">
          <Button type="button" variant="ghost" size="icon-sm" className="formia-no-drag rounded-[5px]" onClick={onBack} disabled={!canGoBack} aria-label="Back">
            <ArrowLeftIcon className="size-4" />
          </Button>
        </Hint>
        <Hint content="Forward">
          <Button type="button" variant="ghost" size="icon-sm" className="formia-no-drag rounded-[5px]" onClick={onForward} disabled={!canGoForward} aria-label="Forward">
            <ArrowRightIcon className="size-4" />
          </Button>
        </Hint>
      </div>
      <WindowControls />
    </header>
  );
}

function PropertiesSidebar({
  className,
  selection,
  previewChanges,
  projectPath,
  isDesktop,
  codexAvailability,
  codexStatus,
  projectServerStatus,
  canvasBackground,
  canRefreshApp,
  onBuild,
  onCancelBuild,
  onRestartServer,
  onCopyServerDiagnostics,
  serverDiagnosticsCopied,
  onRefreshApp,
  onCanvasBackgroundChange,
  onApplyStyle,
  onResetStyle,
  onApplyText,
  onResetText,
  onResetAll,
}: {
  className?: string;
  selection: SelectedElement | null;
  previewChanges: PreviewChange[];
  projectPath: string | null;
  isDesktop: boolean;
  codexAvailability: CodexAvailability;
  codexStatus: CodexStatus;
  projectServerStatus: ProjectServerStatus;
  canvasBackground: string;
  canRefreshApp: boolean;
  onBuild: () => void;
  onCancelBuild: () => void;
  onRestartServer: () => void;
  onCopyServerDiagnostics: () => void;
  serverDiagnosticsCopied: boolean;
  onRefreshApp: () => void;
  onCanvasBackgroundChange: (value: string) => void;
  onApplyStyle: (property: string, value: string) => void;
  onResetStyle: (property: string) => void;
  onApplyText: (value: string) => void;
  onResetText: () => void;
  onResetAll: () => void;
}) {
  const buildIndicator = getBuildIndicator(codexAvailability, Boolean(previewChanges.length));
  const isBuilding = codexStatus.state === "working";
  const buildBlocked = !isBuilding && (!isDesktop || codexAvailability.state !== "available" || !projectPath || !previewChanges.length);

  return (
    <aside className={`flex h-full w-72 shrink-0 flex-col border-l border-border bg-white text-foreground ${className || ""}`}>
      <header className="shrink-0 border-b border-border bg-background px-3 py-2.5">
        <div className="flex items-center justify-end gap-1">
          {isDesktop ? (
            <div className="flex items-center gap-0">
              <Hint content={isBuilding ? "Cancel the current Build" : buildIndicator === "unavailable" || buildIndicator === "checking" ? codexAvailability.message : !projectPath ? "Select a project from the desktop app to enable Build" : buildIndicator === "up-to-date" ? buildIndicatorLabel(buildIndicator) : "Send staged visual changes to Codex"}>
                <Button
                  type="button"
                  size="lg"
                  className={`rounded-r-none border-r border-primary-foreground/20 pl-4 font-normal ${buildBlocked ? "cursor-not-allowed" : ""}`}
                  onClick={() => {
                    if (isBuilding) onCancelBuild();
                    else if (!buildBlocked) onBuild();
                  }}
                  aria-disabled={buildBlocked}
                  aria-label={isBuilding ? "Cancel Build" : "Build visual changes with Codex"}
                >
                  <span className={`size-[6px] shrink-0 rounded-full ${buildIndicatorClass(buildIndicator)}`} aria-hidden="true" />
                  {isBuilding ? "Cancel" : "Build"}
                </Button>
              </Hint>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button type="button" size="lg" className="-ml-px w-9 rounded-l-none px-0" aria-label="Build options">
                    <CaretDownIcon className="size-3.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="min-w-44 rounded-[5px] p-0.5 shadow-none ring-1 ring-foreground/10">
                  <DropdownMenuItem disabled={!selection && !previewChanges.length} onSelect={onResetAll}>
                    <EraserIcon />
                    Reset design
                  </DropdownMenuItem>
                  <DropdownMenuItem disabled={!isDesktop || !projectPath || projectServerStatus.state === "starting"} onSelect={onRestartServer}>
                    <TerminalWindowIcon />
                    Restart server
                  </DropdownMenuItem>
                  <DropdownMenuItem disabled={!canRefreshApp} onSelect={onRefreshApp}>
                    <ArrowClockwiseIcon />
                    Refresh app
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ) : (
            <Button asChild size="lg">
              <a href={windowsInstallerUrl} aria-label="Download Formia to open a local project">
                <DownloadSimpleIcon />
                Download Formia
              </a>
            </Button>
          )}
        </div>
      </header>

      {isDesktop && (codexAvailability.state !== "available" || codexStatus.state !== "idle") || projectServerStatus.state === "failed" ? (
        <section className="shrink-0 space-y-2 border-b border-border px-3.5 py-3">
          {isDesktop && codexAvailability.state !== "available" ? (
            <Hint content={codexAvailability.message}>
              <p className={`flex items-center gap-1.5 truncate text-xs ${codexAvailability.state === "unavailable" ? "text-destructive" : "text-muted-foreground"}`} role="status">
                {codexAvailability.state === "checking" ? <CircleNotchIcon className="size-3 shrink-0 animate-spin" /> : <WarningCircleIcon className="size-3 shrink-0" />}
                <span className="truncate">{codexAvailability.message}</span>
              </p>
            </Hint>
          ) : null}
          {codexStatus.state !== "idle" ? (
            <Hint content={codexStatus.message}>
              <p
                role="status"
                className={`flex items-center gap-1.5 truncate text-xs ${codexStatus.state === "failed" ? "text-destructive" : "text-muted-foreground"}`}
              >
                {codexStatus.state === "working" ? <CircleNotchIcon className="size-3 shrink-0 animate-spin" /> : null}
                {codexStatus.state === "applied" ? <CheckIcon className="size-3 shrink-0 text-emerald-600" /> : null}
                {codexStatus.state === "failed" ? <WarningCircleIcon className="size-3 shrink-0" /> : null}
                <span className="truncate">{codexStatusLabel(codexStatus)}</span>
              </p>
            </Hint>
          ) : null}
          {projectServerStatus.state === "failed" ? (
            <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-2.5" role="alert">
              <p className="flex items-start gap-1.5 text-xs leading-5 text-destructive">
                <WarningCircleIcon className="size-3 shrink-0" />
                <span className="break-words">{projectServerStatus.message}</span>
              </p>
              <div className="mt-2 flex gap-2 pl-4.5">
                <Button type="button" variant="outline" size="xs" onClick={onRestartServer}>
                  <ArrowClockwiseIcon />
                  Retry
                </Button>
                <Button type="button" variant="ghost" size="xs" onClick={onCopyServerDiagnostics}>
                  <ClipboardTextIcon />
                  {serverDiagnosticsCopied ? "Copied" : "Copy details"}
                </Button>
              </div>
            </div>
          ) : null}
        </section>
      ) : null}

      <div className="scrollbar-hidden min-h-0 flex-1 overflow-y-auto">
        {selection ? (
          <>
            {selection.react && typeof selection.react.props === "object" && selection.react.props !== null ? (
              <PropertyGroup title="React props" values={selection.react.props as Record<string, unknown>} />
            ) : null}
            {selection.textEditable && selection.text.trim() ? <ContentGroup value={selection.text} onCommit={onApplyText} onReset={onResetText} /> : null}
            <LayoutGroup key={selection.selectionId ?? `${selection.tagName}-${selection.id ?? "selected"}`} selection={selection} onApplyStyle={onApplyStyle} onResetStyle={onResetStyle} />
            <TypographyGroup selection={selection} onApplyStyle={onApplyStyle} onResetStyle={onResetStyle} />
            <ColorGroup selection={selection} onApplyStyle={onApplyStyle} onResetStyle={onResetStyle} />
            <BorderGroup selection={selection} onApplyStyle={onApplyStyle} onResetStyle={onResetStyle} />
          </>
        ) : (
          <>
            <section className={inspectorSectionClass}>
              <h3 className={inspectorTitleClass}>Page</h3>
              <div className="group relative flex h-7 min-w-0 items-center gap-1 rounded-[5px] border border-border bg-background px-2 shadow-none transition-colors hover:bg-muted/30 focus-within:border-border focus-within:bg-muted/25 focus-within:shadow-none focus-within:ring-1 focus-within:ring-foreground/5">
                <ColorPicker value={colorHexValue(canvasBackground)} onChange={onCanvasBackgroundChange} ariaLabel="Choose page background color" />
                <Input
                  id="canvas-background-color"
                  value={displayedColorHexValue(canvasBackground)}
                  aria-label="Edit page background color"
                  className="h-4 min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap rounded-none border-0 bg-transparent p-0 text-[12px] leading-4 font-normal shadow-none focus:overflow-x-auto focus:text-clip focus-visible:ring-0 md:text-[12px]"
                  onChange={(event) => onCanvasBackgroundChange(event.target.value)}
                />
              </div>
            </section>
          </>
        )}
      </div>
    </aside>
  );
}

function codexStatusLabel(status: CodexStatus) {
  if (status.state === "working") return status.message || "Codex working";
  if (status.state === "applied") return "Applied and refreshed";
  if (status.state === "failed") return status.message || "Codex needs attention";
  return "";
}

export type ProjectWorkspaceProps = {
  runtime: WorkspaceRuntime;
  active: boolean;
  projectName: string;
  projectPath: string | null;
  projectUrl: string | null;
  codexAvailability: CodexAvailability;
  onBack: () => void;
};

/**
 * Shared visual editing surface. Product-specific entry points choose the
 * runtime; this component does not discover or decide which product is open.
 */
export function ProjectWorkspace({
  runtime,
  active,
  projectName,
  projectPath,
  projectUrl,
  codexAvailability,
  onBack,
}: ProjectWorkspaceProps) {
  const isDesktop = runtime === "desktop";
  const [canvasUrl, setCanvasUrl] = useState<string | null>(null);
  const [canvasKey, setCanvasKey] = useState(0);
  const [activeTool, setActiveTool] = useState<ToolName>("interact");
  const [selection, setSelection] = useState<SelectedElement | null>(null);
  const [stagedPreviewChanges, setStagedPreviewChanges] = useState<PreviewChange[]>([]);
  const [layerTree, setLayerTree] = useState<LayerNode[]>([]);
  const [canvasBackground, setCanvasBackground] = useState("#F5F5F5");
  const [sidebarsVisible, setSidebarsVisible] = useState(true);
  const [canGoBack, setCanGoBack] = useState(false);
  const [canGoForward, setCanGoForward] = useState(false);
  const [artboardHeight, setArtboardHeight] = useState(minimumArtboardHeight);
  const [codexStatus, setCodexStatus] = useState<CodexStatus>({ state: "idle", message: "" });
  const [projectServerStatus, setProjectServerStatus] = useState<ProjectServerStatus>({ state: "stopped", message: "" });
  const [serverDiagnosticsCopied, setServerDiagnosticsCopied] = useState(false);
  const [zoom, setZoom] = useState(0.75);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [panMode, setPanMode] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  const canvasViewportRef = useRef<HTMLDivElement>(null);
  const panStartRef = useRef<{ pointerX: number; pointerY: number; panX: number; panY: number } | null>(null);
  const webviewHostRef = useRef<HTMLDivElement>(null);
  const webviewRef = useRef<FormiaWebviewElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const artboardHeightRef = useRef(minimumArtboardHeight);
  const zoomRef = useRef(0.75);
  const panRef = useRef({ x: 0, y: 0 });
  const zoomTargetRef = useRef(0.75);
  const panTargetRef = useRef({ x: 0, y: 0 });
  const viewportAnimationRef = useRef<number | null>(null);
  const activeToolRef = useRef<ToolName>("interact");
  const shortcutHandlerRef = useRef<(input: WorkspaceShortcutInput) => void>(() => {});
  const handleWebviewWheelRef = useRef(handleWebviewWheel);
  handleWebviewWheelRef.current = handleWebviewWheel;

  const updateArtboardHeight = useCallback((nextHeight: number) => {
    const previousHeight = artboardHeightRef.current;
    if (nextHeight === previousHeight) return;

    artboardHeightRef.current = nextHeight;
    setArtboardHeight(nextHeight);

    // Keep the page's top edge stationary while its bottom grows or shrinks.
    const heightDelta = nextHeight - previousHeight;
    const nextPan = {
      ...panRef.current,
      y: panRef.current.y + (heightDelta * zoomRef.current) / 2,
    };
    const nextPanTarget = {
      ...panTargetRef.current,
      y: panTargetRef.current.y + (heightDelta * zoomTargetRef.current) / 2,
    };
    panRef.current = nextPan;
    panTargetRef.current = nextPanTarget;
    setPan(nextPan);
  }, []);

  useEffect(() => () => {
    if (viewportAnimationRef.current !== null) cancelAnimationFrame(viewportAnimationRef.current);
  }, []);

  useEffect(() => {
    const host = webviewHostRef.current;
    if (!host) return;

    host.replaceChildren();
    webviewRef.current = null;
    setCanGoBack(false);
    setCanGoForward(false);
    if (!active || !isDesktop || !canvasUrl || !window.formiaDesktop) return;

    const webview = document.createElement("webview") as FormiaWebviewElement;
    webview.className = "h-full w-full";
    webview.setAttribute("preload", window.formiaDesktop.inspectorPreloadUrl);
    webview.setAttribute("partition", projectSessionPartition(projectPath));

    const syncTool = () => {
      webview.send("formia:set-tool", activeToolRef.current);
      webview.send("formia:get-layer-tree");
      webview.send("formia:get-preview-state");
    };
    const resetArtboardHeight = () => updateArtboardHeight(minimumArtboardHeight);
    const remeasureArtboardHeight = () => {
      resetArtboardHeight();
      requestAnimationFrame(() => webview.send("formia:measure-page-height"));
    };
    const syncNavigationState = () => {
      setCanGoBack(webview.canGoBack());
      setCanGoForward(webview.canGoForward());
    };
    const clearWebviewHover = () => webview.send("formia:clear-layer-highlight");
    const receiveSelection = (event: Event) => {
      const message = event as FormiaWebviewEvent;
      if (message.channel === "formia:canvas-wheel") {
        if (isCanvasWheelInput(message.args[0])) handleWebviewWheelRef.current(message.args[0]);
        return;
      }
      if (message.channel === "formia:canvas-keydown") {
        if (isCanvasKeyboardInput(message.args[0])) shortcutHandlerRef.current(message.args[0]);
        return;
      }
      if (message.channel === "formia:canvas-keyup") {
        const input = message.args[0];
        if (isCanvasKeyboardInput(input) && input.code === "Space") setPanMode(false);
        return;
      }
      if (message.channel === "formia:page-height") {
        const nextHeight = Number(message.args[0]);
        if (Number.isFinite(nextHeight) && nextHeight > 0) {
          updateArtboardHeight(Math.max(minimumArtboardHeight, Math.ceil(nextHeight)));
        }
        return;
      }
      if (message.channel === "formia:layer-tree") {
        const payload = message.args[0];
        if (isLayerTreePayload(payload)) setLayerTree(payload.nodes as LayerNode[]);
        return;
      }
      if (message.channel === "formia:element-selected" || message.channel === "formia:element-updated") {
        const nextSelection = message.args[0];
        if (!isSelectionPayload(nextSelection)) return;
        setSelection(nextSelection as SelectedElement);
        setStagedPreviewChanges(Array.isArray(nextSelection.previewChanges) ? nextSelection.previewChanges as PreviewChange[] : []);
        return;
      }
      if (message.channel === "formia:preview-state") {
        const payload = message.args[0];
        if (isPreviewStatePayload(payload)) setStagedPreviewChanges(payload.changes as PreviewChange[]);
        return;
      }
      if (message.channel === "formia:selection-cleared") {
        setSelection(null);
        setStagedPreviewChanges([]);
      }
    };

    webview.addEventListener("did-finish-load", syncTool);
    webview.addEventListener("did-finish-load", syncNavigationState);
    webview.addEventListener("did-start-loading", resetArtboardHeight);
    webview.addEventListener("did-navigate", syncNavigationState);
    webview.addEventListener("did-navigate-in-page", remeasureArtboardHeight);
    webview.addEventListener("did-navigate-in-page", syncNavigationState);
    webview.addEventListener("mouseleave", clearWebviewHover);
    host.addEventListener("mouseleave", clearWebviewHover);
    webview.addEventListener("ipc-message", receiveSelection);
    host.appendChild(webview);
    webviewRef.current = webview;
    webview.setAttribute("src", canvasUrl);

    return () => {
      webview.removeEventListener("did-finish-load", syncTool);
      webview.removeEventListener("did-finish-load", syncNavigationState);
      webview.removeEventListener("did-start-loading", resetArtboardHeight);
      webview.removeEventListener("did-navigate", syncNavigationState);
      webview.removeEventListener("did-navigate-in-page", remeasureArtboardHeight);
      webview.removeEventListener("did-navigate-in-page", syncNavigationState);
      webview.removeEventListener("mouseleave", clearWebviewHover);
      host.removeEventListener("mouseleave", clearWebviewHover);
      webview.removeEventListener("ipc-message", receiveSelection);
      if (webviewRef.current === webview) webviewRef.current = null;
      webview.remove();
    };
  }, [active, canvasKey, canvasUrl, isDesktop, projectPath, updateArtboardHeight]);

  useEffect(() => {
    if (isDesktop || !active || !projectUrl) return;

    let cancelled = false;
    const frame = window.requestAnimationFrame(() => {
      if (cancelled) return;
      setCanvasUrl(projectUrl);
      setProjectServerStatus({ state: "ready", url: projectUrl, message: "" });
      setSelection(null);
      setStagedPreviewChanges([]);
      setLayerTree([]);
      setCanvasKey((key) => key + 1);
    });

    return () => {
      cancelled = true;
      window.cancelAnimationFrame(frame);
    };
  }, [active, isDesktop, projectUrl]);

  useEffect(() => {
    if (isDesktop) return;

    const receiveOnlineMessage = (event: MessageEvent) => {
      const message = event.data as { source?: string; channel?: string; args?: unknown[] } | null;
      if (!message || message.source !== "formia-online-demo") return;

      if (message.channel === "formia:online-ready") {
        sendCanvasMessage("formia:set-tool", activeToolRef.current);
        sendCanvasMessage("formia:get-layer-tree");
        sendCanvasMessage("formia:get-preview-state");
        return;
      }
      if (message.channel === "formia:layer-tree") {
        const payload = message.args?.[0];
        if (isLayerTreePayload(payload)) setLayerTree(payload.nodes as LayerNode[]);
        return;
      }
      if (message.channel === "formia:element-selected" || message.channel === "formia:element-updated") {
        const nextSelection = message.args?.[0];
        if (!isSelectionPayload(nextSelection)) return;
        setSelection(nextSelection as SelectedElement);
        setStagedPreviewChanges(Array.isArray(nextSelection.previewChanges) ? nextSelection.previewChanges as PreviewChange[] : []);
        return;
      }
      if (message.channel === "formia:preview-state") {
        const payload = message.args?.[0];
        if (isPreviewStatePayload(payload)) setStagedPreviewChanges(payload.changes as PreviewChange[]);
        return;
      }
      if (message.channel === "formia:selection-cleared") {
        setSelection(null);
        setStagedPreviewChanges([]);
      }
    };

    window.addEventListener("message", receiveOnlineMessage);
    return () => window.removeEventListener("message", receiveOnlineMessage);
  }, [isDesktop]);

  useEffect(() => {
    const unsubscribe = window.formiaDesktop?.onCodexStatus((status) => {
      setCodexStatus({ state: status.state, message: status.message });
      if (status.state === "applied") {
        sendCanvasMessage("formia:reset-overrides");
        setSelection(null);
        setStagedPreviewChanges([]);
        setCanvasKey((key) => key + 1);
      }
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    let subscribed = true;
    const applyProjectServerStatus = (status: ProjectServerStatus) => {
      setProjectServerStatus(status);
      if (status.state === "starting") {
        setCanvasUrl(null);
        setSelection(null);
        setStagedPreviewChanges([]);
        setLayerTree([]);
      }
      if (status.url) {
        setCanvasUrl(status.url);
        setCanvasKey((key) => key + 1);
        setSelection(null);
        setStagedPreviewChanges([]);
      }
      if (status.state === "failed") setCanvasUrl(null);
    };

    const desktop = window.formiaDesktop;
    const unsubscribe = desktop?.onProjectServerStatus(applyProjectServerStatus);
    void desktop?.getProjectServerStatus().then((status) => {
      if (subscribed) applyProjectServerStatus(status);
    });

    return () => {
      subscribed = false;
      unsubscribe?.();
    };
  }, []);

  useEffect(() => {
    activeToolRef.current = activeTool;
    sendCanvasMessage("formia:set-tool", activeTool);
  }, [activeTool]);

  function fitCanvas() {
    const viewport = canvasViewportRef.current;
    if (!viewport) return;

    const padding = 64;
    const nextZoom = clampZoom(Math.min(
      (viewport.clientWidth - padding) / artboardWidth,
      (viewport.clientHeight - padding) / artboardHeightRef.current,
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
    const isPinch = input.ctrlKey;

    if (input.shiftKey && !isPinch) {
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
    const scaleX = bounds.width / artboardWidth;
    const scaleY = bounds.height / artboardHeightRef.current;
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

  function sendCanvasMessage(channel: CanvasMessageChannel, ...args: CanvasMessageArgs<CanvasMessageChannel>) {
    const messageArgs = channel === "formia:set-tool"
      ? [args[0], toolCursor(args[0] as ToolName)]
      : args;
    if (iframeRef.current) {
      iframeRef.current.contentWindow?.postMessage({ source: "formia-parent", channel, args: messageArgs }, window.location.origin);
      return;
    }
    if (webviewRef.current) {
      webviewRef.current.send(channel, ...messageArgs);
      return;
    }
  }

  function handleWorkspaceShortcut(input: WorkspaceShortcutInput) {
    const hasModifier = input.ctrlKey || input.metaKey;

    if (input.code === "Space") {
      if (!input.repeat && !input.targetIsEditable && !hasModifier && !input.altKey) {
        input.preventDefault?.();
        setPanMode(true);
      }
      return;
    }

    if (input.code === "Escape") {
      if (!input.targetIsEditable) {
        setPanMode(false);
        clearCanvasSelection();
      }
      return;
    }

    if (input.targetIsEditable || input.altKey || input.repeat) return;

    if (!hasModifier && !input.shiftKey) {
      const layerDirection = input.code === "ArrowUp" || input.code === "ArrowLeft"
        ? "up"
        : input.code === "ArrowDown" || input.code === "ArrowRight"
          ? "down"
          : null;
      if (layerDirection) {
        input.preventDefault?.();
        sendCanvasMessage("formia:move-selected-layer", layerDirection);
        return;
      }
    }

    if (hasModifier) {
      if (!input.shiftKey && input.code === "KeyD") {
        input.preventDefault?.();
        sendCanvasMessage("formia:duplicate-selected-layer");
        return;
      }
      if (!input.shiftKey && input.code === "BracketLeft") {
        input.preventDefault?.();
        goBack();
      }
      return;
    }

    if (input.code === "Delete" || input.code === "Backspace") {
      input.preventDefault?.();
      sendCanvasMessage("formia:delete-selected-layer");
      return;
    }

    if (input.code === "Equal" || input.code === "NumpadAdd") {
      input.preventDefault?.();
      zoomCanvas(0.1);
      return;
    }

    if (input.code === "Minus" || input.code === "NumpadSubtract") {
      input.preventDefault?.();
      zoomCanvas(-0.1);
      return;
    }

    if (input.shiftKey) return;

    if (input.code === "KeyS") {
      input.preventDefault?.();
      selectTool("select");
      return;
    }
    if (input.code === "KeyI") {
      input.preventDefault?.();
      selectTool("interact");
      return;
    }
    if (input.code === "KeyT") {
      input.preventDefault?.();
      selectTool("text");
      return;
    }
    if (input.code === "Digit0" || input.code === "Numpad0") {
      input.preventDefault?.();
      fitCanvas();
    }
  }

  shortcutHandlerRef.current = handleWorkspaceShortcut;

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      shortcutHandlerRef.current({
        code: event.code,
        key: event.key,
        ctrlKey: event.ctrlKey,
        metaKey: event.metaKey,
        shiftKey: event.shiftKey,
        altKey: event.altKey,
        repeat: event.repeat,
        targetIsEditable: isEditableKeyboardTarget(event.target),
        preventDefault: () => event.preventDefault(),
      });
    }

    function handleKeyUp(event: KeyboardEvent) {
      if (event.code === "Space" && !isEditableKeyboardTarget(event.target)) setPanMode(false);
    }

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, []);

  function selectTool(tool: ToolName) {
    activeToolRef.current = tool;
    setActiveTool(tool);
    sendCanvasMessage("formia:set-tool", tool);
  }

  function refreshApp() {
    setSelection(null);
    setStagedPreviewChanges([]);
    setLayerTree([]);
    setArtboardHeight(minimumArtboardHeight);
    if (webviewRef.current) {
      webviewRef.current.reload();
      return;
    }
    if (canvasUrl) setCanvasKey((key) => key + 1);
  }

  function selectLayer(selectionId: string) {
    sendCanvasMessage("formia:select-layer", selectionId);
  }

  function highlightLayer(selectionId: string) {
    sendCanvasMessage("formia:highlight-layer", selectionId);
  }

  function clearLayerHighlight() {
    sendCanvasMessage("formia:clear-layer-highlight");
  }

  function handleCanvasPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.target !== webviewRef.current) clearLayerHighlight();
    movePan(event);
  }

  function moveLayer(payload: { sourceSelectionId: string; targetParentId: string | null; beforeSelectionId: string | null }) {
    sendCanvasMessage("formia:move-layer", payload);
  }

  function clearCanvasSelection() {
    setSelection(null);
    setStagedPreviewChanges([]);
    sendCanvasMessage("formia:clear-selection");
  }

  function resetPreview() {
    sendCanvasMessage("formia:reset-overrides");
    setStagedPreviewChanges([]);
    setCodexStatus({ state: "idle", message: "" });
  }

  async function buildWithCodex() {
    if (!projectPath || !stagedPreviewChanges.length || !window.formiaDesktop) return;

    setCodexStatus({ state: "working", message: "Sending visual changes to Codex" });
    try {
      await window.formiaDesktop.buildWithCodex({
        projectPath,
        projectName,
        canvasUrl,
        selection,
        previewChanges: stagedPreviewChanges,
      });
    } catch (error) {
      setCodexStatus({
        state: "failed",
        message: error instanceof Error ? error.message : "Could not start Codex.",
      });
    }
  }

  function goBack() {
    void window.formiaDesktop?.stopProjectServer();
    onBack();
  }

  async function restartProjectServer() {
    if (!projectPath || !window.formiaDesktop) return;

    setSelection(null);
    setStagedPreviewChanges([]);
    setLayerTree([]);
    try {
      setServerDiagnosticsCopied(false);
      await window.formiaDesktop.restartProjectServer();
    } catch (error) {
      setProjectServerStatus({
        state: "failed",
        message: desktopErrorMessage(error, "Could not restart the project server."),
      });
    }
  }

  async function cancelCodexBuild() {
    if (!window.formiaDesktop) return;
    try {
      await window.formiaDesktop.cancelCodexBuild();
    } catch (error) {
      setCodexStatus({
        state: "failed",
        message: desktopErrorMessage(error, "Could not cancel Build."),
      });
    }
  }

  async function copyServerDiagnostics() {
    const details = [
      "Formia project server error",
      `Project: ${projectName}`,
      projectPath ? `Path: ${projectPath}` : null,
      `Details: ${projectServerStatus.message || "Unknown server error"}`,
      projectServerStatus.diagnostics ? `Diagnostics:\n${projectServerStatus.diagnostics}` : null,
    ].filter(Boolean).join("\n");

    try {
      await navigator.clipboard.writeText(details);
      setServerDiagnosticsCopied(true);
      window.setTimeout(() => setServerDiagnosticsCopied(false), 2000);
    } catch {
      setServerDiagnosticsCopied(false);
    }
  }

  function navigateBack() {
    const webview = webviewRef.current;
    if (webview?.canGoBack()) {
      webview.goBack();
      return;
    }
    goBack();
  }

  function navigateForward() {
    const webview = webviewRef.current;
    if (!webview?.canGoForward()) return;
    webview.goForward();
  }

  return (
    <main
      className={active ? "relative flex h-screen flex-col overflow-hidden bg-white" : "hidden"}
      style={{ "--formia-cursor": toolCursor(activeTool) } as CSSProperties}
    >
      {isDesktop ? (
        <WorkspaceTopbar
          sidebarsVisible={sidebarsVisible}
          canGoBack={Boolean(canvasUrl) || canGoBack}
          canGoForward={canGoForward}
          onToggleSidebars={() => setSidebarsVisible((visible) => !visible)}
          onBack={navigateBack}
          onForward={navigateForward}
        />
      ) : null}
      <div className="min-h-0 flex flex-1">
        <LayerPanel
          className={sidebarsVisible ? "" : "hidden"}
          canvasUrl={canvasUrl}
          layerTree={layerTree}
          selection={selection}
          onSelectLayer={selectLayer}
          onHighlightLayer={highlightLayer}
          onClearLayerHighlight={clearLayerHighlight}
          onMoveLayer={moveLayer}
        />
          <WorkspaceToolbar
           className={sidebarsVisible ? "" : "hidden"}
           activeTool={activeTool}
           isDesktop={isDesktop}
           canvasUrl={canvasUrl}
           onSelectTool={selectTool}
         />
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="min-h-0 flex-1">
          <div
            ref={canvasViewportRef}
            className={`relative h-full w-full overflow-hidden touch-none ${isPanning || panMode ? "cursor-grabbing" : ""}`}
            style={{ backgroundColor: canvasBackground }}
            onWheel={handleCanvasWheel}
            onPointerDown={(event) => {
              const clickedWebview = event.target === webviewRef.current;
              if (!clickedWebview) clearCanvasSelection();
              if (!clickedWebview || event.button === 1) beginPan(event);
            }}
            onPointerMove={handleCanvasPointerMove}
            onPointerLeave={clearLayerHighlight}
            onPointerUp={endPan}
            onPointerCancel={endPan}
          >
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 opacity-50"
              style={{ backgroundImage: "linear-gradient(to right, color-mix(in oklch, var(--border) 40%, transparent) 1px, transparent 1px), linear-gradient(to bottom, color-mix(in oklch, var(--border) 40%, transparent) 1px, transparent 1px)", backgroundSize: "24px 24px" }}
            />
            <div
              className="absolute"
              style={{
                left: "50%",
                top: "50%",
                width: artboardWidth,
                height: artboardHeight,
                transform: `translate(-50%, -50%) translate(${pan.x}px, ${pan.y}px)`,
              }}
            >
              <div
                className="h-full w-full shadow-[0_2px_8px_rgba(0,0,0,0.04),0_4px_40px_rgba(0,0,0,0.05)] ring-1 ring-black/5"
                style={{ transform: `scale(${zoom})`, transformOrigin: "center center" }}
              >
                <div className="h-full w-full overflow-hidden bg-white">
                  {active && isDesktop && window.formiaDesktop && canvasUrl ? (
                    <div key={`${canvasUrl}-${canvasKey}`} ref={webviewHostRef} className="h-full w-full" />
                  ) : canvasUrl ? (
                    <iframe
                      key={`${canvasUrl}-${canvasKey}`}
                      ref={iframeRef}
                      src={canvasUrl}
                      title={`${projectName} application canvas`}
                      className="h-full w-full border-0"
                      onLoad={() => {
                        sendCanvasMessage("formia:set-tool", activeToolRef.current);
                        sendCanvasMessage("formia:get-layer-tree");
                        sendCanvasMessage("formia:get-preview-state");
                      }}
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-background px-10 text-center">
                      <div>
                        {projectServerStatus.state === "starting" ? <CircleNotchIcon className="mx-auto mb-3 size-5 animate-spin text-muted-foreground" /> : null}
                        {projectServerStatus.state === "failed" ? <WarningCircleIcon className="mx-auto mb-3 size-5 text-destructive" /> : null}
                        <p className="text-sm font-medium">
                          {projectServerStatus.state === "failed" ? "Project server could not start" : "Starting project server"}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {projectServerStatus.state === "failed" ? projectServerStatus.message : "Formia will load the project here when it is ready."}
                        </p>
                        {projectServerStatus.state === "failed" ? (
                          <div className="mt-4 flex justify-center gap-2">
                            <Button type="button" variant="outline" size="sm" onClick={() => void restartProjectServer()}>
                              <ArrowClockwiseIcon />
                              Retry
                            </Button>
                            <Button type="button" variant="ghost" size="sm" onClick={() => void copyServerDiagnostics()}>
                              <ClipboardTextIcon />
                              {serverDiagnosticsCopied ? "Copied" : "Copy details"}
                            </Button>
                          </div>
                        ) : null}
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

                </div>
              </div>
            </div>

      <PropertiesSidebar
        className={sidebarsVisible ? "" : "hidden"}
        selection={selection}
        previewChanges={stagedPreviewChanges}
        projectPath={projectPath}
        isDesktop={isDesktop}
        codexAvailability={codexAvailability}
        codexStatus={codexStatus}
        projectServerStatus={projectServerStatus}
        canvasBackground={canvasBackground}
        canRefreshApp={Boolean(canvasUrl)}
        onBuild={() => void buildWithCodex()}
        onCancelBuild={() => void cancelCodexBuild()}
        onRestartServer={() => void restartProjectServer()}
        onCopyServerDiagnostics={() => void copyServerDiagnostics()}
        serverDiagnosticsCopied={serverDiagnosticsCopied}
        onRefreshApp={refreshApp}
        onCanvasBackgroundChange={setCanvasBackground}
        onApplyStyle={(property, value) => sendCanvasMessage("formia:apply-style", { property, value })}
        onResetStyle={(property) => sendCanvasMessage("formia:reset-style", property)}
        onApplyText={(value) => sendCanvasMessage("formia:apply-text", value)}
        onResetText={() => sendCanvasMessage("formia:reset-text")}
        onResetAll={resetPreview}
      />
      </div>
    </main>
  );
}
