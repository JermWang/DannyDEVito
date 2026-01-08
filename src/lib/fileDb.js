import fs from "node:fs/promises";
import path from "node:path";

function getDataDir() {
  return path.join(process.cwd(), "data");
}

function getFilePath(filename) {
  return path.join(getDataDir(), filename);
}

async function ensureDataDir() {
  await fs.mkdir(getDataDir(), { recursive: true });
}

export async function readJsonFile(filename, fallbackValue) {
  await ensureDataDir();
  const filePath = getFilePath(filename);

  try {
    const raw = await fs.readFile(filePath, "utf8");
    return JSON.parse(raw);
  } catch (err) {
    if (err?.code === "ENOENT") {
      return fallbackValue;
    }
    throw err;
  }
}

export async function writeJsonFile(filename, value) {
  await ensureDataDir();
  const filePath = getFilePath(filename);
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

export async function appendJsonArrayItem(filename, item) {
  const current = await readJsonFile(filename, []);
  const next = Array.isArray(current) ? current.concat([item]) : [item];
  await writeJsonFile(filename, next);
  return item;
}
