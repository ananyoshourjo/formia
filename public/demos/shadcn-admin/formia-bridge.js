(function () {
  "use strict";

  var selectionCounter = 0;
  var selectedElement = null;
  var previewChanges = [];
  var highlightedElement = null;
  var previousHighlight = "";
  var activeTool = "interact";
  var textEditingState = null;
  var selectionOverlay = document.createElement("div");
  var hoverOverlay = document.createElement("div");
  var cursorStyle = document.createElement("style");
  var selectedOutlineElement = null;
  var selectedOutline = "";
  var hoverOutlineElement = null;
  var hoverOutline = "";

  cursorStyle.textContent = "html, body, body * { cursor: var(--formia-cursor, auto) !important; }";
  document.head.appendChild(cursorStyle);

  function setCanvasCursor(cursor) {
    document.documentElement.style.setProperty("--formia-cursor", cursor || "auto");
  }
  var styleProperties = [
    "display", "position", "top", "right", "bottom", "left", "zIndex", "overflow",
    "width", "height", "minWidth", "minHeight", "maxWidth", "maxHeight", "boxSizing",
    "marginTop", "marginRight", "marginBottom", "marginLeft", "paddingTop", "paddingRight",
    "paddingBottom", "paddingLeft", "gap", "rowGap", "columnGap", "flexDirection", "flexWrap",
    "justifyContent", "alignItems", "alignContent", "flexGrow", "flexShrink", "flexBasis",
    "order", "gridTemplateColumns", "gridTemplateRows", "gridAutoFlow", "gridColumnStart",
    "gridColumnEnd", "gridRowStart", "gridRowEnd", "justifySelf", "alignSelf", "fontFamily",
    "fontSize", "fontWeight", "lineHeight", "letterSpacing", "textAlign", "textTransform",
    "textDecorationLine", "color", "backgroundColor", "borderStyle", "borderWidth", "borderRadius",
    "borderColor", "transform"
  ];

  function post(channel, args) {
    window.parent.postMessage({ source: "formia-online-demo", channel: channel, args: args || [] }, "*");
  }

  function isInspectable(element) {
    if (!(element instanceof HTMLElement)) return false;
    if (element === document.body || element === document.documentElement) return false;
    if (element.closest("[data-formia-ignore]")) return false;
    return !["SCRIPT", "STYLE", "LINK", "META", "NOSCRIPT"].includes(element.tagName);
  }

  function ensureSelectionId(element) {
    if (!element.dataset.formiaSelectionId) {
      selectionCounter += 1;
      element.dataset.formiaSelectionId = "demo-" + selectionCounter;
    }
    return element.dataset.formiaSelectionId;
  }

  function inspectableElements() {
    return Array.from(document.querySelectorAll("body *")).filter(isInspectable);
  }

  function textFor(element) {
    return (element.innerText || element.textContent || "").replace(/\s+/g, " ").trim().slice(0, 160);
  }

  function nodeName(element) {
    var directText = Array.from(element.childNodes)
      .filter(function (node) { return node.nodeType === Node.TEXT_NODE; })
      .map(function (node) { return node.textContent || ""; })
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
    return (directText || element.getAttribute("aria-label") || element.tagName.toLowerCase()).slice(0, 80);
  }

  function selectionPayload(element) {
    var styles = getComputedStyle(element);
    var rect = element.getBoundingClientRect();
    var styleValues = {};
    styleProperties.forEach(function (property) { styleValues[property] = styles[property] || ""; });
    var attributes = {};
    Array.from(element.attributes).forEach(function (attribute) {
      if (!attribute.name.startsWith("data-formia")) attributes[attribute.name] = attribute.value;
    });
    return {
      selectionId: ensureSelectionId(element),
      tagName: element.tagName.toLowerCase(),
      id: element.id || null,
      className: typeof element.className === "string" ? element.className : "",
      text: textFor(element),
      textEditable: element.children.length === 0 && textFor(element).length > 0,
      attributes: attributes,
      dimensions: { x: Math.round(rect.left), y: Math.round(rect.top), width: Math.round(rect.width), height: Math.round(rect.height) },
      styles: styleValues,
      styleOrigins: {},
      parentLayout: element.parentElement ? { display: getComputedStyle(element.parentElement).display } : null,
      react: null,
      previewChanges: previewChanges
    };
  }

  function nodeFor(element) {
    var children = Array.from(element.children).filter(isInspectable);
    return {
      selectionId: ensureSelectionId(element),
      tagName: element.tagName.toLowerCase(),
      name: nodeName(element),
      detail: element.id ? "#" + element.id : null,
      children: children.map(nodeFor)
    };
  }

  function sendLayerTree() {
    var root = document.getElementById("root");
    post("formia:layer-tree", [{ nodes: root && isInspectable(root) ? [nodeFor(root)] : [] }]);
  }

  function sendSelection(element, channel) {
    restoreOutline("selected");
    restoreOutline("hover");
    selectedElement = element;
    moveOverlay(selectionOverlay, element);
    hideOverlay(hoverOverlay);
    setOutline("selected", element, "2px solid #2563eb");
    post(channel || "formia:element-selected", [selectionPayload(element)]);
  }

  function isTextEditable(element) {
    return element instanceof HTMLElement && element.children.length === 0 && textFor(element).length > 0;
  }

  function finishTextEditing() {
    if (!textEditingState) return;
    var element = textEditingState.element;
    if (textEditingState.contentEditable === null) element.removeAttribute("contenteditable");
    else element.setAttribute("contenteditable", textEditingState.contentEditable);
    if (textEditingState.spellcheck === null) element.removeAttribute("spellcheck");
    else element.setAttribute("spellcheck", textEditingState.spellcheck);
    element.removeEventListener("input", handleTextInput);
    textEditingState = null;
  }

  function recordTextChange(from, to) {
    if (from === to || !selectedElement) return;
    var id = ensureSelectionId(selectedElement);
    var existing = previewChanges.find(function (change) { return change.selectionId === id; });
    if (!existing) {
      existing = { selectionId: id, tagName: selectedElement.tagName.toLowerCase(), source: null, text: textFor(selectedElement), changes: [] };
      previewChanges.push(existing);
    }
    var change = existing.changes.find(function (item) { return item.kind === "text" && item.property === "textContent"; });
    if (change) change.to = to;
    else existing.changes.push({ kind: "text", property: "textContent", from: from, to: to });
    post("formia:preview-state", [{ changes: previewChanges }]);
  }

  function handleTextInput(event) {
    var element = event.currentTarget;
    if (!(element instanceof HTMLElement) || textEditingState?.element !== element) return;
    recordTextChange(textEditingState.originalHTML, element.innerHTML);
    sendSelection(element, "formia:element-updated");
  }

  function beginTextEditing(element) {
    if (!isTextEditable(element)) return false;
    if (textEditingState?.element === element) {
      element.focus();
      return true;
    }

    finishTextEditing();
    textEditingState = {
      element: element,
      originalHTML: element.innerHTML,
      contentEditable: element.getAttribute("contenteditable"),
      spellcheck: element.getAttribute("spellcheck")
    };
    element.setAttribute("contenteditable", "true");
    element.setAttribute("spellcheck", "false");
    element.addEventListener("input", handleTextInput);
    element.focus();

    var range = document.createRange();
    range.selectNodeContents(element);
    range.collapse(false);
    var browserSelection = window.getSelection();
    if (browserSelection) {
      browserSelection.removeAllRanges();
      browserSelection.addRange(range);
    }
    return true;
  }

  function ensureOverlays() {
    if (!selectionOverlay.isConnected && document.documentElement) {
      Object.assign(selectionOverlay.style, {
        position: "fixed",
        display: "none",
        pointerEvents: "none",
        zIndex: "2147483647",
        border: "2px solid #2563eb",
        background: "rgba(37, 99, 235, 0.08)",
        boxSizing: "border-box"
      });
      document.documentElement.appendChild(selectionOverlay);
    }
    if (!hoverOverlay.isConnected && document.documentElement) {
      Object.assign(hoverOverlay.style, {
        position: "fixed",
        display: "none",
        pointerEvents: "none",
        zIndex: "2147483646",
        border: "1px solid rgba(37, 99, 235, 0.38)",
        background: "rgba(37, 99, 235, 0.025)",
        boxSizing: "border-box"
      });
      document.documentElement.appendChild(hoverOverlay);
    }
  }

  function moveOverlay(overlay, element) {
    if (!element || !element.isConnected) {
      overlay.style.display = "none";
      return;
    }
    ensureOverlays();
    var rect = element.getBoundingClientRect();
    Object.assign(overlay.style, {
      display: "block",
      left: rect.left + "px",
      top: rect.top + "px",
      width: rect.width + "px",
      height: rect.height + "px"
    });
  }

  function hideOverlay(overlay) { overlay.style.display = "none"; }
  function restoreOutline(kind) {
    var element = kind === "selected" ? selectedOutlineElement : hoverOutlineElement;
    var previous = kind === "selected" ? selectedOutline : hoverOutline;
    if (element) element.style.outline = previous;
    if (kind === "selected") {
      selectedOutlineElement = null;
      selectedOutline = "";
    } else {
      hoverOutlineElement = null;
      hoverOutline = "";
    }
  }
  function setOutline(kind, element, value) {
    restoreOutline(kind);
    if (!element) return;
    if (kind === "selected") {
      selectedOutlineElement = element;
      selectedOutline = element.style.outline;
    } else {
      hoverOutlineElement = element;
      hoverOutline = element.style.outline;
    }
    element.style.outline = value;
  }
  function refreshOverlays() {
    if (selectedElement) moveOverlay(selectionOverlay, selectedElement);
    if (highlightedElement && highlightedElement !== selectedElement) moveOverlay(hoverOverlay, highlightedElement);
  }

  function recordChange(property, from, to) {
    if (from === to) return;
    var id = selectedElement ? ensureSelectionId(selectedElement) : null;
    var existing = previewChanges.find(function (change) { return change.selectionId === id; });
    if (!existing) {
      existing = { selectionId: id, tagName: selectedElement ? selectedElement.tagName.toLowerCase() : "div", source: null, text: selectedElement ? textFor(selectedElement) : "", changes: [] };
      previewChanges.push(existing);
    }
    var change = existing.changes.find(function (item) { return item.kind === "style" && item.property === property; });
    if (change) change.to = to;
    else existing.changes.push({ kind: "style", property: property, from: from, to: to });
    post("formia:preview-state", [{ changes: previewChanges }]);
  }

  function kebab(property) { return property.replace(/[A-Z]/g, function (letter) { return "-" + letter.toLowerCase(); }); }

  function applyStyle(property, value) {
    if (!selectedElement || !property || property === "x" || property === "y") return;
    var cssProperty = kebab(property);
    var before = selectedElement.style.getPropertyValue(cssProperty) || getComputedStyle(selectedElement)[property] || "";
    selectedElement.style.setProperty(cssProperty, value == null ? "" : String(value));
    recordChange(property, before, String(value));
    sendSelection(selectedElement, "formia:element-updated");
  }

  function resetStyle(property) {
    if (!selectedElement) return;
    var cssProperty = kebab(property);
    var before = selectedElement.style.getPropertyValue(cssProperty) || "";
    selectedElement.style.removeProperty(cssProperty);
    recordChange(property, before, "");
    sendSelection(selectedElement, "formia:element-updated");
  }

  function clearHighlight() {
    restoreOutline("hover");
    hideOverlay(hoverOverlay);
    highlightedElement = null;
    previousHighlight = "";
  }

  function highlight(selectionId) {
    clearHighlight();
    var element = document.querySelector('[data-formia-selection-id="' + CSS.escape(selectionId) + '"]');
    if (!element) return;
    highlightedElement = element;
    if (element === selectedElement) {
      restoreOutline("hover");
      hideOverlay(hoverOverlay);
      moveOverlay(selectionOverlay, element);
    } else {
      setOutline("hover", element, "1px solid rgba(37, 99, 235, 0.38)");
      moveOverlay(hoverOverlay, element);
    }
  }

  function duplicateSelected() {
    if (!selectedElement || !selectedElement.parentElement) return;
    var clone = selectedElement.cloneNode(true);
    clone.removeAttribute("data-formia-selection-id");
    selectedElement.parentElement.insertBefore(clone, selectedElement.nextSibling);
    ensureSelectionId(clone);
    sendLayerTree();
    sendSelection(clone);
  }

  function deleteSelected() {
    if (!selectedElement || !selectedElement.parentElement) return;
    var next = selectedElement.previousElementSibling || selectedElement.nextElementSibling;
    restoreOutline("selected");
    selectedElement.remove();
    selectedElement = null;
    hideOverlay(selectionOverlay);
    sendLayerTree();
    if (next && isInspectable(next)) sendSelection(next); else post("formia:selection-cleared", []);
  }

  function moveSelected(direction) {
    if (!selectedElement || !selectedElement.parentElement) return;
    var sibling = direction === "up" ? selectedElement.previousElementSibling : selectedElement.nextElementSibling;
    if (!sibling) return;
    if (direction === "up") selectedElement.parentElement.insertBefore(selectedElement, sibling);
    else selectedElement.parentElement.insertBefore(sibling, selectedElement);
    sendLayerTree();
  }

  function onMessage(event) {
    var message = event.data;
    if (!message || message.source !== "formia-parent") return;
    var channel = message.channel;
    var args = message.args || [];
    if (channel === "formia:set-tool") {
      activeTool = String(args[0] || "interact");
      setCanvasCursor(args[1]);
      if (activeTool !== "text") finishTextEditing();
      if (activeTool !== "select") clearHighlight();
      if (activeTool === "text" && selectedElement) beginTextEditing(selectedElement);
    } else if (channel === "formia:get-layer-tree") sendLayerTree();
    else if (channel === "formia:get-preview-state") post("formia:preview-state", [{ changes: previewChanges }]);
    else if (channel === "formia:select-layer") {
      var element = document.querySelector('[data-formia-selection-id="' + CSS.escape(args[0]) + '"]');
      if (element) {
        sendSelection(element);
        if (activeTool === "text") beginTextEditing(element);
      }
    } else if (channel === "formia:highlight-layer") highlight(args[0]);
    else if (channel === "formia:clear-layer-highlight") clearHighlight();
    else if (channel === "formia:apply-style") applyStyle(args[0] && args[0].property, args[0] && args[0].value);
    else if (channel === "formia:reset-style") resetStyle(args[0]);
    else if (channel === "formia:apply-text" && selectedElement && isTextEditable(selectedElement)) {
      finishTextEditing();
      var before = selectedElement.innerHTML;
      selectedElement.textContent = String(args[0] || "");
      recordTextChange(before, selectedElement.innerHTML);
      sendSelection(selectedElement, "formia:element-updated");
    } else if (channel === "formia:reset-overrides") {
      previewChanges = [];
      document.querySelectorAll("[data-formia-selection-id]").forEach(function (element) { element.removeAttribute("style"); });
      post("formia:preview-state", [{ changes: [] }]);
      if (selectedElement) sendSelection(selectedElement, "formia:element-updated");
    } else if (channel === "formia:duplicate-selected-layer") duplicateSelected();
    else if (channel === "formia:delete-selected-layer") deleteSelected();
    else if (channel === "formia:move-selected-layer") moveSelected(args[0]);
    else if (channel === "formia:clear-selection") {
      finishTextEditing();
      selectedElement = null;
      restoreOutline("selected");
      restoreOutline("hover");
      hideOverlay(selectionOverlay);
      hideOverlay(hoverOverlay);
      post("formia:selection-cleared", []);
    }
  }

  document.addEventListener("keydown", function (event) {
    if (event.key !== "Escape" || !textEditingState) return;
    finishTextEditing();
    event.preventDefault();
    event.stopPropagation();
  }, true);

  document.addEventListener("pointerdown", function (event) {
    if (activeTool !== "select") return;
    event.preventDefault();
    event.stopPropagation();
    var target = event.target instanceof Element ? event.target.closest("[data-formia-selection-id]") : null;
    if (target && isInspectable(target)) sendSelection(target);
  }, true);
  document.addEventListener("click", function (event) {
    if (activeTool !== "select" && activeTool !== "text") return;
    event.preventDefault();
    event.stopPropagation();
    var target = event.target instanceof Element ? event.target.closest("[data-formia-selection-id]") : null;
    if (!target || !isInspectable(target)) return;
    if (activeTool === "text") {
      if (!isTextEditable(target)) return;
      sendSelection(target);
      beginTextEditing(target);
      return;
    }
    sendSelection(target);
  }, true);
  document.addEventListener("pointerover", function (event) {
    if (activeTool !== "select" && activeTool !== "text") return;
    var target = event.target instanceof Element ? event.target.closest("[data-formia-selection-id]") : null;
    if (activeTool === "text" && (!target || !isTextEditable(target))) {
      clearHighlight();
      return;
    }
    if (target && isInspectable(target)) {
      highlightedElement = target;
      if (target === selectedElement) {
        restoreOutline("hover");
        hideOverlay(hoverOverlay);
      } else {
        setOutline("hover", target, "1px solid rgba(37, 99, 235, 0.38)");
        moveOverlay(hoverOverlay, target);
      }
      post("formia:element-highlighted", [ensureSelectionId(target)]);
    }
  }, true);
  window.addEventListener("resize", refreshOverlays);
  window.addEventListener("scroll", refreshOverlays, true);
  window.addEventListener("message", onMessage);
  var observer = new MutationObserver(function () {
    inspectableElements().forEach(ensureSelectionId);
    window.requestAnimationFrame(refreshOverlays);
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
  inspectableElements().forEach(ensureSelectionId);
  post("formia:online-ready");
  window.setTimeout(sendLayerTree, 250);
})();
