import express from 'express';
import { auth } from '../middlewares/auth.js';
import {
  generateArticle,
  generateArticleStream,
  generateBlogTitle,
  generateImage,
  generateImageAsync,
  removeImageBackground,
  removeImageObject,
  resumeReview,
  getJobStatus,
  streamJobStatus,
} from '../controllers/aiController.js';
import { upload } from '../configs/multer.js';

const aiRouter = express.Router();

// Synchronous Text Generation (with Atomic Quota)
aiRouter.post('/generate-article', auth, generateArticle);
aiRouter.post('/generate-article-stream', auth, generateArticleStream);
aiRouter.post('/generate-blog-title', auth, generateBlogTitle);

// Synchronous Image Generation (Premium)
aiRouter.post('/generate-image', auth, generateImage);

// Async Background Job Pipeline (BullMQ architecture with Immediate 202 Accepted)
aiRouter.post('/generate-image-async', auth, generateImageAsync);
aiRouter.get('/job/:jobId', auth, getJobStatus);
aiRouter.get('/job-stream/:jobId', auth, streamJobStatus);

// File Operations (with Auto Cleanup)
aiRouter.post('/remove-image-background', upload.single('image'), auth, removeImageBackground);
aiRouter.post('/remove-image-object', upload.single('image'), auth, removeImageObject);
aiRouter.post('/resume-review', upload.single('resume'), auth, resumeReview);

export default aiRouter;
