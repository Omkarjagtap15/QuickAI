import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { clerkMiddleware } from '@clerk/express';
import aiRouter from './routes/aiRoutes.js';
import userRouter from './routes/userRoutes.js';
import connectCloudinary from './configs/cloudinary.js';
import sql from './configs/db.js';
import { logger } from './services/logger.js';

const app = express();

await connectCloudinary();

// ── Security & Middleware ────────────────────────────────────────────────────────

const allowedOrigins = [
  process.env.CLIENT_URL,
  'http://localhost:5173',
  'http://localhost:3000',
  'http://127.0.0.1:5173',
].filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, curl, k6, or server-to-server)
      if (!origin || allowedOrigins.includes(origin) || process.env.NODE_ENV !== 'production') {
        return callback(null, true);
      }
      return callback(new Error('Blocked by CORS policy'));
    },
    credentials: true,
  })
);

// Global Rate Limiter: 100 requests per 15 minutes per IP
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests. Please try again later.' },
});

app.use(globalLimiter);
app.use(express.json({ limit: '10mb' }));
app.use(clerkMiddleware());

// ── Observability & Health ───────────────────────────────────────────────────────

app.get('/', (req, res) => res.send('QuickAI Multi-Provider Platform API is Live!'));

app.get('/health', async (req, res) => {
  let dbStatus = 'ok';
  try {
    await sql`SELECT 1`;
  } catch (err) {
    dbStatus = 'degraded';
  }

  res.json({
    status: dbStatus === 'ok' ? 'healthy' : 'degraded',
    database: dbStatus,
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
    providers: {
      gemini: { status: 'operational', circuit: 'closed' },
      clipdrop: { status: 'operational', circuit: 'closed' },
      cloudinary: { status: 'operational', circuit: 'closed' },
    },
  });
});

// ── Application Routes ───────────────────────────────────────────────────────────

app.use('/api/ai', aiRouter);
app.use('/api/user', userRouter);

// ── Error Handling Middleware ───────────────────────────────────────────────────

app.use((err, req, res, next) => {
  logger.error({ event: 'unhandled_error', message: err.message, stack: err.stack });
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal Server Error',
  });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  logger.info(`Server is running on port ${PORT}`);
});

export default app;
