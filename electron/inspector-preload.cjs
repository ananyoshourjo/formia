const { ipcRenderer } = require("electron");

let inspectMode = false;
let hoveredElement = null;
let selectedElement = null;
let selectionSequence = 0;

const selectionAttribute = "data-formia-selection-id";
const editableStyleProperties = new Set([
  "x",
  "y",
  "width",
  "height",
  "minWidth",
  "minHeight",
  "transform",
  "display",
  "position",
  "top",
  "bottom",
  "right",
  "left",
  "flexDirection",
  "flexWrap",
  "rowGap",
  "columnGap",
  "flexGrow",
  "flexShrink",
  "flexBasis",
  "order",
  "alignSelf",
  "justifySelf",
  "gridTemplateColumns",
  "gridTemplateRows",
  "gridAutoFlow",
  "gridColumnStart",
  "gridColumnEnd",
  "gridRowStart",
  "gridRowEnd",
  "gridArea",
  "color",
  "backgroundColor",
  "fontFamily",
  "fontSize",
  "fontWeight",
  "lineHeight",
  "letterSpacing",
  "textAlign",
  "textTransform",
  "textDecorationLine",
  "margin",
  "padding",
  "marginTop",
  "marginRight",
  "marginBottom",
  "marginLeft",
  "paddingTop",
  "paddingRight",
  "paddingBottom",
  "paddingLeft",
  "border",
  "borderRadius",
  "gap",
  "alignItems",
  "justifyContent",
  "overflow",
  "boxSizing",
  "zIndex",
]);
const elementSnapshots = new WeakMap();
const touchedElements = new Set();

const overlay = document.createElement("div");
Object.assign(overlay.style, {
  position: "fixed",
  display: "none",
  pointerEvents: "none",
  zIndex: "2147483647",
  border: "2px solid #2563eb",
  background: "rgba(37, 99, 235, 0.08)",
});

const scrollbarStyle = document.createElement("style");
scrollbarStyle.textContent = `
  html, body, * {
    scrollbar-width: none !important;
    -ms-overflow-style: none !important;
  }
  html::-webkit-scrollbar,
  body::-webkit-scrollbar,
  *::-webkit-scrollbar {
    display: none !important;
    width: 0 !important;
    height: 0 !important;
  }
`;

function installScrollbarStyle() {
  if (!scrollbarStyle.isConnected && document.documentElement) {
    document.documentElement.appendChild(scrollbarStyle);
  }
}

installScrollbarStyle();
if (!scrollbarStyle.isConnected) {
  document.addEventListener("DOMContentLoaded", installScrollbarStyle, { once: true });
}

function ensureOverlay() {
  if (!overlay.isConnected && document.documentElement) {
    document.documentElement.appendChild(overlay);
  }
}

function moveOverlay(element) {
  ensureOverlay();
  const rect = element.getBoundingClientRect();
  Object.assign(overlay.style, {
    display: "block",
    left: `${rect.left}px`,
    top: `${rect.top}px`,
    width: `${rect.width}px`,
    height: `${rect.height}px`,
  });
}

function hideOverlay() {
  overlay.style.display = "none";
  hoveredElement = null;
}

function cssPropertyName(property) {
  return property.replace(/[A-Z]/g, (character) => `-${character.toLowerCase()}`);
}

function snapshotFor(element) {
  let snapshot = elementSnapshots.get(element);
  if (!snapshot) {
    snapshot = {
      styles: new Map(),
      className: undefined,
      html: undefined,
    };
    elementSnapshots.set(element, snapshot);
    touchedElements.add(element);
  }
  return snapshot;
}

function rememberInlineStyle(element, cssName) {
  const snapshot = snapshotFor(element);
  if (!snapshot.styles.has(cssName)) {
    snapshot.styles.set(cssName, {
      value: element.style.getPropertyValue(cssName),
      priority: element.style.getPropertyPriority(cssName),
    });
  }
  return snapshot;
}

function selectElement(element) {
  if (selectedElement && selectedElement !== element) {
    selectedElement.removeAttribute(selectionAttribute);
  }

  selectedElement = element;
  if (!selectedElement.hasAttribute(selectionAttribute)) {
    selectionSequence += 1;
    selectedElement.setAttribute(selectionAttribute, `formia-${selectionSequence}`);
  }
}

function clearSelection() {
  if (selectedElement) selectedElement.removeAttribute(selectionAttribute);
  selectedElement = null;
  hideOverlay();
  ipcRenderer.sendToHost("formia:selection-cleared");
}

function isDocumentSurface(element) {
  return element === document.body || element === document.documentElement || element === document.scrollingElement;
}

