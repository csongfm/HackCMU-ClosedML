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
- Gemini-generated 80-120 word summaries on every story and selectable 5, 10, or 20-minute transcript previews paced at about 150 spoken words per minute

## Setup

1. Copy `.env.example` to `.env.local`.
2. Add a MongoDB Atlas connection string.
3. Generate an `AUTH_SECRET` with `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"` and put it in `.env.local`. Keep an existing generated secret.
4. Add `GEMINI_API_KEY` from Google AI Studio. `GEMINI_MODEL` defaults to `gemini-flash-latest`.
5. Add your ElevenLabs API key and voice ID.
6. Run `npm run dev`.

The ElevenLabs endpoint accepts one script section at a time at `POST /api/voice`. The news pipeline should generate and synthesize sections separately, then assemble or play them as briefing chapters.

Run `npm test` for preference validation checks. The browser and profile API share the same interest and stock limits; excess entries are rejected instead of silently discarded. X imports are not included and need no X API credentials.

## Personalized news

Save your preferences to open `/feed`, or use **My feed** from onboarding. Discovery uses Google News RSS without a news API key. The server sends interest/place/watchlist search terms—not account details—to Google News RSS. Headlines are English-language and from the last 72 hours; searches and category balancing are heuristic. Gemini generates summaries in batches of eight and personalized transcripts; both are cached in MongoDB to reduce cost and latency. Summary cache IDs include a prompt version, so changing the summary format refreshes old short entries without deleting user data. Set `GEMINI_USE_GOOGLE_SEARCH=true` only when the Google project has Search grounding quota. Audio generation and playback are not connected to the feed yet.

Run `npm.cmd test` for preference and news-pipeline tests, and `npm.cmd run build` to verify production compilation.

## Quiet five-star personalization

Stories have accessible one-to-five-star controls and a Clear action. Ratings save without moving the current cards or showing model progress. After **five distinct stories rated since the last successful fetch**, the client automatically requests fresh news, bypassing the normal 15-minute cache. A failed fetch keeps the existing feed and pending ratings for a retry. Change the batch size with REFRESH_AFTER_RATINGS in lib/feed-learning.ts.

Each account keeps its latest 200 distinct ratings in MongoDB. Atomic replacements preserve concurrent votes. Old likes/dislikes become five/one stars. Only stories in that user's cached feed can be rated; the server builds feature snapshots from the retrieval corpus, never trusting client features. Clearing a rating removes its influence on the next ranked refresh.

The model uses **linear pairwise logistic regression**, following the probabilistic preference approach described in [Microsoft's learning-to-rank overview](https://www.microsoft.com/en-us/research/publication/from-ranknet-to-lambdarank-to-lambdamart-an-overview/). For each unequal-rated pair, its target is 1 if A's stars exceed B's, otherwise 0; equal stars are skipped. The model predicts sigmoid(w dot (featuresA - featuresB)). Rating gaps weight the loss, so 5 vs 1 carries more weight than 4 vs 3. Full-batch gradient descent minimizes regularized binary cross entropy across at most 1,200 pairs. This is a linear model, not the neural RankNet architecture, and fitted weights are not a guarantee of optimal recommendations.

Features:
- **Logarithmic freshness:** 1 / (1 + log(1 + age in hours)), with a strong initial coefficient of 2.5. This drops fastest just after publication; weights can adapt to actual preferences.
- **Keywords:** stopword-filtered headline terms, normalized TF-IDF identities, and an aggregate keyword-salience score. Category and publisher features add context. Keywords describe headlines, not full article semantics.
- **Popularity proxy:** log-scaled number of independent publishers with sufficiently similar headlines in the fetched candidate pool. This measures coverage, not views/shares, and is zero when no additional coverage is observed. It cannot establish global popularity.

Each refreshed retrieval keeps the saved preference searches, adds up to three positively learned keyword searches, applies exclusions and a 72-hour age limit, and collects up to 160 deduplicated candidates. The model selects 40, preferring unrated candidates; it does not generate stories. If publishers return the same stories, a refresh cannot guarantee new headlines. With tied or insufficient ratings, ranking falls back to freshness-first priors. Google News receives search terms, including learned keywords, but no account identity or ratings. No new API key is required.

Tests cover pair labels and gaps, held-out headline preferences, feature-weight learning, logarithmic recency, coverage limits, migration, batch boundaries, validation, and bounded deterministic training.

## Account setup troubleshooting

The app reads `.env.local`; `.env.example` is only a template. Account creation and sign-in need both `MONGODB_URI` and `AUTH_SECRET`. ElevenLabs credentials are not required for accounts.

If the development screen asks for `MONGODB_URI`, paste your complete MongoDB connection string into `.env.local`, then restart with `npm.cmd run dev` in PowerShell. Do not overwrite an already configured `.env.local` by copying the example again.
