import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import questions from '../src/questions.json' assert { type: 'json' };

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '../data');
const USERS_FILE = join(DATA_DIR, 'users.json');

// Ensure data directory exists
if (!existsSync(DATA_DIR)) {
  mkdirSync(DATA_DIR, { recursive: true });
}

// Types
interface UserData {
  fid: number;
  username?: string;
  currentStreak: number;
  longestStreak: number;
  lastPlayed: string | null;
  lastCorrect: boolean;
  totalPlayed: number;
  totalCorrect: number;
  answers: Record<string, { correct: boolean; date: string }>;
}

interface UsersDB {
  users: Record<string, UserData>;
}

// Load/save users
function loadUsers(): UsersDB {
  try {
    if (existsSync(USERS_FILE)) {
      return JSON.parse(readFileSync(USERS_FILE, 'utf-8'));
    }
  } catch (e) {
    console.error('Error loading users:', e);
  }
  return { users: {} };
}

function saveUsers(db: UsersDB): void {
  writeFileSync(USERS_FILE, JSON.stringify(db, null, 2));
}

function getUser(fid: number): UserData {
  const db = loadUsers();
  const key = String(fid);
  if (!db.users[key]) {
    db.users[key] = {
      fid,
      currentStreak: 0,
      longestStreak: 0,
      lastPlayed: null,
      lastCorrect: false,
      totalPlayed: 0,
      totalCorrect: 0,
      answers: {},
    };
    saveUsers(db);
  }
  return db.users[key];
}

function updateUser(fid: number, data: Partial<UserData>): UserData {
  const db = loadUsers();
  const key = String(fid);
  db.users[key] = { ...getUser(fid), ...data };
  saveUsers(db);
  return db.users[key];
}

// Date utilities
function getTodayString(): string {
  return new Date().toISOString().split('T')[0];
}

function getYesterdayString(): string {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return yesterday.toISOString().split('T')[0];
}

// Get today's question
interface Question {
  id: number;
  question: string;
  options: string[];
  correct: number;
  category: string;
  funFact: string;
}

function getTodaysQuestion(): Question {
  const today = new Date();
  const seed = today.getFullYear() * 10000 + (today.getMonth() + 1) * 100 + today.getDate();
  const index = seed % questions.length;
  return questions[index] as Question;
}

function getQuestionNumber(): number {
  const today = new Date();
  const start = new Date(today.getFullYear(), 0, 0);
  const diff = today.getTime() - start.getTime();
  const oneDay = 1000 * 60 * 60 * 24;
  return Math.floor(diff / oneDay);
}

// Get leaderboard
function getLeaderboard(limit = 10): Array<{ fid: number; username?: string; streak: number; total: number }> {
  const db = loadUsers();
  return Object.values(db.users)
    .sort((a, b) => b.longestStreak - a.longestStreak || b.totalCorrect - a.totalCorrect)
    .slice(0, limit)
    .map(u => ({
      fid: u.fid,
      username: u.username,
      streak: u.longestStreak,
      total: u.totalCorrect,
    }));
}

const app = new Hono();

// CORS for development
app.use('/api/*', cors());

// API: Get user data
app.get('/api/user/:fid', (c) => {
  const fid = parseInt(c.req.param('fid'));
  if (isNaN(fid)) {
    return c.json({ error: 'Invalid FID' }, 400);
  }
  const user = getUser(fid);
  const today = getTodayString();
  const hasPlayedToday = user.lastPlayed === today;
  
  return c.json({
    user,
    hasPlayedToday,
    todaysAnswer: hasPlayedToday ? user.answers[today] : null,
    question: getTodaysQuestion(),
    questionNumber: getQuestionNumber(),
  });
});

// API: Submit answer
app.post('/api/answer', async (c) => {
  const body = await c.req.json();
  const { fid, username, answerIndex } = body;
  
  if (!fid || answerIndex === undefined) {
    return c.json({ error: 'Missing fid or answerIndex' }, 400);
  }

  const user = getUser(fid);
  const today = getTodayString();
  const yesterday = getYesterdayString();
  const question = getTodaysQuestion();

  // Check if already played today
  if (user.lastPlayed === today) {
    return c.json({ 
      error: 'Already played today',
      user,
      todaysAnswer: user.answers[today],
    }, 400);
  }

  const isCorrect = answerIndex === question.correct;

  // Update streak
  let newStreak = 0;
  if (isCorrect) {
    if (user.lastPlayed === yesterday && user.lastCorrect) {
      newStreak = user.currentStreak + 1;
    } else {
      newStreak = 1;
    }
  }

  const updatedUser = updateUser(fid, {
    username: username || user.username,
    currentStreak: newStreak,
    longestStreak: Math.max(newStreak, user.longestStreak),
    lastPlayed: today,
    lastCorrect: isCorrect,
    totalPlayed: user.totalPlayed + 1,
    totalCorrect: user.totalCorrect + (isCorrect ? 1 : 0),
    answers: {
      ...user.answers,
      [today]: { correct: isCorrect, date: today },
    },
  });

  return c.json({
    success: true,
    isCorrect,
    correctAnswer: question.correct,
    user: updatedUser,
    funFact: question.funFact,
  });
});

// API: Leaderboard
app.get('/api/leaderboard', (c) => {
  return c.json({
    leaderboard: getLeaderboard(20),
  });
});

// API: Today's question (public, no answers)
app.get('/api/question', (c) => {
  const q = getTodaysQuestion();
  return c.json({
    id: q.id,
    question: q.question,
    options: q.options,
    category: q.category,
    questionNumber: getQuestionNumber(),
  });
});

// Frame POST handler (for traditional frame button clicks)
app.post('/frame', async (c) => {
  try {
    const body = await c.req.json();
    console.log('Frame POST received:', JSON.stringify(body, null, 2));
    
    // Extract FID from frame message
    const fid = body?.untrustedData?.fid;
    const buttonIndex = body?.untrustedData?.buttonIndex;
    
    // For now, redirect to the app
    const appUrl = process.env.APP_URL || 'http://localhost:5173';
    
    // Return a frame that opens the mini app
    return c.html(`
<!DOCTYPE html>
<html>
<head>
  <meta property="fc:frame" content="vNext" />
  <meta property="fc:frame:image" content="${appUrl}/og.png" />
  <meta property="fc:frame:button:1" content="🧠 Play Trivia" />
  <meta property="fc:frame:button:1:action" content="link" />
  <meta property="fc:frame:button:1:target" content="${appUrl}" />
</head>
</html>
    `);
  } catch (e) {
    console.error('Frame error:', e);
    return c.json({ error: 'Frame error' }, 500);
  }
});

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
  // Serve static assets
  app.use('/assets/*', serveStatic({ root: './dist' }));
  app.use('/og.png', serveStatic({ root: './dist', path: '/og.png' }));
  app.use('/og.svg', serveStatic({ root: './dist', path: '/og.svg' }));
  
  // Serve index.html for all other routes (SPA fallback)
  app.get('*', (c) => {
    const html = readFileSync(join(__dirname, '../dist/index.html'), 'utf-8');
    return c.html(html);
  });
}

const port = parseInt(process.env.PORT || '3000');
console.log(`🧠 Daily Trivia API running on port ${port}`);

serve({ fetch: app.fetch, port });

export default app;