function isSelectionBackground(element) {
  if (isDocumentSurface(element)) return true;
  return Boolean(selectedElement && element !== selectedElement && element.contains(selectedElement));
}

function sendUpdatedSelection() {
  if (selectedElement) {
    ipcRenderer.sendToHost("formia:element-updated", selectionPayload(selectedElement));
  }
}

function applyStyle(property, value) {
  if (!selectedElement || !editableStyleProperties.has(property) || typeof value !== "string") return;

  if (property === "x" || property === "y") {
    const coordinate = Number.parseFloat(value);
    if (!Number.isFinite(coordinate)) return;

    const cssName = property === "x" ? "left" : "top";
    const rect = selectedElement.getBoundingClientRect();
    const computed = getComputedStyle(selectedElement);
    const currentCoordinate = property === "x" ? rect.x : rect.y;
    const currentOffset = Number.parseFloat(computed.getPropertyValue(cssName)) || 0;
    const snapshot = rememberInlineStyle(selectedElement, cssName);

    if (computed.position === "static") {
      rememberInlineStyle(selectedElement, "position");
      snapshot.autoPosition = true;
      selectedElement.style.setProperty("position", "relative", "important");
    }

    const nextOffset = currentOffset + coordinate - currentCoordinate;
    selectedElement.style.setProperty(cssName, `${nextOffset}px`, "important");
    sendUpdatedSelection();
    return;
  }

  const cssName = cssPropertyName(property);
  const snapshot = rememberInlineStyle(selectedElement, cssName);
  if (property === "position") snapshot.autoPosition = false;

  selectedElement.style.setProperty(cssName, value.trim(), "important");
  sendUpdatedSelection();
}

function resetStyle(property) {
  if (!selectedElement || !editableStyleProperties.has(property)) return;

  const isCoordinate = property === "x" || property === "y";
  const cssName = property === "x" ? "left" : property === "y" ? "top" : cssPropertyName(property);
  const snapshot = elementSnapshots.get(selectedElement);
  const original = snapshot?.styles.get(cssName);
  if (!original) return;

  if (original.value) {
    selectedElement.style.setProperty(cssName, original.value, original.priority);
  } else {
    selectedElement.style.removeProperty(cssName);
  }
  snapshot.styles.delete(cssName);

  if (isCoordinate && snapshot.autoPosition && !snapshot.styles.has("left") && !snapshot.styles.has("top")) {
    const originalPosition = snapshot.styles.get("position");
    if (originalPosition?.value) {
      selectedElement.style.setProperty("position", originalPosition.value, originalPosition.priority);
    } else {
      selectedElement.style.removeProperty("position");
    }
    snapshot.styles.delete("position");
    snapshot.autoPosition = false;
  }

  sendUpdatedSelection();
}

function applyClassName(value) {
  if (!selectedElement || typeof value !== "string") return;

  const snapshot = snapshotFor(selectedElement);
  if (snapshot.className === undefined) snapshot.className = selectedElement.getAttribute("class");
  selectedElement.setAttribute("class", value);
  sendUpdatedSelection();
}

function resetClassName() {
  if (!selectedElement) return;

  const snapshot = elementSnapshots.get(selectedElement);
  if (!snapshot || snapshot.className === undefined) return;

  if (snapshot.className === null) {
    selectedElement.removeAttribute("class");
  } else {
    selectedElement.setAttribute("class", snapshot.className);
  }
  snapshot.className = undefined;
  sendUpdatedSelection();
}

function applyText(value) {
  if (!selectedElement || typeof value !== "string" || selectedElement.children.length > 0) return;

  const snapshot = snapshotFor(selectedElement);
  if (snapshot.html === undefined) snapshot.html = selectedElement.innerHTML;
  selectedElement.textContent = value;
  sendUpdatedSelection();
}

function resetText() {
  if (!selectedElement) return;

  const snapshot = elementSnapshots.get(selectedElement);
  if (!snapshot || snapshot.html === undefined) return;

  selectedElement.innerHTML = snapshot.html;
  snapshot.html = undefined;
  sendUpdatedSelection();
}

function resetAllOverrides() {
  for (const element of touchedElements) {
    const snapshot = elementSnapshots.get(element);
    if (!snapshot) continue;

    for (const [cssName, original] of snapshot.styles) {
      if (original.value) {
        element.style.setProperty(cssName, original.value, original.priority);
      } else {
        element.style.removeProperty(cssName);
      }
    }

    if (snapshot.className !== undefined) {
      if (snapshot.className === null) element.removeAttribute("class");
      else element.setAttribute("class", snapshot.className);
    }

    if (snapshot.html !== undefined) element.innerHTML = snapshot.html;
    elementSnapshots.delete(element);
  }

  touchedElements.clear();
  sendUpdatedSelection();
}

