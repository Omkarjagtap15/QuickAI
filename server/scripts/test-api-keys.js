import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });
import { neon } from '@neondatabase/serverless';
import OpenAI from 'openai';
import axios from 'axios';
import { v2 as cloudinary } from 'cloudinary';

console.log('🔍 ==================== QUICKAI API KEYS DIAGNOSTIC ====================\n');

const results = {};

// 1. Neon Database Test
async function testDatabase() {
  console.log('1️⃣ Testing Neon PostgreSQL Database...');
  const start = Date.now();
  try {
    if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is missing');
    const sql = neon(process.env.DATABASE_URL);
    const tables = await sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `;
    const latency = Date.now() - start;
    results.database = {
      status: '✅ WORKING',
      latency: `${latency}ms`,
      tables: tables.map(t => t.table_name),
    };
    console.log(`   ✅ Database connected in ${latency}ms! Tables:`, tables.map(t => t.table_name).join(', '));
  } catch (err) {
    results.database = { status: '❌ FAILED', error: err.message };
    console.log('   ❌ Database error:', err.message);
  }
}

// 2. Clerk Auth Test
async function testClerk() {
  console.log('\n2️⃣ Testing Clerk Authentication API...');
  const start = Date.now();
  try {
    const key = process.env.CLERK_SECRET_KEY;
    if (!key) throw new Error('CLERK_SECRET_KEY is missing');
    const res = await axios.get('https://api.clerk.com/v1/users?limit=5', {
      headers: { Authorization: `Bearer ${key}` },
    });
    const latency = Date.now() - start;
    results.clerk = {
      status: '✅ WORKING',
      latency: `${latency}ms`,
      userCount: res.data.length,
    };
    console.log(`   ✅ Clerk API authenticated in ${latency}ms! Found ${res.data.length} registered users.`);
  } catch (err) {
    const msg = err.response?.data?.errors?.[0]?.message || err.message;
    results.clerk = { status: '❌ FAILED', error: msg };
    console.log('   ❌ Clerk error:', msg);
  }
}

// 3. Gemini AI Test
async function testGemini() {
  console.log('\n3️⃣ Testing Google Gemini AI API (gemini-3.5-flash-lite)...');
  const start = Date.now();
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error('GEMINI_API_KEY is missing');
    
    const AI = new OpenAI({
      apiKey,
      baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai/',
    });

    const completion = await AI.chat.completions.create({
      model: 'gemini-3.5-flash-lite',
      messages: [{ role: 'user', content: 'Say "Gemini is online!" in 4 words or less.' }],
      max_tokens: 20,
    });

    const latency = Date.now() - start;
    const text = completion.choices[0]?.message?.content?.trim();
    results.gemini = {
      status: '✅ WORKING',
      latency: `${latency}ms`,
      model: 'gemini-3.5-flash-lite',
      response: text,
      tokensUsed: completion.usage?.total_tokens,
    };
    console.log(`   ✅ Gemini generated response in ${latency}ms: "${text}"`);
  } catch (err) {
    const msg = err.error?.message || err.message;
    results.gemini = { status: '❌ FAILED', error: msg };
    console.log('   ❌ Gemini error:', msg);
  }
}

// 4. ClipDrop Image Generation Test
async function testClipdrop() {
  console.log('\n4️⃣ Testing ClipDrop Image Generation API...');
  const start = Date.now();
  try {
    const apiKey = process.env.CLIPDROP_API_KEY;
    if (!apiKey) throw new Error('CLIPDROP_API_KEY is missing');

    const form = new FormData();
    form.append('prompt', 'A small blue circle on white background');

    const res = await axios.post('https://clipdrop-api.co/text-to-image/v1', form, {
      headers: { 'x-api-key': apiKey },
      responseType: 'arraybuffer',
      timeout: 20000,
    });

    const latency = Date.now() - start;
    const bytes = res.data.byteLength || res.data.length;
    results.clipdrop = {
      status: '✅ WORKING',
      latency: `${latency}ms`,
      imageBytes: bytes,
    };
    console.log(`   ✅ ClipDrop generated image in ${latency}ms (${bytes} bytes)!`);
  } catch (err) {
    let errorMsg = err.message;
    if (err.response?.data) {
      try {
        const parsed = JSON.parse(Buffer.from(err.response.data).toString());
        errorMsg = parsed.error || JSON.stringify(parsed);
      } catch (e) {
        errorMsg = `Status ${err.response.status}: ${err.response.statusText}`;
      }
    }
    results.clipdrop = { status: '❌ FAILED', error: errorMsg };
    console.log('   ❌ ClipDrop error:', errorMsg);
  }
}

// 5. Cloudinary Test
async function testCloudinary() {
  console.log('\n5️⃣ Testing Cloudinary CDN & Image API...');
  const start = Date.now();
  try {
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
    });

    const ping = await cloudinary.api.ping();
    const latency = Date.now() - start;
    results.cloudinary = {
      status: '✅ WORKING',
      latency: `${latency}ms`,
      pingResponse: ping,
    };
    console.log(`   ✅ Cloudinary ping in ${latency}ms:`, ping);
  } catch (err) {
    results.cloudinary = { status: '❌ FAILED', error: err.message };
    console.log('   ❌ Cloudinary error:', err.message);
  }
}

async function run() {
  await testDatabase();
  await testClerk();
  await testGemini();
  await testClipdrop();
  await testCloudinary();

  console.log('\n==================== DIAGNOSTIC SUMMARY ====================');
  console.log(JSON.stringify(results, null, 2));
}

run();

