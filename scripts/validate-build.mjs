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
  assert((await stat(filePath)).isFile(), `Arquivo ausente no build: ${relativePath}`);
}

function resolveHtmlFile(value, sourceUrl, label) {
  assert(typeof value === "string", `${label} deve ser um texto.`);
  assert(value.startsWith("./"), `${label} deve usar uma URL relativa com ./`);

  const resolvedUrl = new URL(value, sourceUrl);
  assert(
    resolvedUrl.origin === projectPageUrl.origin &&
      resolvedUrl.pathname.startsWith(projectPageUrl.pathname),
    `${label} escapa do subpath do GitHub Project Pages.`,
  );

  return decodeURIComponent(
    resolvedUrl.pathname.slice(projectPageUrl.pathname.length),
  );
}

function resolveManifestFile(value, label, expectedPath) {
  assert(typeof value === "string", `${label} deve ser um texto.`);
  assert(
    !value.startsWith("./"),
    `${label} não pode usar um path ./ no manifest de produção.`,
  );
  assert(
    value === expectedPath,
    `${label} deve ser ${expectedPath}; recebido: ${value}.`,
  );

  const resolvedUrl = new URL(value, manifestUrl);
  const expectedUrl = new URL(expectedPath, projectPageUrl.origin);
  assert(
    resolvedUrl.href === expectedUrl.href,
    `${label} resolve para ${resolvedUrl.href}; esperado: ${expectedUrl.href}.`,
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
    assert(value, `URL de asset vazia em ${relativePath}.`);
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
  assert(!/localhost|127\.0\.0\.1/i.test(content), `${relativePath} contém uma URL local.`);
  assert(!/[A-Z]:\\/i.test(content), `${relativePath} contém um path do Windows.`);
}

console.info(
  "O manifest e o build resolvem explicitamente sob /owlbear-scene-background/.",
);
