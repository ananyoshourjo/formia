const maximumBuildPayloadBytes = 2 * 1024 * 1024;
const maximumPreviewChanges = 100;

function requiredString(value, field, maximumLength = 4096) {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${field} is required.`);
  if (value.length > maximumLength) throw new Error(`${field} is too long.`);
  return value.trim();
}

function optionalString(value, field, maximumLength = 4096) {
  if (value == null) return null;
  if (typeof value !== "string") throw new Error(`${field} must be text.`);
  if (value.length > maximumLength) throw new Error(`${field} is too long.`);
  return value;
}

function normalizeProjectPathInput(value) {
  return requiredString(value, "Project path");
}

function normalizeCodexBuildRequest(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Build request is invalid.");

  const previewChanges = value.previewChanges;
  if (!Array.isArray(previewChanges) || previewChanges.length === 0) throw new Error("Build requires at least one visual change.");
  if (previewChanges.length > maximumPreviewChanges) throw new Error("This Build contains too many visual changes. Reset the design and make a smaller change.");

  const normalized = {
    projectPath: normalizeProjectPathInput(value.projectPath),
    projectName: requiredString(value.projectName || "Untitled project", "Project name", 240),
    canvasUrl: optionalString(value.canvasUrl, "Canvas URL"),
    selection: value.selection && typeof value.selection === "object" && !Array.isArray(value.selection) ? value.selection : null,
    previewChanges,
  };

  if (Buffer.byteLength(JSON.stringify(normalized), "utf8") > maximumBuildPayloadBytes) {
    throw new Error("This Build request is too large. Reset the design and make a smaller change.");
  }

  return normalized;
}

module.exports = {
  normalizeCodexBuildRequest,
  normalizeProjectPathInput,
};
