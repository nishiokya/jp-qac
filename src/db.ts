import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";
import type { Address } from "./domain/types.js";

export class PostalRepository {
  readonly db: DatabaseSync;

  constructor(path: string) {
    mkdirSync(dirname(path), { recursive: true });
    this.db = new DatabaseSync(path);
    this.db.exec(`
      PRAGMA journal_mode = WAL;
      PRAGMA busy_timeout = 5000;
      CREATE TABLE IF NOT EXISTS postal_codes (
        postal_code TEXT NOT NULL,
        prefecture TEXT NOT NULL,
        city TEXT NOT NULL,
        town TEXT NOT NULL,
        prefecture_kana TEXT NOT NULL,
        city_kana TEXT NOT NULL,
        town_kana TEXT NOT NULL,
        PRIMARY KEY (postal_code, prefecture, city, town)
      ) STRICT;
      CREATE INDEX IF NOT EXISTS postal_codes_postal_code_idx
        ON postal_codes(postal_code);
      CREATE TABLE IF NOT EXISTS metadata (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      ) STRICT;
    `);
  }

  findByPostalCode(postalCode: string): Address[] {
    return this.db.prepare(`
      SELECT postal_code AS postalCode, prefecture, city, town,
             prefecture_kana AS prefectureKana, city_kana AS cityKana,
             town_kana AS townKana
      FROM postal_codes WHERE postal_code = ? ORDER BY prefecture, city, town
    `).all(postalCode) as unknown as Address[];
  }

  count(): number {
    const row = this.db.prepare("SELECT count(*) AS count FROM postal_codes").get() as { count: number };
    return row.count;
  }

  close(): void {
    this.db.close();
  }
}
