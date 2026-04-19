import { getDatabase } from '../database';
import { Medicine, LabTest } from '../../types/medicine.types';

// ─── Seeded Medicines (local SQLite read-only) ─────────────────────────────

export async function searchMedicines(query: string): Promise<Medicine[]> {
  const db = await getDatabase();
  const search = `%${query}%`;
  const rows = await db.getAllAsync<Record<string, unknown>>(
    `SELECT * FROM medicines WHERE name LIKE ? ORDER BY usage_count DESC, name ASC LIMIT 30`,
    [search]
  );
  return rows.map(mapMedicineRow);
}

export async function getFrequentMedicines(limit = 20): Promise<Medicine[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<Record<string, unknown>>(
    'SELECT * FROM medicines ORDER BY usage_count DESC LIMIT ?',
    [limit]
  );
  return rows.map(mapMedicineRow);
}

export async function incrementMedicineUsage(name: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    'UPDATE medicines SET usage_count = usage_count + 1 WHERE name = ?',
    [name]
  );
}

// ─── Seeded Lab Tests (local SQLite read-only) ─────────────────────────────

export async function searchLabTests(query: string): Promise<LabTest[]> {
  const db = await getDatabase();
  const search = `%${query}%`;
  const rows = await db.getAllAsync<Record<string, unknown>>(
    `SELECT * FROM lab_tests WHERE name LIKE ? OR category LIKE ? ORDER BY usage_count DESC, name ASC LIMIT 30`,
    [search, search]
  );
  return rows.map(mapLabTestRow);
}

export async function getLabTestsByCategory(category: string): Promise<LabTest[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<Record<string, unknown>>(
    'SELECT * FROM lab_tests WHERE category = ? ORDER BY usage_count DESC, name ASC',
    [category]
  );
  return rows.map(mapLabTestRow);
}

export async function getFrequentLabTests(limit = 20): Promise<LabTest[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<Record<string, unknown>>(
    'SELECT * FROM lab_tests ORDER BY usage_count DESC LIMIT ?',
    [limit]
  );
  return rows.map(mapLabTestRow);
}

export async function incrementLabTestUsage(name: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    'UPDATE lab_tests SET usage_count = usage_count + 1 WHERE name = ?',
    [name]
  );
}

// ─── Row Mappers ────────────────────────────────────────────────────────────

function mapMedicineRow(row: Record<string, unknown>): Medicine {
  return {
    id: row.id as string,
    name: row.name as string,
    type: row.type as Medicine['type'],
    strength: (row.strength ?? '') as string,
    manufacturer: (row.manufacturer ?? '') as string,
    isCustom: Boolean(row.is_custom),
    usageCount: (row.usage_count ?? 0) as number,
  };
}

function mapLabTestRow(row: Record<string, unknown>): LabTest {
  return {
    id: row.id as string,
    name: row.name as string,
    category: (row.category ?? '') as string,
    isCustom: Boolean(row.is_custom),
    usageCount: (row.usage_count ?? 0) as number,
  };
}
