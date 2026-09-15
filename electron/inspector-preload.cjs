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
let selectedElementIdentity = null;
let textEditingState = null;
let selectionSequence = 0;
let insertedTextSequence = 0;
let insertedBoxSequence = 0;
let layerTreeObserver = null;
let layerTreeTimer = null;

const selectionAttribute = "data-formia-selection-id";
const insertedTextAttribute = "data-formia-inserted-text";
const insertedBoxAttribute = "data-formia-inserted-box";
const canvasTextDropExcludedTags = new Set(["A", "B", "BR", "CODE", "EM", "H1", "H2", "H3", "H4", "H5", "H6", "I", "INPUT", "LABEL", "P", "PRE", "S", "SELECT", "SMALL", "SPAN", "STRONG", "TEXTAREA", "U"]);
const canvasTextDropContainerDisplays = new Set(["block", "flow-root", "flex", "grid", "inline-block", "inline-flex", "inline-grid", "list-item", "table", "table-cell", "table-caption", "table-row"]);
const layerTreeExcludedTags = new Set(["SCRIPT", "STYLE", "LINK", "META", "TITLE", "NOSCRIPT", "TEMPLATE", "PATH", "CIRCLE", "RECT", "LINE", "POLYLINE", "POLYGON"]);
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
const deletedElements = new Map();
const duplicatedElements = new Map();
const insertedTextElements = new Map();
const insertedBoxElements = new Map();
let isReapplyingStructuralMoves = false;
let isRebindingPreviewOverrides = false;
let layerPointerDrag = null;
let textPositionDrag = null;
let suppressNextClick = false;
let canvasDropTarget = null;

const toolCursorPaths = {
  interact: "M220.49,207.8,207.8,220.49a12,12,0,0,1-17,0l-56.57-56.57L115,214.08l-.13.33A15.84,15.84,0,0,1,100.26,224l-.78,0a15.82,15.82,0,0,1-14.41-11L32.8,52.92A15.95,15.95,0,0,1,52.92,32.8L213,85.07a16,16,0,0,1,1.41,29.8l-.33.13-50.16,19.27,56.57,56.56A12,12,0,0,1,220.49,207.8Z",
  select: "M248,121.58a15.76,15.76,0,0,1-11.29,15l-.2.06-78,21.84-21.84,78-.06.2a15.77,15.77,0,0,1-15,11.29h-.3a15.77,15.77,0,0,1-15.07-10.67L41,61.41a1,1,0,0,1-.05-.16A16,16,0,0,1,61.25,40.9l.16.05,175.92,65.26A15.78,15.78,0,0,1,248,121.58Z",
  text: "M184,208a8,8,0,0,1-8,8H160a40,40,0,0,1-32-16,40,40,0,0,1-32,16H80a8,8,0,0,1,0-16H96a24,24,0,0,0,24-24V136H104a8,8,0,0,1,0-16h16V80A24,24,0,0,0,96,56H80a8,8,0,0,1,0-16H96a40,40,0,0,1,32,16,40,40,0,0,1,32-16h16a8,8,0,0,1,0,16H160a24,24,0,0,0-24,24v40h16a8,8,0,0,1,0,16H136v40a24,24,0,0,0,24,24h16A8,8,0,0,1,184,208Z",
  box: "M216,32H40A8,8,0,0,0,32,40V216A8,8,0,0,0,40,224H216A8,8,0,0,0,224,216V40A8,8,0,0,0,216,32Zm-8,176H48V48H208Z",
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
    left: `${target.axis === "x" ? (target.type === "before" !== Boolean(target.reverse) ? rect.left : rect.right - 1) : rect.left}px`,
    top: `${target.axis === "x" ? rect.top : (target.type === "before" !== Boolean(target.reverse) ? rect.top : rect.bottom - 1)}px`,
    width: `${target.axis === "x" ? 3 : rect.width}px`,
    height: `${target.axis === "x" ? rect.height : 3}px`,
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
      identity: elementIdentity(element),
    };
    elementSnapshots.set(element, snapshot);
    touchedElements.add(element);
  }
  return snapshot;
}

function elementIdentity(element) {
  const react = getReactDetails(element);
  return {
    tagName: element.tagName,
    id: element.id || "",
    className: typeof element.className === "string" ? element.className : "",
    text: (element.textContent || "").trim().replace(/\s+/g, " ").slice(0, 120),
    source: react?.source || null,
    path: elementPath(element),
  };
}

function elementPath(element) {
  const indexes = [];
  let current = element;
  while (current?.parentElement && current.parentElement !== document.body) {
    indexes.unshift(Array.from(current.parentElement.children).indexOf(current));
    current = current.parentElement;
  }
  if (current?.parentElement === document.body) indexes.unshift(Array.from(document.body.children).indexOf(current));
  return indexes.join(".");
}

function identityFromDetails(details) {
  return {
    tagName: typeof details?.tagName === "string" ? details.tagName.toUpperCase() : "",
    id: details?.id || "",
    className: details?.className || "",
    text: details?.text || "",
    source: details?.react?.source || details?.source || null,
  };
}

function identityScore(element, identity) {
  if (!(element instanceof Element) || !identity) return 0;
  if (identity.id && element.id !== identity.id) return 0;
  if (identity.tagName && element.tagName !== identity.tagName) return 0;

  let score = identity.id ? 100 : 0;
  if (identity.source && getReactDetails(element)?.source === identity.source) score += 80;
  if (identity.className && element.className === identity.className) score += 20;
  if (identity.text && (element.textContent || "").trim().replace(/\s+/g, " ").startsWith(identity.text)) score += 10;
  if (identity.path && elementPath(element) === identity.path) score += 5;
  return score || (identity.tagName ? 1 : 0);
}

function findPreviewReplacement(identity) {
  if (!identity || !document.body) return null;
  const candidates = Array.from(document.querySelectorAll("body *"))
    .filter((element) => !layerTreeExcludedTags.has(element.tagName))
    .map((element) => ({ element, score: identityScore(element, identity) }))
    .filter(({ score }) => score > 0)
    .sort((left, right) => right.score - left.score);
  if (candidates.length === 0 || candidates[0].score <= 1) return null;
  if (candidates[1]?.score === candidates[0].score) return null;
  return candidates[0].element;
}

function capturePreviewOverride(element, snapshot) {
  if (!snapshot) return;
  snapshot.overrides = snapshot.overrides || { styles: new Map(), className: undefined, html: undefined };

  for (const [cssName, original] of snapshot.styles) {
    const current = element.style.getPropertyValue(cssName);
    const priority = element.style.getPropertyPriority(cssName);
    if (current !== original.value || priority !== original.priority) snapshot.overrides.styles.set(cssName, { value: current, priority });
  }
  if (snapshot.className !== undefined && element.getAttribute("class") !== snapshot.className) snapshot.overrides.className = element.getAttribute("class");
  if (snapshot.html !== undefined && element.innerHTML !== snapshot.html) snapshot.overrides.html = element.innerHTML;
}

