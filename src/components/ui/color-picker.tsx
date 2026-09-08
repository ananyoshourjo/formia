"use client";

import * as React from "react";
import { EyedropperIcon } from "@phosphor-icons/react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type ColorFormat = "hex" | "rgb" | "hsl";
type RgbaColor = { r: number; g: number; b: number; a: number };
type HsvaColor = { h: number; s: number; v: number; a: number };

type ColorPickerProps = {
  value: string;
  onChange: (value: string) => void;
  ariaLabel?: string;
};

const swatches = ["#000000", "#6b7280", "#d1d5db", "#93c5fd", "#818cf8", "#ec4899"];

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function round(value: number, digits = 0) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function hexToRgba(value: string): RgbaColor | null {
  const match = value.trim().match(/^#([0-9a-f]{3,8})$/i);
  if (!match) return null;

  let hex = match[1];
  if (hex.length === 3 || hex.length === 4) hex = hex.split("").map((digit) => `${digit}${digit}`).join("");
  if (hex.length === 6) hex += "ff";
  if (hex.length !== 8) return null;

  return {
    r: parseInt(hex.slice(0, 2), 16),
    g: parseInt(hex.slice(2, 4), 16),
    b: parseInt(hex.slice(4, 6), 16),
    a: round(parseInt(hex.slice(6, 8), 16) / 255, 2),
  };
}

function parseRgb(value: string): RgbaColor | null {
  const match = value.trim().match(/^rgba?\(\s*([^)]*)\)$/i);
  if (!match) return null;
  const parts = match[1].replaceAll(",", " ").replace("/", " /").trim().split(/\s+/);
  const slashIndex = parts.indexOf("/");
  const channels = slashIndex >= 0 ? parts.slice(0, slashIndex) : parts;
  const alphaValue = slashIndex >= 0 ? parts[slashIndex + 1] : channels.length > 3 ? channels[3] : "1";
  if (channels.length < 3) return null;

  const parseChannel = (channel: string) => {
    const parsed = Number.parseFloat(channel);
    if (!Number.isFinite(parsed)) return null;
    return clamp(channel.endsWith("%") ? parsed * 2.55 : parsed, 0, 255);
  };
  const r = parseChannel(channels[0]);
  const g = parseChannel(channels[1]);
  const b = parseChannel(channels[2]);
  const alpha = Number.parseFloat(alphaValue);
  if (r === null || g === null || b === null || !Number.isFinite(alpha)) return null;

  return { r, g, b, a: clamp(alphaValue.endsWith("%") ? alpha / 100 : alpha, 0, 1) };
}

function hslToRgba(h: number, s: number, l: number, a: number): RgbaColor {
  const saturation = s / 100;
  const lightness = l / 100;
  const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation;
  const segment = (((h % 360) + 360) % 360) / 60;
  const secondary = chroma * (1 - Math.abs((segment % 2) - 1));
  const match = lightness - chroma / 2;
  let r = 0;
  let g = 0;
  let b = 0;

  if (segment < 1) [r, g, b] = [chroma, secondary, 0];
  else if (segment < 2) [r, g, b] = [secondary, chroma, 0];
  else if (segment < 3) [r, g, b] = [0, chroma, secondary];
  else if (segment < 4) [r, g, b] = [0, secondary, chroma];
  else if (segment < 5) [r, g, b] = [secondary, 0, chroma];
  else [r, g, b] = [chroma, 0, secondary];

  return { r: round((r + match) * 255), g: round((g + match) * 255), b: round((b + match) * 255), a };
}

function rgbaToHsva({ r, g, b, a }: RgbaColor): HsvaColor {
  const red = r / 255;
  const green = g / 255;
  const blue = b / 255;
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const delta = max - min;
  let h = 270;

  if (delta) {
    if (max === red) h = 60 * (((green - blue) / delta) % 6);
    else if (max === green) h = 60 * ((blue - red) / delta + 2);
    else h = 60 * ((red - green) / delta + 4);
  }

  return { h: (h + 360) % 360, s: max ? (delta / max) * 100 : 0, v: max * 100, a };
}

