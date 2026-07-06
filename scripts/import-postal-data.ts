import { createWriteStream, existsSync, mkdirSync, readFileSync, renameSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { pipeline } from "node:stream/promises";
import { DatabaseSync } from "node:sqlite";
import { execFileSync } from "node:child_process";

const SOURCE_URL =
  process.env.POSTAL_DATA_URL ??
  "https://www.post.japanpost.jp/service/search/zipcode/download/utf/zip/utf_ken_all.zip";
const target = resolve(process.env.DATABASE_PATH ?? "./data/jp-qac.sqlite");
const tempDir = resolve("./data/.postal-import");
const zipPath = join(tempDir, "postal.zip");
const nextPath = `${target}.next`;

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let value = "";
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i]!;
    if (char === '"') {
      if (quoted && line[i + 1] === '"') {
        value += '"';
        i += 1;
      } else quoted = !quoted;
    } else if (char === "," && !quoted) {
      result.push(value);
      value = "";
    } else value += char;
  }
  result.push(value);
  return result;
}

mkdirSync(tempDir, { recursive: true });
mkdirSync(dirname(target), { recursive: true });
rmSync(zipPath, { force: true });
rmSync(nextPath, { force: true });

console.log(`Downloading ${SOURCE_URL}`);
const response = await fetch(SOURCE_URL);
if (!response.ok || !response.body) throw new Error(`Download failed: HTTP ${response.status}`);
await pipeline(response.body, createWriteStream(zipPath));
execFileSync("unzip", ["-o", zipPath, "-d", tempDir], { stdio: "inherit" });

const csvName = execFileSync("unzip", ["-Z1", zipPath], { encoding: "utf8" }).trim().split("\n")[0];
if (!csvName) throw new Error("CSV was not found in archive");
const lines = readFileSync(join(tempDir, csvName), "utf8").replace(/^\uFEFF/, "").split(/\r?\n/);

const db = new DatabaseSync(nextPath);
db.exec(`
  PRAGMA journal_mode = DELETE;
  CREATE TABLE postal_codes (
    postal_code TEXT NOT NULL,
    prefecture TEXT NOT NULL,
    city TEXT NOT NULL,
    town TEXT NOT NULL,
    prefecture_kana TEXT NOT NULL,
    city_kana TEXT NOT NULL,
    town_kana TEXT NOT NULL,
    PRIMARY KEY (postal_code, prefecture, city, town)
  ) STRICT;
  CREATE INDEX postal_codes_postal_code_idx ON postal_codes(postal_code);
  CREATE TABLE metadata (key TEXT PRIMARY KEY, value TEXT NOT NULL) STRICT;
`);
const insert = db.prepare(`
  INSERT OR REPLACE INTO postal_codes
  (postal_code, prefecture, city, town, prefecture_kana, city_kana, town_kana)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);
db.exec("BEGIN");
let count = 0;
try {
  for (const line of lines) {
    if (!line) continue;
    const columns = parseCsvLine(line);
    // Japan Post UTF-8 single-record format: municipality code, old zip,
    // zip, prefecture kana, city kana, town kana, prefecture, city, town, ...
    if (columns.length < 9) throw new Error(`Unexpected CSV format at row ${count + 1}`);
    insert.run(columns[2]!, columns[6]!, columns[7]!, columns[8]!, columns[3]!, columns[4]!, columns[5]!);
    count += 1;
  }
  db.prepare("INSERT INTO metadata VALUES (?, ?)").run("source_url", SOURCE_URL);
  db.prepare("INSERT INTO metadata VALUES (?, ?)").run("imported_at", new Date().toISOString());
  db.prepare("INSERT INTO metadata VALUES (?, ?)").run("record_count", String(count));
  db.exec("COMMIT");
} catch (error) {
  db.exec("ROLLBACK");
  throw error;
} finally {
  db.close();
}

if (existsSync(target)) rmSync(target);
renameSync(nextPath, target);
rmSync(tempDir, { recursive: true, force: true });
console.log(`Imported ${count.toLocaleString()} records into ${target}`);
