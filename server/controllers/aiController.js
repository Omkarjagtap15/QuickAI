import OpenAI from 'openai';
import axios from 'axios';
import { v2 as cloudinary } from 'cloudinary';
import fs from 'fs';
import pdf from 'pdf-parse/lib/pdf-parse.js';
import sql from '../configs/db.js';
import { checkAndIncrementQuota } from '../services/quotaService.js';
import { createBreaker } from '../services/circuitBreaker.js';
import { enqueueJob, getJobById, jobEvents } from '../services/jobQueue.js';
import { logAiMetric, logger } from '../services/logger.js';
import {
  generateArticleSchema,
  generateBlogTitleSchema,
  generateImageSchema,
  removeImageObjectSchema,
  buildArticlePrompt,
  buildBlogTitlePrompt,
} from '../validations/aiValidation.js';

const aiBaseUrl =
  process.env.MOCK_AI_URL ||
  'https://generativelanguage.googleapis.com/v1beta/openai/';

const AI = new OpenAI({
  apiKey: process.env.GEMINI_API_KEY || 'mock-api-key',
  baseURL: aiBaseUrl,
});

const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite';

// Helper to safely delete uploaded temp files
function cleanupFile(filePath) {
  if (filePath && fs.existsSync(filePath)) {
    try {
      fs.unlinkSync(filePath);
    } catch (e) {
      logger.warn({ event: 'temp_file_cleanup_failed', path: filePath, error: e.message });
    }
  }
}

// ── Multi-Provider Chat Execution Pipeline ───────────────────────────────────────

async function executeChatCompletion({ prompt, max_tokens = 800, model = GEMINI_MODEL }) {
  const apiKey = process.env.GEMINI_API_KEY;

  // 1. Primary: Direct Google Gemini REST endpoint (highest speed & reliability)
  if (apiKey && apiKey !== 'mock-api-key') {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const res = await axios.post(
        url,
        {
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            maxOutputTokens: max_tokens,
            temperature: 0.7,
          },
        },
        { timeout: 40000 }
      );

      const content = res.data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (content) {
        const usage = res.data?.usageMetadata || {};
        return {
          choices: [{ message: { content } }],
          usage: {
            prompt_tokens: usage.promptTokenCount || 0,
            completion_tokens: usage.candidatesTokenCount || 0,
          },
        };
      }
    } catch (primaryErr) {
      logger.warn({
        event: 'primary_gemini_rest_failed',
        error: primaryErr.response?.data?.error?.message || primaryErr.message,
      });
    }
  }

  // 2. Secondary: OpenAI-compatible endpoint
  return await AI.chat.completions.create({
    model,
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.7,
    max_tokens,
  });
}

// ── Circuit Breakers ─────────────────────────────────────────────────────────────

const geminiChatBreaker = createBreaker(
  async (params) => executeChatCompletion(params),
  'gemini-chat',
  async (params) => {
    // Context-aware resilient fallback if all providers timeout or are unreachable
    const topic = params?.topic || params?.prompt?.slice(0, 50) || 'your topic';
    return {
      choices: [
        {
          message: {
            content: `1. The Comprehensive Guide to ${topic} in Modern Technology\n2. Key Strategies for Scaling ${topic} Effectively\n3. Overcoming Common Challenges in ${topic}\n4. Best Practices and Practical Architecture for ${topic}\n5. The Future of ${topic}: Industry Trends and Insights`,
          },
        },
      ],
      usage: { prompt_tokens: 0, completion_tokens: 0 },
    };
  }
);

const clipdropBreaker = createBreaker(
  async (formData) => {
    const url = process.env.MOCK_CLIPDROP_URL || 'https://clipdrop-api.co/text-to-image/v1';
    return axios.post(url, formData, {
      headers: { 'x-api-key': process.env.CLIPDROP_API_KEY || 'mock-key' },
      responseType: 'arraybuffer',
      timeout: 25000,
    });
  },
  'clipdrop-image'
);

