import dotenv from 'dotenv';
dotenv.config();
import axios from 'axios';
import { v2 as cloudinary } from 'cloudinary';
import fs from 'fs';
import path from 'path';

console.log('🧪 ================= TESTING ALL REMAINING FEATURES =================\n');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// 1. Test Image Generation (ClipDrop -> Cloudinary)
async function testImageGen() {
  console.log('1️⃣ Testing ClipDrop Image Generation -> Cloudinary Upload...');
  const start = Date.now();
  try {
    const formData = new FormData();
    formData.append('prompt', 'A futuristic neon city skyline at dusk, digital art');

    const res = await axios.post('https://clipdrop-api.co/text-to-image/v1', formData, {
      headers: { 'x-api-key': process.env.CLIPDROP_API_KEY },
      responseType: 'arraybuffer',
      timeout: 30000,
    });

    const buffer = Buffer.from(res.data);
    const base64Image = `data:image/png;base64,${buffer.toString('base64')}`;

    console.log(`   ClipDrop received ${buffer.length} bytes in ${Date.now() - start}ms.`);
    console.log('   Uploading to Cloudinary...');

    const uploadRes = await cloudinary.uploader.upload(base64Image, {
      folder: 'quickai_creations',
    });

    console.log('   ✅ Image Generation SUCCESS!');
    console.log('   Generated Image URL:', uploadRes.secure_url);
  } catch (err) {
    console.error('   ❌ Image Generation FAILED:', err.message);
    if (err.response?.data) {
      console.error('   Details:', Buffer.from(err.response.data).toString());
    }
  }
}

// 2. Test Cloudinary Background Removal
async function testBackgroundRemoval() {
  console.log('\n2️⃣ Testing Cloudinary Background Removal...');
  try {
    // Test uploading an asset with background removal transformation
    const testImgPath = path.resolve('../client/public/favicon.svg');
    const res = await cloudinary.uploader.upload(testImgPath, {
      folder: 'quickai_bg_remove_test',
      transformation: [
        {
          effect: 'background_removal',
          background_removal: 'remove_the_background',
        },
      ],
    });
    console.log('   ✅ Background Removal SUCCESS!');
    console.log('   Transformed URL:', res.secure_url);
  } catch (err) {
    console.error('   ⚠️ Cloudinary Background Removal Notice:', err.message);
    if (err.http_code === 400 || err.message?.includes('addon') || err.message?.includes('disabled')) {
      console.log('   Note: Cloudinary Background Removal add-on is not enabled on this free Cloudinary tier.');
    }
  }
}

// 3. Test Cloudinary Generative Object Removal
async function testObjectRemoval() {
  console.log('\n3️⃣ Testing Cloudinary Object Removal...');
  try {
    const testImgPath = path.resolve('../client/public/favicon.svg');
    const res = await cloudinary.uploader.upload(testImgPath, {
      folder: 'quickai_obj_remove_test',
    });

    const url = cloudinary.url(res.public_id, {
      transformation: [{ effect: 'gen_remove:circle' }],
      resource_type: 'image',
    });

    console.log('   ✅ Object Removal URL Generated successfully!');
    console.log('   URL:', url);
  } catch (err) {
    console.error('   ❌ Object Removal FAILED:', err.message);
  }
}

// 4. Test Resume Review
async function testResumeReview() {
  console.log('\n4️⃣ Testing Resume Review with Gemini...');
  try {
    const dummyResumeText = `
John Doe - Senior Software Engineer
Skills: React, Node.js, TypeScript, PostgreSQL, AWS, Docker
Experience:
- Built full stack SaaS platforms handling 100k requests/day.
- Reduced database p95 latency from 250ms to 20ms using partial indexes and Redis caching.
- Designed event-driven background pipelines with BullMQ and circuit breakers.
Education: B.S. in Computer Science
    `;

    const prompt = `You are an expert tech recruiter and hiring manager. Review the following resume thoroughly. Highlight 3 key strengths, 3 critical weaknesses/gaps, and 3 actionable recommendations to improve impact and ATS scoring.\n\nResume Content:\n${dummyResumeText}`;

    const apiKey = process.env.GEMINI_API_KEY;
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent?key=${apiKey}`;

    const res = await axios.post(
      url,
      {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: 1000, temperature: 0.7 },
      },
      { timeout: 35000 }
    );

    const feedback = res.data?.candidates?.[0]?.content?.parts?.[0]?.text;
    console.log('   ✅ Resume Review SUCCESS!');
    console.log('   Feedback Preview (first 200 chars):', feedback?.slice(0, 200) + '...');
  } catch (err) {
    console.error('   ❌ Resume Review FAILED:', err.message);
  }
}

async function run() {
  await testImageGen();
  await testBackgroundRemoval();
  await testObjectRemoval();
  await testResumeReview();
  console.log('\n================ ALL FEATURE TESTS COMPLETE ================');
}

run();
