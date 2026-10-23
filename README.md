# FeedbackAnalytics

Platform that collects structured guest feedback for service businesses (cafes,
clinics, salons, shops). A guest scans a QR code, leaves a rating + comment with
no login; an async pipeline classifies sentiment and aspects, flags critical
reviews, and alerts the manager on Telegram in under a minute.

Team: Лорман Світлана, Гапоненко Єлизавета, Шин Дарія.
Lab: Об'єктно-орієнтований аналіз — лабораторна робота №1.

This repo implements the C4 design from the lab: the **Backend API** and the
**analysis worker** live in `backend/` (NestJS); the **React SPA** lives in
`frontend/`.

---

## Architecture to the code map

The backend follows the L4 class diagrams one-to-one.

| C4 component (L3/L4)        | File                                                     |
| --------------------------- | -------------------------------------------------------- |
| FeedbackController          | `backend/src/feedback/feedback.controller.ts`            |
| CreateFeedbackDto           | `backend/src/feedback/dto/create-feedback.dto.ts`        |
| FeedbackService             | `backend/src/feedback/feedback.service.ts`               |
| QrService / QrContext       | `backend/src/feedback/qr.service.ts`, `qr.context.ts`    |
| AnalysisTaskDispatcher      | `backend/src/feedback/analysis-task-dispatcher.ts`       |
| FeedbackRepository          | `backend/src/feedback/feedback.repository.ts`            |
| AuthController / AuthService| `backend/src/auth/`                                      |
| AdminController             | `backend/src/admin/admin.controller.ts`                  |
| StatisticsService           | `backend/src/admin/statistics.service.ts`                |
| FeedbackAnalysisProcessor   | `backend/src/analysis/feedback-analysis.processor.ts`    |
| TextPreprocessor            | `backend/src/analysis/text-preprocessor.ts`              |
| SentimentClassifier         | `backend/src/analysis/sentiment-classifier.ts`           |
| AspectExtractor             | `backend/src/analysis/aspect-extractor.ts`               |
| CriticalityDetector         | `backend/src/analysis/criticality-detector.ts`           |
| AnalysisResultRepository    | `backend/src/analysis/analysis-result.repository.ts`     |
| LlmGateway + Gemini/Groq    | `backend/src/analysis/llm/`                              |
| AlertDispatcher             | `backend/src/notifications/alert-dispatcher.ts`          |
| TelegramService             | `backend/src/notifications/telegram.service.ts`          |
| types.ts (value objects)    | `backend/src/analysis/types.ts`                          |
| Feedback model + status     | `backend/prisma/schema.prisma`                           |

**Stack:** NestJS · Prisma · PostgreSQL · Redis + BullMQ · JWT · Telegram Bot
API · Gemini/Groq (with a built-in mock so it runs with no API keys).

**Note on processes:** the design shows the API and the analysis worker as two
containers. To stay on free hosting we run the BullMQ worker *in-process* with
the API (controlled by `RUN_WORKER`). To split them later, deploy a second
service with `RUN_WORKER=true` and set it to `false` on the web service.

---

## REST API (for the frontend)

Base URL: `<backend>/api`

| Method | Path            | Auth   | Body / query                                  | Returns |
| ------ | --------------- | ------ | --------------------------------------------- | ------- |
| GET    | `/health`       | –      | –                                             | `{ status, service, timestamp }` |
| POST   | `/feedback`     | –      | `{ qrToken, rating (1–5), comment? }`         | `{ id, createdAt }` |
| POST   | `/auth/login`   | –      | `{ email, password }`                         | `{ accessToken }` |
| GET    | `/reviews`      | Bearer | `?page=1&pageSize=20`                          | paginated reviews w/ sentiment + aspects |
| GET    | `/stats`        | Bearer | –                                             | `{ totalFeedback, averageRating, criticalCount }` |
| GET    | `/qr`           | Bearer | `?table=<label>`                              | `{ token, url }` to build the guest QR |

Admin routes need `Authorization: Bearer <accessToken>`.

---

## Local development

Prereqs: Node 22+, Docker (for Postgres + Redis).

```bash
# 1. start Postgres + Redis
docker compose up -d

# 2. backend
cd backend
cp .env.example .env            # defaults already point at the compose services
npm install
npx prisma generate
npm run db:push                 # create tables from schema.prisma
npm run prisma:seed             # create demo venue + admin (admin@example.com / admin12345)
npm run start:dev               # http://localhost:3000/api/health

# 3. frontend (separate terminal)
cd ../frontend
npm install
npm run dev                     # http://localhost:5173
```

Try the flow without a frontend:

```bash
# mint a QR token (login first to get a bearer token)
TOKEN=$(curl -s localhost:3000/api/auth/login -H 'content-type: application/json' \
  -d '{"email":"admin@example.com","password":"admin12345"}' | jq -r .accessToken)
QR=$(curl -s localhost:3000/api/qr -H "authorization: Bearer $TOKEN" | jq -r .token)

# submit a (critical) review as a guest
curl -s localhost:3000/api/feedback -H 'content-type: application/json' \
  -d "{\"qrToken\":\"$QR\",\"rating\":1,\"comment\":\"Dirty table and rude staff\"}"

# see it analyzed
curl -s localhost:3000/api/reviews -H "authorization: Bearer $TOKEN" | jq
```

With no LLM key set (`LLM_PROVIDER=mock`) the pipeline uses a keyword heuristic,
so everything works offline. Set `LLM_PROVIDER=gemini` + `GEMINI_API_KEY` (or
`groq` + `GROQ_API_KEY`) for real analysis, and `TELEGRAM_BOT_TOKEN` +
`TELEGRAM_CHAT_ID` for real alerts.

---

## Deployment

### Backend → Render (free)

The whole backend (web service + PostgreSQL + Redis) is described in
[`render.yaml`](./render.yaml).

1. Push this repo to GitHub.
2. Render → **New → Blueprint** → select the repo. It provisions `feedback-db`,
   `feedback-redis` and the `feedback-backend` web service.
3. In the service's **Environment**, set the `sync:false` vars:
   `CORS_ORIGINS` (your Vercel URL), `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD`,
   and optionally the LLM/Telegram keys.
4. First deploy runs `prisma db push` automatically. Seed the admin once from
   the Render shell: `npm run prisma:seed`.

Health check: `/api/health`. `JWT_SECRET` and `QR_SIGNING_SECRET` are generated
by Render.

### Frontend → Vercel (free)

1. Vercel → **New Project** → import the repo, set **Root Directory** to
   `frontend`. Framework auto-detects Vite ([`vercel.json`](./frontend/vercel.json)).
2. Add env var `VITE_API_URL=https://feedback-backend.onrender.com/api`.
3. Add the resulting Vercel URL to the backend's `CORS_ORIGINS`.

---

## CI/CD

[`.github/workflows/ci.yml`](./.github/workflows/ci.yml) runs on every push/PR to
`main`:

- **backend** — `npm ci` → `prisma generate` → `lint` → `build` → unit tests
- **frontend** — `npm ci` → `lint` → `build`

**CD** is git-driven: Render (`autoDeploy: true`) and Vercel both redeploy on
push to `main`, after CI passes. No secrets needed in GitHub for deploys.