function hsvaToRgba({ h, s, v, a }: HsvaColor): RgbaColor {
  const saturation = s / 100;
  const value = v / 100;
  const chroma = value * saturation;
  const segment = (((h % 360) + 360) % 360) / 60;
  const secondary = chroma * (1 - Math.abs((segment % 2) - 1));
  const match = value - chroma;
  let r = 0;
  let g = 0;
  let b = 0;

  if (segment < 1) [r, g, b] = [chroma, secondary, 0];
  else if (segment < 2) [r, g, b] = [secondary, chroma, 0];
  else if (segment < 3) [r, g, b] = [0, chroma, secondary];
  else if (segment < 4) [r, g, b] = [0, secondary, chroma];
  else if (segment < 5) [r, g, b] = [secondary, 0, chroma];
  else [r, g, b] = [chroma, 0, secondary];

  return { r: round((r + match) * 255), g: round((g + match) * 255), b: round((b + match) * 255), a };
}

function parseHsl(value: string): RgbaColor | null {
  const match = value.trim().match(/^hsla?\(\s*([^)]*)\)$/i);
  if (!match) return null;
  const parts = match[1].replaceAll(",", " ").replace("/", " /").trim().split(/\s+/);
  const slashIndex = parts.indexOf("/");
  const channels = slashIndex >= 0 ? parts.slice(0, slashIndex) : parts;
  const alphaValue = slashIndex >= 0 ? parts[slashIndex + 1] : channels.length > 3 ? channels[3] : "1";
  if (channels.length < 3) return null;

  const h = Number.parseFloat(channels[0]);
  const s = Number.parseFloat(channels[1]);
  const l = Number.parseFloat(channels[2]);
  const alpha = Number.parseFloat(alphaValue);
  if (![h, s, l, alpha].every(Number.isFinite)) return null;

  return hslToRgba(h, clamp(s, 0, 100), clamp(l, 0, 100), clamp(alphaValue.endsWith("%") ? alpha / 100 : alpha, 0, 1));
}

function parseColor(value: string): HsvaColor {
  const rgba = hexToRgba(value) || parseRgb(value) || parseHsl(value) || { r: 0, g: 0, b: 0, a: 1 };
  return rgbaToHsva(rgba);
}

function parseColorIfValid(value: string) {
  const rgba = hexToRgba(value) || parseRgb(value) || parseHsl(value);
  return rgba ? rgbaToHsva(rgba) : null;
}

function rgbaToHex({ r, g, b, a }: RgbaColor) {
  const channel = (value: number) => Math.round(value).toString(16).padStart(2, "0");
  return `#${channel(r)}${channel(g)}${channel(b)}${a < 0.995 ? channel(a * 255) : ""}`;
}

function rgbaToHsl({ r, g, b, a }: RgbaColor) {
  const red = r / 255;
  const green = g / 255;
  const blue = b / 255;
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const delta = max - min;
  const l = (max + min) / 2;
  const s = delta === 0 ? 0 : delta / (1 - Math.abs(2 * l - 1));
  let h = 0;

  if (delta) {
    if (max === red) h = 60 * (((green - blue) / delta) % 6);
    else if (max === green) h = 60 * ((blue - red) / delta + 2);
    else h = 60 * ((red - green) / delta + 4);
  }

  return { h: round((h + 360) % 360), s: round(s * 100), l: round(l * 100), a: round(a, 2) };
}

function formatLabel(format: ColorFormat) {
  return format === "hex" ? "Hex" : format.toUpperCase();
}

