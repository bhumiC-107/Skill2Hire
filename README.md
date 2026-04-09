# 🚀 Skill2Hire — AI-Powered Skill Tutor

**Skill2Hire** is an intelligent learning platform that assesses your skill gaps through personalized quizzes, generates tailored curricula and project tutorials, tracks your progress with gamification, and matches you with curated job opportunities — all powered by AI.

![Skill2Hire](https://img.shields.io/badge/AI-Powered-6366f1?style=for-the-badge)
![Vite](https://img.shields.io/badge/Vite-Frontend-06b6d4?style=for-the-badge)
![Express](https://img.shields.io/badge/Express-Backend-10b981?style=for-the-badge)
![SQLite](https://img.shields.io/badge/SQLite-Database-f59e0b?style=for-the-badge)

---

## ✨ Features

### 🎯 Skill Assessment
- 10 AI-generated MCQ questions tailored to your career goal
- Supports custom goals (even abstract ones like "I want to build AI apps")
- Optional GitHub URL, code snippet, and screenshot upload for deeper analysis

### 📊 Skill Gap Analysis
- Radar chart visualization comparing current vs required skills
- Strengths and weaknesses breakdown
- Readiness score with priority-ranked skill gaps

### 📚 Personalized Curriculum
- AI-generated 8-12 module learning path targeting your exact gaps
- Streaming lesson content with code examples and exercises
- Lessons cached to save tokens on revisits

### 🛠️ Guided Projects
- Step-by-step project tutorials unlocked at 45% curriculum completion
- AI-generated detailed instructions for each step
- XP rewards per step with Builder badge on completion

### 💼 Job Matching (Real Algorithm)
- Jobs based on skills you'll **acquire after** completing the curriculum
- **Real match percentage** calculated server-side:
  - `matchPercentage = (fuzzy matched skills / required skills) × 100`
  - Supports exact, substring, and word-overlap matching
- Sorted by best match; filtered by remote/onsite/hybrid/trending

### 🤝 Peer-to-Peer Mentorship
- AI-matched mentor profiles based on your learning path
- Match scores, ratings, and expertise tags
- Connect button for mentorship requests

### 🎮 Gamification
- **XP System** — Earn XP for completing modules and project steps
- **Levels** — Level up every 500 XP
- **Streaks** — Daily learning streak tracking
- **Badges** — 6 earnable badges (First Lesson, 5 Lessons, Streaks, Level 5, Builder)
- Confetti animations on achievements

### 🪙 Token Usage Tracking
- Per-feature token breakdown (quiz, curriculum, lesson, jobs, mentors)
- Prompt vs completion token split
- Estimated cost display
- API call count tracking
- Comprehensive caching to minimize token usage

---

## 🏗️ Tech Stack

| Layer | Technology |
|---|---|
| Frontend | **Vite** + **Vanilla JavaScript** (SPA with hash routing) |
| Styling | Custom CSS — dark mode, glassmorphism, animations, particles |
| Backend | **Node.js** + **Express** |
| Database | **SQLite** (better-sqlite3) |
| AI/LLM | **Google Gemini Flash** via **OpenRouter API** |
| Fonts | Inter + JetBrains Mono (Google Fonts) |
| Syntax | PrismJS for code highlighting |

---

## 📁 Project Structure

```
Skill2Hire/
├── index.html                 # Entry point
├── package.json               # Dependencies & scripts
├── vite.config.js             # Vite dev server proxy
├── .env                       # API key (not committed)
│
├── server/
│   ├── index.js               # Express server (port 3001)
│   ├── db.js                  # SQLite schema (8 tables)
│   ├── llm.js                 # OpenRouter client + token logging
│   └── routes/
│       ├── auth.js            # Registration & profile
│       ├── quiz.js            # Quiz generation & evaluation
│       ├── curriculum.js      # Curriculum + lesson streaming (SSE)
│       ├── project.js         # Project generation & steps
│       ├── jobs.js            # Job matching with real algorithm
│       ├── mentors.js         # Mentor profile generation
│       └── stats.js           # Dashboard stats & token usage
│
└── src/
    ├── main.js                # SPA router + session management
    ├── api.js                 # HTTP client + SSE stream handlers
    ├── style.css              # Design system (800+ lines)
    ├── pages/
    │   ├── landing.js         # Hero page with particle background
    │   ├── onboarding.js      # Registration + goal + portfolio
    │   ├── quiz.js            # 10-question AI assessment
    │   ├── analysis.js        # Skill gap radar chart
    │   ├── dashboard.js       # Gamified learning hub
    │   ├── lesson.js          # Streamed AI lesson content
    │   ├── project.js         # Step-by-step project tutorial
    │   ├── jobs.js            # Skill-matched job listings
    │   └── mentors.js         # Peer mentorship page
    └── utils/
        ├── particles.js       # Canvas particle animation
        ├── charts.js          # Radar chart + progress ring
        └── gamification.js    # XP, levels, badges, confetti
```

---

## 🚀 Getting Started

### Prerequisites
- **Node.js** v18+
- **npm** v9+
- **OpenRouter API Key** ([get one here](https://openrouter.ai/settings/keys))

### Installation

```bash
# 1. Clone the repository
git clone https://github.com/bhumiC-107/Skill2Hire.git
cd Skill2Hire

# 2. Install dependencies
npm install

# 3. Create .env file
echo "OPENROUTER_API_KEY=your_api_key_here" > .env
echo "PORT=3001" >> .env

# 4. Start the development server
npm run dev
```

This runs both the **Express backend** (port 3001) and **Vite frontend** (port 5173) concurrently.

### Open the app
Navigate to **http://localhost:5173/** in your browser.

---

## 🔄 User Flow

```
Landing → Onboarding → Quiz (AI) → Analysis → Dashboard
                                                  ↓
                                    Lessons → Project → Jobs
                                                  ↓
                                              Mentors
```

1. **Landing** — Click "Start Your Journey"
2. **Onboarding** — Enter name, email, type/pick a goal, optionally share GitHub/code
3. **Quiz** — Answer 10 AI-generated MCQ questions
4. **Analysis** — View skill gap radar chart, strengths, weaknesses
5. **Dashboard** — Your gamified curriculum with XP, badges, token usage
6. **Lessons** — Click modules to stream AI-generated lesson content
7. **Project** — Unlocks at 45% progress (if opted in)
8. **Jobs** — View skill-matched job opportunities
9. **Mentors** — Connect with AI-matched mentors

---

## 🪙 Token Optimization

| Strategy | Savings |
|---|---|
| Gemini Flash model | ~100x cheaper than Claude |
| Quiz result caching | ~1400 tokens/revisit |
| Curriculum caching | ~1200 tokens/revisit |
| Lesson caching (per module) | ~2500 tokens/revisit |
| Jobs caching | ~1500 tokens/revisit |
| Reduced max_tokens (2000/2500) | Prevents over-generation |
| Condensed evaluation prompts | ~60% smaller prompts |

---

## 📊 Database Schema

8 tables: `users`, `quiz_results`, `curricula`, `progress`, `lesson_cache`, `project_steps`, `jobs_cache`, `token_usage`

All LLM token usage is logged per feature with prompt/completion breakdown for cost monitoring.

---

## 🔧 API Endpoints

| Method | Endpoint | Description | LLM |
|---|---|---|---|
| POST | `/api/auth/register` | Register user | ❌ |
| GET | `/api/auth/user/:id` | Get user profile | ❌ |
| PUT | `/api/auth/user/:id/goal` | Update goal | ❌ |
| POST | `/api/quiz/generate` | Generate quiz | ✅ |
| POST | `/api/quiz/submit` | Evaluate answers | ✅ |
| POST | `/api/curriculum/generate` | Generate curriculum | ✅ |
| POST | `/api/curriculum/lesson` | Stream lesson (SSE) | ✅ |
| POST | `/api/curriculum/complete-module` | Complete module | ❌ |
| POST | `/api/project/generate` | Generate project | ✅ |
| POST | `/api/project/step-detail` | Stream step (SSE) | ✅ |
| POST | `/api/jobs/generate` | Generate + match jobs | ✅ |
| POST | `/api/mentors/generate` | Generate mentors | ✅ |
| GET | `/api/stats/:userId` | Dashboard stats | ❌ |

---

## 📄 License

This project is for educational purposes.

---

**Built with ❤️ by Bhumika**