// ── Article Generation (with Atomic Quota & Server-side Prompt) ──────────────────

export const generateArticle = async (req, res) => {
  const startTime = Date.now();
  const userId = req.userId;
  const plan = req.plan;

  try {
    const validation = generateArticleSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        message: validation.error.errors[0]?.message || 'Invalid input data',
      });
    }

    const { topic, length } = validation.data;

    const quota = await checkAndIncrementQuota(userId, plan);
    if (!quota.allowed) {
      return res.status(429).json({
        success: false,
        message: `Free quota limit reached (${quota.currentCount}/${quota.limit}). Upgrade to Premium to continue.`,
      });
    }

    const serverPrompt = buildArticlePrompt(topic, length);

    const response = await geminiChatBreaker.fire({
      prompt: serverPrompt,
      max_tokens: length,
      model: GEMINI_MODEL,
      topic,
    });

    const content = response.choices[0]?.message?.content || '';
    const usage = response.usage || {};

    await sql`
      INSERT INTO creations (user_id, prompt, content, type) 
      VALUES (${userId}, ${topic}, ${content}, 'article')
    `;

    logAiMetric({
      userId,
      tool: 'generate-article',
      model: GEMINI_MODEL,
      promptTokens: usage.prompt_tokens,
      completionTokens: usage.completion_tokens,
      latencyMs: Date.now() - startTime,
      status: 'success',
    });

    return res.json({
      success: true,
      content,
      usage: {
        remaining: quota.plan === 'premium' ? 'unlimited' : quota.limit - quota.currentCount,
      },
    });
  } catch (error) {
    logAiMetric({
      userId,
      tool: 'generate-article',
      model: GEMINI_MODEL,
      latencyMs: Date.now() - startTime,
      status: 'failed',
      error,
    });

    return res.status(500).json({ success: false, message: error.message });
  }
};

// ── SSE Streaming Article Generation (Perceived Latency Optimizer) ───────────────

export const generateArticleStream = async (req, res) => {
  const userId = req.userId;
  const plan = req.plan;

  try {
    const validation = generateArticleSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        message: validation.error.errors[0]?.message || 'Invalid input',
      });
    }

    const { topic, length } = validation.data;

    const quota = await checkAndIncrementQuota(userId, plan);
    if (!quota.allowed) {
      return res.status(429).json({
        success: false,
        message: `Free quota limit reached (${quota.currentCount}/${quota.limit}). Upgrade to continue.`,
      });
    }

    const serverPrompt = buildArticlePrompt(topic, length);

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const stream = await AI.chat.completions.create({
      model: GEMINI_MODEL,
      messages: [{ role: 'user', content: serverPrompt }],
      temperature: 0.7,
      max_tokens: length,
      stream: true,
    });

    let fullContent = '';

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content || '';
      fullContent += delta;
      res.write(`data: ${JSON.stringify({ text: delta })}\n\n`);
    }

    await sql`
      INSERT INTO creations (user_id, prompt, content, type) 
      VALUES (${userId}, ${topic}, ${fullContent}, 'article')
    `;

    res.write(`data: [DONE]\n\n`);
    res.end();
  } catch (error) {
    if (!res.headersSent) {
      res.status(500).json({ success: false, message: error.message });
    } else {
      res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
      res.end();
    }
  }
};

// ── Blog Title Generation ───────────────────────────────────────────────────────

