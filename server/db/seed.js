import 'dotenv/config';
import { neon } from '@neondatabase/serverless';

if (!process.env.DATABASE_URL) {
  console.error('❌ Error: DATABASE_URL is not set.');
  process.exit(1);
}

const sql = neon(process.env.DATABASE_URL);

async function seed() {
  console.log('🌱 Starting benchmark database seeding...');

  const TOTAL_CREATIONS = 1000; // Scalable batch for benchmark testing
  const TOTAL_USERS = 50;

  const userIds = Array.from({ length: TOTAL_USERS }, (_, i) => `user_bench_${i + 1}`);

  console.log(`Inserting ${TOTAL_CREATIONS} sample creations...`);
  const types = ['article', 'blog-title', 'image', 'resume-review'];

  for (let i = 0; i < TOTAL_CREATIONS; i += 50) {
    const promises = [];
    for (let j = 0; j < 50 && i + j < TOTAL_CREATIONS; j++) {
      const idx = i + j;
      const uId = userIds[idx % userIds.length];
      const type = types[idx % types.length];
      const isPublic = idx % 2 === 0;

      promises.push(
        sql`
          INSERT INTO creations (user_id, prompt, content, type, publish)
          VALUES (${uId}, ${`Benchmark prompt ${idx}`}, ${`Generated content payload for benchmarking index scan efficiency #${idx}`}, ${type}, ${isPublic})
        `
      );
    }
    await Promise.all(promises);
  }

  console.log('Seeding initial usage counters...');
  for (const uId of userIds.slice(0, 20)) {
    await sql`
      INSERT INTO usage (user_id, count, plan)
      VALUES (${uId}, ${Math.floor(Math.random() * 8)}, 'free')
      ON CONFLICT (user_id) DO NOTHING
    `;
  }

  console.log('Seeding initial likes join table...');
  const sampleCreations = await sql`SELECT id FROM creations WHERE publish = true LIMIT 50`;
  for (const c of sampleCreations) {
    const likers = userIds.slice(0, Math.floor(Math.random() * 25));
    for (const liker of likers) {
      await sql`
        INSERT INTO likes (creation_id, user_id)
        VALUES (${c.id}, ${liker})
        ON CONFLICT DO NOTHING
      `;
    }
  }

  console.log('🎉 Seeding successfully completed!');
}

seed().catch((err) => {
  console.error('Seeding error:', err);
  process.exit(1);
});
