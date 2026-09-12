# Briefly — Canva-Ready Hackathon Deck

This deck is based on the current repo for HackCMU-ClosedML and is designed for a fast, polished presentation. It reflects what the app already does today, while clearly separating built features from the future roadmap.

---

## Slide 1 — Title

### Title
Briefly
Personalized daily news, shaped by you

### Subtitle
HackCMU 2026 — A daily audio briefing that learns what matters to each listener

### Suggested Canva layout
- Background: dark navy / teal gradient
- Left: large headline and subtitle
- Right: mockup of the Briefly onboarding or feed UI
- Accent colors: teal, white, soft yellow

### Speaker note
“Briefly is a personalized daily news briefing that turns a listener’s location, interests, teams, stocks, and follows into a tailored 10-minute news experience. The core idea is simple: instead of reading a generic feed, each user gets a briefing built around what they actually care about.”

---

## Slide 2 — The problem

### Title
The problem: news is crowded, noisy, and one-size-fits-all

### Bullets
- People are overwhelmed by endless headlines from every category
- Most news apps reward engagement, not relevance
- A commuter, a parent, or a sports fan do not want the same briefing
- Over time, users need a system that adapts to their changing interests

### Suggested visual
- Split screen: generic news feed vs. personalized briefing
- Add small icons for noise, overload, and personalization

### Speaker note
“Today’s news products are built for broad audiences. That means generic feeds, noisy headlines, and little context about what a person actually cares about. Briefly solves that by building a news experience around each listener’s profile.”

---

## Slide 3 — What Briefly does

### Title
Briefly turns profile signals into a custom briefing

### Bullets
- Uses a listener’s city, country, interests, sports teams, watchlist, and followed entities
- Builds a feed of recent headlines from Google News RSS
- Curates stories by category and relevance
- Learns from explicit thumbs-up / thumbs-down feedback
- Prepares the foundation for a voice-based daily audio briefing

### Suggested visual
- Flow diagram: Profile inputs → News queries → Ranked feed → Feedback loop

### Speaker note
“This is not just a feed. It is a personalization system. Briefly combines onboarding preferences, search-based news retrieval, and a lightweight learning loop so the experience gets better over time.”

---

## Slide 4 — Onboarding experience

### Title
Start with a profile, not a generic feed

### Bullets
- Create an account and sign in securely
- Choose interests from 68 topics across 8 categories
- Add home city, country, sports teams, stock symbols, people, companies, and excluded topics
- Save profile and instantly view a personalized feed

### Suggested visual
- Screenshot of onboarding card with fields and interest picker
- Use labels like city, teams, watchlist, interests, exclusions

### Speaker note
“The first step is onboarding. Briefly asks for the information needed to understand a user’s context: where they live, what they care about, what they follow, and what they want to avoid. That profile becomes the foundation of every briefing.”

---

## Slide 5 — Personalized feed generation

### Title
The feed is built from real-time news, not static recommendations

### Bullets
- Builds one or more Google News queries per profile group
- Searches places, sports, markets, following, and interests separately
- Combines results into a curated feed
- Filters out excluded topics and duplicate stories
- Balances categories so one topic does not dominate the whole briefing

### Suggested visual
- Diagram showing query groups:
  - Places
  - Sports
  - Markets
  - Following
  - Interests
- Under each, show sample query terms

### Speaker note
“The feed is generated from actual headline search queries, not from a fixed database. That gives the product freshness and real-world coverage. It also means the system can adapt to current events while staying grounded in each user’s preferences.”

---

## Slide 6 — Learning from user feedback

### Title
Briefly learns what users want, then re-ranks the feed

### Bullets
- Users can mark stories as More like this or Less like this
- Feedback is stored per account
- The app retrains a bounded per-user logistic regression model using headline words, categories, and publishers
- Recent votes are blended with the original feed ordering
- Reset learning restores the original feed state

### Suggested visual
- Before vs. after feed order chart
- Small badges showing “More like this,” “Less like this,” and “Undo”

### Speaker note
“This is where Briefly becomes more than a recommender. It learns from explicit feedback. The model is lightweight, fast, and per-user, so it adapts to changing tastes without requiring a separate ML service or external API.”

---

## Slide 7 — Current architecture

### Title
Built as a full-stack product, not just a mockup

