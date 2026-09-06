const { ipcRenderer } = require("electron");

const minimumPageHeight = 900;
let pageHeightTimer = null;
let pageHeightDeadline = null;
let pageHeightObserver = null;
let hasReportedPageHeight = false;

function measurePageHeight() {
  if (hasReportedPageHeight) return;
  hasReportedPageHeight = true;
  if (pageHeightTimer !== null) clearTimeout(pageHeightTimer);
  if (pageHeightDeadline !== null) clearTimeout(pageHeightDeadline);
  pageHeightTimer = null;
  pageHeightDeadline = null;
  pageHeightObserver?.disconnect();
  pageHeightObserver = null;

  const root = document.documentElement;
  const body = document.body;
  const height = Math.max(
    minimumPageHeight,
    root?.scrollHeight || 0,
    root?.offsetHeight || 0,
    body?.scrollHeight || 0,
    body?.offsetHeight || 0,
  );

  ipcRenderer.sendToHost("formia:page-height", height);
  root?.style.setProperty("overflow", "hidden", "important");
  root?.style.setProperty("overscroll-behavior", "none", "important");
  body?.style.setProperty("overflow", "hidden", "important");
  body?.style.setProperty("overscroll-behavior", "none", "important");
  window.scrollTo(0, 0);
}

function schedulePageHeightMeasurement() {
  if (hasReportedPageHeight) return;
  if (pageHeightTimer !== null) clearTimeout(pageHeightTimer);
  pageHeightTimer = setTimeout(measurePageHeight, 250);
}

function preparePageHeightMeasurement() {
  hasReportedPageHeight = false;
  schedulePageHeightMeasurement();

  pageHeightObserver?.disconnect();
  pageHeightObserver = new MutationObserver(schedulePageHeightMeasurement);
  pageHeightObserver.observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    characterData: true,
  });

  if (pageHeightDeadline !== null) clearTimeout(pageHeightDeadline);
  pageHeightDeadline = setTimeout(measurePageHeight, 2000);
}

window.addEventListener("DOMContentLoaded", preparePageHeightMeasurement);
window.addEventListener("load", schedulePageHeightMeasurement);
window.addEventListener("DOMContentLoaded", prepareLayerTreeObservation);
window.addEventListener("popstate", () => {
  preparePageHeightMeasurement();
  scheduleLayerTreeUpdate();
});

let activeTool = "interact";
let hoveredElement = null;
let selectedElement = null;
let textEditingState = null;
let selectionSequence = 0;
let layerTreeObserver = null;
let layerTreeTimer = null;

const selectionAttribute = "data-formia-selection-id";
const layerTreeExcludedTags = new Set(["SCRIPT", "STYLE", "LINK", "META", "TITLE", "NOSCRIPT", "TEMPLATE", "SVG", "PATH", "CIRCLE", "RECT", "LINE", "POLYLINE", "POLYGON"]);
const maximumLayerTreeNodes = 800;
const maximumLayerTreeDepth = 12;
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
  "alignContent",
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
  "borderStyle",
  "borderWidth",
  "borderColor",
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
const structureSnapshots = new WeakMap();
const structuralMoves = new Map();
let isReapplyingStructuralMoves = false;
let layerPointerDrag = null;
let suppressNextClick = false;
let canvasDropTarget = null;

const toolCursorPaths = {
  interact: "M220.49,207.8,207.8,220.49a12,12,0,0,1-17,0l-56.57-56.57L115,214.08l-.13.33A15.84,15.84,0,0,1,100.26,224l-.78,0a15.82,15.82,0,0,1-14.41-11L32.8,52.92A15.95,15.95,0,0,1,52.92,32.8L213,85.07a16,16,0,0,1,1.41,29.8l-.33.13-50.16,19.27,56.57,56.56A12,12,0,0,1,220.49,207.8Z",
  select: "M248,121.58a15.76,15.76,0,0,1-11.29,15l-.2.06-78,21.84-21.84,78-.06.2a15.77,15.77,0,0,1-15,11.29h-.3a15.77,15.77,0,0,1-15.07-10.67L41,61.41a1,1,0,0,1-.05-.16A16,16,0,0,1,61.25,40.9l.16.05,175.92,65.26A15.78,15.78,0,0,1,248,121.58Z",
  text: "M184,208a8,8,0,0,1-8,8H160a40,40,0,0,1-32-16,40,40,0,0,1-32,16H80a8,8,0,0,1,0-16H96a24,24,0,0,0,24-24V136H104a8,8,0,0,1,0-16h16V80A24,24,0,0,0,96,56H80a8,8,0,0,1,0-16H96a40,40,0,0,1,32,16,40,40,0,0,1,32-16h16a8,8,0,0,1,0,16H160a24,24,0,0,0-24,24v40h16a8,8,0,0,1,0,16H136v40a24,24,0,0,0,24,24h16A8,8,0,0,1,184,208Z",
};

