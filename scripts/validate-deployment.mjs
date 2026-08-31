import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const deploymentUrl = process.argv[2];
if (!deploymentUrl) {
  throw new Error("Pass the deployed GitHub Pages URL as the first argument.");
}

const siteUrl = new URL(deploymentUrl);
if (siteUrl.protocol !== "https:") {
  throw new Error("The deployed site must use HTTPS.");
}
if (!siteUrl.pathname.endsWith("/")) {
  siteUrl.pathname += "/";
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
    throw new Error(`${label} returned HTTP ${response.status}: ${url}`);
  }
  return response;
}

await fetchOk(siteUrl, "Site root");

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
const references = [
  manifest.icon,
  manifest.background_url,
  manifest.action?.icon,
  manifest.action?.popover,
];

for (const value of references) {
  if (typeof value !== "string" || !value.startsWith("./")) {
    throw new Error(`Invalid relative manifest URL: ${String(value)}`);
  }
  const resolvedUrl = new URL(value, manifestUrl);
  if (
    resolvedUrl.origin !== siteUrl.origin ||
    !resolvedUrl.pathname.startsWith(siteUrl.pathname)
  ) {
    throw new Error(`Manifest URL escapes the project subpath: ${value}`);
  }
}

for (const relativePath of files) {
  const localContent = await readFile(path.join("dist", relativePath), "utf8");
  if (/localhost|127\.0\.0\.1|[A-Z]:\\/i.test(localContent)) {
    throw new Error(`${relativePath} contains a local-only reference.`);
  }
}

console.info(`Deployment validated: ${siteUrl}`);
