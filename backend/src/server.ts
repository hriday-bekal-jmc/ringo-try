import 'dotenv/config';
import 'express-async-errors';
import express, { Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { query } from './config/db';

import authRoutes from './routes/authRoutes';
import templateRoutes from './routes/templateRoutes';
import applicationRoutes from './routes/applicationRoutes';
import settlementRoutes from './routes/settlementRoutes';
import adminRoutes from './routes/adminRoutes';
import dashboardRoutes from './routes/dashboardRoutes';
import eventsRoutes from './routes/eventsRoutes';

const app = express();

// Security headers
app.use(helmet());

// CORS — allow frontend origin with credentials (for HttpOnly cookies)
app.use(cors({
  origin: process.env.FRONTEND_URL ?? 'http://localhost:5173',
  credentials: true,
}));

app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// Passport Google OAuth Strategy — only registered when credentials are present
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  passport.use(new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: process.env.GOOGLE_REDIRECT_URI ?? 'http://localhost:3000/api/auth/google/callback',
    },
    async (_accessToken, _refreshToken, profile, done) => {
      try {
        const email = profile.emails?.[0]?.value;
        if (!email) return done(new Error('No email in Google profile'));

        const result = await query<{
          id: string;
          role: string;
          department_id: string;
          email: string;
        }>(
          `INSERT INTO users (full_name, email, oauth_id, is_active)
           VALUES ($1, $2, $3, true)
           ON CONFLICT (email) DO UPDATE
             SET oauth_id = EXCLUDED.oauth_id, updated_at = NOW()
           RETURNING id, role, department_id, email`,
          [profile.displayName ?? email, email, profile.id]
        );

        const user = result.rows[0];
        return done(null, {
          userId: user.id,
          role: user.role,
          departmentId: user.department_id,
          email: user.email,
        });
      } catch (err) {
        return done(err as Error);
      }
    }
  ));
} else {
  console.warn('[Auth] GOOGLE_CLIENT_ID/SECRET not set — Google OAuth disabled.');
}

app.use(passport.initialize());

// Routes
app.use('/api/auth',        authRoutes);
app.use('/api/templates',   templateRoutes);
app.use('/api/applications', applicationRoutes);
app.use('/api/settlements', settlementRoutes);
app.use('/api/admin',       adminRoutes);
app.use('/api/dashboard',   dashboardRoutes);
app.use('/api/events',      eventsRoutes);

// Health check
app.get('/health', (_req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

// Global error handler
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('[Error]', err.message, err.stack);
  const status = (err as { status?: number }).status ?? 500;
  res.status(status).json({
    error: process.env.NODE_ENV === 'production' ? 'Internal server error.' : err.message,
  });
});

const PORT = parseInt(process.env.PORT ?? '3000', 10);
app.listen(PORT, () => {
  console.log(`RINGO backend running on http://localhost:${PORT}`);
});

export default app;
