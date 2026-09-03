"use client";

import { type PointerEvent as ReactPointerEvent, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { AlignLeftIcon, AngleIcon, ArrowCounterClockwiseIcon, ArrowElbowDownLeftIcon, ArrowLeftIcon, ArrowsOutIcon, CaretDownIcon, CheckIcon, CircleNotchIcon, ColumnsIcon, CursorIcon, DotIcon, DotsNineIcon, FlipHorizontalIcon, FlipVerticalIcon, GridFourIcon, HandGrabbingIcon, LinkSimpleHorizontalIcon, MinusIcon, PlusIcon, RowsIcon, SplitHorizontalIcon, SquareIcon, StackSimpleIcon, WarningCircleIcon } from "@phosphor-icons/react";
import { AlignBottomFilled, AlignHorizontalCenterFilled, AlignLeft2Filled, AlignRight2Filled, AlignTopFilled, Columns3Filled } from "@mingcute/react/core-filled";
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react";
import { AArrowUpIcon, CaseLowerIcon, CaseSensitiveIcon, CaseUpperIcon, FitToScreenIcon, MinusSignIcon, ParagraphSpacingIcon, TextAlignCenterIcon, TextAlignJustifyCenterIcon, TextAlignLeft01Icon, TextAlignLeftIcon, TextAlignRight01Icon, TextAlignRightIcon, TextStrikethroughIcon, TextUnderlineIcon, TextVariableFrontIcon, XLineTopIcon } from "@hugeicons/core-free-icons";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
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
  parentLayout: { display: string } | null;
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

type CodexAvailability = {
  state: "checking" | "available" | "unavailable";
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

const inspectorSectionClass = "border-b border-border px-3 py-2.5";
const inspectorHeadingClass = "text-[14px] leading-4 font-medium text-foreground";
const inspectorTitleClass = `mb-2 ${inspectorHeadingClass}`;
const inspectorLabelClass = "text-[12px] leading-4 font-normal text-muted-foreground";
const inspectorFieldClass = "min-w-0 rounded-[5px] border border-border bg-background px-2 text-[14px] leading-4 text-foreground shadow-none";

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

  useEffect(() => {
    resizeContentTextarea(textareaRef.current);
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
            onCommit(event.currentTarget.value);
            resizeContentTextarea(event.currentTarget);
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
  return value?.split(",")[0]?.trim().replace(/^['"]|['"]$/g, "") || "";
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
        <Input id="typography-font-family" value={currentValue} aria-label="Edit font family" className="h-4 min-w-0 w-full overflow-hidden text-ellipsis whitespace-nowrap rounded-none border-0 bg-transparent p-0 pr-1 text-[14px] leading-4 font-normal shadow-none focus-visible:ring-0" onChange={(event) => onApplyStyle("fontFamily", event.currentTarget.value)} />
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
      <DropdownMenuContent align="start" sideOffset={4} className="max-h-72 min-w-[16rem] max-w-[calc(100vw-1rem)] overflow-y-auto rounded-[5px] p-0.5 shadow-none ring-1 ring-foreground/10">
        <DropdownMenuLabel className="px-2 py-1 text-[11px]">Installed fonts</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={availableFonts.includes(currentFamily) ? currentFamily : ""} onValueChange={(font) => onApplyStyle("fontFamily", font)}>
          {availableFonts.map((font) => (
            <DropdownMenuRadioItem key={font} value={font} className="rounded-[3px] px-2 py-1 text-[14px]" style={{ fontFamily: `"${font}"` }}>
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
      <Hint content={name}><label htmlFor={`typography-${name}`} className="grid size-3.5 place-items-center text-muted-foreground [&>svg]:block"><HugeiconsIcon icon={icon} size={15} strokeWidth={1.8} /></label></Hint>
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
        <Hint content="font-weight"><label htmlFor="typography-font-weight" className="grid size-3.5 place-items-center text-muted-foreground"><HugeiconsIcon icon={TextVariableFrontIcon} size={15} strokeWidth={1.8} /></label></Hint>
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

function colorPickerValue(value: string | undefined) {
  const normalized = value?.trim().toLowerCase() || "";
  const hex = normalized.match(/^#([0-9a-f]{3,8})$/i)?.[1];
  if (hex) {
    if (hex.length === 3) return `#${hex.split("").map((digit) => `${digit}${digit}`).join("")}`;
    if (hex.length >= 6) return `#${hex.slice(0, 6)}`;
  }

  const rgb = normalized.match(/^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})(?:\s*,\s*[\d.]+)?\s*\)$/i);
  if (rgb) {
    return `#${rgb.slice(1, 4).map((channel) => Number(channel).toString(16).padStart(2, "0")).join("")}`;
  }

  return "#000000";
}

function ColorField({ label, name, property, value, onApplyStyle, onResetStyle }: { label: string; name: string; property: string; value: string | undefined; onApplyStyle: (property: string, value: string) => void; onResetStyle: (property: string) => void }) {
  return (
    <div className="space-y-1">
      <Hint content={`Edit ${name} color`}>
        <label htmlFor={`color-${property}`} className={inspectorLabelClass}>{label}</label>
      </Hint>
      <div className="group relative flex h-7 min-w-0 items-center gap-1 rounded-[5px] border border-border bg-background px-2 shadow-none transition-colors hover:bg-muted/30 focus-within:border-border focus-within:bg-muted/25 focus-within:shadow-none focus-within:ring-1 focus-within:ring-foreground/5">
        <ColorPicker value={colorPickerValue(value)} onChange={(next) => onApplyStyle(property, next)} ariaLabel={`Choose ${name} color`} />
        <Input
          id={`color-${property}`}
          value={value || ""}
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
        <CaretDownIcon className="pointer-events-none absolute right-0.5 top-1/2 z-10 size-3 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
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
          <SizingLayoutField label="Width" name="border-width" value={selection.styles.borderWidth} fallback={1} unitOptions={borderUnits} keywordOptions={[]} onCommit={(value, unit) => onApplyStyle("borderWidth", sizingCssValue(value, unit, 1, []))} onReset={() => onResetStyle("borderWidth")} />
          <SizingLayoutField label="Radius" name="border-radius" value={selection.styles.borderRadius} fallback={0} unitOptions={borderRadiusUnits} keywordOptions={[]} onCommit={(value, unit) => onApplyStyle("borderRadius", sizingCssValue(value, unit, 0, []))} onReset={() => onResetStyle("borderRadius")} />
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
}: {
  label: React.ReactNode;
  name: string;
  value: string;
  onCommit: (value: string) => void;
  onReset: () => void;
  suffix?: string;
  wideLabel?: boolean;
  inlineLabel?: boolean;
}) {
  const isInline = inlineLabel ?? typeof label !== "string";
  const controlContents = (
    <>
      <Input id={`layout-${name}`} value={value} aria-label={`Edit ${name}`} className="h-4 min-w-0 w-full overflow-hidden text-ellipsis whitespace-nowrap appearance-none rounded-none border-0 bg-transparent p-0 pr-7 text-[14px] leading-4 font-normal tabular-nums shadow-none focus:overflow-x-auto focus:text-clip focus-visible:ring-0 md:text-[14px]" onChange={(event) => onCommit(event.currentTarget.value)} />
      {suffix ? <span className="-ml-1 text-[14px] leading-4 text-muted-foreground">{suffix}</span> : null}
      <Hint content={`Reset ${name}`}>
        <Button type="button" variant="ghost" size="icon-xs" className={`absolute top-1/2 size-4 -translate-y-1/2 rounded bg-background p-0 text-muted-foreground opacity-0 transition-opacity hover:opacity-100 focus-visible:opacity-100 ${suffix ? "right-5" : "right-1"}`} onClick={onReset} aria-label={`Reset ${name}`}>
          <ArrowCounterClockwiseIcon className="size-3.5" />
        </Button>
      </Hint>
    </>
  );

  if (!isInline) {
    return (
      <div className="space-y-1">
        <Hint content={name}><label htmlFor={`layout-${name}`} className={inspectorLabelClass}>{label}</label></Hint>
        <div className="group relative flex h-7 min-w-0 items-center rounded-[5px] border border-border bg-background px-2 shadow-none transition-colors hover:bg-muted/30 focus-within:border-border focus-within:bg-muted/25 focus-within:shadow-none focus-within:ring-1 focus-within:ring-foreground/5">
          {controlContents}
        </div>
      </div>
    );
  }

  return (
    <div className={`group relative grid h-7 min-w-0 items-center rounded-[5px] border border-border bg-background px-2 shadow-none transition-colors hover:bg-muted/30 focus-within:border-border focus-within:bg-muted/25 focus-within:shadow-none focus-within:ring-1 focus-within:ring-foreground/5 ${wideLabel ? "grid-cols-[1.75rem_minmax(0,1fr)_auto]" : "grid-cols-[0.875rem_minmax(0,1fr)_auto] gap-x-2"}`}>
      <Hint content={name}><label htmlFor={`layout-${name}`} className={`${wideLabel ? "text-left" : "grid size-3.5 place-items-center"} text-[14px] leading-none font-normal text-muted-foreground [&>svg]:block`}>{label}</label></Hint>
      {controlContents}
    </div>
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

const insetKeywords = [
  { value: "auto", label: "Auto", inputValue: "auto" },
] as const;

type SizingUnit = string;
type SizingOption = { readonly value: string; readonly label: string; readonly inputValue?: string };

function parseSizingValue(value: string | undefined, fallback: number, unitOptions: readonly SizingOption[] = sizingUnits, keywordOptions: readonly SizingOption[] = sizingKeywords) {
  const normalized = value?.trim() || `${fallback}px`;
  const keyword = keywordOptions.find((option) => option.value === normalized);
  if (keyword) return { inputValue: keyword.inputValue || keyword.value, unit: keyword.value };

  const numeric = normalized.match(/^(-?(?:\d+(?:\.\d*)?|\.\d+))([a-z%]*)$/i);
  if (!numeric) return { inputValue: normalized, unit: "px" as SizingUnit };

  const unit = unitOptions.some((option) => option.value === numeric[2]) ? numeric[2] : "px";
  return { inputValue: numeric[1], unit };
}

function sizingCssValue(inputValue: string, unit: SizingUnit, fallback: number, keywordOptions: readonly SizingOption[] = sizingKeywords) {
  const keyword = keywordOptions.find((option) => option.value === unit);
  if (keyword) return keyword.value;
  const value = inputValue.trim() || `${fallback}`;
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
  compactLabel = false,
  inlineLabel,
}: {
  label: React.ReactNode;
  name: string;
  value: string | undefined;
  fallback: number;
  onCommit: (inputValue: string, unit: SizingUnit) => void;
  onReset: () => void;
  unitOptions?: readonly SizingOption[];
  keywordOptions?: readonly SizingOption[];
  compactLabel?: boolean;
  inlineLabel?: boolean;
}) {
  const parsed = parseSizingValue(value, fallback, unitOptions, keywordOptions);
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
      <div className={`group relative min-w-0 rounded-[5px] border border-border bg-background px-2 shadow-none transition-colors hover:bg-muted/30 focus-within:border-border focus-within:bg-muted/25 focus-within:shadow-none focus-within:ring-1 focus-within:ring-foreground/5 ${isInline ? "grid h-7 grid-cols-[1.75rem_minmax(0,1fr)] items-center" : "flex h-7 items-center"}`}>
        {isInline ? <Hint content={name}><label htmlFor={`layout-${name}`} className={`${compactLabel ? "grid size-3.5 place-items-center [&>svg]:block" : ""} text-[14px] leading-4 font-normal text-muted-foreground`}>{label}</label></Hint> : null}
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

  if (!isInline) {
    return (
      <div className="space-y-1">
        <Hint content={name}><label htmlFor={`layout-${name}`} className={inspectorLabelClass}>{label}</label></Hint>
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

function CompactLayoutSelectField({
  label,
  name,
  value,
  options,
  onChange,
  onReset,
}: {
  label: React.ReactNode;
  name: string;
  value: string | undefined;
  options: readonly { value: string; label: string }[];
  onChange: (value: string) => void;
  onReset: () => void;
}) {
  return (
    <div className="group relative grid h-7 min-w-0 grid-cols-[0.875rem_minmax(0,1fr)] items-center gap-x-2 rounded-[5px] border border-border bg-background px-2 shadow-none transition-colors hover:bg-muted/30 focus-within:border-border focus-within:bg-muted/25 focus-within:shadow-none focus-within:ring-1 focus-within:ring-foreground/5">
      <Hint content={name}><label className="grid size-3.5 place-items-center text-[14px] leading-none font-normal text-muted-foreground [&>svg]:block">{label}</label></Hint>
      <Select value={value || options[0]?.value} onValueChange={onChange}>
        <SelectTrigger size="sm" aria-label={`Edit ${name}`} className="h-7 min-w-0 w-full items-center justify-start gap-1 rounded-none border-0 bg-transparent p-0 pr-8 text-[14px] leading-none font-normal text-foreground shadow-none focus-visible:ring-0 [&>svg]:hidden">
          <SelectValue />
        </SelectTrigger>
        <SelectContent position="popper" className="rounded-[5px] p-0.5 shadow-none ring-1 ring-foreground/10">
          {options.map((option) => <SelectItem key={option.value} value={option.value} className="rounded-[3px] px-2 py-1 text-[14px]">{option.label}</SelectItem>)}
        </SelectContent>
      </Select>
      <Hint content={`Reset ${name}`}>
        <Button type="button" variant="ghost" size="icon-xs" className="absolute right-5 top-1/2 z-10 size-4 -translate-y-1/2 rounded bg-background p-0 text-muted-foreground opacity-0 transition-opacity hover:opacity-100 focus-visible:opacity-100" onClick={onReset} aria-label={`Reset ${name}`}>
          <ArrowCounterClockwiseIcon className="size-3.5" />
        </Button>
      </Hint>
      <CaretDownIcon className="pointer-events-none absolute right-0.5 top-1/2 z-10 size-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
    </div>
  );
}

function LayoutLabel({ children }: { children: React.ReactNode }) {
  return <p className={inspectorLabelClass}>{children}</p>;
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
  if (spacingValuePattern.test(value) || /^(?:auto|inherit|initial|unset|revert)$/i.test(value) || /^[a-z-]+\(.*\)$/i.test(value)) return value;
  const currentUnit = currentValue?.trim().match(spacingValuePattern)?.[2] || "px";
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
  return (
    <div className={`group flex min-w-0 items-center justify-center ${className}`}>
      <Input
        id={`spacing-${property}`}
        value={spacingInputValue(value)}
        aria-label={`${label} ${property}`}
        className="h-5 w-8 rounded-[3px] border-transparent bg-transparent px-0.5 text-center text-[11px] font-normal tabular-nums shadow-none hover:border-border hover:bg-background focus-visible:border-border focus-visible:bg-background focus-visible:ring-1 focus-visible:ring-foreground/5"
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
  function commitSpacing(property: SpacingProperty, value: string, currentValue: string | undefined) {
    onApplyStyle(property, spacingCssValue(value, currentValue));
  }

  return (
    <div className="space-y-1">
      <LayoutLabel>Spacing</LayoutLabel>
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

const distributionOptions = [
  { value: "flex-start", label: "Start" },
  { value: "center", label: "Center" },
  { value: "flex-end", label: "End" },
  { value: "space-between", label: "Space between" },
  { value: "space-around", label: "Space around" },
  { value: "space-evenly", label: "Space evenly" },
] as const;

const overflowOptions = [
  { value: "visible", label: "Visible" },
  { value: "hidden", label: "Hidden" },
  { value: "auto", label: "Auto" },
  { value: "scroll", label: "Scroll" },
] as const;

const boxSizingOptions = [
  { value: "content-box", label: "Content-box" },
  { value: "border-box", label: "Border-box" },
] as const;

function normalizeDistribution(value: string | undefined) {
  if (value === "center" || value === "flex-start" || value === "flex-end" || value === "space-between" || value === "space-around" || value === "space-evenly") return value;
  if (value === "start") return "flex-start";
  if (value === "end") return "flex-end";
  return "flex-start";
}

const layoutControlSurface = "flex h-7 overflow-hidden rounded-[5px] border border-border bg-muted/35 p-0.5 shadow-none";
const layoutControlButton = "h-full flex-1 rounded-[3px] text-muted-foreground leading-4 shadow-none transition-colors aria-pressed:bg-background aria-pressed:text-foreground aria-pressed:shadow-none aria-pressed:ring-1 aria-pressed:ring-foreground/5";

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
  const alignIndex = Math.max(0, alignmentValues.indexOf(selection.styles.alignItems as typeof alignmentValues[number]));
  const distribution = normalizeDistribution(selection.styles.justifyContent);
  const justifyIndex = Math.max(0, alignmentValues.indexOf(distribution as typeof alignmentValues[number]));
  const positionMode = selection.styles.position || "static";
  const isFlexContainer = selection.styles.display === "flex" || selection.styles.display === "inline-flex";
  const isFlexItem = selection.parentLayout?.display === "flex" || selection.parentLayout?.display === "inline-flex";
  const isGridContainer = selection.styles.display === "grid" || selection.styles.display === "inline-grid";
  const isGridItem = selection.parentLayout?.display === "grid" || selection.parentLayout?.display === "inline-grid";
  const isColumnFlex = isFlexContainer && (selection.styles.flexDirection === "column" || selection.styles.flexDirection === "column-reverse");
  const isDistributed = distribution.startsWith("space-");

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
            <SizingLayoutField label="MW" name="min-width" value={selection.styles.minWidth} fallback={0} inlineLabel onCommit={(value, unit) => commitSizing("minWidth", value, unit)} onReset={() => onResetStyle("minWidth")} />
            <SizingLayoutField label="MH" name="min-height" value={selection.styles.minHeight} fallback={0} inlineLabel onCommit={(value, unit) => commitSizing("minHeight", value, unit)} onReset={() => onResetStyle("minHeight")} />
          </div>
        </div>

        <LayoutSelectField label="Box Sizing" name="box-sizing" value={selection.styles.boxSizing} options={boxSizingOptions} onChange={(value) => onApplyStyle("boxSizing", value)} />

        <SpacingGroup selection={selection} onApplyStyle={onApplyStyle} />

        <div className="space-y-1">
          <LayoutLabel>Alignment</LayoutLabel>
          <div className="grid grid-cols-2 items-start gap-1">
            <div className="grid w-full grid-cols-3 gap-0.5 rounded-[5px] border border-border bg-muted/35 p-0.5" role="group" aria-label="Alignment and justification">
              {alignmentValues.flatMap((alignValue, row) => alignmentIcons[row].map((AlignmentIcon, column) => {
                const justifyValue = alignmentValues[column];
                const selected = isDistributed
                  ? (isColumnFlex ? column === alignIndex : row === alignIndex)
                  : (isColumnFlex ? row === justifyIndex && column === alignIndex : row === alignIndex && column === justifyIndex);
                return (
                  <Button key={`${alignValue}-${justifyValue}`} type="button" variant="ghost" size="icon-xs" className="h-7 w-full rounded-[3px] text-muted-foreground shadow-none hover:bg-transparent" onClick={() => applyAlignment(row, column)} aria-label={`Align ${alignValue}, justify ${justifyValue}`} aria-pressed={selected}>
                    {selected ? (isDistributed ? <Columns3Filled className="size-3.5" aria-hidden="true" /> : <AlignmentIcon className="size-3.5" aria-hidden="true" />) : <DotIcon className="size-3.5" aria-hidden="true" />}
                  </Button>
                );
              }))}
            </div>
            <div className="space-y-1">
              <CompactLayoutSelectField label={<AlignLeftIcon className="size-3.5" aria-hidden="true" />} name="justify-content" value={distribution} options={distributionOptions} onChange={(value) => onApplyStyle("justifyContent", value)} onReset={() => onResetStyle("justifyContent")} />
              <SizingLayoutField compactLabel label={<SplitHorizontalIcon className="size-3.5" aria-hidden="true" />} name="gap" value={selection.styles.gap} fallback={0} keywordOptions={[]} onCommit={(value, unit) => onApplyStyle("gap", sizingCssValue(value, unit, 0, []))} onReset={() => onResetStyle("gap")} />
              <CompactLayoutField label={<StackSimpleIcon className="size-3.5" aria-hidden="true" />} name="z-index" value={selection.styles.zIndex} onCommit={(value) => onApplyStyle("zIndex", value)} onReset={() => onResetStyle("zIndex")} />
            </div>
          </div>
        </div>
        <div className="space-y-1">
          <LayoutLabel>Display</LayoutLabel>
          <div className={layoutControlSurface} role="group" aria-label="Display">
            {[["block", SquareIcon], ["flex", DotsNineIcon], ["grid", GridFourIcon]].map(([value, Icon]) => (
              <Hint key={value as string} content={`Display ${value}`}>
                <Button key={value as string} type="button" variant="ghost" size="icon-xs" className={layoutControlButton} onClick={() => onApplyStyle("display", value as string)} aria-label={`Display ${value}`} aria-pressed={selection.styles.display === value}><Icon className="size-3.5" /></Button>
              </Hint>
            ))}
          </div>
        </div>
        {isFlexContainer || isFlexItem ? (
          <div className="space-y-2">
            <LayoutLabel>Flex container</LayoutLabel>
            {isFlexContainer ? (
              <div className="space-y-1">
                <div className="grid grid-cols-2 gap-1">
                  <SizingLayoutField label="RG" name="row-gap" value={selection.styles.rowGap} fallback={0} keywordOptions={[]} onCommit={(value, unit) => onApplyStyle("rowGap", sizingCssValue(value, unit, 0, []))} onReset={() => onResetStyle("rowGap")} />
                  <SizingLayoutField label="CG" name="column-gap" value={selection.styles.columnGap} fallback={0} keywordOptions={[]} onCommit={(value, unit) => onApplyStyle("columnGap", sizingCssValue(value, unit, 0, []))} onReset={() => onResetStyle("columnGap")} />
                </div>
              </div>
            ) : null}
            {isFlexItem ? (
              <div className="space-y-1">
                <p className="text-[11px] leading-4 text-muted-foreground">Item</p>
                <div className="grid grid-cols-2 gap-1">
                  <CompactLayoutField label="G" name="flex-grow" value={selection.styles.flexGrow} onCommit={(value) => onApplyStyle("flexGrow", value)} onReset={() => onResetStyle("flexGrow")} />
                  <CompactLayoutField label="S" name="flex-shrink" value={selection.styles.flexShrink} onCommit={(value) => onApplyStyle("flexShrink", value)} onReset={() => onResetStyle("flexShrink")} />
                  <SizingLayoutField label="B" name="flex-basis" value={selection.styles.flexBasis} fallback={0} onCommit={(value, unit) => onApplyStyle("flexBasis", sizingCssValue(value, unit, 0))} onReset={() => onResetStyle("flexBasis")} />
                  <CompactLayoutField label="O" name="order" value={selection.styles.order} onCommit={(value) => onApplyStyle("order", value)} onReset={() => onResetStyle("order")} />
                </div>
                <LayoutSelectField label="AS" name="align-self" value={selection.styles.alignSelf} options={[
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
        {isGridContainer || isGridItem ? (
          <div className="space-y-2">
            <LayoutLabel>Grid container</LayoutLabel>
            {isGridContainer ? (
              <div className="space-y-1">
                <div className="grid grid-cols-2 gap-1">
                  <CompactLayoutField label="C" name="grid-template-columns" value={selection.styles.gridTemplateColumns} wideLabel onCommit={(value) => onApplyStyle("gridTemplateColumns", value)} onReset={() => onResetStyle("gridTemplateColumns")} />
                  <CompactLayoutField label="R" name="grid-template-rows" value={selection.styles.gridTemplateRows} wideLabel onCommit={(value) => onApplyStyle("gridTemplateRows", value)} onReset={() => onResetStyle("gridTemplateRows")} />
                  <SizingLayoutField label="RG" name="row-gap" value={selection.styles.rowGap} fallback={0} keywordOptions={[]} onCommit={(value, unit) => onApplyStyle("rowGap", sizingCssValue(value, unit, 0, []))} onReset={() => onResetStyle("rowGap")} />
                  <SizingLayoutField label="CG" name="column-gap" value={selection.styles.columnGap} fallback={0} keywordOptions={[]} onCommit={(value, unit) => onApplyStyle("columnGap", sizingCssValue(value, unit, 0, []))} onReset={() => onResetStyle("columnGap")} />
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
            {isGridItem ? (
              <div className="space-y-1">
                <p className="text-[11px] leading-4 text-muted-foreground">Item</p>
                <div className="grid grid-cols-2 gap-1">
                  <CompactLayoutField label="CS" name="grid-column-start" value={selection.styles.gridColumnStart} onCommit={(value) => onApplyStyle("gridColumnStart", value)} onReset={() => onResetStyle("gridColumnStart")} />
                  <CompactLayoutField label="CE" name="grid-column-end" value={selection.styles.gridColumnEnd} onCommit={(value) => onApplyStyle("gridColumnEnd", value)} onReset={() => onResetStyle("gridColumnEnd")} />
                  <CompactLayoutField label="RS" name="grid-row-start" value={selection.styles.gridRowStart} onCommit={(value) => onApplyStyle("gridRowStart", value)} onReset={() => onResetStyle("gridRowStart")} />
                  <CompactLayoutField label="RE" name="grid-row-end" value={selection.styles.gridRowEnd} onCommit={(value) => onApplyStyle("gridRowEnd", value)} onReset={() => onResetStyle("gridRowEnd")} />
                  <CompactLayoutField label="A" name="grid-area" value={selection.styles.gridArea} onCommit={(value) => onApplyStyle("gridArea", value)} onReset={() => onResetStyle("gridArea")} />
                </div>
                <LayoutSelectField label="JS" name="justify-self" value={selection.styles.justifySelf} options={[
                  { value: "auto", label: "Auto" },
                  { value: "start", label: "Start" },
                  { value: "end", label: "End" },
                  { value: "center", label: "Center" },
                  { value: "stretch", label: "Stretch" },
                ]} onChange={(value) => onApplyStyle("justifySelf", value)} />
                <LayoutSelectField label="AS" name="align-self" value={selection.styles.alignSelf} options={[
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
        <div className="space-y-1">
          <LayoutLabel>Flow</LayoutLabel>
          {isFlexContainer ? (
            <div className="grid grid-cols-[minmax(0,1fr)_1.75rem] gap-1">
              <div className={layoutControlSurface} role="group" aria-label="Flex direction">
                <Hint content="Flex direction row">
                  <Button type="button" variant="ghost" size="icon-xs" className={layoutControlButton} onClick={() => onApplyStyle("flexDirection", "row")} aria-label="Flex direction row" aria-pressed={selection.styles.flexDirection === "row"}><RowsIcon className="size-3.5" /></Button>
                </Hint>
                <Hint content="Flex direction column">
                  <Button type="button" variant="ghost" size="icon-xs" className={layoutControlButton} onClick={() => onApplyStyle("flexDirection", "column")} aria-label="Flex direction column" aria-pressed={selection.styles.flexDirection === "column"}><ColumnsIcon className="size-3.5" /></Button>
                </Hint>
              </div>
              <Hint content={selection.styles.flexWrap === "wrap" ? "Disable flex wrap" : "Enable flex wrap"}>
                <Button type="button" variant="ghost" size="icon-xs" className="size-7 rounded-[5px] border border-border bg-muted/35 text-muted-foreground shadow-none aria-pressed:bg-background aria-pressed:text-foreground aria-pressed:shadow-none aria-pressed:ring-1 aria-pressed:ring-foreground/5" onClick={() => onApplyStyle("flexWrap", selection.styles.flexWrap === "wrap" ? "nowrap" : "wrap")} aria-label="Toggle flex wrap" aria-pressed={selection.styles.flexWrap === "wrap"}><ArrowElbowDownLeftIcon className="size-3.5" /></Button>
              </Hint>
            </div>
          ) : null}
          <Select value={positionMode} onValueChange={(value) => onApplyStyle("position", value)}>
            <SelectTrigger aria-label="Position" className={`${inspectorFieldClass} h-7 w-full px-2 font-normal hover:bg-muted/30 focus-visible:ring-1 focus-visible:ring-foreground/5`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent position="popper" className="rounded-[5px] p-0.5 shadow-none ring-1 ring-foreground/10">
              <SelectItem value="static" className="rounded-[3px] px-2 py-1 text-[14px]">Static</SelectItem>
              <SelectItem value="relative" className="rounded-[3px] px-2 py-1 text-[14px]">Relative</SelectItem>
              <SelectItem value="absolute" className="rounded-[3px] px-2 py-1 text-[14px]">Absolute</SelectItem>
              <SelectItem value="fixed" className="rounded-[3px] px-2 py-1 text-[14px]">Fixed</SelectItem>
            </SelectContent>
          </Select>
          {positionMode !== "static" ? (
            <div className="space-y-1 pt-1">
              <LayoutLabel>Inset</LayoutLabel>
              <div className="grid grid-cols-2 gap-1">
                <SizingLayoutField label="T" name="top" value={selection.styles.top} fallback={0} keywordOptions={insetKeywords} onCommit={(value, unit) => commitInset("top", value, unit)} onReset={() => onResetStyle("top")} />
                <SizingLayoutField label="B" name="bottom" value={selection.styles.bottom} fallback={0} keywordOptions={insetKeywords} onCommit={(value, unit) => commitInset("bottom", value, unit)} onReset={() => onResetStyle("bottom")} />
                <SizingLayoutField label="R" name="right" value={selection.styles.right} fallback={0} keywordOptions={insetKeywords} onCommit={(value, unit) => commitInset("right", value, unit)} onReset={() => onResetStyle("right")} />
                <SizingLayoutField label="L" name="left" value={selection.styles.left} fallback={0} keywordOptions={insetKeywords} onCommit={(value, unit) => commitInset("left", value, unit)} onReset={() => onResetStyle("left")} />
              </div>
              {positionMode === "absolute" || positionMode === "fixed" ? (
                <div className="flex items-center justify-between px-1 text-[11px] leading-4">
                  <span className="text-muted-foreground">Anchor</span>
                  <span className="text-foreground">{positionMode === "fixed" ? "Viewport" : "Nearest positioned parent"}</span>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
        <LayoutSelectField label="Overflow" name="overflow" value={selection.styles.overflow || "visible"} options={overflowOptions} onChange={(value) => onApplyStyle("overflow", value)} />
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

function PropertiesSidebar({
  selection,
  projectPath,
  inspectMode,
  isDesktop,
  codexAvailability,
  codexStatus,
  projectServerStatus,
  canvasBackground,
  onToggleInspect,
  onBuild,
  onCanvasBackgroundChange,
  onApplyStyle,
  onResetStyle,
  onApplyText,
  onResetText,
  onResetAll,
}: {
  selection: SelectedElement | null;
  projectPath: string | null;
  inspectMode: boolean;
  isDesktop: boolean;
  codexAvailability: CodexAvailability;
  codexStatus: CodexStatus;
  projectServerStatus: ProjectServerStatus;
  canvasBackground: string;
  onToggleInspect: () => void;
  onBuild: () => void;
  onCanvasBackgroundChange: (value: string) => void;
  onApplyStyle: (property: string, value: string) => void;
  onResetStyle: (property: string) => void;
  onApplyText: (value: string) => void;
  onResetText: () => void;
  onResetAll: () => void;
}) {
  const buildIndicator = getBuildIndicator(codexAvailability, Boolean(selection?.previewChanges?.length));
  const buildBlocked = !isDesktop || codexAvailability.state !== "available" || !projectPath || !selection?.previewChanges?.length || codexStatus.state === "working";

  return (
    <aside className="flex h-screen w-72 shrink-0 flex-col border-l border-border bg-background text-foreground">
      <header className="shrink-0 border-b border-border bg-background px-3 py-2.5">
        <div className="flex items-center justify-end gap-1">
          <Hint content={inspectMode ? "Stop inspecting" : "Inspect element"}>
            <Button
              type="button"
              variant={inspectMode ? "default" : "ghost"}
              size="icon"
              onClick={onToggleInspect}
              disabled={!isDesktop}
              aria-pressed={inspectMode}
              aria-label={inspectMode ? "Stop inspecting" : "Inspect element"}
            >
              <CursorIcon />
            </Button>
          </Hint>
          <Hint content="Reset preview">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={onResetAll}
              disabled={!selection}
              aria-label="Reset preview"
            >
              <ArrowCounterClockwiseIcon />
            </Button>
          </Hint>
          <Hint content={!isDesktop ? "Open Formia in the desktop app to enable Build" : buildIndicator === "unavailable" || buildIndicator === "checking" ? codexAvailability.message : !projectPath ? "Select a project from the desktop app to enable Build" : buildIndicator === "up-to-date" ? buildIndicatorLabel(buildIndicator) : "Send staged visual changes to Codex"}>
            <Button
              type="button"
              size="lg"
              className={`pl-4 font-normal ${buildBlocked ? "cursor-not-allowed" : ""}`}
              onClick={() => {
                if (!buildBlocked) onBuild();
              }}
              aria-disabled={buildBlocked}
              aria-label="Build visual changes with Codex"
            >
              <span className={`size-[6px] shrink-0 rounded-full ${buildIndicatorClass(buildIndicator)}`} aria-hidden="true" />
              Build
            </Button>
          </Hint>
        </div>
      </header>

      {codexAvailability.state !== "available" || codexStatus.state !== "idle" || projectServerStatus.state === "failed" ? (
        <section className="shrink-0 space-y-2 border-b border-border px-3.5 py-3">
          {codexAvailability.state !== "available" ? (
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
            <Hint content={projectServerStatus.message}>
              <p className="flex items-center gap-1.5 text-xs text-destructive" role="status">
                <WarningCircleIcon className="size-3 shrink-0" />
                <span className="truncate">{projectServerStatus.message}</span>
              </p>
            </Hint>
          ) : null}
        </section>
      ) : null}

      <div className="min-h-0 flex-1 overflow-y-auto">
        {selection ? (
          <>
            {selection.react && typeof selection.react.props === "object" && selection.react.props !== null ? (
              <PropertyGroup title="React props" values={selection.react.props as Record<string, unknown>} />
            ) : null}
            {selection.textEditable ? <ContentGroup value={selection.text} onCommit={onApplyText} onReset={onResetText} /> : null}
            <LayoutGroup key={selection.selectionId ?? `${selection.tagName}-${selection.id ?? "selected"}`} selection={selection} onApplyStyle={onApplyStyle} onResetStyle={onResetStyle} />
            <TypographyGroup selection={selection} onApplyStyle={onApplyStyle} onResetStyle={onResetStyle} />
            <ColorGroup selection={selection} onApplyStyle={onApplyStyle} onResetStyle={onResetStyle} />
            <BorderGroup selection={selection} onApplyStyle={onApplyStyle} onResetStyle={onResetStyle} />
            <PropertyGroup title="Attributes" values={selection.attributes} />
          </>
        ) : (
          <>
            <section className={inspectorSectionClass}>
              <label htmlFor="canvas-background-color" className={inspectorLabelClass}>Canvas background</label>
              <div className="mt-1 grid grid-cols-[2.25rem_minmax(0,1fr)] items-center gap-1">
                <input
                  id="canvas-background-color"
                  type="color"
                  value={canvasBackground}
                  onChange={(event) => onCanvasBackgroundChange(event.target.value)}
                  className="h-7 w-full cursor-pointer rounded-[5px] border border-border bg-background p-1"
                  aria-label="Canvas background color"
                />
                <span className={`${inspectorFieldClass} flex h-7 items-center font-mono text-[12px] uppercase`}>{canvasBackground}</span>
              </div>
            </section>
            <div className="flex min-h-64 flex-col items-center justify-center px-8 text-center">
              <CursorIcon className="mb-3 size-6 text-muted-foreground" />
              <p className="text-xs leading-5 text-muted-foreground">
                Turn on Inspect, then click any visible element in the application.
              </p>
            </div>
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

export function ProjectWorkspace({
  active,
  projectName,
  projectPath,
  codexAvailability,
  onBack,
}: {
  active: boolean;
  projectName: string;
  projectPath: string | null;
  codexAvailability: CodexAvailability;
  onBack: () => void;
}) {
  const isDesktop = useSyncExternalStore(subscribeToRuntime, getDesktopSnapshot, getDesktopServerSnapshot);
  const [canvasUrl, setCanvasUrl] = useState<string | null>(null);
  const [canvasKey, setCanvasKey] = useState(0);
  const [inspectMode, setInspectMode] = useState(false);
  const [selection, setSelection] = useState<SelectedElement | null>(null);
  const [canvasBackground, setCanvasBackground] = useState("#f9f9f9");
  const [codexStatus, setCodexStatus] = useState<CodexStatus>({ state: "idle", message: "" });
  const [projectServerStatus, setProjectServerStatus] = useState<ProjectServerStatus>({ state: "stopped", message: "" });
  const [zoom, setZoom] = useState(0.75);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [panMode, setPanMode] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  const canvasViewportRef = useRef<HTMLDivElement>(null);
  const panStartRef = useRef<{ pointerX: number; pointerY: number; panX: number; panY: number } | null>(null);
  const webviewHostRef = useRef<HTMLDivElement>(null);
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
    const host = webviewHostRef.current;
    if (!host) return;

    host.replaceChildren();
    webviewRef.current = null;
    if (!active || !isDesktop || !canvasUrl || !window.formiaDesktop) return;

    const webview = document.createElement("webview") as FormiaWebviewElement;
    webview.className = "h-full w-full";
    webview.setAttribute("preload", window.formiaDesktop.inspectorPreloadUrl);
    webview.setAttribute("partition", "persist:formia-canvas");

    const syncInspectMode = () => webview.send("formia:set-inspect-mode", false);
    const receiveSelection = (event: Event) => {
      const message = event as FormiaWebviewEvent;
      if (message.channel === "formia:canvas-wheel") {
        handleWebviewWheel(message.args[0] as CanvasWheelInput);
        return;
      }
      if (message.channel === "formia:element-selected" || message.channel === "formia:element-updated") {
        setSelection(message.args[0] as SelectedElement);
        return;
      }
      if (message.channel === "formia:selection-cleared") {
        setSelection(null);
      }
    };

    webview.addEventListener("did-finish-load", syncInspectMode);
    webview.addEventListener("ipc-message", receiveSelection);
    host.appendChild(webview);
    webviewRef.current = webview;
    webview.setAttribute("src", canvasUrl);

    return () => {
      webview.removeEventListener("did-finish-load", syncInspectMode);
      webview.removeEventListener("ipc-message", receiveSelection);
      if (webviewRef.current === webview) webviewRef.current = null;
      webview.remove();
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
    let subscribed = true;
    const applyProjectServerStatus = (status: ProjectServerStatus) => {
      setProjectServerStatus(status);
      if (status.state === "starting") {
        setCanvasUrl(null);
        setSelection(null);
      }
      if (status.url) {
        setCanvasUrl(status.url);
        setCanvasKey((key) => key + 1);
        setSelection(null);
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

  function sendCanvasMessage(channel: string, ...args: unknown[]) {
    webviewRef.current?.send(channel, ...args);
  }

  function clearCanvasSelection() {
    setSelection(null);
    sendCanvasMessage("formia:clear-selection");
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

  function goBack() {
    void window.formiaDesktop?.stopProjectServer();
    onBack();
  }

  return (
    <main className={active ? "relative flex h-screen overflow-hidden bg-muted/50" : "hidden"}>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="min-h-0 flex-1">
          <div
            ref={canvasViewportRef}
            className={`relative h-full w-full overflow-hidden touch-none ${isPanning || panMode ? "cursor-grabbing" : "cursor-default"}`}
            style={{ backgroundColor: canvasBackground }}
            onWheel={handleCanvasWheel}
            onPointerDown={(event) => {
              const clickedWebview = event.target === webviewRef.current;
              if (!clickedWebview) clearCanvasSelection();
              if (!clickedWebview || event.button === 1) beginPan(event);
            }}
            onPointerMove={movePan}
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
                  width: artboardSize.width,
                  height: artboardSize.height,
                  transform: `translate(-50%, -50%) translate(${pan.x}px, ${pan.y}px)`,
                }}
              >
                <div className="h-full w-full shadow-[0_2px_8px_rgba(0,0,0,0.04),0_4px_40px_rgba(0,0,0,0.05)] ring-1 ring-black/5" style={{ transform: `scale(${zoom})`, transformOrigin: "center center" }}>
                  <div className="h-full w-full overflow-hidden bg-white">
                    {active && isDesktop && window.formiaDesktop && canvasUrl ? (
                      <div key={`${canvasUrl}-${canvasKey}`} ref={webviewHostRef} className="h-full w-full" />
                    ) : canvasUrl ? (
                      <iframe key={`${canvasUrl}-${canvasKey}`} src={canvasUrl} title={`${projectName} application canvas`} className="h-full w-full" />
                    ) : (
                    <div className="flex h-full w-full items-center justify-center bg-background px-10 text-center">
                      <div>
                        {projectServerStatus.state === "starting" ? <CircleNotchIcon className="mx-auto mb-3 size-5 animate-spin text-muted-foreground" /> : null}
                        {projectServerStatus.state === "failed" ? <WarningCircleIcon className="mx-auto mb-3 size-5 text-destructive" /> : null}
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

            <div className="absolute bottom-4 left-4 z-30 flex items-center gap-1 rounded-xl border border-border/70 bg-background/95 p-1 shadow-[0_2px_8px_rgba(0,0,0,0.04),0_4px_40px_rgba(0,0,0,0.03)] backdrop-blur">
              <Hint content="Pan canvas (Space + drag)">
                <Button type="button" variant={panMode ? "default" : "ghost"} size="icon-sm" onClick={() => setPanMode((enabled) => !enabled)} aria-label="Pan canvas (Space + drag)">
                  <HandGrabbingIcon />
                </Button>
              </Hint>
              <div className="mx-1 h-5 w-px bg-border" />
              <Button type="button" variant="ghost" size="icon-sm" onClick={() => zoomCanvas(-0.1)} disabled={zoom <= minZoom} aria-label="Zoom out">
                <MinusIcon />
              </Button>
              <span className="min-w-12 text-center text-xs font-medium tabular-nums text-muted-foreground" aria-label={`Canvas zoom ${Math.round(zoom * 100)} percent`}>
                {Math.round(zoom * 100)}%
              </span>
              <Button type="button" variant="ghost" size="icon-sm" onClick={() => zoomCanvas(0.1)} disabled={zoom >= maxZoom} aria-label="Zoom in">
                <PlusIcon />
              </Button>
              <div className="mx-1 h-5 w-px bg-border" />
              <Hint content="Fit artboard to canvas">
                <Button type="button" variant="ghost" size="icon-sm" onClick={fitCanvas} aria-label="Fit artboard to canvas">
                  <ArrowsOutIcon />
                </Button>
              </Hint>
            </div>
            <div className="pointer-events-none absolute bottom-5 right-5 z-10 hidden text-[11px] text-muted-foreground sm:block">
              Scroll to zoom · Pinch to zoom · Shift + scroll to pan · Space + drag
                  </div>
                </div>
              </div>
            </div>

      <Hint content="Back to project selection">
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="absolute left-3 top-3 z-40 bg-background/95 shadow-[0_2px_8px_rgba(0,0,0,0.08)] backdrop-blur"
          onClick={goBack}
          aria-label="Back to project selection"
        >
          <ArrowLeftIcon />
        </Button>
      </Hint>

      <PropertiesSidebar
        selection={selection}
        projectPath={projectPath}
        inspectMode={inspectMode}
        isDesktop={isDesktop}
        codexAvailability={codexAvailability}
        codexStatus={codexStatus}
        projectServerStatus={projectServerStatus}
        canvasBackground={canvasBackground}
        onToggleInspect={() => setInspectMode((enabled) => !enabled)}
        onBuild={() => void buildWithCodex()}
        onCanvasBackgroundChange={setCanvasBackground}
        onApplyStyle={(property, value) => sendCanvasMessage("formia:apply-style", { property, value })}
        onResetStyle={(property) => sendCanvasMessage("formia:reset-style", property)}
        onApplyText={(value) => sendCanvasMessage("formia:apply-text", value)}
        onResetText={() => sendCanvasMessage("formia:reset-text")}
        onResetAll={resetPreview}
      />
    </main>
  );
}
