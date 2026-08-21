# Milestone 3X: Multi-Provider Auth (OAuth + Passkeys)

## Goal
Allow users to authenticate with Twitter/X, Reddit, Google, Apple, generic OpenID Connect, and WebAuthn passkeys — in addition to existing local auth.

## Prerequisites
- Milestone 3 complete (local signup/login, sessions, captcha all working)
- `users` table has `oidc_sub` + `oidc_issuer` columns (already exists from M2)

## Provider-Specific Notes

| Provider | Protocol | Token Endpoint | User Info | Key Quirks |
|----------|----------|---------------|-----------|------------|
| **Twitter/X** | OAuth 2.0 PKCE | `https://api.twitter.com/2/oauth2/token` | `GET /2/users/me` | Returns `{data:{id,name,username}}`. Scopes: `tweet.read users.read offline.access`. No email by default. |
| **Reddit** | OAuth 2.0 PKCE | `https://www.reddit.com/api/v1/access_token` | `GET /api/v1/me` | Must set custom `User-Agent` header or get 429. Returns `{name,id}`. Scopes: `identity`. Duration param required (`duration=temporary`). |
| **Google** | OIDC | Standard OIDC discovery | ID token contains sub/name/email | Straightforward OIDC. `nonce` recommended. |
| **Apple** | OIDC (form_post) | `https://appleid.apple.com/auth/token` | ID token only (first login includes name/email) | Response mode is `form_post` (POST callback). `client_secret` is a signed JWT generated from team key. Name only returned on first auth. |
| **Generic OIDC** | OIDC | Discovery via issuer URL | ID token + optional userinfo endpoint | Configurable via env vars. Fallback for any OIDC provider. |
| **Passkeys** | WebAuthn | N/A | N/A | Server generates challenges, verifies attestations/assertions with Web Crypto. Multiple credentials per user. |

## Architecture

### Users Table
Existing `users` table stays as-is. `oidc_sub` + `oidc_issuer` handles all OAuth/OIDC providers:
- Twitter: `sub` = user id string, `issuer` = `"twitter"`
- Reddit: `sub` = account id, `issuer` = `"reddit"`
- Google/Apple/Generic: `sub` and `issuer` from OIDC claims

Passkeys need a new `passkey_credentials` table (multiple credentials per user).

### No Third-Party Auth Libraries
All flows use raw HTTP calls + Deno Web Crypto API. Per project minimalism rules.

### Unified Endpoints
One authorize/callback pair handles all OAuth providers; provider name selects config. Passkeys have separate register/authenticate endpoints.

### PKCE Everywhere
All OAuth providers use PKCE. Twitter and Reddit require it. Google/Apple support it.

### Account Creation Strategy
OAuth login → look up by `(oidc_sub, oidc_issuer)` → if found, log in → if not, create new user with auto-generated username from profile. Username collisions resolved by appending provider suffix or random digits. No manual account linking UI yet.

## Deliverables

### 1. DB Migration — Passkey Credentials (`/db/migrations/015_create_passkey_credentials.sql`)

```sql
CREATE TABLE passkey_credentials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  credential_id bytea NOT NULL UNIQUE,
  public_key bytea NOT NULL,
  sign_count bigint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_passkey_credentials_user_id ON passkey_credentials(user_id);
```

### 2. Provider Config + Types (`/api/auth/providers.ts`)

Define `OAuthProvider` interface:
- `name`, `authUrl`, `tokenUrl`, `userInfoUrl`
- `scopes`, `clientId`, `clientSecret`
- `responseMode` (`query` | `form_post`)
- `tokenEndpointAuthMethod` (`client_secret_post` | `client_secret_basic`)
- `parseUserInfo(response)` → `{ sub, name?, username?, email? }`

Built-in configs for twitter, reddit, google, apple, generic. Read per-provider env vars. Only configured providers are available.

### 3. OAuth Authorize (`/api/auth/oauth.ts`)

**GET /api/auth/oauth/authorize?provider=twitter|reddit|google|apple|generic**

1. Look up provider config by name
2. Generate PKCE `code_verifier` (random 43-128 chars) and `code_challenge` (S256)
3. Generate random `state`
4. Store hashed `code_verifier` + `state` in short-lived cookie (10 min expiry)
5. Build authorization URL with provider-specific params (scopes, response_type, PKCE challenge, redirect_uri)
6. Redirect to provider

### 4. OAuth Callback (`/api/auth/oauth.ts`)

**GET /api/auth/oauth/callback** (or POST for Apple `form_post`)