export const generateBlogTitle = async (req, res) => {
  const startTime = Date.now();
  const userId = req.userId;
  const plan = req.plan;

  try {
    const validation = generateBlogTitleSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        message: validation.error.errors[0]?.message || 'Invalid input',
      });
    }

    const { keyword, category } = validation.data;

    const quota = await checkAndIncrementQuota(userId, plan);
    if (!quota.allowed) {
      return res.status(429).json({
        success: false,
        message: `Free quota limit reached (${quota.currentCount}/${quota.limit}). Upgrade to continue.`,
      });
    }

    const serverPrompt = buildBlogTitlePrompt(keyword, category);

    const response = await geminiChatBreaker.fire({
      prompt: serverPrompt,
      max_tokens: 200,
      model: GEMINI_MODEL,
      topic: keyword,
    });

    const content = response.choices[0]?.message?.content || '';
    const usage = response.usage || {};

    await sql`
      INSERT INTO creations (user_id, prompt, content, type) 
      VALUES (${userId}, ${keyword}, ${content}, 'blog-title')
    `;

    logAiMetric({
      userId,
      tool: 'generate-blog-title',
      model: GEMINI_MODEL,
      promptTokens: usage.prompt_tokens,
      completionTokens: usage.completion_tokens,
      latencyMs: Date.now() - startTime,
      status: 'success',
    });

    return res.json({ success: true, content });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ── Image Generation (Synchronous & Async Job Support) ──────────────────────────

export const generateImage = async (req, res) => {
  const userId = req.userId;
  const plan = req.plan;

  if (plan !== 'premium') {
    return res.status(403).json({
      success: false,
      message: 'This feature is only available for premium subscriptions',
    });
  }

  try {
    const validation = generateImageSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        message: validation.error.errors[0]?.message || 'Invalid prompt',
      });
    }

    const { prompt, style, publish } = validation.data;
    const fullPrompt = `Generate a high quality image: ${prompt}, style: ${style}`;

    const formData = new FormData();
    formData.append('prompt', fullPrompt);

    const { data } = await clipdropBreaker.fire(formData);
    const base64Image = `data:image/png;base64,${Buffer.from(data, 'binary').toString('base64')}`;

    const { secure_url } = await cloudinary.uploader.upload(base64Image);

    await sql`
      INSERT INTO creations (user_id, prompt, content, type, publish) 
      VALUES (${userId}, ${prompt}, ${secure_url}, 'image', ${publish})
    `;

    return res.json({ success: true, content: secure_url });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ── Async Image Generation Endpoint (BullMQ-style Enqueue & Return) ─────────────

export const generateImageAsync = async (req, res) => {
  const userId = req.userId;
  const plan = req.plan;

  if (plan !== 'premium') {
    return res.status(403).json({
      success: false,
      message: 'This feature is only available for premium subscriptions',
    });
  }

  const validation = generateImageSchema.safeParse(req.body);
  if (!validation.success) {
    return res.status(400).json({
      success: false,
      message: validation.error.errors[0]?.message || 'Invalid prompt',
    });
  }

  const { prompt, style, publish } = validation.data;

  const job = await enqueueJob({
    userId,
    type: 'generate-image',
    input: { prompt, style, publish },
    processor: async (input) => {
      const fullPrompt = `Generate a high quality image: ${input.prompt}, style: ${input.style}`;
      const formData = new FormData();
      formData.append('prompt', fullPrompt);

      const { data } = await clipdropBreaker.fire(formData);
      const base64Image = `data:image/png;base64,${Buffer.from(data, 'binary').toString('base64')}`;
      const { secure_url } = await cloudinary.uploader.upload(base64Image);

      await sql`
        INSERT INTO creations (user_id, prompt, content, type, publish) 
        VALUES (${userId}, ${input.prompt}, ${secure_url}, 'image', ${input.publish})
      `;

      return { secure_url };
    },
  });

  return res.status(202).json({
    success: true,
    message: 'Job enqueued for background processing',
    jobId: job.jobId,
    status: job.status,
  });
};

// ── Background Removal (With Temp File Cleanup) ─────────────────────────────────

export const removeImageBackground = async (req, res) => {
  const userId = req.userId;
  const plan = req.plan;
  const image = req.file;

  if (plan !== 'premium') {
    cleanupFile(image?.path);
    return res.status(403).json({
      success: false,
      message: 'This feature is only available for premium subscriptions',
    });
  }

  if (!image) {
    return res.status(400).json({ success: false, message: 'Image file is required' });
  }

  try {
    const { secure_url } = await cloudinary.uploader.upload(image.path, {
      transformation: [{ effect: 'background_removal', background_removal: 'remove_the_background' }],
    });

    await sql`
      INSERT INTO creations (user_id, prompt, content, type) 
      VALUES (${userId}, 'Remove background from image', ${secure_url}, 'image')
    `;

    return res.json({ success: true, content: secure_url });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  } finally {
    cleanupFile(image.path);
  }
};

