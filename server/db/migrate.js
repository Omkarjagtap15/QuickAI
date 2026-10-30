import 'dotenv/config';
import { neon } from '@neondatabase/serverless';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

if (!process.env.DATABASE_URL) {
  console.error('❌ Error: DATABASE_URL is not set.');
  process.exit(1);
}

const sql = neon(process.env.DATABASE_URL);

async function runMigrations() {
  console.log('🚀 Running database migrations...');

  // 1. Ensure migrations tracking table exists
  await sql`
    CREATE TABLE IF NOT EXISTS _migrations (
      id SERIAL PRIMARY KEY,
      name TEXT UNIQUE NOT NULL,
      applied_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )
  `;

  const appliedRows = await sql`SELECT name FROM _migrations`;
  const applied = new Set(appliedRows.map((r) => r.name));

  const migrationsDir = path.join(__dirname, 'migrations');
  const files = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  for (const file of files) {
    if (applied.has(file)) {
      console.log(`  ⏭  Skipped (already applied): ${file}`);
      continue;
    }

    console.log(`  ▶  Applying migration: ${file}...`);
    const filePath = path.join(migrationsDir, file);
    const sqlContent = fs.readFileSync(filePath, 'utf-8');

    try {
      // Execute raw migration string
      await sql(sqlContent);
      await sql`INSERT INTO _migrations (name) VALUES (${file})`;
      console.log(`  ✅ Successfully applied: ${file}`);
    } catch (err) {
      console.error(`  ❌ Failed applying ${file}:`, err.message);
      process.exit(1);
    }
  }

  console.log('🎉 All migrations successfully executed!');
}

runMigrations().catch((err) => {
  console.error('Fatal migration error:', err);
  process.exit(1);
});