### Bullets
- Next.js application with account onboarding and protected routes
- MongoDB-backed profiles and feed learning history
- Signed-in session authentication and secure profile management
- Protected ElevenLabs voice endpoint for future audio narration
- News API with profile-aware caching and graceful fallback behavior

### Suggested visual
- System architecture with boxes:
  - Frontend
  - Auth + profiles
  - News pipeline
  - Feed learning model
  - Voice layer
  - MongoDB

### Speaker note
“The repo already includes the building blocks of a real product: secure login, persistent profile storage, news retrieval, caching, and a learning layer. It is a strong prototype that shows both product design and technical depth.”

---

## Slide 8 — What makes Briefly different

### Title
Why this is compelling for a hackathon

### Bullets
- Personalization is built into the product from day one
- The system uses real, fresh news instead of static content
- Feedback directly changes ranking in the current feed
- It respects profile constraints like excluded topics and watchlists
- It has a clear roadmap to voice-based daily briefings

### Suggested visual
- Three-column layout: Personalization, Freshness, Learning

### Speaker note
“The differentiator is not just AI—it is the combination of real-world news, personal profile signals, and a feedback loop that makes the product improve with use. That gives Briefly a path from prototype to product.”

---

## Slide 9 — Demo flow

### Title
How we would demo it live

### Bullets
1. Sign up or sign in
2. Choose interests, city, teams, and watchlist
3. Save profile and open the personalized feed
4. Show category filters and story explanations
5. Give feedback on one or two stories
6. Refresh feed and show re-ranked headlines
7. Highlight the voice/audio foundation as the next step

### Suggested visual
- 6-step horizontal timeline with screenshots or UI blocks

### Speaker note
“In a live demo, we can show the real user journey end-to-end: profile setup, generated feed, and ranking changes after feedback. That makes the value of the product clear in under five minutes.”

---

## Slide 10 — Roadmap / honest scope

### Title
What is already built vs. what is next

### Built today
- Account creation and sign-in
- Personalized onboarding
- Feed generation from Google News RSS
- Per-user learning and feedback
- Profile-aware caching and secured APIs

### Next steps
- Finish the audio briefing pipeline
- Add story summarization and polished voice narration
- Improve ranking quality with richer features
- Add notification scheduling and daily brief delivery

### Suggested visual
- Two-column card layout labeled “Built now” and “Next”

### Speaker note
“It is important to be transparent: the current build already covers personalization, feed generation, and learning. The audio experience is conceptually ready, but the actual generation and playback of the daily spoken brief is the next major milestone.”

---

## Slide 11 — Closing

### Title
Briefly is a product that learns with the user

### Subtitle
A personalized daily news briefing that feels like it was made for you

### Final CTA
- “We built a strong prototype for a real-world problem”
- “We are ready to take it from news curation to daily audio briefing”

### Speaker note
“Briefly brings together personalization, news retrieval, and lightweight machine learning in one cohesive product. It is a strong example of how a hackathon project can feel credible, useful, and ready to scale.”

---

# Quick Canva Notes

## Recommended design system
- Primary colors: deep navy (#071A1F), teal (#2DD4BF), soft white (#F8FAFC)
- Accent: warm yellow for highlights
- Use rounded cards, generous whitespace, and a modern dashboard aesthetic
- Keep slide text concise and use 1–2 sentences per bullet block

## Suggested font pairing
- Headline: Sora, Poppins, or Manrope
- Body: Inter or DM Sans

## Presentation style
- Aim for 10–12 slides total
- Keep each slide to 3–5 bullets max
- Use one strong visual per slide
- Use the product UI screenshots from the repo as visual anchors when possible

---

# Short 60-second pitch script

“Briefly is a personalized daily news briefing that turns a user’s interests, location, teams, watchlist, and follow lists into a tailored feed. Instead of forcing everyone through the same news stream, Briefly asks for a profile up front and uses that to generate relevant stories from Google News, then learns from feedback like More like this and Less like this. The app already includes account creation, profile storage, personalized feed generation, feedback-driven ranking, and a protected voice endpoint for future audio narration. In short, Briefly is a full-stack prototype for a smarter, more human news experience.”

---

# Optional title options

1. Briefly — Personalized Daily News, Built for You
2. Briefly — News That Learns Your Taste
3. Briefly — A Daily Audio Briefing That Adapts to You
4. Briefly — The News Feed That Gets Better Over Time