function inspectAtPoint(x, y) {
  if (!inspectMode || !Number.isFinite(x) || !Number.isFinite(y)) return;

  const element = document.elementFromPoint(x, y);
  if (!(element instanceof Element) || element === overlay) return;
  if (isSelectionBackground(element)) {
    clearSelection();
    return;
  }
  moveOverlay(element);
  selectElement(element);
  ipcRenderer.sendToHost("formia:element-selected", selectionPayload(element));
}

function compactValue(value, depth = 0, seen = new WeakSet()) {
  if (value == null || ["string", "number", "boolean"].includes(typeof value)) return value;
  if (typeof value === "function") return `[function ${value.name || "anonymous"}]`;
  if (typeof value === "symbol") return value.toString();
  if (typeof value !== "object") return String(value);
  if (seen.has(value)) return "[circular]";
  if (depth >= 2) return Array.isArray(value) ? `[array:${value.length}]` : "[object]";

  seen.add(value);
  if (Array.isArray(value)) return value.slice(0, 12).map((item) => compactValue(item, depth + 1, seen));

  const result = {};
  for (const [key, item] of Object.entries(value).slice(0, 20)) {
    if (key === "children" && typeof item === "object") {
      result[key] = "[ReactNode]";
    } else {
      result[key] = compactValue(item, depth + 1, seen);
    }
  }
  return result;
}

function getReactDetails(element) {
  const fiberKey = Object.keys(element).find((key) => key.startsWith("__reactFiber$"));
  let fiber = fiberKey ? element[fiberKey] : null;

  while (fiber) {
    const component = fiber.type;
    if (typeof component === "function" || (component && typeof component === "object")) {
      const name = component.displayName || component.name || component.render?.displayName || component.render?.name;
      if (name) {
        return {
          name,
          props: compactValue(fiber.memoizedProps || {}),
          source: fiber._debugSource
            ? `${fiber._debugSource.fileName}:${fiber._debugSource.lineNumber}`
            : null,
        };
      }
    }
    fiber = fiber.return;
  }

  return null;
}

function inspectElement(element) {
  const computed = getComputedStyle(element);
  const rect = element.getBoundingClientRect();
  return {
    selectionId: element.getAttribute(selectionAttribute),
    tagName: element.tagName.toLowerCase(),
    id: element.id || null,
    className: typeof element.className === "string" ? element.className : "",
    text: (element.textContent || "").trim().replace(/\s+/g, " ").slice(0, 180),
    textEditable: element.children.length === 0,
    attributes: Object.fromEntries(
      Array.from(element.attributes)
        .filter((attribute) => !["class", "id", selectionAttribute].includes(attribute.name))
        .map((attribute) => [attribute.name, attribute.value]),
    ),
    dimensions: {
      width: Math.round(rect.width * 100) / 100,
      height: Math.round(rect.height * 100) / 100,
      x: Math.round(rect.x * 100) / 100,
      y: Math.round(rect.y * 100) / 100,
    },
    styles: {
      width: computed.width,
      height: computed.height,
      minWidth: computed.minWidth,
      minHeight: computed.minHeight,
      transform: element.style.getPropertyValue("transform") || computed.transform,
      display: computed.display,
      position: computed.position,
      top: computed.top,
      bottom: computed.bottom,
      right: computed.right,
      left: computed.left,
      flexDirection: computed.flexDirection,
      flexWrap: computed.flexWrap,
      rowGap: computed.rowGap,
      columnGap: computed.columnGap,
      flexGrow: computed.flexGrow,
      flexShrink: computed.flexShrink,
      flexBasis: computed.flexBasis,
      order: computed.order,
      alignSelf: computed.alignSelf,
      justifySelf: computed.justifySelf,
      gridTemplateColumns: computed.gridTemplateColumns,
      gridTemplateRows: computed.gridTemplateRows,
      gridAutoFlow: computed.gridAutoFlow,
      gridColumnStart: computed.gridColumnStart,
      gridColumnEnd: computed.gridColumnEnd,
      gridRowStart: computed.gridRowStart,
      gridRowEnd: computed.gridRowEnd,
      gridArea: computed.gridArea,
      overflow: computed.overflow,
      boxSizing: computed.boxSizing,
      zIndex: computed.zIndex,
      color: computed.color,
      backgroundColor: computed.backgroundColor,
      fontFamily: computed.fontFamily,
      fontSize: computed.fontSize,
      fontWeight: computed.fontWeight,
      lineHeight: computed.lineHeight,
      letterSpacing: computed.letterSpacing,
      textAlign: computed.textAlign,
      textTransform: computed.textTransform,
      textDecorationLine: computed.textDecorationLine,
      margin: computed.margin,
      padding: computed.padding,
      marginTop: computed.marginTop,
      marginRight: computed.marginRight,
      marginBottom: computed.marginBottom,
      marginLeft: computed.marginLeft,
      paddingTop: computed.paddingTop,
      paddingRight: computed.paddingRight,
      paddingBottom: computed.paddingBottom,
      paddingLeft: computed.paddingLeft,
      border: computed.border,
      borderRadius: computed.borderRadius,
      gap: computed.gap,
      alignItems: computed.alignItems,
      justifyContent: computed.justifyContent,
    },
    parentLayout: element.parentElement
      ? { display: getComputedStyle(element.parentElement).display }
      : null,
    react: getReactDetails(element),
  };
}

