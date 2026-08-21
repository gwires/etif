# Milestone 3: Auth

## Goal
Implement authentication: OIDC OAuth, local signup with custom captcha, session management.

## Prerequisites
- Milestone 2 complete (all DB tables exist)
- Deno backend running (basic HTTP server scaffolded)

## Architecture
All auth lives in `/api/auth/` directory within the Deno backend. Sessions use http-only cookies. No JWT — opaque tokens hashed in DB.

## Deliverables

### 1. Captcha System (`/api/auth/captcha.ts`)

**GET /api/auth/captcha** → returns a challenge

Generate simple puzzles server-side. Types:
- Arithmetic: `"What is 7 + 3 * 2?"` → answer `"13"`
- Word logic: `"Which word does not belong: apple, banana, hammer, orange?"` → answer `"hammer"`
- Reverse text: `"Reverse this word: 'planet'"` → answer `"tenalp"`

Store challenge in `captcha_challenges` table with hashed answer (SHA-256). Expiry: 5 minutes. Return `{ id, challenge_data }`. Do NOT return the answer.

**POST /api/auth/captcha/verify** → verify answer (used internally during signup)
- Input: `{ captcha_id, answer }`
- Hash answer, compare to stored hash
- Delete challenge after verification (single-use)
- Return boolean

### 2. Local Signup (`/api/auth/signup.ts`)

**POST /api/auth/signup**
```json
{ "username": "alice", "password": "...", "captcha_id": "uuid", "captcha_answer": "13" }
```

Steps:
1. Verify captcha (call captcha verify internally)
2. Validate username (3-32 chars, alphanumeric + underscore)
3. Validate password (min 8 chars)
4. Hash password with bcrypt (use Deno's `@deno/crypto` or std/hash)
5. Insert into `users` table
6. Create session, set cookie
7. Return `{ user: { id, username }, session_token }` (token also in cookie)

Error cases: captcha expired/wrong, username taken, validation failure → return 400 with message.

### 3. Local Login (`/api/auth/login.ts`)

**POST /api/auth/login**
```json
{ "username": "alice", "password": "..." }
```

Steps:
1. Look up user by username
2. Verify password against hash
3. Create session, set cookie
4. Return user object

### 4. OIDC Flow (`/api/auth/oidc.ts`)

**GET /api/auth/oidc/authorize?provider=generic**
- Read OIDC config from env vars: `OIDC_ISSUER_URL`, `OIDC_CLIENT_ID`, `OIDC_CLIENT_SECRET`, `OIDC_REDIRECT_URI`
- Generate random state, store in a short-lived cookie
- Redirect to `{issuer}/authorize?response_type=code&client_id=...&redirect_uri=...&scope=openid profile&state=...`

**GET /api/auth/oidc/callback?code=...&state=...**
1. Validate state matches cookie
2. Exchange code for tokens at `{issuer}/token`
3. Decode ID token (verify signature using issuer's JWKS from `{issuer}/.well-known/jwks.json`)
4. Extract `sub`, `preferred_username` (or `name`), `iss`
5. Upsert user: match on `(oidc_sub, oidc_issuer)`, update username if changed
6. Create session, set cookie
7. Redirect to `/capture/recent`

Use only Deno std for JWT decoding and crypto. No third-party OIDC libraries.

### 5. Session Management (`/api/auth/session.ts`)

**Session creation:**
- Generate 32-byte random token
- Hash with SHA-256, store hash in `sessions` table
- Set cookie: `session=<raw_token>; HttpOnly; SameSite=Lax; Path=/; Max-Age=604800` (7 days)

**Session validation middleware (`/api/auth/middleware.ts`):**
- Read `session` cookie
- Hash it, look up in `sessions` where `expires_at > now()`
- If valid, attach `user_id` to request context
- If invalid/missing, return 401

**DELETE /api/auth/logout**
- Delete session from DB
- Clear cookie

### 6. Config (`/api/config.ts`)
Read from env vars:
```
DATABASE_URL=postgres://...
SESSION_SECRET=<for signing, optional>
OIDC_ISSUER_URL=...
OIDC_CLIENT_ID=...
OIDC_CLIENT_SECRET=...
OIDC_REDIRECT_URI=http://localhost:5173/auth/callback
PORT=8000
```

## API Summary
```
GET    /api/auth/captcha           → { id, challenge_data }
POST   /api/auth/captcha/verify    → { valid: boolean }
POST   /api/auth/signup            → { user, session }
POST   /api/auth/login             → { user, session }
GET    /api/auth/oidc/authorize     → redirect to provider
GET    /api/auth/oidc/callback      → redirect to app
DELETE /api/auth/logout             → 204
GET    /api/auth/me                 → current user or 401 (uses session middleware)
```

## Verification
```bash
# Get captcha
curl localhost:8000/api/auth/captcha | jq

# Signup
curl -X POST localhost:8000/api/auth/signup \
  -H 'Content-Type: application/json' \
  -d '{"username":"test","password":"testpass123","captcha_id":"...","captcha_answer":"..."}' \
  -v  # check Set-Cookie header

# Me (with session cookie)
curl localhost:8000/api/auth/me -b 'session=...'

# Logout
curl -X DELETE localhost:8000/api/auth/logout -b 'session=...'
```

## Constraints
- No third-party auth libraries. Use Deno std crypto only.
- Password hashing: use bcrypt via Deno std or a minimal implementation. If bcrypt is too heavy, use argon2id via WASM or scrypt. Document choice.
- Session tokens: cryptographically random, never logged, never returned in response body (cookie only). The signup/login responses should NOT include the raw token — it's cookie-only. Fix the deliverable above accordingly.
- All DB queries use parameterized statements (no string interpolation).
- Memory-conscious: no caching layers, query DB directly.
