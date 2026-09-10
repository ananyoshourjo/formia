export type Project = {
  name: string;
  path: string | null;
  url?: string | null;
  error?: string;
};

export type RecentProject = {
  name: string;
  path: string;
};

export type CodexAvailability = {
  state: "checking" | "available" | "unavailable";
  message: string;
};

export type CodexStatus = {
  jobId?: string;
  state: "idle" | "working" | "applied" | "failed";
  message: string;
};

export type ProjectServerStatus = {
  state: "starting" | "ready" | "failed" | "stopped";
  url?: string;
  message: string;
  diagnostics?: string;
};

export type CanvasMessage =
  | { channel: "formia:set-tool"; args: [string] }
  | { channel: "formia:get-layer-tree"; args: [] }
  | { channel: "formia:get-preview-state"; args: [] }
  | { channel: "formia:measure-page-height"; args: [] }
  | { channel: "formia:clear-layer-highlight"; args: [] }
  | { channel: "formia:reset-overrides"; args: [] }
  | { channel: "formia:duplicate-selected-layer"; args: [] }
  | { channel: "formia:delete-selected-layer"; args: [] }
  | { channel: "formia:clear-selection"; args: [] }
  | { channel: "formia:select-layer"; args: [string] }
  | { channel: "formia:highlight-layer"; args: [string] }
  | { channel: "formia:move-selected-layer"; args: ["up" | "down"] }
  | { channel: "formia:move-layer"; args: [{ sourceSelectionId: string; targetParentId: string | null; beforeSelectionId: string | null }] }
  | { channel: "formia:apply-style"; args: [{ property: string; value: string }] }
  | { channel: "formia:reset-style"; args: [string] }
  | { channel: "formia:apply-class"; args: [string] }
  | { channel: "formia:reset-class"; args: [] }
  | { channel: "formia:apply-text"; args: [string] }
  | { channel: "formia:reset-text"; args: [] };

export type CanvasMessageChannel = CanvasMessage["channel"];
export type CanvasMessageArgs<Channel extends CanvasMessageChannel> = Extract<CanvasMessage, { channel: Channel }>["args"];

export type CanvasEventChannel =
  | "formia:canvas-wheel"
  | "formia:canvas-keydown"
  | "formia:canvas-keyup"
  | "formia:page-height"
  | "formia:layer-tree"
  | "formia:element-selected"
  | "formia:element-updated"
  | "formia:preview-state"
  | "formia:selection-cleared";

export function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

export function isCanvasWheelInput(value: unknown): value is { deltaX: number; deltaY: number; deltaMode: number; ctrlKey: boolean; shiftKey: boolean; clientX?: number; clientY?: number } {
  if (!isRecord(value)) return false;
  return ["deltaX", "deltaY", "deltaMode"].every((key) => typeof value[key] === "number")
    && ["ctrlKey", "shiftKey"].every((key) => typeof value[key] === "boolean")
    && (value.clientX === undefined || typeof value.clientX === "number")
    && (value.clientY === undefined || typeof value.clientY === "number");
}

export function isCanvasKeyboardInput(value: unknown): value is { code: string; key: string; ctrlKey: boolean; metaKey: boolean; shiftKey: boolean; altKey: boolean; repeat: boolean; targetIsEditable: boolean } {
  if (!isRecord(value)) return false;
  return typeof value.code === "string"
    && typeof value.key === "string"
    && ["ctrlKey", "metaKey", "shiftKey", "altKey", "repeat", "targetIsEditable"].every((key) => typeof value[key] === "boolean");
}

export function isLayerTreePayload(value: unknown): value is { nodes: unknown[] } {
  const isLayerNode = (node: unknown): boolean => {
    if (!isRecord(node)) return false;
    return typeof node.selectionId === "string"
      && typeof node.tagName === "string"
      && typeof node.name === "string"
      && (node.detail === null || typeof node.detail === "string")
      && Array.isArray(node.children)
      && node.children.every(isLayerNode);
  };
  return isRecord(value) && Array.isArray(value.nodes) && value.nodes.every(isLayerNode);
}

export function isPreviewStatePayload(value: unknown): value is { changes: unknown[] } {
  return isRecord(value) && Array.isArray(value.changes);
}

export function isSelectionPayload(value: unknown): value is { previewChanges?: unknown[] } {
  return isRecord(value)
    && typeof value.tagName === "string"
    && isRecord(value.styles)
    && isRecord(value.dimensions)
    && (value.previewChanges === undefined || Array.isArray(value.previewChanges));
}

export type CodexBuildRequest = {
  projectPath: string;
  projectName: string;
  canvasUrl: string | null;
  selection: unknown;
  previewChanges: unknown[];
};

export type CodexBuildResult = {
  jobId: string;
};

export function desktopErrorMessage(error: unknown, fallback: string) {
  if (!(error instanceof Error) || !error.message.trim()) return fallback;
  return error.message
    .replace(/^Error invoking remote method '[^']+':\s*/i, "")
    .replace(/^Error:\s*/i, "")
    .trim() || fallback;
}