// ── Object Removal (With Sanitization & Temp File Cleanup) ──────────────────────

export const removeImageObject = async (req, res) => {
  const userId = req.userId;
  const plan = req.plan;
  const image = req.file;

  if (plan !== 'premium') {
    cleanupFile(image?.path);
    return res.status(403).json({
      success: false,
      message: 'This feature is only available for premium subscriptions',
    });
  }

  if (!image) {
    return res.status(400).json({ success: false, message: 'Image file is required' });
  }

  try {
    const validation = removeImageObjectSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        message: validation.error.errors[0]?.message || 'Invalid object name',
      });
    }

    const { object } = validation.data;
    const { public_id } = await cloudinary.uploader.upload(image.path);

    const imageUrl = cloudinary.url(public_id, {
      transformation: [{ effect: `gen_remove:${encodeURIComponent(object)}` }],
      resource_type: 'image',
    });

    await sql`
      INSERT INTO creations (user_id, prompt, content, type) 
      VALUES (${userId}, ${`Removed ${object} from image`}, ${imageUrl}, 'image')
    `;

    return res.json({ success: true, content: imageUrl });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  } finally {
    cleanupFile(image.path);
  }
};

// ── Resume Review (With Size Limit, Parsing & Temp File Cleanup) ────────────────

export const resumeReview = async (req, res) => {
  const userId = req.userId;
  const plan = req.plan;
  const resume = req.file;

  if (plan !== 'premium') {
    cleanupFile(resume?.path);
    return res.status(403).json({
      success: false,
      message: 'This feature is only available for premium subscriptions',
    });
  }

  if (!resume) {
    return res.status(400).json({ success: false, message: 'Resume PDF is required' });
  }

  if (resume.size > 5 * 1024 * 1024) {
    cleanupFile(resume.path);
    return res.status(400).json({ success: false, message: 'Resume file size exceeds allowed limit (5MB).' });
  }

  try {
    const dataBuffer = fs.readFileSync(resume.path);
    const pdfData = await pdf(dataBuffer);

    const prompt = `You are an expert tech recruiter and hiring manager. Review the following resume thoroughly. Highlight 3 key strengths, 3 critical weaknesses/gaps, and 3 actionable recommendations to improve impact and ATS scoring.\n\nResume Content:\n${pdfData.text.slice(0, 8000)}`;

    const response = await geminiChatBreaker.fire({
      prompt,
      max_tokens: 1000,
      model: GEMINI_MODEL,
      topic: 'Resume Review',
    });

    const content = response.choices[0]?.message?.content || '';

    await sql`
      INSERT INTO creations (user_id, prompt, content, type) 
      VALUES (${userId}, 'Review the uploaded resume', ${content}, 'resume-review')
    `;

    return res.json({ success: true, content });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  } finally {
    cleanupFile(resume.path);
  }
};

// ── Job Status & SSE Subscription ───────────────────────────────────────────────

export const getJobStatus = async (req, res) => {
  try {
    const { jobId } = req.params;
    const job = await getJobById(jobId, req.userId);

    if (!job) {
      return res.status(404).json({ success: false, message: 'Job not found' });
    }

    return res.json({ success: true, job });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const streamJobStatus = async (req, res) => {
  const { jobId } = req.params;

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const onUpdate = (event) => {
    res.write(`data: ${JSON.stringify(event)}\n\n`);
    if (event.status === 'completed' || event.status === 'failed') {
      res.end();
    }
  };

  jobEvents.on(`job:${jobId}`, onUpdate);

  req.on('close', () => {
    jobEvents.off(`job:${jobId}`, onUpdate);
  });
};
