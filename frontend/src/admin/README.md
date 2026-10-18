# Admin UI — stage 1

Routes: `/admin/login` (login), `/admin` (protected dashboard shell).
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

Reviews, statistics cards and QR controls belong to subsequent stages.