function collectPreviewChanges() {
  return Array.from(touchedElements).flatMap((element) => {
    const snapshot = elementSnapshots.get(element);
    if (!snapshot || !element.isConnected) return [];

    const changes = [];
    for (const [cssName, original] of snapshot.styles) {
      const current = element.style.getPropertyValue(cssName);
      const currentPriority = element.style.getPropertyPriority(cssName);
      if (current !== original.value || currentPriority !== original.priority) {
        changes.push({
          kind: "style",
          property: cssName,
          from: original.value || "(not set)",
          to: current || "(not set)",
        });
      }
    }

    if (snapshot.className !== undefined) {
      const current = element.getAttribute("class");
      if (current !== snapshot.className) {
        changes.push({
          kind: "class",
          from: snapshot.className || "(not set)",
          to: current || "(not set)",
        });
      }
    }

    if (snapshot.html !== undefined && element.innerHTML !== snapshot.html) {
      changes.push({
        kind: "text",
        from: snapshot.html,
        to: element.textContent || "",
      });
    }

    if (changes.length === 0) return [];
    const details = inspectElement(element);
    return [{
      selectionId: details.selectionId,
      tagName: details.tagName,
      source: details.react?.source || null,
      text: details.text,
      changes,
    }];
  });
}

function selectionPayload(element) {
  return {
    ...inspectElement(element),
    previewChanges: collectPreviewChanges(),
  };
}

window.addEventListener(
  "mousemove",
  (event) => {
    if (!inspectMode) return;
    const element = event.target;
    if (!(element instanceof Element) || element === overlay || element === hoveredElement) return;
    hoveredElement = element;
    moveOverlay(element);
  },
  true,
);

window.addEventListener(
  "click",
  (event) => {
    if (!inspectMode) return;
    const element = event.target;
    if (!(element instanceof Element) || element === overlay) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (isSelectionBackground(element)) {
      clearSelection();
      return;
    }
    moveOverlay(element);
    selectElement(element);
    ipcRenderer.sendToHost("formia:element-selected", selectionPayload(element));
  },
  true,
);

window.addEventListener(
  "wheel",
  (event) => {
    event.preventDefault();
    ipcRenderer.sendToHost("formia:canvas-wheel", {
      deltaX: event.deltaX,
      deltaY: event.deltaY,
      deltaMode: event.deltaMode,
      ctrlKey: event.ctrlKey,
      shiftKey: event.shiftKey,
      clientX: event.clientX,
      clientY: event.clientY,
    });
  },
  { capture: true, passive: false },
);

ipcRenderer.on("formia:set-inspect-mode", (_event, enabled) => {
  inspectMode = Boolean(enabled);
  if (!inspectMode) hideOverlay();
});

ipcRenderer.on("formia:clear-selection", () => {
  clearSelection();
});

ipcRenderer.on("formia:inspect-at-point", (_event, payload) => {
  inspectAtPoint(Number(payload?.x), Number(payload?.y));
});

ipcRenderer.on("formia:apply-style", (_event, payload) => {
  applyStyle(payload?.property, payload?.value);
});

ipcRenderer.on("formia:reset-style", (_event, property) => {
  resetStyle(property);
});

ipcRenderer.on("formia:apply-class", (_event, value) => {
  applyClassName(value);
});

ipcRenderer.on("formia:reset-class", () => {
  resetClassName();
});

ipcRenderer.on("formia:apply-text", (_event, value) => {
  applyText(value);
});

ipcRenderer.on("formia:reset-text", () => {
  resetText();
});

ipcRenderer.on("formia:reset-overrides", () => {
  resetAllOverrides();
});

ipcRenderer.on("formia:get-preview-state", () => {
  ipcRenderer.sendToHost("formia:preview-state", { changes: collectPreviewChanges() });
});
