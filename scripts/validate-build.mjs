import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";

const distDirectory = path.resolve("dist");
const projectPageUrl = new URL(
  "https://example.github.io/owlbear-scene-background/",
);
const manifestUrl = new URL("manifest.json", projectPageUrl);

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function assertFileExists(relativePath) {
  const filePath = path.join(distDirectory, relativePath);
  assert((await stat(filePath)).isFile(), `Missing build file: ${relativePath}`);
}

function resolveSiteFile(value, sourceUrl, label) {
  assert(typeof value === "string", `${label} must be a string.`);
  assert(value.startsWith("./"), `${label} must use a ./ relative URL.`);

  const resolvedUrl = new URL(value, sourceUrl);
  assert(
    resolvedUrl.origin === projectPageUrl.origin &&
      resolvedUrl.pathname.startsWith(projectPageUrl.pathname),
    `${label} escapes the GitHub Project Pages subpath.`,
  );

  return decodeURIComponent(
    resolvedUrl.pathname.slice(projectPageUrl.pathname.length),
  );
}

async function validateHtml(relativePath) {
  const html = await readFile(path.join(distDirectory, relativePath), "utf8");
  const htmlUrl = new URL(relativePath, projectPageUrl);
  const references = html.matchAll(/(?:src|href)=["']([^"']+)["']/g);

  for (const match of references) {
    const value = match[1];
    assert(value, `Empty asset URL in ${relativePath}.`);
    const assetPath = resolveSiteFile(
      value,
      htmlUrl,
      `${relativePath} asset ${value}`,
    );
    await assertFileExists(assetPath);
  }
}

async function listFiles(directory, prefix = "") {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const relativePath = path.posix.join(prefix, entry.name);
    if (entry.isDirectory()) {
      files.push(
        ...(await listFiles(path.join(directory, entry.name), relativePath)),
      );
    } else if (entry.isFile()) {
      files.push(relativePath);
    }
  }

  return files;
}

const manifest = JSON.parse(
  await readFile(path.join(distDirectory, "manifest.json"), "utf8"),
);
const manifestReferences = {
  icon: manifest.icon,
  background_url: manifest.background_url,
  "action.icon": manifest.action?.icon,
  "action.popover": manifest.action?.popover,
};

for (const [label, value] of Object.entries(manifestReferences)) {
  await assertFileExists(resolveSiteFile(value, manifestUrl, label));
}

await validateHtml("index.html");
await validateHtml("background.html");

for (const relativePath of await listFiles(distDirectory)) {
  const content = await readFile(path.join(distDirectory, relativePath), "utf8");
  assert(!/localhost|127\.0\.0\.1/i.test(content), `${relativePath} contains a local URL.`);
  assert(!/[A-Z]:\\/i.test(content), `${relativePath} contains a Windows path.`);
}

console.info(
  "Build paths are valid for /owlbear-scene-background/ and all referenced files exist.",
);
