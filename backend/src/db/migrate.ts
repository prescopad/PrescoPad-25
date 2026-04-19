import fs from 'fs';
import path from 'path';
import { pool } from '../config/database';
import { ENV } from '../config/env';

async function migrate(): Promise<void> {
  console.log('Running database migrations...');
  console.log(`Database: ${ENV.db.name}@${ENV.db.host}:${ENV.db.port}`);

  const client = await pool.connect();

  try {
    const migrationsDir = path.join(__dirname, 'migrations');
    const files = fs.readdirSync(migrationsDir).sort();

    for (const file of files) {
      if (!file.endsWith('.sql')) continue;
      console.log(`Executing migration: ${file}`);
      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');
      await client.query(sql);
      console.log(`Completed: ${file}`);
    }

    console.log('All migrations completed successfully');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
