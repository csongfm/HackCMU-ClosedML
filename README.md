# Briefly

Briefly turns a listener's location, interests, teams, and stock watchlist into a personalized ten-minute audio news briefing.

## Included foundation

- One-page account creation, sign-in, and onboarding experience
- Password hashing and HTTP-only signed sessions
- MongoDB-backed user accounts and listener profiles
- Protected ElevenLabs text-to-speech endpoint
- Responsive briefing preview that reacts to onboarding choices
- 68 interests in eight categories, searchable selection, and custom topics (up to 20 selected)
- Up to 25 stock symbols, with automatic capitalization and duplicate removal
- Multiple sports teams (15), home country, and extra cities/regions/countries (5)
- Follow companies/organizations (15) and public figures (15), and exclude subjects (10)
- Existing single-team profiles automatically load into the new team list
- Personalized `/feed` with real Google News RSS headlines, source links, category filters, and selection explanations
- Authenticated news API with a 15-minute, profile-aware MongoDB cache (one feed document per account)

## Setup

1. Copy `.env.example` to `.env.local`.
2. Add a MongoDB Atlas connection string.
3. Generate an `AUTH_SECRET` with `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"` and put it in `.env.local`. Keep an existing generated secret.
4. Add your ElevenLabs API key and voice ID.
5. Run `npm run dev`.

The ElevenLabs endpoint accepts one script section at a time at `POST /api/voice`. The news pipeline should generate and synthesize sections separately, then assemble or play them as briefing chapters.

Run `npm test` for preference validation checks. The browser and profile API share the same interest and stock limits; excess entries are rejected instead of silently discarded. X imports are not included and need no X API credentials.

## Personalized news

Save your preferences to open `/feed`, or use **My feed** from onboarding. No extra news API key is needed. The server sends interest/place/watchlist search terms (not account details) to Google News RSS. Headlines are English-language, from the last 72 hours; searches and category balancing are heuristic. Exclusions match headline text only. News source outages show an error or a clearly labeled saved feed from the same preferences. Audio script generation and playback are not implemented yet.

Run `npm.cmd test` for preference and news-pipeline tests, and `npm.cmd run build` to verify production compilation.

## Teach my feed

Each headline has **More like this**, **Less like this**, and **Undo** controls. Feedback is saved to the signed-in account and the current feed is reranked in the response, without waiting for the RSS cache to expire. **Reset learning** clears the learned history while preserving the saved profile.

The server trains a per-user logistic regression model with stochastic gradient descent on normalized headline-word, category, and publisher features. The latest 200 distinct rated stories are stored in one `feedLearning` MongoDB document per account. Changing a vote replaces that story's training example; Undo removes it. The model is refit from the bounded history, so removed votes leave no residual weights. Atomic updates preserve votes from concurrent tabs. Only stories in the account's current cached feed can be rated; feature data is built server-side.

Learned relevance is blended with a small prior from the original freshness/category ordering. Feedback affects both the current feed and future fetched feeds; retrieval still uses the saved interests and exclusions. This model learns keyword similarity, not full-article semantics, and does not guarantee that each vote changes the visible order. It needs no new API key or ML service. `npm test` includes held-out-headline ranking, negative-feedback, reset, and deterministic-retraining checks.

## Account setup troubleshooting

The app reads `.env.local`; `.env.example` is only a template. Account creation and sign-in need both `MONGODB_URI` and `AUTH_SECRET`. ElevenLabs credentials are not required for accounts.

If the development screen asks for `MONGODB_URI`, paste your complete MongoDB connection string into `.env.local`, then restart with `npm.cmd run dev` in PowerShell. Do not overwrite an already configured `.env.local` by copying the example again.
