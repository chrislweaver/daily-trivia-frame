# Daily Trivia - Farcaster Mini App 🧠

A daily crypto & Farcaster trivia game that runs inside Warpcast as a Frame/Mini App.

## Features

- 🎯 **One question per day** - Same question for everyone, new question each day
- 🔥 **Streak tracking** - Build and maintain your streak by playing daily
- 🏆 **Leaderboard** - Compete with other Farcaster users
- 📊 **Stats** - Track your accuracy and total correct answers
- 📢 **Share results** - Cast your score to show off (or seek sympathy)
- 💡 **Fun facts** - Learn something new with each answer

## Tech Stack

- **Frontend**: React + Vite + TypeScript
- **Backend**: Hono (lightweight Node.js framework)
- **Frame SDK**: `@farcaster/frame-sdk` for Mini App integration
- **Storage**: JSON file store (easily upgradeable to SQLite/Postgres)

## Development

### Prerequisites
- Node.js 18+
- npm or yarn

### Setup

```bash
# Install dependencies
npm install

# Run development server (frontend + backend)
npm run dev
```

This starts:
- Frontend on `http://localhost:5173` (Vite)
- Backend API on `http://localhost:3000` (Hono)

### Testing in Warpcast

1. Use ngrok or similar to expose your local server:
   ```bash
   ngrok http 5173
   ```

2. Go to https://warpcast.com/~/developers/frames

3. Enter your ngrok URL in the frame debugger

4. Test the frame functionality

## Deployment

### Option 1: Railway (Recommended)

1. Push to GitHub
2. Connect repo to Railway
3. Set build command: `npm run build`
4. Set start command: `npm run start`
5. Add environment variables:
   - `PORT=3000`
   - `NODE_ENV=production`
   - `APP_URL=https://your-app.railway.app`

### Option 2: Vercel + Separate API

The frontend can be deployed to Vercel, but you'll need a separate backend host since Vercel serverless has limitations for persistent storage.

### Option 3: VPS (DigitalOcean, etc.)

```bash
# On server
git clone <repo>
cd daily-trivia
npm install
npm run build
NODE_ENV=production npm run start

# Use PM2 for process management
pm2 start "npm run start" --name daily-trivia
```

## Project Structure

```
daily-trivia/
├── src/                  # Frontend React app
│   ├── App.tsx          # Main app component
│   ├── index.css        # Styles
│   ├── main.tsx         # Entry point
│   └── questions.json   # Trivia questions database
├── server/              # Backend API
│   └── index.ts         # Hono server
├── public/              # Static assets
│   └── og.png          # Open Graph image for frames
├── data/                # Runtime data (gitignored)
│   └── users.json       # User data storage
└── dist/                # Build output
```

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/question` | GET | Get today's question (no answer) |
| `/api/user/:fid` | GET | Get user data and check if played today |
| `/api/answer` | POST | Submit an answer |
| `/api/leaderboard` | GET | Get top players |
| `/frame` | POST | Handle frame button clicks |

## Adding Questions

Edit `src/questions.json` to add more trivia questions:

```json
{
  "id": 41,
  "question": "What is your question?",
  "options": ["Option A", "Option B", "Option C", "Option D"],
  "correct": 0,  // 0-indexed, so 0 = Option A
  "category": "Category Name",
  "funFact": "A fun fact shown after answering!"
}
```

Currently has 40 questions covering:
- Farcaster History & Tech
- Crypto History
- Protocol Trivia (Optimism, Base, etc.)
- Crypto Culture (memes, slang)

## Mini App Registration

After deployment and testing:

1. Go to https://warpcast.com/~/developers/mini-apps
2. Click "Create Mini App"
3. Fill in:
   - **Name**: Daily Trivia
   - **Icon**: Upload a 1024x1024 icon (brain emoji themed)
   - **Description**: Test your crypto & Farcaster knowledge with a daily trivia question. Build streaks, compete on leaderboards!
   - **Frame URL**: Your deployed URL
   - **Splash Background Color**: `#0a0a0a`
4. Submit for review

### Mini App Icon Specs
- Size: 1024x1024 px
- Format: PNG or JPG
- Background: Can be transparent
- Style: Should match app branding (brain emoji, purple/blue gradient)

## Frame Meta Tags

The app uses these frame meta tags (in `index.html`):

```html
<meta property="fc:frame" content="vNext" />
<meta property="fc:frame:image" content="https://your-app.com/og.png" />
<meta property="fc:frame:button:1" content="🧠 Play Today's Trivia" />
<meta property="fc:frame:post_url" content="https://your-app.com/frame" />
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | 3000 |
| `NODE_ENV` | Environment | development |
| `APP_URL` | Public app URL | http://localhost:5173 |
| `VITE_API_URL` | API URL for frontend | (empty = same origin) |

## Future Improvements

- [ ] Add more questions (target: 365 for a full year)
- [ ] Difficulty levels
- [ ] Categories/topics selection
- [ ] Weekly/monthly challenges
- [ ] NFT badges for achievements
- [ ] Multiplayer mode
- [ ] Question submission by community

## License

MIT