1. Validate `state` matches cookie
2. Exchange authorization code for tokens using PKCE `code_verifier`
3. For OIDC providers (Google, Apple, generic): verify ID token signature via JWKS
4. For Twitter/Reddit: call user info API with access token
5. Extract `{ sub, name, username, email }` from provider response
6. Upsert user: match on `(oidc_sub, oidc_issuer)`, update name if changed, create if new
7. Handle username collisions (append `_twitter`, `_reddit`, etc.)
8. Create session, set cookie, redirect to frontend

### 5. JWT/JWKS Verification (`/api/auth/jwks.ts`)

- Fetch JWKS from OIDC issuer's `/.well-known/jwks.json`
- Verify ID token signature (RS256/ES256) using Web Crypto `importKey` + `verify`
- Validate standard claims: `iss`, `aud`, `exp`, `iat`
- Used by Google, Apple, generic OIDC. Not needed for Twitter/Reddit.

### 6. Passkey Registration (`/api/auth/passkey.ts`)

**POST /api/auth/passkey/register** (authenticated — requires existing session)

1. Generate `PublicKeyCredentialCreationOptions` with RP name/id, user info, supported algorithms
2. Store challenge in short-lived cookie
3. Client returns attestation object (base64url-encoded)
4. Parse attestation, verify with Web Crypto, extract credential ID + public key
5. Insert into `passkey_credentials` table

### 7. Passkey Authentication (`/api/auth/passkey.ts`)

**POST /api/auth/passkey/authenticate** (unauthenticated)

1. Client sends credential ID
2. Look up credential in DB, generate `PublicKeyCredentialRequestOptions` with stored challenge
3. Client returns assertion (base64url-encoded)
4. Verify signature against stored public key, check sign_count > stored value
5. Update sign_count in DB
6. Create session, set cookie

### 8. Router Wiring + Config Updates

Wire into `main.ts`:
```
GET  /api/auth/oauth/authorize    → redirect to provider
GET  /api/auth/oauth/callback     → handle OAuth return (POST for Apple)
POST /api/auth/passkey/register   → register new passkey (auth required)
POST /api/auth/passkey/authenticate → login with passkey
```

Update `config.ts` with optional per-provider env vars.

### 9. Tests

- `tests/auth_oauth_test.ts` — PKCE generation, state validation, provider config resolution
- `tests/auth_passkey_test.ts` — challenge generation, credential storage/retrieval
- Manual integration test against real providers (documented curl/browser flow)

### 10. Frontend Auth Page Updates (Capture)

- Add OAuth buttons for each configured provider on login/signup pages
- Add passkey login button on login page
- Add passkey registration in settings/profile area
- Handle OAuth redirect return + error states

## Environment Variables

All optional — only configured providers appear as login options:

```bash
# Twitter/X
TWITTER_CLIENT_ID=...
TWITTER_CLIENT_SECRET=...

# Reddit
REDDIT_CLIENT_ID=...
REDDIT_CLIENT_SECRET=...

# Google
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...

# Apple
APPLE_CLIENT_ID=...          # Service ID (e.g., com.example.signin)
APPLE_TEAM_ID=...            # Apple Developer Team ID
APPLE_KEY_ID=...             # Key ID for Sign in with Apple
APPLE_PRIVATE_KEY=...        # PEM-encoded private key (or path)

# Generic OIDC (optional, extends existing vars)
OIDC_ISSUER_URL=...
OIDC_CLIENT_ID=...
OIDC_CLIENT_SECRET=...

# Shared
OAUTH_REDIRECT_URI=http://localhost:8000/api/auth/oauth/callback
```

## API Summary

```
GET    /api/auth/oauth/authorize?provider=X   → redirect to provider
GET    /api/auth/oauth/callback               → OAuth callback (GET)
POST   /api/auth/oauth/callback               → OAuth callback (Apple form_post)
POST   /api/auth/passkey/register              → register passkey (auth required)
POST   /api/auth/passkey/authenticate           → login with passkey
```

Plus existing endpoints unchanged: `/api/auth/captcha`, `/api/auth/signup`, `/api/auth/login`, `/api/auth/me`, `/api/auth/logout`.

## Out of Scope
- Account linking/merging UI
- Email verification (providers already verified)
- Token refresh / long-lived OAuth tokens
- Profile pictures/avatars
- Twitter/Reddit API access beyond identity

## Constraints
- No third-party auth libraries. Raw HTTP + Web Crypto only.
- All DB queries use parameterized statements.
- Memory-conscious: no caching layers except brief JWKS cache (TTL ~1hr).
- Passkeys require HTTPS in production (localhost fine for dev).
