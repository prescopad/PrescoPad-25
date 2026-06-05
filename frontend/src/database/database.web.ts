import { seedMedicines, seedLabTests } from './seed';

type Row = Record<string, unknown>;

type CountResult = { c: number };

class WebDatabase {
  private version = 0;

  private medicines: Row[] = [];

  private labTests: Row[] = [];

  async execAsync(sql: string): Promise<void> {
    if (sql.includes('PRAGMA user_version = 1')) {
      this.version = 1;
    }
  }

  async getFirstAsync<T>(query: string): Promise<T | undefined> {
    if (query.includes('PRAGMA user_version')) {
      return { user_version: this.version } as T;
    }

    if (query.includes('COUNT(*) as c FROM medicines')) {
      return { c: this.medicines.length } as T;
    }

    if (query.includes('COUNT(*) as c FROM lab_tests')) {
      return { c: this.labTests.length } as T;
    }

    return undefined;
  }

  async getAllAsync<T>(query: string, params: unknown[] = []): Promise<T[]> {
    if (query.includes('FROM medicines')) {
      return this.queryMedicines(query, params) as T[];
    }

    if (query.includes('FROM lab_tests')) {
      return this.queryLabTests(query, params) as T[];
    }

    return [];
  }

  async runAsync(query: string, params: unknown[] = []): Promise<void> {
    if (query.includes('INSERT INTO medicines')) {
      const [id, name, type, strength, manufacturer] = params as string[];
      this.medicines.push({
        id,
        name,
        type,
        strength,
        manufacturer,
        is_custom: 0,
        usage_count: 0,
      });
      return;
    }

    if (query.includes('INSERT INTO lab_tests')) {
      const [id, name, category] = params as string[];
      this.labTests.push({
        id,
        name,
        category,
        is_custom: 0,
        usage_count: 0,
      });
      return;
    }

    if (query.includes('UPDATE medicines SET usage_count = usage_count + 1 WHERE name = ?')) {
      const [name] = params as [string];
      const row = this.medicines.find((entry) => entry.name === name);
      if (row) {
        row.usage_count = Number(row.usage_count ?? 0) + 1;
      }
      return;
    }

    if (query.includes('UPDATE lab_tests SET usage_count = usage_count + 1 WHERE name = ?')) {
      const [name] = params as [string];
      const row = this.labTests.find((entry) => entry.name === name);
      if (row) {
        row.usage_count = Number(row.usage_count ?? 0) + 1;
      }
    }
  }

  async closeAsync(): Promise<void> {
    return;
  }

  private queryMedicines(query: string, params: unknown[]): Row[] {
    const search = typeof params[0] === 'string' ? String(params[0]).replace(/%/g, '').toLowerCase() : '';
    const limit = typeof params[0] === 'number' ? Number(params[0]) : 30;
    let rows = [...this.medicines];

    if (query.includes('WHERE name LIKE ?')) {
      rows = rows.filter((row) => String(row.name ?? '').toLowerCase().includes(search));
    }

    rows.sort((left, right) => {
      const usageDelta = Number(right.usage_count ?? 0) - Number(left.usage_count ?? 0);
      if (usageDelta !== 0) return usageDelta;
      return String(left.name ?? '').localeCompare(String(right.name ?? ''));
    });

    return rows.slice(0, limit);
  }

  private queryLabTests(query: string, params: unknown[]): Row[] {
    let rows = [...this.labTests];

    if (query.includes('WHERE category = ?')) {
      const category = String(params[0] ?? '').toLowerCase();
      rows = rows.filter((row) => String(row.category ?? '').toLowerCase() === category);
    } else if (query.includes('WHERE name LIKE ? OR category LIKE ?')) {
      const search = String(params[0] ?? '').replace(/%/g, '').toLowerCase();
      rows = rows.filter(
        (row) =>
          String(row.name ?? '').toLowerCase().includes(search) ||
          String(row.category ?? '').toLowerCase().includes(search)
      );
    }

    rows.sort((left, right) => {
      const usageDelta = Number(right.usage_count ?? 0) - Number(left.usage_count ?? 0);
      if (usageDelta !== 0) return usageDelta;
      return String(left.name ?? '').localeCompare(String(right.name ?? ''));
    });

    const limit = typeof params[0] === 'number' ? Number(params[0]) : 30;
    return rows.slice(0, limit);
  }
}

const webDatabase = new WebDatabase();

export async function getDatabase(): Promise<WebDatabase> {
  if ((await webDatabase.getFirstAsync<CountResult>('SELECT COUNT(*) as c FROM medicines'))?.c === 0) {
    await seedMedicines(webDatabase);
  }

  if ((await webDatabase.getFirstAsync<CountResult>('SELECT COUNT(*) as c FROM lab_tests'))?.c === 0) {
    await seedLabTests(webDatabase);
  }

  await webDatabase.execAsync('PRAGMA user_version = 1');
  return webDatabase;
}

export async function closeDatabase(): Promise<void> {
  await webDatabase.closeAsync();
}