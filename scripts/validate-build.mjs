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

function resolveHtmlFile(value, sourceUrl, label) {
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

function resolveManifestFile(value, label, expectedPath) {
  assert(typeof value === "string", `${label} must be a string.`);
  assert(
    !value.startsWith("./"),
    `${label} must not use a ./ path in the production manifest.`,
  );
  assert(
    value === expectedPath,
    `${label} must be ${expectedPath}, received ${value}.`,
  );

  const resolvedUrl = new URL(value, manifestUrl);
  const expectedUrl = new URL(expectedPath, projectPageUrl.origin);
  assert(
    resolvedUrl.href === expectedUrl.href,
    `${label} resolves to ${resolvedUrl.href}, expected ${expectedUrl.href}.`,
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
    const assetPath = resolveHtmlFile(
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
  icon: {
    value: manifest.icon,
    expectedPath: "/owlbear-scene-background/icon.svg",
  },
  background_url: {
    value: manifest.background_url,
    expectedPath: "/owlbear-scene-background/background.html",
  },
  "action.icon": {
    value: manifest.action?.icon,
    expectedPath: "/owlbear-scene-background/icon.svg",
  },
  "action.popover": {
    value: manifest.action?.popover,
    expectedPath: "/owlbear-scene-background/index.html",
  },
};

for (const [label, reference] of Object.entries(manifestReferences)) {
  await assertFileExists(
    resolveManifestFile(reference.value, label, reference.expectedPath),
  );
}

await validateHtml("index.html");
await validateHtml("background.html");

for (const relativePath of await listFiles(distDirectory)) {
  const content = await readFile(path.join(distDirectory, relativePath), "utf8");
  assert(!/localhost|127\.0\.0\.1/i.test(content), `${relativePath} contains a local URL.`);
  assert(!/[A-Z]:\\/i.test(content), `${relativePath} contains a Windows path.`);
}

console.info(
  "Manifest and build paths resolve explicitly under /owlbear-scene-background/.",
);