const cursorStyle = document.createElement("style");

function cursorForTool(tool) {
  const hotspot = tool === "text" ? "8 8" : "2 2";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 256 256"><path fill="#0d0d0d" d="${toolCursorPaths[tool]}"/></svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}") ${hotspot}, auto`;
}

function installCursorStyle() {
  cursorStyle.textContent = `html, body, body * { cursor: ${cursorForTool(activeTool)} !important; }`;
  if (!cursorStyle.isConnected && document.documentElement) document.documentElement.appendChild(cursorStyle);
}

installCursorStyle();
if (!cursorStyle.isConnected) document.addEventListener("DOMContentLoaded", installCursorStyle, { once: true });

const overlay = document.createElement("div");
Object.assign(overlay.style, {
  position: "fixed",
  display: "none",
  pointerEvents: "none",
  zIndex: "2147483647",
  border: "2px solid #2563eb",
  background: "rgba(37, 99, 235, 0.08)",
});

const hoverOverlay = document.createElement("div");
Object.assign(hoverOverlay.style, {
  position: "fixed",
  display: "none",
  pointerEvents: "none",
  zIndex: "2147483646",
  border: "1px solid rgba(37, 99, 235, 0.38)",
  background: "rgba(37, 99, 235, 0.025)",
});

const dropIndicator = document.createElement("div");
Object.assign(dropIndicator.style, {
  position: "fixed",
  display: "none",
  pointerEvents: "none",
  zIndex: "2147483646",
  height: "3px",
  borderRadius: "999px",
  background: "#0d0d0d",
  boxShadow: "0 0 0 1px rgba(255, 255, 255, 0.7)",
});