function applyPreviewOverride(element, snapshot) {
  if (!snapshot?.overrides) return;
  for (const [cssName, current] of snapshot.overrides.styles) {
    if (current.value) element.style.setProperty(cssName, current.value, current.priority);
    else element.style.removeProperty(cssName);
  }
  if (snapshot.overrides.className !== undefined) {
    if (snapshot.overrides.className === null) element.removeAttribute("class");
    else element.setAttribute("class", snapshot.overrides.className);
  }
  if (snapshot.overrides.html !== undefined) element.innerHTML = snapshot.overrides.html;
}

function rebindPreviewOverrides() {
  if (isRebindingPreviewOverrides) return;
  isRebindingPreviewOverrides = true;
  try {
    const replacements = new Map();
    for (const element of Array.from(touchedElements)) {
      const snapshot = elementSnapshots.get(element);
      if (!snapshot) continue;
      if (element.isConnected) {
        capturePreviewOverride(element, snapshot);
        continue;
      }
      capturePreviewOverride(element, snapshot);
      const replacement = findPreviewReplacement(snapshot.identity);
      if (!replacement) continue;
      replacements.set(element, replacement);
      applyPreviewOverride(replacement, snapshot);
      elementSnapshots.set(replacement, snapshot);
      touchedElements.delete(element);
      touchedElements.add(replacement);
      if (selectedElement === element) selectedElement = replacement;
    }

    if (selectedElement && !selectedElement.isConnected && selectedElementIdentity) {
      const replacement = findPreviewReplacement(selectedElementIdentity);
      if (replacement) selectedElement = replacement;
    }

    for (const move of structuralMoves.values()) {
      const replacement = replacements.get(move.element) || (!move.element.isConnected ? findPreviewReplacement(move.elementIdentity) : move.element);
      const targetParent = replacements.get(move.targetParent) || (!move.targetParent.isConnected ? findPreviewReplacement(move.targetParentIdentity) : move.targetParent);
      if (replacement instanceof Element) move.element = replacement;
      if (targetParent instanceof Element) move.targetParent = targetParent;
    }

    for (const entry of deletedElements.values()) {
      if (entry.element.isConnected) continue;
      const replacement = findPreviewReplacement(entry.identity || identityFromDetails(entry.details));
      if (replacement instanceof Element && !isDocumentSurface(replacement)) {
        entry.element = replacement;
        if (!entry.originalParent?.isConnected) entry.originalParent = findPreviewReplacement(entry.originalParentIdentity);
        replacement.remove();
      }
    }

    for (const entry of duplicatedElements.values()) {
      if (entry.clone.isConnected) continue;
      const source = findPreviewReplacement(entry.sourceIdentity);
      if (!(source instanceof Element) || !source.parentElement) continue;
      const clone = source.cloneNode(true);
      clearLayerSelectionIds(clone);
      source.parentElement.insertBefore(clone, source.nextElementSibling);
      entry.clone = clone;
    }

    for (const entry of Array.from(insertedTextElements.values())) {
      const previous = entry.element;
      if (previous?.isConnected) {
        entry.text = previous.textContent || "";
        entry.inlineStyle = previous.getAttribute("style") || entry.inlineStyle;
        entry.selectionId = previous.getAttribute(selectionAttribute) || entry.selectionId;
        continue;
      }

      if (previous instanceof Element) {
        entry.text = previous.textContent || entry.text;
        entry.inlineStyle = previous.getAttribute("style") || entry.inlineStyle;
        entry.selectionId = previous.getAttribute(selectionAttribute) || entry.selectionId;
      }

      const parent = entry.parent?.isConnected
        ? entry.parent
        : findPreviewReplacement(entry.parentIdentity) || findCanvasInsertionParent();
      if (!(parent instanceof Element)) continue;

      const inserted = document.createElement("p");
      inserted.setAttribute(insertedTextAttribute, entry.insertionId);
      inserted.textContent = entry.text;
      if (entry.inlineStyle) inserted.setAttribute("style", entry.inlineStyle);
      if (entry.selectionId) inserted.setAttribute(selectionAttribute, entry.selectionId);
      parent.appendChild(inserted);

      insertedTextElements.delete(previous);
      insertedTextElements.set(inserted, entry);
      entry.element = inserted;
      entry.parent = parent;
      entry.parentIdentity = elementIdentity(parent);

      for (const move of structuralMoves.values()) {
        if (move.element !== previous) continue;
        move.element = inserted;
        move.elementIdentity = elementIdentity(inserted);
      }

      if (selectedElement === previous) {
        selectedElement = inserted;
        selectedElementIdentity = elementIdentity(inserted);
      }
    }

    for (const entry of Array.from(insertedBoxElements.values())) {
      const previous = entry.element;
      if (previous?.isConnected) {
        entry.inlineStyle = previous.getAttribute("style") || entry.inlineStyle;
        entry.selectionId = previous.getAttribute(selectionAttribute) || entry.selectionId;
        syncInsertedBoxSize(previous);
        continue;
      }

      if (previous instanceof Element) {
        entry.inlineStyle = previous.getAttribute("style") || entry.inlineStyle;
        entry.selectionId = previous.getAttribute(selectionAttribute) || entry.selectionId;
      }

      const parent = entry.parent?.isConnected
        ? entry.parent
        : findPreviewReplacement(entry.parentIdentity) || findCanvasInsertionParent();
      if (!(parent instanceof Element)) continue;

      const inserted = createInsertedBoxNode(entry, parent);
      insertedBoxElements.delete(previous);
      insertedBoxElements.set(inserted, entry);
      entry.element = inserted;
      entry.parent = parent;
      entry.parentIdentity = elementIdentity(parent);

      for (const move of structuralMoves.values()) {
        if (move.element !== previous) continue;
        move.element = inserted;
        move.elementIdentity = elementIdentity(inserted);
      }

      if (selectedElement === previous) {
        selectedElement = inserted;
        selectedElementIdentity = elementIdentity(inserted);
      }
    }

    if (selectedElement instanceof Element && selectedElement.isConnected) {
      ensureLayerSelectionId(selectedElement);
      moveOverlay(selectedElement);
    }
  } finally {
    isRebindingPreviewOverrides = false;
  }
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

function beginTextEditing(element, selectContents = false) {
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
  if (!selectContents) range.collapse(false);
  const browserSelection = window.getSelection();
  browserSelection?.removeAllRanges();
  browserSelection?.addRange(range);
  return true;
}

function selectElement(element) {
  if (textEditingState?.element !== element) finishTextEditing();
  selectedElement = element;
  selectedElementIdentity = elementIdentity(element);
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
  selectedElementIdentity = null;
  hideOverlay();
  ipcRenderer.sendToHost("formia:selection-cleared");
}

function isDocumentSurface(element) {
  return element === document.body || element === document.documentElement || element === document.scrollingElement;
}

function isSelectionBackground(element) {
  return isDocumentSurface(element);
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

function isInsertedTextLayer(element) {
  return element instanceof Element && element.hasAttribute(insertedTextAttribute);
}

function isInsertedBoxLayer(element) {
  return element instanceof Element && element.hasAttribute(insertedBoxAttribute);
}

function isInsertedLayer(element) {
  return isInsertedTextLayer(element) || isInsertedBoxLayer(element);
}

function findCanvasInsertionParent() {
  return document.body || null;
}

function insertionSourceContext(element) {
  if (!(element instanceof Element) || isDocumentSurface(element)) return null;

  ensureLayerSelectionId(element);
  const details = inspectElement(element);
  return {
    selectionId: details.selectionId,
    tagName: details.tagName,
    id: details.id,
    className: details.className,
    text: details.text,
    source: details.react?.source || null,
    component: details.react?.name || null,
  };
}

function positionForPoint(element, clientX, clientY) {
  const offsetParent = element.offsetParent instanceof Element ? element.offsetParent : document.documentElement;
  const rect = offsetParent.getBoundingClientRect();
  const isDocumentParent = offsetParent === document.documentElement || offsetParent === document.body;
  const scrollLeft = isDocumentParent ? window.scrollX : offsetParent.scrollLeft;
  const scrollTop = isDocumentParent ? window.scrollY : offsetParent.scrollTop;

  return {
    left: Math.round(clientX - rect.left + scrollLeft),
    top: Math.round(clientY - rect.top + scrollTop),
  };
}

function measuredInsertedBoxChildRect(box, child, boxRect) {
  const currentRect = child.getBoundingClientRect();
  const computedBox = getComputedStyle(box);
  const contentWidth = Math.max(1, boxRect.width - (Number.parseFloat(computedBox.borderLeftWidth) || 0) - (Number.parseFloat(computedBox.borderRightWidth) || 0));
  const explicitWidth = child.style.getPropertyValue("width").trim();
  if (explicitWidth || currentRect.width < contentWidth - 0.5) return currentRect;

  const originalWidth = {
    value: child.style.getPropertyValue("width"),
    priority: child.style.getPropertyPriority("width"),
  };
  const originalMaxWidth = {
    value: child.style.getPropertyValue("max-width"),
    priority: child.style.getPropertyPriority("max-width"),
  };
  child.style.setProperty("width", "max-content", "important");
  child.style.setProperty("max-width", "none", "important");
  const intrinsicRect = child.getBoundingClientRect();
  if (originalWidth.value) child.style.setProperty("width", originalWidth.value, originalWidth.priority);
  else child.style.removeProperty("width");
  if (originalMaxWidth.value) child.style.setProperty("max-width", originalMaxWidth.value, originalMaxWidth.priority);
  else child.style.removeProperty("max-width");

  return intrinsicRect.width > currentRect.width ? intrinsicRect : currentRect;
}

function measuredBoxChildBounds(box, boxRect, borderRight, borderBottom) {
  let width = 1;
  let height = 1;
  for (const child of Array.from(box.children)) {
    const rect = measuredInsertedBoxChildRect(box, child, boxRect);
    width = Math.max(width, Math.ceil(rect.right - boxRect.left + borderRight));
    height = Math.max(height, Math.ceil(rect.bottom - boxRect.top + borderBottom));
  }
  return { width, height };
}

function syncInsertedBoxSize(element) {
  const entry = insertedBoxElements.get(element);
  if (!(element instanceof Element) || !entry) return;

  if (element.children.length === 0) {
    element.style.setProperty("width", "100px", "important");
    element.style.setProperty("height", "100px", "important");
    entry.inlineStyle = element.getAttribute("style") || entry.inlineStyle;
    entry.width = 100;
    entry.height = 100;
    return;
  }

  const boxRect = element.getBoundingClientRect();
  const computed = getComputedStyle(element);
  const borderRight = Number.parseFloat(computed.borderRightWidth) || 0;
  const borderBottom = Number.parseFloat(computed.borderBottomWidth) || 0;
  const measured = measuredBoxChildBounds(element, boxRect, borderRight, borderBottom);
  const width = measured.width;
  const height = measured.height;

  element.style.setProperty("width", `${width}px`, "important");
  element.style.setProperty("height", `${height}px`, "important");
  entry.inlineStyle = element.getAttribute("style") || entry.inlineStyle;
  entry.width = width;
  entry.height = height;
}

function syncInsertedBoxSizes() {
  const entries = Array.from(insertedBoxElements.values()).reverse();
  for (const { element } of entries) {
    if (element?.isConnected) syncInsertedBoxSize(element);
  }
}

function createInsertedTextNode(entry, parent) {
  const element = document.createElement("p");
  element.setAttribute(insertedTextAttribute, entry.insertionId);
  element.textContent = entry.text;

  if (entry.inlineStyle) {
    element.setAttribute("style", entry.inlineStyle);
  } else {
    element.style.setProperty("position", "absolute", "important");
    element.style.setProperty("margin", "0", "important");
  }

  if (entry.selectionId) element.setAttribute(selectionAttribute, entry.selectionId);
  parent.appendChild(element);
  return element;
}

function createInsertedBoxNode(entry, parent) {
  const element = document.createElement("div");
  element.setAttribute(insertedBoxAttribute, entry.insertionId);

  if (entry.inlineStyle) {
    element.setAttribute("style", entry.inlineStyle);
  } else {
    element.style.setProperty("position", "absolute", "important");
    element.style.setProperty("width", "100px", "important");
    element.style.setProperty("height", "100px", "important");
    element.style.setProperty("box-sizing", "border-box", "important");
    element.style.setProperty("border", "1px solid #9ca3af", "important");
  }

  if (entry.selectionId) element.setAttribute(selectionAttribute, entry.selectionId);
  parent.appendChild(element);
  return element;
}

function insertTextAtPoint(clientX, clientY, anchor) {
  const parent = findCanvasInsertionParent();
  if (!(parent instanceof Element)) return false;

  finishTextEditing();
  const entry = {
    insertionId: `formia-text-${++insertedTextSequence}`,
    element: null,
    parent,
    parentIdentity: elementIdentity(parent),
    sourceContext: insertionSourceContext(anchor),
    text: "New text",
    inlineStyle: "",
    selectionId: null,
  };
  const element = createInsertedTextNode(entry, parent);
  const position = positionForPoint(element, clientX, clientY);
  element.style.setProperty("left", `${position.left}px`, "important");
  element.style.setProperty("top", `${position.top}px`, "important");
  entry.element = element;
  entry.inlineStyle = element.getAttribute("style") || "";
  entry.left = position.left;
  entry.top = position.top;
  insertedTextElements.set(element, entry);

  selectElement(element);
  moveOverlay(element);
  ipcRenderer.sendToHost("formia:element-selected", selectionPayload(element));
  sendLayerTree();
  beginTextEditing(element, true);
  return true;
}

function insertBoxAtPoint(clientX, clientY) {
  const parent = findCanvasInsertionParent();
  if (!(parent instanceof Element)) return false;

  finishTextEditing();
  const entry = {
    insertionId: `formia-box-${++insertedBoxSequence}`,
    element: null,
    parent,
    parentIdentity: elementIdentity(parent),
    inlineStyle: "",
    selectionId: null,
    width: 100,
    height: 100,
  };
  const element = createInsertedBoxNode(entry, parent);
  const position = positionForPoint(element, clientX, clientY);
  element.style.setProperty("left", `${position.left}px`, "important");
  element.style.setProperty("top", `${position.top}px`, "important");
  entry.element = element;
  entry.inlineStyle = element.getAttribute("style") || "";
  entry.left = position.left;
  entry.top = position.top;
  insertedBoxElements.set(element, entry);

  selectElement(element);
  moveOverlay(element);
  ipcRenderer.sendToHost("formia:element-selected", selectionPayload(element));
  sendLayerTree();
  return true;
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

  const insertedText = insertedTextElements.get(element);
  if (insertedText) {
    insertedText.parent = targetParent;
    insertedText.parentIdentity = elementIdentity(targetParent);
  }
  const insertedBox = insertedBoxElements.get(element);
  if (insertedBox) {
    insertedBox.parent = targetParent;
    insertedBox.parentIdentity = elementIdentity(targetParent);
  }

  syncInsertedBoxSize(snapshot.parent);
  syncInsertedBoxSize(targetParent);

  if (isOriginalPlacement(element, snapshot)) {
    structuralMoves.delete(element);
    structureSnapshots.delete(element);
  } else {
    structuralMoves.set(element, {
      element,
      elementIdentity: elementIdentity(element),
      originalParent: snapshot.parent,
      originalNextSibling: snapshot.nextSibling,
      originalIndex: snapshot.index,
      targetParent,
      targetParentIdentity: elementIdentity(targetParent),
      targetBefore: beforeElement,
      targetBeforeIdentity: beforeElement ? elementIdentity(beforeElement) : null,
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
    if (move.targetBefore && move.targetBefore.parentElement !== move.targetParent) {
      move.targetBefore = move.targetBefore.isConnected ? null : findPreviewReplacement(move.targetBeforeIdentity);
    }
    if (move.element.parentElement !== move.targetParent || move.element.nextElementSibling !== move.targetBefore) {
      move.targetParent.insertBefore(move.element, move.targetBefore || null);
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

function moveSelectedLayer(direction) {
  if (!(selectedElement instanceof Element) || isDocumentSurface(selectedElement) || !selectedElement.parentElement) return false;

  const element = selectedElement;
  const parent = element.parentElement;
  const previousSibling = element.previousElementSibling;
  const nextSibling = element.nextElementSibling;
  const movesUp = direction === "up" || direction === "left";

  if (movesUp) {
    if (!previousSibling) return false;
    return commitElementMove(element, { parent, before: previousSibling });
  }

  if (direction === "down" || direction === "right") {
    if (!nextSibling) return false;
    return commitElementMove(element, { parent, before: nextSibling.nextElementSibling });
  }

  return false;
}

function commitElementMove(element, target) {
  if (!moveElementTo(element, target.parent, target.before)) return false;

  selectElement(element);
  moveOverlay(element);
  ipcRenderer.sendToHost("formia:element-selected", selectionPayload(element));
  sendLayerTree();
  return true;
}

function beginTextPositionDrag(event, element) {
  const computed = getComputedStyle(element);
  const left = Number.parseFloat(element.style.getPropertyValue("left") || computed.left) || 0;
  const top = Number.parseFloat(element.style.getPropertyValue("top") || computed.top) || 0;

  textPositionDrag = {
    element,
    pointerId: event.pointerId,
    startX: event.clientX,
    startY: event.clientY,
    initialLeft: left,
    initialTop: top,
    moved: false,
    dropTarget: null,
    freeMove: event.shiftKey,
  };
  element.setPointerCapture?.(event.pointerId);
}

function moveTextPositionDrag(event) {
  if (!textPositionDrag || event.pointerId !== textPositionDrag.pointerId) return false;

  const drag = textPositionDrag;
  const deltaX = event.clientX - drag.startX;
  const deltaY = event.clientY - drag.startY;
  if (!drag.moved && Math.hypot(deltaX, deltaY) < 5) return true;

  if (!drag.moved) {
    drag.moved = true;
    suppressNextClick = true;
    selectElement(drag.element);
    rememberInlineStyle(drag.element, "left");
    rememberInlineStyle(drag.element, "top");
    ipcRenderer.sendToHost("formia:element-selected", selectionPayload(drag.element));
  }

  event.preventDefault();
  event.stopImmediatePropagation();
  const left = Math.round(drag.initialLeft + deltaX);
  const top = Math.round(drag.initialTop + deltaY);
  drag.element.style.setProperty("left", `${left}px`, "important");
  drag.element.style.setProperty("top", `${top}px`, "important");
  const entry = insertedTextElements.get(drag.element) || insertedBoxElements.get(drag.element);
  if (entry) {
    entry.inlineStyle = drag.element.getAttribute("style") || entry.inlineStyle;
    entry.left = left;
    entry.top = top;
  }

  if (event.shiftKey) drag.freeMove = true;
  drag.dropTarget = drag.freeMove ? null : findCanvasTextDropTarget(event.clientX, event.clientY, drag.element);
  if (drag.dropTarget) showDropTarget(drag.dropTarget);
  else hideDropIndicator();

  moveOverlay(drag.element);
  return true;
}

function endTextPositionDrag(event) {
  if (!textPositionDrag || event.pointerId !== textPositionDrag.pointerId) return false;

  const drag = textPositionDrag;
  textPositionDrag = null;
  drag.element.releasePointerCapture?.(event.pointerId);
  if (!drag.moved) {
    hideDropIndicator();
    return true;
  }

  if (event.type === "pointercancel") suppressNextClick = false;
  event.preventDefault();
  event.stopImmediatePropagation();

  const target = event.type === "pointerup" && !drag.freeMove
    ? findCanvasTextDropTarget(event.clientX, event.clientY, drag.element)
    : null;
  hideDropIndicator();

  if (target && moveElementTo(drag.element, target.parent, target.before)) {
    const position = positionForPoint(drag.element, event.clientX, event.clientY);
    drag.element.style.setProperty("left", `${position.left}px`, "important");
    drag.element.style.setProperty("top", `${position.top}px`, "important");

    const entry = insertedTextElements.get(drag.element) || insertedBoxElements.get(drag.element);
    if (entry) {
      entry.inlineStyle = drag.element.getAttribute("style") || entry.inlineStyle;
      entry.left = position.left;
      entry.top = position.top;
    }

    selectElement(drag.element);
    moveOverlay(drag.element);
    ipcRenderer.sendToHost("formia:element-selected", selectionPayload(drag.element));
    sendLayerTree();
    return true;
  }

  sendUpdatedSelection();
  return true;
}

function clearLayerSelectionIds(element) {
  element.removeAttribute(selectionAttribute);
  element.querySelectorAll(`[${selectionAttribute}]`).forEach((child) => child.removeAttribute(selectionAttribute));
}

function deleteSelectedLayer() {
  if (!(selectedElement instanceof Element) || isDocumentSurface(selectedElement) || !selectedElement.parentElement) return false;

  finishTextEditing();
  const element = selectedElement;
  const snapshot = rememberStructure(element);
  const details = inspectElement(element);
  const insertedText = insertedTextElements.get(element);
  const insertedBox = insertedBoxElements.get(element);
  const duplicated = duplicatedElements.get(element);

  structuralMoves.delete(element);
  if (insertedText) insertedTextElements.delete(element);
  else if (insertedBox) insertedBoxElements.delete(element);
  else if (duplicated) duplicatedElements.delete(element);
  else {
    deletedElements.set(element, {
      element,
      identity: elementIdentity(element),
      originalParent: snapshot.parent,
      originalParentIdentity: snapshot.parent ? elementIdentity(snapshot.parent) : null,
      originalIndex: snapshot.index,
      details,
    });
  }

  for (const descendant of element.querySelectorAll(`[${insertedTextAttribute}], [${insertedBoxAttribute}]`)) {
    insertedTextElements.delete(descendant);
    insertedBoxElements.delete(descendant);
    structuralMoves.delete(descendant);
  }

  selectedElement = null;
  hoveredElement = null;
  hideOverlay();
  hideHoverOverlay();
  element.remove();
  ipcRenderer.sendToHost("formia:selection-cleared");
  sendLayerTree();
  sendPreviewState();
  return true;
}

function duplicateSelectedLayer() {
  if (!(selectedElement instanceof Element) || isDocumentSurface(selectedElement) || !selectedElement.parentElement) return false;

  finishTextEditing();
  const source = selectedElement;
  const parent = source.parentElement;
  const sourceDetails = inspectElement(source);
  const clone = source.cloneNode(true);
  clearLayerSelectionIds(clone);
  parent.insertBefore(clone, source.nextElementSibling);
  duplicatedElements.set(clone, {
    clone,
    sourceSelectionId: sourceDetails.selectionId,
    sourceDetails,
    sourceIdentity: elementIdentity(source),
    parentIdentity: elementIdentity(parent),
  });

  selectElement(clone);
  moveOverlay(clone);
  ipcRenderer.sendToHost("formia:element-selected", selectionPayload(clone));
  sendLayerTree();
  return true;
}

function sendUpdatedSelection() {
  syncInsertedBoxSizes();
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
  textPositionDrag = null;
  restoreStructuralOverrides();

  for (const { clone } of Array.from(duplicatedElements.values()).reverse()) {
    if (clone.isConnected) clone.remove();
  }
  duplicatedElements.clear();

  for (const { element } of Array.from(insertedTextElements.values()).reverse()) {
    if (element.isConnected) element.remove();
  }
  insertedTextElements.clear();

  for (const { element } of Array.from(insertedBoxElements.values()).reverse()) {
    if (element.isConnected) element.remove();
  }
  insertedBoxElements.clear();

  for (const { element, originalParent, originalIndex } of Array.from(deletedElements.values()).reverse()) {
    if (!element.isConnected && originalParent?.isConnected) {
      const siblings = Array.from(originalParent.children);
      const originalReference = siblings[originalIndex] || null;
      originalParent.insertBefore(element, originalReference);
    }
  }
  deletedElements.clear();

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
  if (selectedElement instanceof Element && selectedElement.isConnected) {
    sendUpdatedSelection();
  } else if (selectedElement) {
    selectedElement = null;
    selectedElementIdentity = null;
    hideOverlay();
    ipcRenderer.sendToHost("formia:selection-cleared");
  }
  sendLayerTree();
  sendPreviewState();
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

function markInsertedLayerBranches(element, branches, insideInsertedBox = false) {
  const isInsideInsertedBox = insideInsertedBox || isInsertedBoxLayer(element);
  let containsInsertedLayer = isInsertedLayer(element) || insideInsertedBox;
  if (isInsideInsertedBox) branches.add(element);
  for (const child of element.children) {
    if (markInsertedLayerBranches(child, branches, isInsideInsertedBox)) containsInsertedLayer = true;
  }
  if (containsInsertedLayer) branches.add(element);
  return containsInsertedLayer;
}

function buildLayerNode(element, state, depth = 0) {
  const isInsertedBranch = state.insertedLayerBranches.has(element);
  if ((state.count >= maximumLayerTreeNodes && !isInsertedBranch) || layerTreeExcludedTags.has(element.tagName)) return null;

  const computed = getComputedStyle(element);
  if (!isInsertedBranch && (computed.display === "none" || computed.visibility === "hidden")) return null;

  state.count += 1;
  const children = depth < maximumLayerTreeDepth || isInsertedBranch
    ? Array.from(element.children).map((child) => buildLayerNode(child, state, depth + 1)).filter(Boolean)
    : [];
  const rect = element.getBoundingClientRect();
  if (!isInsertedBranch && children.length === 0 && (rect.width <= 0 || rect.height <= 0)) return null;

  const componentName = getReactComponentName(element);
  return {
    selectionId: ensureLayerSelectionId(element),
    tagName: element.tagName.toLowerCase(),
    name: componentName || element.tagName.toLowerCase(),
    detail: layerDetail(element),
    children,
    inserted: isInsertedBoxLayer(element) ? "box" : isInsertedTextLayer(element) ? "text" : null,
  };
}

function collectLayerTree() {
  if (!document.body) return [];
  const insertedLayerBranches = new Set();
  for (const element of document.body.children) markInsertedLayerBranches(element, insertedLayerBranches);
  const state = { count: 0, insertedLayerBranches };
  return Array.from(document.body.children)
    .map((element) => buildLayerNode(element, state))
    .filter(Boolean);
}

function sendLayerTree() {
  if (!document.body) return;
  rebindPreviewOverrides();
  reapplyStructuralOverrides();
  syncInsertedBoxSizes();
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
  let element = document.elementFromPoint(x, y);
  if (!(element instanceof Element) || element === overlay || element === dropIndicator || element === dropTargetOverlay) return null;
  if (element === source || source.contains(element) || element === document.documentElement || element === document.scrollingElement || layerTreeExcludedTags.has(element.tagName)) return null;
  if (element === document.body) return { type: "inside", element, parent: document.body, before: null };

  const insertedBox = element.closest(`[${insertedBoxAttribute}]`);
  if (insertedBox instanceof Element && insertedBox !== source && !source.contains(insertedBox)) {
    return { type: "inside", element: insertedBox, parent: insertedBox, before: null };
  }

  // Prefer the sibling being crossed over its nested text, icons, and wrappers.
  let sibling = element;
  while (sibling.parentElement && sibling.parentElement !== source.parentElement) sibling = sibling.parentElement;
  if (sibling.parentElement === source.parentElement) element = sibling;

  const parent = element.parentElement;
  if (!parent || isDocumentSurface(parent) && parent !== document.body) return null;
  const rect = element.getBoundingClientRect();
  const layout = getComputedStyle(parent);
  const horizontal = layout.display.includes("flex") && layout.flexDirection.startsWith("row") || layout.display.includes("grid") && layout.gridTemplateColumns.split(" ").length > 1;
  const axis = horizontal ? "x" : "y";
  const reverse = horizontal ? (layout.direction === "rtl") !== (layout.flexDirection === "row-reverse") : layout.flexDirection === "column-reverse";
  const size = horizontal ? rect.width : rect.height;
  let fraction = size > 0 ? ((horizontal ? x - rect.left : y - rect.top) / size) : 0.5;
  if (reverse) fraction = 1 - fraction;
  // A small dead band prevents flicker at the nesting/reorder boundaries.
  const previous = canvasDropTarget?.element === element ? canvasDropTarget.type : null;
  const edge = Math.min(0.25, 24 / Math.max(1, size));
  const slop = Math.min(0.08, 4 / Math.max(1, size));
  if (fraction < edge + (previous === "before" ? slop : 0)) return { type: "before", element, parent, before: element, axis, reverse };
  if (fraction > 1 - edge - (previous === "after" ? slop : 0)) return { type: "after", element, parent, before: element.nextElementSibling, axis, reverse };
  if (element.children.length === 0) return { type: fraction < 0.5 ? "before" : "after", element, parent, before: fraction < 0.5 ? element : element.nextElementSibling, axis, reverse };
  return { type: "inside", element, parent: element, before: null };
}

function isCanvasTextDropContainer(element, source) {
  if (!(element instanceof Element) || isDocumentSurface(element) || element === source || source.contains(element)) return false;
  if (layerTreeExcludedTags.has(element.tagName) || canvasTextDropExcludedTags.has(element.tagName)) return false;

  const computed = getComputedStyle(element);
  if (!canvasTextDropContainerDisplays.has(computed.display) || computed.visibility === "hidden" || computed.display === "none") return false;

  const rect = element.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}

function findCanvasTextDropTarget(x, y, source) {
  if (!(source instanceof Element)) return null;

  const pointerEvents = source.style.getPropertyValue("pointer-events");
  const pointerEventsPriority = source.style.getPropertyPriority("pointer-events");
  source.style.setProperty("pointer-events", "none", "important");

  let element = null;
  try {
    element = document.elementFromPoint(x, y);
  } finally {
    if (pointerEvents) source.style.setProperty("pointer-events", pointerEvents, pointerEventsPriority);
    else source.style.removeProperty("pointer-events");
  }

  while (element instanceof Element && !isDocumentSurface(element)) {
    if (isCanvasTextDropContainer(element, source) && element !== source.parentElement) {
      return { type: "inside", element, parent: element, before: null };
    }
    element = element.parentElement;
  }

  return null;
}

function beginCanvasLayerDrag(event) {
  if (activeTool !== "select" || event.button !== 0 || layerPointerDrag || textPositionDrag) return;
  const element = selectedElement?.contains(event.target) ? selectedElement : event.target;
  if (!(element instanceof Element) || element === overlay || isDocumentSurface(element) || layerTreeExcludedTags.has(element.tagName)) return;

  if (insertedTextElements.has(element) || insertedBoxElements.has(element)) {
    beginTextPositionDrag(event, element);
    return;
  }

  layerPointerDrag = {
    element,
    pointerId: event.pointerId,
    startX: event.clientX,
    startY: event.clientY,
    moved: false,
    frame: null,
  };
  element.setPointerCapture?.(event.pointerId);
}

function moveCanvasLayerDrag(event) {
  if (textPositionDrag) {
    moveTextPositionDrag(event);
    return;
  }
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
  const drag = layerPointerDrag;
  drag.x = event.clientX;
  drag.y = event.clientY;
  hideHoverOverlay();
  if (drag.frame === null) drag.frame = requestAnimationFrame(() => {
    drag.frame = null;
    const target = findCanvasDropTarget(drag.x, drag.y, drag.element);
    if (target) showDropTarget(target);
    else hideDropIndicator();
  });
}

function endCanvasLayerDrag(event) {
  if (textPositionDrag) {
    endTextPositionDrag(event);
    return;
  }
  if (!layerPointerDrag || event.pointerId !== layerPointerDrag.pointerId) return;

  const drag = layerPointerDrag;
  layerPointerDrag = null;
  if (drag.frame !== null) cancelAnimationFrame(drag.frame);
  drag.element.releasePointerCapture?.(event.pointerId);
  if (!drag.moved) return;
  if (event.type === "pointercancel") suppressNextClick = false;

  event.preventDefault();
  event.stopImmediatePropagation();
  const target = event.type === "pointerup" ? findCanvasDropTarget(event.clientX, event.clientY, drag.element) : null;
  hideDropIndicator();
  if (target) commitElementMove(drag.element, target);
}

function cancelCanvasLayerDrag() {
  if (textPositionDrag) {
    endTextPositionDrag({ pointerId: textPositionDrag.pointerId, type: "pointercancel", preventDefault() {}, stopImmediatePropagation() {} });
    return;
  }
  if (!layerPointerDrag) return;
  endCanvasLayerDrag({ pointerId: layerPointerDrag.pointerId, type: "pointercancel", preventDefault() {}, stopImmediatePropagation() {} });
}

window.addEventListener("blur", cancelCanvasLayerDrag);
window.addEventListener("lostpointercapture", cancelCanvasLayerDrag);
window.addEventListener("dragstart", (event) => {
  if (activeTool === "select") event.preventDefault();
}, true);

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
  const styleOrigins = {};
  const authoredStyle = (property, computedValue) => {
    const authored = element.style.getPropertyValue(property);
    styleOrigins[property] = authored ? "inline" : "computed";
    return authored || computedValue;
  };
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
        .filter((attribute) => !["class", "id", selectionAttribute, insertedTextAttribute, insertedBoxAttribute].includes(attribute.name))
        .map((attribute) => [attribute.name, attribute.value]),
    ),
    dimensions: {
      width: Math.round(rect.width * 100) / 100,
      height: Math.round(rect.height * 100) / 100,
      x: Math.round(rect.x * 100) / 100,
      y: Math.round(rect.y * 100) / 100,
    },
    styles: {
      width: authoredStyle("width", computed.width), height: authoredStyle("height", computed.height),
      minWidth: authoredStyle("min-width", computed.minWidth), minHeight: authoredStyle("min-height", computed.minHeight),
      transform: authoredStyle("transform", computed.transform), display: authoredStyle("display", computed.display),
      position: authoredStyle("position", computed.position), top: authoredStyle("top", computed.top), bottom: authoredStyle("bottom", computed.bottom),
      right: authoredStyle("right", computed.right), left: authoredStyle("left", computed.left), flexDirection: authoredStyle("flex-direction", computed.flexDirection),
      flexWrap: authoredStyle("flex-wrap", computed.flexWrap), alignContent: authoredStyle("align-content", computed.alignContent), rowGap: authoredStyle("row-gap", computed.rowGap),
      columnGap: authoredStyle("column-gap", computed.columnGap), flexGrow: authoredStyle("flex-grow", computed.flexGrow), flexShrink: authoredStyle("flex-shrink", computed.flexShrink),
      flexBasis: authoredStyle("flex-basis", computed.flexBasis), order: authoredStyle("order", computed.order), alignSelf: authoredStyle("align-self", computed.alignSelf),
      justifySelf: authoredStyle("justify-self", computed.justifySelf), gridTemplateColumns: authoredStyle("grid-template-columns", computed.gridTemplateColumns),
      gridTemplateRows: authoredStyle("grid-template-rows", computed.gridTemplateRows), gridAutoFlow: authoredStyle("grid-auto-flow", computed.gridAutoFlow),
      gridColumnStart: authoredStyle("grid-column-start", computed.gridColumnStart), gridColumnEnd: authoredStyle("grid-column-end", computed.gridColumnEnd),
      gridRowStart: authoredStyle("grid-row-start", computed.gridRowStart), gridRowEnd: authoredStyle("grid-row-end", computed.gridRowEnd), gridArea: authoredStyle("grid-area", computed.gridArea),
      overflow: authoredStyle("overflow", computed.overflow), boxSizing: authoredStyle("box-sizing", computed.boxSizing), zIndex: authoredStyle("z-index", computed.zIndex),
      color: authoredStyle("color", computed.color), backgroundColor: authoredStyle("background-color", computed.backgroundColor), fontFamily: authoredStyle("font-family", computed.fontFamily),
      fontSize: authoredStyle("font-size", computed.fontSize), fontWeight: authoredStyle("font-weight", computed.fontWeight), lineHeight: authoredStyle("line-height", computed.lineHeight),
      letterSpacing: authoredStyle("letter-spacing", computed.letterSpacing), textAlign: authoredStyle("text-align", computed.textAlign), textTransform: authoredStyle("text-transform", computed.textTransform),
      textDecorationLine: authoredStyle("text-decoration-line", computed.textDecorationLine), margin: authoredStyle("margin", computed.margin), padding: authoredStyle("padding", computed.padding),
      marginTop: authoredStyle("margin-top", computed.marginTop), marginRight: authoredStyle("margin-right", computed.marginRight), marginBottom: authoredStyle("margin-bottom", computed.marginBottom), marginLeft: authoredStyle("margin-left", computed.marginLeft),
      paddingTop: authoredStyle("padding-top", computed.paddingTop), paddingRight: authoredStyle("padding-right", computed.paddingRight), paddingBottom: authoredStyle("padding-bottom", computed.paddingBottom), paddingLeft: authoredStyle("padding-left", computed.paddingLeft),
      border: authoredStyle("border", computed.border), borderStyle: authoredStyle("border-style", computed.borderStyle), borderWidth: authoredStyle("border-width", computed.borderWidth),
      borderColor: authoredStyle("border-color", computed.borderColor), borderRadius: authoredStyle("border-radius", computed.borderRadius), gap: authoredStyle("gap", computed.gap),
      alignItems: authoredStyle("align-items", computed.alignItems), justifyContent: authoredStyle("justify-content", computed.justifyContent),
    },
    styleOrigins,
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
        const change = {
          kind: "style",
          property: cssName,
          from: original.value || "(not set)",
          to: current || "(not set)",
        };
        if (cssName === "font-family") {
          change.intent = "replace-primary-font-family";
          change.preserveFallbacks = true;
          change.primaryFont = current.split(",")[0]?.trim().replace(/^['"]|['"]$/g, "") || "";
        }
        changes.push(change);
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
    const insertedElement = insertedTextElements.get(element) || insertedBoxElements.get(element);
    return [{
      selectionId: details.selectionId,
      tagName: details.tagName,
      source: insertedElement?.sourceContext?.source || details.react?.source || null,
      text: details.text,
      insertionId: insertedElement?.insertionId || null,
      changes,
    }];
  });
}

function collectStructuralPreviewChanges() {
  const deletedChanges = Array.from(deletedElements.values()).map(({ originalParent, originalIndex, details }) => ({
    selectionId: details.selectionId,
    tagName: details.tagName,
    source: details.react?.source || null,
    text: details.text,
    changes: [{
      kind: "structure",
      operation: "delete",
      property: "layer",
      from: `${layerDescription(originalParent)} at index ${originalIndex}`,
      to: "deleted",
    }],
  }));

  const duplicatedChanges = Array.from(duplicatedElements.values()).flatMap(({ clone, sourceSelectionId, sourceDetails }) => {
    if (!clone.isConnected || !clone.parentElement) return [];

    const details = inspectElement(clone);
    return [{
      selectionId: details.selectionId,
      tagName: details.tagName,
      source: sourceDetails.react?.source || details.react?.source || null,
      text: details.text,
      changes: [{
        kind: "structure",
        operation: "duplicate",
        property: "layer",
        from: sourceSelectionId ? `layer ${sourceSelectionId}` : layerDescription(clone),
        to: `${layerDescription(clone.parentElement)} at index ${layerIndex(clone)}`,
      }],
    }];
  });

  const insertedTextChanges = Array.from(insertedTextElements.values()).flatMap((entry) => {
    const element = entry.element;
    if (!(element instanceof Element) || !element.isConnected || !element.parentElement) return [];

    const details = inspectElement(element);
    entry.parent = element.parentElement;
    entry.parentIdentity = elementIdentity(entry.parent);
    const parentDetails = inspectElement(entry.parent);
    const left = Number.parseFloat(details.styles.left) || entry.left || 0;
    const top = Number.parseFloat(details.styles.top) || entry.top || 0;
    return [{
      selectionId: details.selectionId,
      insertionId: entry.insertionId,
      tagName: "p",
      source: entry.sourceContext?.source || null,
      text: details.text,
      changes: [{
        kind: "structure",
        operation: "insert",
        property: "layer",
        from: "Text tool",
        to: `p in ${layerDescription(entry.parent)} at (${Math.round(left)}, ${Math.round(top)})`,
        elementType: "text",
        elementTagName: "p",
        content: details.text,
        position: { left: Math.round(left), top: Math.round(top) },
        sourceContext: entry.sourceContext,
        previewParent: {
          selectionId: parentDetails.selectionId,
          insertionId: insertedBoxElements.get(entry.parent)?.insertionId || null,
          tagName: parentDetails.tagName,
          id: parentDetails.id,
          source: parentDetails.react?.source || null,
        },
      }],
    }];
  });

  const insertedBoxChanges = Array.from(insertedBoxElements.values()).flatMap((entry) => {
    const element = entry.element;
    if (!(element instanceof Element) || !element.isConnected || !element.parentElement) return [];

    const details = inspectElement(element);
    entry.parent = element.parentElement;
    entry.parentIdentity = elementIdentity(entry.parent);
    const parentDetails = inspectElement(entry.parent);
    const left = Number.parseFloat(details.styles.left) || entry.left || 0;
    const top = Number.parseFloat(details.styles.top) || entry.top || 0;
    const width = Math.round(details.dimensions.width);
    const height = Math.round(details.dimensions.height);
    const parentInsertionId = insertedBoxElements.get(entry.parent)?.insertionId || null;
    return [{
      selectionId: details.selectionId,
      insertionId: entry.insertionId,
      tagName: "div",
      source: null,
      text: "",
      changes: [{
        kind: "structure",
        operation: "insert",
        property: "layer",
        from: "Box tool",
        to: `div in ${layerDescription(entry.parent)} at (${Math.round(left)}, ${Math.round(top)}) sized ${width} × ${height}`,
        elementType: "box",
        elementTagName: "div",
        position: { left: Math.round(left), top: Math.round(top) },
        size: { width, height },
        sourceContext: null,
        previewParent: {
          selectionId: parentDetails.selectionId,
          insertionId: parentInsertionId,
          tagName: parentDetails.tagName,
          id: parentDetails.id,
          source: parentDetails.react?.source || null,
        },
      }],
    }];
  });

  const moveChanges = Array.from(structuralMoves.values()).filter((move) => !isInsertedLayer(move.element)).flatMap((move) => {
    if (!move.element.isConnected || !move.targetParent.isConnected) return [];

    const details = inspectElement(move.element);
    return [{
      selectionId: details.selectionId,
      tagName: details.tagName,
      source: details.react?.source || null,
      text: details.text,
      changes: [{
        kind: "structure",
        operation: "move",
        property: "parent/order",
        from: `${layerDescription(move.originalParent)} at index ${move.originalIndex}`,
        to: `${layerDescription(move.targetParent)} at index ${layerIndex(move.element)}`,
      }],
    }];
  });

  return [...deletedChanges, ...duplicatedChanges, ...insertedTextChanges, ...insertedBoxChanges, ...moveChanges];
}

function sendPreviewState() {
  ipcRenderer.sendToHost("formia:preview-state", {
    changes: [...collectPreviewChanges(), ...collectStructuralPreviewChanges()],
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
    if (activeTool !== "select" || layerPointerDrag?.moved || textPositionDrag?.moved) return;
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
    if (activeTool === "box") {
      insertBoxAtPoint(event.clientX, event.clientY);
      return;
    }
    if (isSelectionBackground(element)) {
      if (activeTool === "text") insertTextAtPoint(event.clientX, event.clientY, null);
      else clearSelection();
      return;
    }
    if (activeTool === "text") {
      if (isTextEditable(element)) {
        moveOverlay(element);
        selectElement(element);
        ipcRenderer.sendToHost("formia:element-selected", selectionPayload(element));
        beginTextEditing(element);
      } else {
        insertTextAtPoint(event.clientX, event.clientY, element);
      }
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

  if (!event.shiftKey && !event.ctrlKey && !event.metaKey && activeTool === "select" && selectedElement && ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.code)) return true;

  if (event.code === "Delete" || event.code === "Backspace") return true;

  const hasModifier = event.ctrlKey || event.metaKey;
  if (hasModifier) return !event.shiftKey && (event.code === "BracketLeft" || event.code === "KeyD");

  if (event.code === "Equal" || event.code === "NumpadAdd" || event.code === "Minus" || event.code === "NumpadSubtract") return true;
  if (event.shiftKey) return false;

  return event.code === "KeyS" || event.code === "KeyI" || event.code === "KeyT" || event.code === "KeyB" || event.code === "Digit0" || event.code === "Numpad0";
}

window.addEventListener(
  "keydown",
  (event) => {
    const targetIsEditable = Boolean(textEditingState) || isEditableKeyboardTarget(event.target);

    if (event.code === "Escape") {
      if (layerPointerDrag || textPositionDrag) {
        cancelCanvasLayerDrag();
        event.preventDefault();
        event.stopImmediatePropagation();
        return;
      }
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
  if (!["interact", "select", "text", "box"].includes(tool)) return;
  cancelCanvasLayerDrag();
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

ipcRenderer.on("formia:delete-selected-layer", () => {
  deleteSelectedLayer();
});

ipcRenderer.on("formia:duplicate-selected-layer", () => {
  duplicateSelectedLayer();
});

ipcRenderer.on("formia:move-selected-layer", (_event, direction) => {
  moveSelectedLayer(direction);
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
  sendPreviewState();
});
