import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Import routes
import authRoutes from './routes/auth.js';
import quizRoutes from './routes/quiz.js';
import curriculumRoutes from './routes/curriculum.js';
import projectRoutes from './routes/project.js';
import jobsRoutes from './routes/jobs.js';
import statsRoutes from './routes/stats.js';
import mentorsRoutes from './routes/mentors.js';

// Mount routes
app.use('/api/auth', authRoutes);
app.use('/api/quiz', quizRoutes);
app.use('/api/curriculum', curriculumRoutes);
app.use('/api/project', projectRoutes);
app.use('/api/jobs', jobsRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/mentors', mentorsRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(join(__dirname, '..', 'dist')));
  app.get('*', (req, res) => {
    res.sendFile(join(__dirname, '..', 'dist', 'index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`⚡ Skill2Hire server running on http://localhost:${PORT}`);
});
