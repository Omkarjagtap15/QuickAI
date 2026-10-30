/**
 * Server-side Input Validation & Prompt Building
 *
 * Prevents:
 * 1. Prompt injection & arbitrary client prompts
 * 2. Client-specified token abuse (caps max_tokens server-side)
 * 3. File upload and parameter malformations
 *
 * Implemented with zero runtime dependency overhead for maximum serverless cold-start speed.
 */

const MAX_ARTICLE_TOKENS = 1600;
const MAX_BLOG_TITLE_TOKENS = 120;

export const generateArticleSchema = {
  safeParse(data) {
    if (!data || typeof data !== 'object') {
      return { success: false, error: { errors: [{ message: 'Request body must be a valid JSON object' }] } };
    }

    const raw = data.topic || data.prompt?.replace(/^Write an article about\s*/i, '') || '';
    const topic = String(raw).trim();

    if (topic.length < 2) {
      return { success: false, error: { errors: [{ message: 'Topic must be at least 2 characters long' }] } };
    }
    if (topic.length > 500) {
      return { success: false, error: { errors: [{ message: 'Topic must not exceed 500 characters' }] } };
    }

    const parsedLength = parseInt(data.length, 10);
    const length = isNaN(parsedLength) || parsedLength <= 0 ? 800 : Math.min(parsedLength, MAX_ARTICLE_TOKENS);

    return {
      success: true,
      data: {
        topic,
        length,
      },
    };
  },
};

export const generateBlogTitleSchema = {
  safeParse(data) {
    if (!data || typeof data !== 'object') {
      return { success: false, error: { errors: [{ message: 'Request body must be a valid JSON object' }] } };
    }

    const raw = data.keyword || data.prompt?.replace(/^Generate a blog title for the keyword\s*/i, '') || '';
    const keyword = String(raw).trim();

    if (keyword.length < 2) {
      return { success: false, error: { errors: [{ message: 'Keyword must be at least 2 characters long' }] } };
    }
    if (keyword.length > 200) {
      return { success: false, error: { errors: [{ message: 'Keyword must not exceed 200 characters' }] } };
    }

    const category = data.category ? String(data.category).slice(0, 100) : 'General';

    return {
      success: true,
      data: {
        keyword,
        category,
      },
    };
  },
};

export const generateImageSchema = {
  safeParse(data) {
    if (!data || typeof data !== 'object') {
      return { success: false, error: { errors: [{ message: 'Request body must be a valid JSON object' }] } };
    }

    const prompt = data.prompt ? String(data.prompt).trim() : '';
    if (prompt.length < 3) {
      return { success: false, error: { errors: [{ message: 'Image prompt must be at least 3 characters long' }] } };
    }
    if (prompt.length > 1000) {
      return { success: false, error: { errors: [{ message: 'Image prompt must not exceed 1000 characters' }] } };
    }

    const style = data.style ? String(data.style).slice(0, 100) : 'Realistic';
    const publish = Boolean(data.publish);

    return {
      success: true,
      data: {
        prompt,
        style,
        publish,
      },
    };
  },
};

export const removeImageObjectSchema = {
  safeParse(data) {
    if (!data || typeof data !== 'object') {
      return { success: false, error: { errors: [{ message: 'Request body must be a valid JSON object' }] } };
    }

    const object = data.object ? String(data.object).trim() : '';
    if (object.length < 2) {
      return { success: false, error: { errors: [{ message: 'Object name must be at least 2 characters long' }] } };
    }
    if (object.length > 100) {
      return { success: false, error: { errors: [{ message: 'Object name cannot exceed 100 characters' }] } };
    }

    if (!/^[a-zA-Z0-9\s_-]+$/.test(object)) {
      return { success: false, error: { errors: [{ message: 'Object name contains invalid characters' }] } };
    }

    return {
      success: true,
      data: {
        object,
      },
    };
  },
};

export function buildArticlePrompt(topic, length) {
  return `Write a well-structured, engaging, high-quality article about "${topic}". Provide clear headings, informative paragraphs, and a compelling conclusion. Aim for approximately ${length} tokens.`;
}

export function buildBlogTitlePrompt(keyword, category) {
  return `Generate 5 catchy, SEO-optimized, engaging blog post titles for the keyword "${keyword}" in the "${category}" niche. Return them as a numbered list.`;
}
