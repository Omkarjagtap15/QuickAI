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

function parseSqlStatements(content) {
  const statements = [];
  let current = '';
  let inDollarBlock = false;

  const lines = content.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('--')) continue; // Skip comment lines

    if (trimmed.includes('$$')) {
      inDollarBlock = !inDollarBlock;
    }

    current += line + '\n';

    if (!inDollarBlock && trimmed.endsWith(';')) {
      const stmt = current.trim();
      if (stmt.length > 0) {
        statements.push(stmt);
      }
      current = '';
    }
  }

  if (current.trim().length > 0) {
    statements.push(current.trim());
  }

  return statements;
}

async function runMigrations() {
  console.log('🚀 Running database migrations...');

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
    const content = fs.readFileSync(filePath, 'utf-8');
    const statements = parseSqlStatements(content);

    try {
      for (const statement of statements) {
        await sql.query(statement);
      }
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
