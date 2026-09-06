"use client";

import * as React from "react";
import { HsvaColorPicker, type HsvaColor } from "react-colorful";
import { EyedropperIcon } from "@phosphor-icons/react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type ColorFormat = "hex" | "rgb" | "hsl";
type RgbaColor = { r: number; g: number; b: number; a: number };

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
  let h = 0;

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

function formatColor(hsva: HsvaColor, format: ColorFormat) {
  const rgba = hsvaToRgba(hsva);
  if (format === "hex") return rgbaToHex(rgba);
  if (format === "rgb") {
    return rgba.a < 0.995 ? `rgba(${rgba.r}, ${rgba.g}, ${rgba.b}, ${round(rgba.a, 2)})` : `rgb(${rgba.r}, ${rgba.g}, ${rgba.b})`;
  }

  const hsl = rgbaToHsl(rgba);
  return hsl.a < 0.995 ? `hsla(${hsl.h}, ${hsl.s}%, ${hsl.l}%, ${hsl.a})` : `hsl(${hsl.h}, ${hsl.s}%, ${hsl.l}%)`;
}

function formatLabel(format: ColorFormat) {
  return format === "hex" ? "Hex" : format.toUpperCase();
}

export function ColorPicker({ value, onChange, ariaLabel = "Choose color" }: ColorPickerProps) {
  const color = value || "#000000";
  const inputId = React.useId();
  const [open, setOpen] = React.useState(false);
  const [format, setFormat] = React.useState<ColorFormat>("hex");
  const [hsva, setHsva] = React.useState(() => parseColor(color));
  const [inputValue, setInputValue] = React.useState(() => formatColor(parseColor(color), "hex").toUpperCase());

  function syncFromValue(nextValue: string) {
    const nextHsva = parseColor(nextValue);
    setHsva(nextHsva);
    setInputValue(formatColor(nextHsva, format).toUpperCase());
  }

  function handleOpenChange(nextOpen: boolean) {
    if (nextOpen) syncFromValue(color);
    setOpen(nextOpen);
  }

  function commitHsva(nextHsva: HsvaColor, nextFormat = format) {
    setHsva(nextHsva);
    setInputValue(formatColor(nextHsva, nextFormat).toUpperCase());
    onChange(formatColor(nextHsva, nextFormat));
  }

  function handleInputChange(nextValue: string) {
    setInputValue(nextValue);
    const nextHsva = parseColorIfValid(nextValue);
    if (nextHsva) commitHsva(nextHsva, format);
  }

  function handleFormatChange(nextFormat: ColorFormat) {
    setFormat(nextFormat);
    setInputValue(formatColor(hsva, nextFormat).toUpperCase());
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

  const triggerColor = rgbaToHex(hsvaToRgba(parseColor(color)));

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button type="button" variant="ghost" size="icon-xs" className="size-4 shrink-0 rounded-[3px] border border-border p-0 focus-visible:ring-1 focus-visible:ring-foreground/20" style={{ backgroundColor: triggerColor }} aria-label={ariaLabel} />
      </PopoverTrigger>
      <PopoverContent side="right" align="start" sideOffset={8} className="w-80 gap-3 rounded-xl border border-border p-3 shadow-lg">
        <HsvaColorPicker
          color={hsva}
          onChange={(next) => commitHsva(next)}
          className="!h-64 !w-full [&_.react-colorful__alpha]:h-3.5 [&_.react-colorful__hue]:h-3.5 [&_.react-colorful__pointer]:!size-4 [&_.react-colorful__saturation]:rounded-[5px] [&_.react-colorful__hue]:mt-2 [&_.react-colorful__hue]:rounded-full [&_.react-colorful__alpha]:mt-2 [&_.react-colorful__alpha]:rounded-full"
        />

        <div className="grid grid-cols-[2.25rem_minmax(0,1fr)_4.75rem] items-center gap-2">
          <Button type="button" variant="outline" size="icon" className="size-9 rounded-[6px] p-0 text-muted-foreground" onClick={() => void pickFromScreen()} aria-label="Pick color from screen">
            <EyedropperIcon className="size-4" />
          </Button>
          <Input id={`color-picker-value-${inputId}`} value={inputValue} onChange={(event) => handleInputChange(event.currentTarget.value)} aria-label={`Edit ${formatLabel(format)} color`} className="h-9 rounded-[6px] px-2.5 font-mono text-xs uppercase" />
          <Select value={format} onValueChange={(next) => handleFormatChange(next as ColorFormat)}>
            <SelectTrigger size="default" aria-label="Color format" className="h-9 w-full rounded-[6px] px-2.5 text-xs font-normal"><SelectValue /></SelectTrigger>
            <SelectContent position="popper" className="min-w-20 rounded-[6px] p-0.5">
              <SelectItem value="hex" className="rounded-[3px] px-2 py-1 text-xs">Hex</SelectItem>
              <SelectItem value="rgb" className="rounded-[3px] px-2 py-1 text-xs">RGB</SelectItem>
              <SelectItem value="hsl" className="rounded-[3px] px-2 py-1 text-xs">HSL</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          {swatches.map((swatch) => (
            <Button key={swatch} type="button" variant="ghost" size="icon-xs" className="size-6 rounded-[4px] border border-border/60 p-0 focus-visible:ring-1 focus-visible:ring-foreground/20" style={{ backgroundColor: swatch }} onClick={() => commitHsva(parseColor(swatch))} aria-label={`Use ${swatch}`} />
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
