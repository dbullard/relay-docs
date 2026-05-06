import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const dataPath = path.join(repoRoot, "data", "changelog.json");
const changelogPath = path.join(repoRoot, "changelog.mdx");
const releaseNotesDir = path.join(repoRoot, "public", "sparkle", "release-notes");

const sectionOrder = ["New", "Improved", "Fixed", "Known Issues", "Notes"];

const data = JSON.parse(await readFile(dataPath, "utf8"));

function versionAnchor(version) {
  return `version-${version.replace(/\./g, "")}`;
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function mdxText(value) {
  return value;
}

function orderedSections(sections) {
  const known = sectionOrder.filter((section) => sections[section]);
  const unknown = Object.keys(sections).filter((section) => !sectionOrder.includes(section));
  return [...known, ...unknown];
}

function renderMdxItem(item) {
  if (typeof item === "string") {
    return `- ${mdxText(item)}`;
  }

  const childItems = item.items.map((child) => `  - ${mdxText(child)}`).join("\n");
  return `- **${mdxText(item.title)}**\n${childItems}`;
}

function renderMdxRelease(release) {
  const lines = [`## Version ${release.version} <a id="${versionAnchor(release.version)}"></a>`];

  for (const section of orderedSections(release.sections)) {
    lines.push("", `### ${section}`, "");
    lines.push(release.sections[section].map(renderMdxItem).join("\n"));
  }

  return lines.join("\n");
}

function inlineMarkdownToHtml(value) {
  const escaped = escapeHtml(value);
  return escaped.replace(/`([^`]+)`/g, "<code>$1</code>");
}

function renderHtmlListItem(item) {
  if (typeof item === "string") {
    return `<li>${inlineMarkdownToHtml(item)}</li>`;
  }

  const childItems = item.items.map((child) => `<li>${inlineMarkdownToHtml(child)}</li>`).join("");
  return `<li><strong>${escapeHtml(item.title)}</strong><ul>${childItems}</ul></li>`;
}

function renderHtmlRelease(release) {
  const fullChangelogUrl = `${data.baseUrl}/changelog#${versionAnchor(release.version)}`;
  const sections = orderedSections(release.sections)
    .map((section) => {
      const items = release.sections[section].map(renderHtmlListItem).join("");
      return `<section><h2>${escapeHtml(section)}</h2><ul>${items}</ul></section>`;
    })
    .join("\n");

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Relay ${escapeHtml(release.version)} Release Notes</title>
  <style>
    :root { color-scheme: light dark; }
    body { margin: 0; padding: 16px; font: -apple-system-body; line-height: 1.45; }
    h1 { margin: 0 0 12px; font: -apple-system-headline; }
    h2 { margin: 18px 0 8px; font: -apple-system-subheadline; }
    ul { margin: 0 0 0 1.25em; padding: 0; }
    li { margin: 6px 0; }
    code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 0.92em; }
    a { color: -apple-system-link; }
    .footer { margin-top: 20px; }
  </style>
</head>
<body>
  <h1>Relay ${escapeHtml(release.version)}</h1>
  ${sections}
  <p class="footer"><a href="${escapeHtml(fullChangelogUrl)}">View the full Relay changelog</a></p>
</body>
</html>
`;
}

function renderChangelog() {
  const releases = data.releases.map(renderMdxRelease).join("\n\n");

  return `---
title: "Relay changelog"
description: "User-facing release notes for Relay."
sidebarTitle: "Changelog"
---

Relay release notes are organized by version. Sparkle update feeds can link to each version directly using the per-version anchors on this page.

${releases}
`;
}

await mkdir(releaseNotesDir, { recursive: true });
await writeFile(changelogPath, renderChangelog(), "utf8");

for (const release of data.releases) {
  const htmlPath = path.join(releaseNotesDir, `${release.version}.html`);
  await writeFile(htmlPath, renderHtmlRelease(release), "utf8");
}

console.log(`Generated ${path.relative(repoRoot, changelogPath)}`);
console.log(`Generated ${data.releases.length} Sparkle release note files in ${path.relative(repoRoot, releaseNotesDir)}`);
