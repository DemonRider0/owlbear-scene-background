import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const deploymentUrl = process.argv[2];
if (!deploymentUrl) {
  throw new Error("Informe a URL publicada no GitHub Pages como primeiro argumento.");
}

const siteUrl = new URL(deploymentUrl);
if (siteUrl.protocol !== "https:") {
  throw new Error("O site publicado deve usar HTTPS.");
}
if (!siteUrl.pathname.endsWith("/")) {
  siteUrl.pathname += "/";
}
if (siteUrl.pathname !== "/owlbear-scene-background/") {
  throw new Error(
    `Path inesperado do GitHub Project Pages: ${siteUrl.pathname}`,
  );
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

async function fetchOk(url, label) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`${label} retornou HTTP ${response.status}: ${url}`);
  }
  return response;
}

await fetchOk(siteUrl, "Raiz do site");

const files = await listFiles(path.resolve("dist"));
for (const relativePath of files) {
  await fetchOk(new URL(relativePath, siteUrl), relativePath);
}

const manifestResponse = await fetchOk(
  new URL("manifest.json", siteUrl),
  "manifest.json",
);
const manifest = JSON.parse(await manifestResponse.text());
const manifestUrl = new URL("manifest.json", siteUrl);
const references = {
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

for (const [label, reference] of Object.entries(references)) {
  const { value, expectedPath } = reference;
  if (typeof value !== "string" || value.startsWith("./")) {
    throw new Error(`${label} usa um path de produção inválido: ${String(value)}`);
  }
  if (value !== expectedPath) {
    throw new Error(`${label} deve ser ${expectedPath}; recebido: ${value}`);
  }
  const resolvedUrl = new URL(value, manifestUrl);
  const expectedUrl = new URL(expectedPath, siteUrl.origin);
  if (
    resolvedUrl.href !== expectedUrl.href ||
    !resolvedUrl.pathname.startsWith(siteUrl.pathname)
  ) {
    throw new Error(
      `${label} resolve para ${resolvedUrl.href}; esperado: ${expectedUrl.href}`,
    );
  }
  await fetchOk(resolvedUrl, label);
}

for (const relativePath of files) {
  const localContent = await readFile(path.join("dist", relativePath), "utf8");
  if (/localhost|127\.0\.0\.1|[A-Z]:\\/i.test(localContent)) {
    throw new Error(`${relativePath} contém uma referência exclusivamente local.`);
  }
}

console.info(`Publicação validada: ${siteUrl}`);