function toRgbaString(rgb: RgbaColor, alpha: number) {
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${round(alpha, 2)})`;
}

export function ColorPicker({ value, onChange, ariaLabel = "Choose color" }: ColorPickerProps) {
  const color = value || "#000000";
  const inputId = React.useId();
  const [open, setOpen] = React.useState(false);
  const [format, setFormat] = React.useState<ColorFormat>("hex");
  const [hsva, setHsva] = React.useState(() => parseColor(color));

  function syncFromValue(nextValue: string) {
    const nextHsva = parseColor(nextValue);
    setHsva(nextHsva);
  }

  function handleOpenChange(nextOpen: boolean) {
    if (nextOpen) syncFromValue(color);
    setOpen(nextOpen);
  }

  function commitHsva(nextHsva: HsvaColor) {
    setHsva(nextHsva);
    onChange(rgbaToHex(hsvaToRgba(nextHsva)));
  }

  function handleInputChange(nextValue: string) {
    const nextHsva = parseColorIfValid(nextValue);
    if (nextHsva) commitHsva(nextHsva);
  }

  function handleFormatChange(nextFormat: ColorFormat) {
    setFormat(nextFormat);
  }

  async function pickFromScreen() {
    const EyeDropper = (window as typeof window & {
      EyeDropper?: new () => { open: () => Promise<{ sRGBHex: string }> };
    }).EyeDropper;
    if (!EyeDropper) return;

    try {
      const result = await new EyeDropper().open();
      commitHsva(parseColor(result.sRGBHex));
    } catch {
      // Escape/cancel is an expected outcome for the browser eyedropper.
    }
  }

  const updatePlane = (clientX: number, clientY: number, element: HTMLElement) => {
    const rect = element.getBoundingClientRect();
    const s = clamp(((clientX - rect.left) / rect.width) * 100, 0, 100);
    const v = clamp(100 - ((clientY - rect.top) / rect.height) * 100, 0, 100);
    commitHsva({ ...hsva, s: round(s, 1), v: round(v, 1) });
  };

  const handlePlanePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    const target = event.currentTarget;
    target.setPointerCapture(event.pointerId);
    updatePlane(event.clientX, event.clientY, target);
  };

  const handlePlanePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if ((event.buttons & 1) !== 1) return;
    updatePlane(event.clientX, event.clientY, event.currentTarget);
  };

  const rgb = hsvaToRgba(hsva);
  const hsl = rgbaToHsl(rgb);
  const hex = rgbaToHex(rgb);
  const checkerboard = {
    backgroundImage: "linear-gradient(45deg, #d4d4d8 25%, transparent 25%), linear-gradient(-45deg, #d4d4d8 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #d4d4d8 75%), linear-gradient(-45deg, transparent 75%, #d4d4d8 75%)",
    backgroundSize: "10px 10px",
    backgroundPosition: "0 0, 0 5px, 5px -5px, -5px 0px",
  } as const;

  const triggerColor = rgbaToHex(hsvaToRgba(parseColor(color)));

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button type="button" variant="ghost" size="icon-xs" className="size-4 shrink-0 rounded-[3px] border border-border p-0 focus-visible:ring-1 focus-visible:ring-foreground/20" style={{ backgroundColor: triggerColor }} aria-label={ariaLabel} />
      </PopoverTrigger>
      <PopoverContent side="right" align="start" sideOffset={8} className="w-[320px] border-0 bg-transparent p-0 shadow-none">
        <div className="w-full max-w-[320px] space-y-3 rounded-xl border bg-background p-3 shadow-sm">
          <div className="relative h-56 w-full overflow-hidden rounded-lg border" style={checkerboard}>
            <div className="absolute inset-0" style={{ backgroundColor: `hsl(${hsva.h} 100% 50%)` }} />
            <div className="absolute inset-0 bg-gradient-to-r from-white to-transparent" />
            <div className="absolute inset-0 bg-gradient-to-t from-black to-transparent" />
            <div className="absolute inset-0 cursor-crosshair touch-none" onPointerDown={handlePlanePointerDown} onPointerMove={handlePlanePointerMove}>
              <div className="absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow" style={{ left: `${hsva.s}%`, top: `${100 - hsva.v}%`, backgroundColor: toRgbaString(rgb, hsva.a) }} />
            </div>
          </div>

          <div className="space-y-2">
            <div className="relative h-4 overflow-hidden rounded-full border" style={checkerboard}>
              <input type="range" min={0} max={360} value={hsva.h} onChange={(event) => commitHsva({ ...hsva, h: Number(event.target.value) })} className="figma-range absolute inset-0 m-0 h-full w-full cursor-pointer appearance-none rounded-full p-0" style={{ background: "linear-gradient(to right, #ff0000 0%, #ffff00 17%, #00ff00 33%, #00ffff 50%, #0000ff 67%, #ff00ff 83%, #ff0000 100%)" }} aria-label="Hue" />
            </div>
            <div className="relative h-4 overflow-hidden rounded-full border" style={checkerboard}>
              <input type="range" min={0} max={100} value={Math.round(hsva.a * 100)} onChange={(event) => commitHsva({ ...hsva, a: Number(event.target.value) / 100 })} className="figma-range absolute inset-0 m-0 h-full w-full cursor-pointer appearance-none rounded-full p-0" style={{ background: `linear-gradient(to right, rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0), rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 1))` }} aria-label="Opacity" />
            </div>
          </div>

          <div className="grid grid-cols-[auto_1fr_auto] items-center gap-2">
            <Button type="button" variant="outline" size="icon" className="size-9 rounded-[6px] p-0 text-muted-foreground" onClick={() => void pickFromScreen()} aria-label="Pick color from screen">
              <EyedropperIcon className="size-4" />
            </Button>
            <Input id={`color-picker-value-${inputId}`} value={format === "hex" ? hex.toUpperCase() : format === "rgb" ? `${rgb.r}, ${rgb.g}, ${rgb.b}` : `${hsl.h}, ${hsl.s}%, ${hsl.l}%`} onChange={(event) => handleInputChange(event.currentTarget.value)} aria-label={`Edit ${formatLabel(format)} color`} className="h-9 rounded-[6px] px-2.5 font-mono text-xs uppercase" />
            <Select value={format} onValueChange={(next) => handleFormatChange(next as ColorFormat)}>
              <SelectTrigger size="default" aria-label="Color format" className="h-9 w-full rounded-[6px] px-2.5 text-xs font-normal"><SelectValue /></SelectTrigger>
              <SelectContent position="popper" className="min-w-20 rounded-[6px] p-0.5">
                <SelectItem value="hex" className="rounded-[3px] px-2 py-1 text-xs">Hex</SelectItem>
                <SelectItem value="rgb" className="rounded-[3px] px-2 py-1 text-xs">RGB</SelectItem>
                <SelectItem value="hsl" className="rounded-[3px] px-2 py-1 text-xs">HSL</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-wrap gap-2">
            {swatches.map((swatch) => (
              <Button key={swatch} type="button" variant="ghost" size="icon-xs" className="size-6 rounded-[4px] border border-border/60 p-0 focus-visible:ring-1 focus-visible:ring-foreground/20" style={{ backgroundColor: swatch }} onClick={() => commitHsva(parseColor(swatch))} aria-label={`Use ${swatch}`} />
            ))}
          </div>
        </div>
        <style jsx global>{`
          .figma-range::-webkit-slider-thumb {
            -webkit-appearance: none;
            appearance: none;
            width: 16px;
            height: 16px;
            border-radius: 9999px;
            border: 2px solid #ffffff;
            background: #2563eb;
            box-shadow: 0 1px 4px rgba(0, 0, 0, 0.35);
            margin-top: -2px;
          }
          .figma-range::-webkit-slider-runnable-track { height: 100%; border-radius: 9999px; }
          .figma-range::-moz-range-thumb {
            width: 16px;
            height: 16px;
            border-radius: 9999px;
            border: 2px solid #ffffff;
            background: #2563eb;
            box-shadow: 0 1px 4px rgba(0, 0, 0, 0.35);
          }
          .figma-range::-moz-range-track { height: 100%; border-radius: 9999px; }
        `}</style>
      </PopoverContent>
    </Popover>
  );
}
