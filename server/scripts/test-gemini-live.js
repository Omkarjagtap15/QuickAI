import dotenv from 'dotenv';
dotenv.config();
import axios from 'axios';
import OpenAI from 'openai';

const aiBaseUrl =
  process.env.MOCK_AI_URL ||
  'https://generativelanguage.googleapis.com/v1beta/openai/';

const AI = new OpenAI({
  apiKey: process.env.GEMINI_API_KEY || 'mock-api-key',
  baseURL: aiBaseUrl,
});

const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite';

async function executeChatCompletion({ prompt, max_tokens = 800, model = GEMINI_MODEL }) {
  const apiKey = process.env.GEMINI_API_KEY;

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
        { timeout: 35000 }
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
      console.warn('Primary Gemini REST failed:', primaryErr.response?.data?.error?.message || primaryErr.message);
    }
  }

  return await AI.chat.completions.create({
    model,
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.7,
    max_tokens,
  });
}

async function run() {
  const start = Date.now();
  const res = await executeChatCompletion({
    prompt: 'Generate 5 blog post titles for web dev in Technology. Return a numbered list.',
    max_tokens: 200,
  });

  console.log(`Executed in ${Date.now() - start}ms:`);
  console.log(res.choices[0]?.message?.content);
}

run();