const dropTargetOverlay = document.createElement("div");
Object.assign(dropTargetOverlay.style, {
  position: "fixed",
  display: "none",
  pointerEvents: "none",
  zIndex: "2147483645",
  border: "2px dashed #0d0d0d",
  background: "rgba(13, 13, 13, 0.05)",
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
  if (!hoverOverlay.isConnected && document.documentElement) {
    document.documentElement.appendChild(hoverOverlay);
  }
  if (!dropIndicator.isConnected && document.documentElement) {
    document.documentElement.appendChild(dropIndicator);
  }
  if (!dropTargetOverlay.isConnected && document.documentElement) {
    document.documentElement.appendChild(dropTargetOverlay);
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

function moveHoverOverlay(element) {
  ensureOverlay();
  const rect = element.getBoundingClientRect();
  Object.assign(hoverOverlay.style, {
    display: "block",
    left: `${rect.left}px`,
    top: `${rect.top}px`,
    width: `${rect.width}px`,
    height: `${rect.height}px`,
  });
}

function hideHoverOverlay() {
  hoverOverlay.style.display = "none";
}

function hideOverlay() {
  overlay.style.display = "none";
  hideHoverOverlay();
  hoveredElement = null;
}

function hideDropIndicator() {
  dropIndicator.style.display = "none";
  dropTargetOverlay.style.display = "none";
  canvasDropTarget = null;
}

function showDropTarget(target) {
  ensureOverlay();
  canvasDropTarget = target;
  if (target.type === "inside") {
    const rect = target.parent.getBoundingClientRect();
    Object.assign(dropTargetOverlay.style, {
      display: "block",
      left: `${rect.left}px`,
      top: `${rect.top}px`,
      width: `${rect.width}px`,
      height: `${rect.height}px`,
    });
    dropIndicator.style.display = "none";
    return;
  }

  const rect = target.element.getBoundingClientRect();
  Object.assign(dropIndicator.style, {
    display: "block",
    left: `${rect.left}px`,
    top: `${target.type === "before" ? rect.top : rect.bottom - 1}px`,
    width: `${rect.width}px`,
  });
  dropTargetOverlay.style.display = "none";
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

function isTextEditable(element) {
  return element instanceof Element && !isDocumentSurface(element) && element.children.length === 0 && Boolean((element.textContent || "").trim());
}

function handleTextInput(event) {
  const element = event.currentTarget;
  if (!(element instanceof Element)) return;
  const snapshot = snapshotFor(element);
  if (snapshot.html === undefined) snapshot.html = element.innerHTML;
  sendUpdatedSelection();
}

function finishTextEditing() {
  if (!textEditingState) return;

  const { element, contentEditable, spellcheck } = textEditingState;
  element.removeEventListener("input", handleTextInput);
  if (contentEditable === null) element.removeAttribute("contenteditable");
  else element.setAttribute("contenteditable", contentEditable);
  if (spellcheck === null) element.removeAttribute("spellcheck");
  else element.setAttribute("spellcheck", spellcheck);
  textEditingState = null;
}

function beginTextEditing(element) {
  if (!isTextEditable(element)) return false;
  if (textEditingState?.element === element) {
    element.focus();
    return true;
  }

  finishTextEditing();
  const snapshot = snapshotFor(element);
  if (snapshot.html === undefined) snapshot.html = element.innerHTML;
  textEditingState = {
    element,
    contentEditable: element.getAttribute("contenteditable"),
    spellcheck: element.getAttribute("spellcheck"),
  };
  element.setAttribute("contenteditable", "true");
  element.setAttribute("spellcheck", "false");
  element.addEventListener("input", handleTextInput);
  element.focus();

  const range = document.createRange();
  range.selectNodeContents(element);
  range.collapse(false);
  const browserSelection = window.getSelection();
  browserSelection?.removeAllRanges();
  browserSelection?.addRange(range);
  return true;
}

function selectElement(element) {
  if (textEditingState?.element !== element) finishTextEditing();
  selectedElement = element;
  hideHoverOverlay();
  ensureLayerSelectionId(selectedElement);
}

function ensureLayerSelectionId(element) {
  const existingId = element.getAttribute(selectionAttribute);
  if (existingId) return existingId;

  selectionSequence += 1;
  const selectionId = `formia-${selectionSequence}`;
  element.setAttribute(selectionAttribute, selectionId);
  return selectionId;
}

function clearSelection() {
  finishTextEditing();
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

function layerIndex(element) {
  if (!element.parentElement) return -1;
  return Array.from(element.parentElement.children).indexOf(element);
}

function layerDescription(element) {
  if (!element) return "page root";
  const componentName = getReactComponentName(element);
  const name = componentName || element.tagName.toLowerCase();
  return element.id ? `${name} (#${element.id})` : name;
}

function rememberStructure(element) {
  if (structureSnapshots.has(element)) return structureSnapshots.get(element);

  const snapshot = {
    parent: element.parentElement,
    nextSibling: element.nextElementSibling,
    index: layerIndex(element),
  };
  structureSnapshots.set(element, snapshot);
  return snapshot;
}

function isOriginalPlacement(element, snapshot) {
  return Boolean(snapshot?.parent && element.parentElement === snapshot.parent && element.nextElementSibling === snapshot.nextSibling);
}

function moveElementTo(element, targetParent, beforeElement = null) {
  if (!(element instanceof Element) || !(targetParent instanceof Element)) return false;
  if (element === targetParent || element.contains(targetParent)) return false;
  if (beforeElement && (beforeElement === element || beforeElement.parentElement !== targetParent)) return false;
  if (element.parentElement === targetParent && element.nextElementSibling === beforeElement) return false;

  const snapshot = rememberStructure(element);
  targetParent.insertBefore(element, beforeElement);

  if (isOriginalPlacement(element, snapshot)) {
    structuralMoves.delete(element);
    structureSnapshots.delete(element);
  } else {
    structuralMoves.set(element, {
      element,
      originalParent: snapshot.parent,
      originalNextSibling: snapshot.nextSibling,
      originalIndex: snapshot.index,
      targetParent,
      targetBefore: beforeElement,
    });
  }

  return true;
}

function restoreStructuralOverrides() {
  const moves = Array.from(structuralMoves.values()).reverse();
  for (const move of moves) {
    if (!move.element.isConnected || !move.originalParent?.isConnected) continue;
    const siblings = Array.from(move.originalParent.children).filter((element) => element !== move.element);
    const originalReference = siblings[move.originalIndex] || null;
    move.originalParent.insertBefore(move.element, originalReference);
  }

  structuralMoves.clear();
}

function reapplyStructuralOverrides() {
  if (isReapplyingStructuralMoves || structuralMoves.size === 0) return;

  isReapplyingStructuralMoves = true;
  for (const move of structuralMoves.values()) {
    if (!move.element.isConnected || !move.targetParent.isConnected) continue;
    if (move.element.parentElement !== move.targetParent || move.element.nextElementSibling !== move.targetBefore) {
      move.targetParent.insertBefore(move.element, move.targetBefore);
    }
  }
  isReapplyingStructuralMoves = false;
}

function moveLayer(selectionId, targetParentId, beforeSelectionId) {
  const element = findLayerElement(selectionId);
  const targetParent = targetParentId ? findLayerElement(targetParentId) : document.body;
  const beforeElement = beforeSelectionId ? findLayerElement(beforeSelectionId) : null;
  if (!(element instanceof Element) || !(targetParent instanceof Element) || (beforeSelectionId && !(beforeElement instanceof Element))) return;
  if (isDocumentSurface(element) || (isDocumentSurface(targetParent) && targetParent !== document.body)) return;
  commitElementMove(element, { parent: targetParent, before: beforeElement });
}

function commitElementMove(element, target) {
  if (!moveElementTo(element, target.parent, target.before)) return false;

  selectElement(element);
  moveOverlay(element);
  ipcRenderer.sendToHost("formia:element-selected", selectionPayload(element));
  sendLayerTree();
  return true;
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

  finishTextEditing();
  const snapshot = snapshotFor(selectedElement);
  if (snapshot.html === undefined) snapshot.html = selectedElement.innerHTML;
  selectedElement.textContent = value;
  sendUpdatedSelection();
}

function resetText() {
  if (!selectedElement) return;

  finishTextEditing();
  const snapshot = elementSnapshots.get(selectedElement);
  if (!snapshot || snapshot.html === undefined) return;

  selectedElement.innerHTML = snapshot.html;
  snapshot.html = undefined;
  sendUpdatedSelection();
}

function resetAllOverrides() {
  finishTextEditing();
  restoreStructuralOverrides();

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
  sendLayerTree();
}

function inspectAtPoint(x, y) {
  if (activeTool !== "select" || !Number.isFinite(x) || !Number.isFinite(y)) return;

  const element = document.elementFromPoint(x, y);
  if (!(element instanceof Element) || element === overlay || element === hoverOverlay) return;
  if (isSelectionBackground(element)) {
    clearSelection();
    return;
  }
  moveOverlay(element);
  selectElement(element);
  ipcRenderer.sendToHost("formia:element-selected", selectionPayload(element));
}

function getReactComponentName(element) {
  const fiberKey = Object.keys(element).find((key) => key.startsWith("__reactFiber$"));
  let fiber = fiberKey ? element[fiberKey] : null;

  while (fiber) {
    const component = fiber.type;
    if (typeof component === "function" || (component && typeof component === "object")) {
      const name = component.displayName || component.name || component.render?.displayName || component.render?.name;
      if (name) return name;
    }
    fiber = fiber.return;
  }

  return null;
}

function layerDetail(element) {
  if (element.id) return `#${element.id}`;
  if (element.children.length === 0) {
    const text = (element.textContent || "").trim().replace(/\s+/g, " ");
    if (text) return text.slice(0, 40);
  }
  return null;
}

function buildLayerNode(element, state, depth = 0) {
  if (state.count >= maximumLayerTreeNodes || layerTreeExcludedTags.has(element.tagName)) return null;

  const computed = getComputedStyle(element);
  if (computed.display === "none" || computed.visibility === "hidden") return null;

  state.count += 1;
  const children = depth < maximumLayerTreeDepth
    ? Array.from(element.children).map((child) => buildLayerNode(child, state, depth + 1)).filter(Boolean)
    : [];
  const rect = element.getBoundingClientRect();
  if (children.length === 0 && (rect.width <= 0 || rect.height <= 0)) return null;

  const componentName = getReactComponentName(element);
  return {
    selectionId: ensureLayerSelectionId(element),
    tagName: element.tagName.toLowerCase(),
    name: componentName || element.tagName.toLowerCase(),
    detail: layerDetail(element),
    children,
  };
}

function collectLayerTree() {
  if (!document.body) return [];
  const state = { count: 0 };
  return Array.from(document.body.children)
    .map((element) => buildLayerNode(element, state))
    .filter(Boolean);
}

function sendLayerTree() {
  if (!document.body) return;
  reapplyStructuralOverrides();
  ipcRenderer.sendToHost("formia:layer-tree", { nodes: collectLayerTree() });
}

function scheduleLayerTreeUpdate() {
  if (layerTreeTimer !== null) clearTimeout(layerTreeTimer);
  layerTreeTimer = setTimeout(() => {
    layerTreeTimer = null;
    sendLayerTree();
  }, 250);
}

function prepareLayerTreeObservation() {
  layerTreeObserver?.disconnect();
  if (!document.documentElement) return;

  layerTreeObserver = new MutationObserver(scheduleLayerTreeUpdate);
  layerTreeObserver.observe(document.documentElement, {
    childList: true,
    subtree: true,
    characterData: true,
  });
  scheduleLayerTreeUpdate();
}

function findLayerElement(selectionId) {
  if (typeof selectionId !== "string" || !selectionId) return null;
  return Array.from(document.querySelectorAll(`[${selectionAttribute}]`)).find((element) => element.getAttribute(selectionAttribute) === selectionId) || null;
}

function highlightLayer(selectionId) {
  const element = findLayerElement(selectionId);
  if (!(element instanceof Element)) return;
  hoveredElement = element;
  if (element === selectedElement) {
    hideHoverOverlay();
    moveOverlay(element);
  } else {
    moveHoverOverlay(element);
  }
}

function clearLayerHighlight() {
  hoveredElement = null;
  hideHoverOverlay();
  if (selectedElement) moveOverlay(selectedElement);
  else hideOverlay();
}

function selectLayer(selectionId) {
  const element = findLayerElement(selectionId);
  if (!(element instanceof Element) || isDocumentSurface(element)) return;
  moveOverlay(element);
  selectElement(element);
  ipcRenderer.sendToHost("formia:element-selected", selectionPayload(element));
  if (activeTool === "text") beginTextEditing(element);
}

function findCanvasDropTarget(x, y, source) {
  const element = document.elementFromPoint(x, y);
  if (!(element instanceof Element) || element === overlay || element === dropIndicator || element === dropTargetOverlay) return null;
  if (element === source || source.contains(element) || element === document.documentElement || element === document.scrollingElement || layerTreeExcludedTags.has(element.tagName)) return null;
  if (element === document.body) return { type: "inside", element, parent: document.body, before: null };

  const parent = element.parentElement;
  if (!parent || isDocumentSurface(parent) && parent !== document.body) return null;
  const rect = element.getBoundingClientRect();
  const relativeY = rect.height > 0 ? (y - rect.top) / rect.height : 0.5;
  if (relativeY < 0.25) return { type: "before", element, parent, before: element };
  if (relativeY > 0.75) return { type: "after", element, parent, before: element.nextElementSibling };
  return { type: "inside", element, parent: element, before: null };
}

function beginCanvasLayerDrag(event) {
  if (activeTool !== "select" || event.button !== 0 || layerPointerDrag) return;
  const element = event.target;
  if (!(element instanceof Element) || element === overlay || isDocumentSurface(element) || layerTreeExcludedTags.has(element.tagName)) return;

  layerPointerDrag = {
    element,
    pointerId: event.pointerId,
    startX: event.clientX,
    startY: event.clientY,
    moved: false,
  };
  element.setPointerCapture?.(event.pointerId);
}

function moveCanvasLayerDrag(event) {
  if (!layerPointerDrag || event.pointerId !== layerPointerDrag.pointerId) return;

  const deltaX = event.clientX - layerPointerDrag.startX;
  const deltaY = event.clientY - layerPointerDrag.startY;
  if (!layerPointerDrag.moved && Math.hypot(deltaX, deltaY) < 5) return;

  if (!layerPointerDrag.moved) {
    layerPointerDrag.moved = true;
    suppressNextClick = true;
    selectElement(layerPointerDrag.element);
    ipcRenderer.sendToHost("formia:element-selected", selectionPayload(layerPointerDrag.element));
  }

  event.preventDefault();
  event.stopImmediatePropagation();
  const target = findCanvasDropTarget(event.clientX, event.clientY, layerPointerDrag.element);
  if (target) showDropTarget(target);
  else hideDropIndicator();
}

function endCanvasLayerDrag(event) {
  if (!layerPointerDrag || event.pointerId !== layerPointerDrag.pointerId) return;

  const drag = layerPointerDrag;
  layerPointerDrag = null;
  drag.element.releasePointerCapture?.(event.pointerId);
  if (!drag.moved) return;
  if (event.type === "pointercancel") suppressNextClick = false;

  event.preventDefault();
  event.stopImmediatePropagation();
  const target = canvasDropTarget;
  hideDropIndicator();
  if (target) commitElementMove(drag.element, target);
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
  const authoredStyle = (property, computedValue) =>
    element.style.getPropertyValue(property) || computedValue;
  const rect = element.getBoundingClientRect();
  return {
    selectionId: element.getAttribute(selectionAttribute),
    tagName: element.tagName.toLowerCase(),
    id: element.id || null,
    className: typeof element.className === "string" ? element.className : "",
    text: (element.textContent || "").trim().replace(/\s+/g, " ").slice(0, 180),
    textEditable: isTextEditable(element),
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
      width: authoredStyle("width", computed.width),
      height: authoredStyle("height", computed.height),
      minWidth: authoredStyle("min-width", computed.minWidth),
      minHeight: authoredStyle("min-height", computed.minHeight),
      transform: element.style.getPropertyValue("transform") || computed.transform,
      display: computed.display,
      position: computed.position,
      top: computed.top,
      bottom: computed.bottom,
      right: computed.right,
      left: computed.left,
      flexDirection: computed.flexDirection,
      flexWrap: computed.flexWrap,
      alignContent: computed.alignContent,
      rowGap: computed.rowGap,
      columnGap: computed.columnGap,
      flexGrow: computed.flexGrow,
      flexShrink: computed.flexShrink,
      flexBasis: authoredStyle("flex-basis", computed.flexBasis),
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
      zIndex: authoredStyle("z-index", computed.zIndex),
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
      borderStyle: computed.borderStyle,
      borderWidth: computed.borderWidth,
      borderColor: computed.borderColor,
      borderRadius: computed.borderRadius,
      gap: authoredStyle("gap", computed.gap),
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

function collectStructuralPreviewChanges() {
  return Array.from(structuralMoves.values()).flatMap((move) => {
    if (!move.element.isConnected || !move.targetParent.isConnected) return [];

    const details = inspectElement(move.element);
    return [{
      selectionId: details.selectionId,
      tagName: details.tagName,
      source: details.react?.source || null,
      text: details.text,
      changes: [{
        kind: "structure",
        property: "parent/order",
        from: `${layerDescription(move.originalParent)} at index ${move.originalIndex}`,
        to: `${layerDescription(move.targetParent)} at index ${layerIndex(move.element)}`,
      }],
    }];
  });
}

function selectionPayload(element) {
  return {
    ...inspectElement(element),
    previewChanges: [...collectPreviewChanges(), ...collectStructuralPreviewChanges()],
  };
}

window.addEventListener(
  "pointerdown",
  beginCanvasLayerDrag,
  true,
);

window.addEventListener(
  "pointermove",
  moveCanvasLayerDrag,
  true,
);

window.addEventListener(
  "pointerup",
  endCanvasLayerDrag,
  true,
);

window.addEventListener(
  "pointercancel",
  endCanvasLayerDrag,
  true,
);

window.addEventListener(
  "mousemove",
  (event) => {
    if (activeTool !== "select") return;
    const element = event.target;
    if (!(element instanceof Element) || element === overlay || element === hoverOverlay || element === hoveredElement) return;
    hoveredElement = element;
    if (element === selectedElement) {
      hideHoverOverlay();
      moveOverlay(element);
    } else {
      moveHoverOverlay(element);
    }
  },
  true,
);

window.addEventListener(
  "click",
  (event) => {
    if (suppressNextClick) {
      suppressNextClick = false;
      event.preventDefault();
      event.stopImmediatePropagation();
      return;
    }
    if (activeTool === "interact") return;
    const element = event.target;
    if (!(element instanceof Element) || element === overlay || element === hoverOverlay) return;
    if (textEditingState?.element === element) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (isSelectionBackground(element)) {
      clearSelection();
      return;
    }
    if (activeTool === "text") {
      if (!isTextEditable(element)) return;
      moveOverlay(element);
      selectElement(element);
      ipcRenderer.sendToHost("formia:element-selected", selectionPayload(element));
      beginTextEditing(element);
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

function isEditableKeyboardTarget(target) {
  return target instanceof HTMLElement && (
    target.isContentEditable ||
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement
  );
}

function isCanvasShortcut(event) {
  if (event.altKey || event.repeat) return false;

  if (event.code === "Space" && !event.ctrlKey && !event.metaKey) return true;

  const hasModifier = event.ctrlKey || event.metaKey;
  if (hasModifier) return !event.shiftKey && event.code === "BracketLeft";

  if (event.code === "Equal" || event.code === "NumpadAdd" || event.code === "Minus" || event.code === "NumpadSubtract") return true;
  if (event.shiftKey) return false;

  return event.code === "KeyS" || event.code === "KeyI" || event.code === "KeyT" || event.code === "Digit0" || event.code === "Numpad0";
}

window.addEventListener(
  "keydown",
  (event) => {
    const targetIsEditable = Boolean(textEditingState) || isEditableKeyboardTarget(event.target);

    if (event.code === "Escape") {
      if (textEditingState) {
        finishTextEditing();
        event.preventDefault();
      } else if (selectedElement) {
        clearSelection();
        event.preventDefault();
      }
      return;
    }

    if (targetIsEditable || !isCanvasShortcut(event)) return;

    event.preventDefault();
    ipcRenderer.sendToHost("formia:canvas-keydown", {
      code: event.code,
      key: event.key,
      ctrlKey: event.ctrlKey,
      metaKey: event.metaKey,
      shiftKey: event.shiftKey,
      altKey: event.altKey,
      repeat: event.repeat,
      targetIsEditable,
    });
  },
  true,
);

window.addEventListener(
  "keyup",
  (event) => {
    if (event.code !== "Space" || Boolean(textEditingState) || isEditableKeyboardTarget(event.target)) return;
    ipcRenderer.sendToHost("formia:canvas-keyup", {
      code: event.code,
      key: event.key,
      ctrlKey: event.ctrlKey,
      metaKey: event.metaKey,
      shiftKey: event.shiftKey,
      altKey: event.altKey,
      repeat: event.repeat,
      targetIsEditable: false,
    });
  },
  true,
);

ipcRenderer.on("formia:set-tool", (_event, tool) => {
  if (!["interact", "select", "text"].includes(tool)) return;
  activeTool = tool;
  installCursorStyle();
  if (activeTool === "select") {
    finishTextEditing();
    if (selectedElement) moveOverlay(selectedElement);
  } else if (activeTool === "text") {
    hideHoverOverlay();
    if (selectedElement && isTextEditable(selectedElement)) {
      moveOverlay(selectedElement);
      beginTextEditing(selectedElement);
    } else {
      hideOverlay();
    }
  } else {
    finishTextEditing();
    layerPointerDrag = null;
    suppressNextClick = false;
    hideDropIndicator();
    hideOverlay();
  }
});

ipcRenderer.on("formia:measure-page-height", () => {
  preparePageHeightMeasurement();
});

ipcRenderer.on("formia:clear-selection", () => {
  clearSelection();
});

ipcRenderer.on("formia:inspect-at-point", (_event, payload) => {
  inspectAtPoint(Number(payload?.x), Number(payload?.y));
});

ipcRenderer.on("formia:get-layer-tree", () => {
  sendLayerTree();
});

ipcRenderer.on("formia:highlight-layer", (_event, selectionId) => {
  highlightLayer(selectionId);
});

ipcRenderer.on("formia:clear-layer-highlight", () => {
  clearLayerHighlight();
});

ipcRenderer.on("formia:select-layer", (_event, selectionId) => {
  selectLayer(selectionId);
});

ipcRenderer.on("formia:move-layer", (_event, payload) => {
  moveLayer(payload?.sourceSelectionId, payload?.targetParentId || null, payload?.beforeSelectionId || null);
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
