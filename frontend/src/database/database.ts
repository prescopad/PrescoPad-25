import * as SQLite from 'expo-sqlite';
import { seedMedicines, seedLabTests } from './seed';

const DB_NAME = 'prescopad.db';

let db: SQLite.SQLiteDatabase | null = null;

export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (db) return db;
  db = await SQLite.openDatabaseAsync(DB_NAME);
  await db.execAsync('PRAGMA journal_mode = WAL');
  await initializeDatabase(db);
  return db;
}

async function initializeDatabase(database: SQLite.SQLiteDatabase): Promise<void> {
  const versionResult = await database.getFirstAsync<{ user_version: number }>(
    'PRAGMA user_version'
  );
  const currentVersion = versionResult?.user_version ?? 0;

  if (currentVersion < 1) {
    // Create reference data tables
    await database.execAsync(`
      CREATE TABLE IF NOT EXISTS medicines (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        type TEXT NOT NULL DEFAULT 'Tablet',
        strength TEXT DEFAULT '',
        manufacturer TEXT DEFAULT '',
        is_custom INTEGER NOT NULL DEFAULT 0,
        usage_count INTEGER NOT NULL DEFAULT 0
      )
    `);

    await database.execAsync(`
      CREATE TABLE IF NOT EXISTS lab_tests (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        category TEXT NOT NULL DEFAULT 'Other',
        is_custom INTEGER NOT NULL DEFAULT 0,
        usage_count INTEGER NOT NULL DEFAULT 0
      )
    `);

    await database.execAsync(
      'CREATE INDEX IF NOT EXISTS idx_medicines_name ON medicines(name)'
    );
    await database.execAsync(
      'CREATE INDEX IF NOT EXISTS idx_medicines_usage ON medicines(usage_count DESC)'
    );
    await database.execAsync(
      'CREATE INDEX IF NOT EXISTS idx_lab_tests_name ON lab_tests(name)'
    );

    await seedMedicines(database);
    await seedLabTests(database);

    await database.execAsync('PRAGMA user_version = 1');
  }
}

export async function closeDatabase(): Promise<void> {
  if (db) {
    await db.closeAsync();
    db = null;
  }
}
