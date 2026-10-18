# Admin UI — stages 1 and 2

Routes: `/admin/login` (login), `/admin` (protected review list).
Other routes keep the existing application behavior. The guest form is not
implemented by this stage. Navigation uses normal page loads and requires the
SPA fallback already configured in `frontend/vercel.json`.

Run `npm ci` and `npm run dev` from `frontend/`, then open
`http://localhost:5173/admin`. The API defaults to `http://localhost:3000/api`.
Copy `frontend/.env.example` to `frontend/.env.local` to override `VITE_API_URL`,
then restart Vite. Backend, PostgreSQL, Redis and a seeded admin must be available
for a real login (see the root README).

The token is stored in sessionStorage; passwords are never stored by the app.
The existing protected `/stats` endpoint validates access before displaying the
shell because the backend has no `/auth/me`. A 401 clears the session; network
errors allow retrying. Token expiry is checked while the page is open and when
the window regains focus. JWT decoding only schedules expiry; the backend
validates signatures and controls access to venue data.

`api.ts` handles requests, `session.ts` manages the token, and `AdminApp.tsx`
contains login and the protected shell. Styles are scoped to `.admin-app`.
No router or other runtime dependency was added.

Checks from `frontend/` (Node 24+):

```sh
npm run lint
npm run build
node --test tests/admin-session.test.mjs
```

Acceptance checks: direct `/admin` access without a token; invalid credentials;
successful login; refresh; logout; expired token; server 401; unavailable API and
retry; mobile layout and keyboard navigation. Browser checks with mocked API
responses do not verify the real database or backend authentication.

`ReviewsPage.tsx` displays `/reviews` in pages of 20, with rating, comment, local
date/time, sentiment, aspect quotes, critical flags and analysis status.
Missing analysis is not interpreted as neutral. Page changes unmount the old
request, abort it and ignore late responses. Errors support retry; a review API
401 clears the session. `reviews.ts` defines API types and Ukrainian labels.

Optional browser regression checks require an existing Playwright installation
and Chromium (no new application dependencies are required). Start Vite, then run:

```sh
node tests/admin-reviews.browser.mjs
```

If Playwright is installed outside the project, set `PLAYWRIGHT_MODULE` to its
absolute module path. `BROWSER_EXECUTABLE` optionally selects a Chrome executable;
`TEST_BASE_URL` defaults to `http://127.0.0.1:5173`. These tests mock the API and
cover statuses, null fields, escaped comments, pagination, retry, empty data,
mobile overflow and a 401 redirect. They do not verify live backend responses.

Statistics cards, automatic refresh and QR controls belong to subsequent stages.
