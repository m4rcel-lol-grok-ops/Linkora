# Linkora

Linkora is an original social networking platform whose **desktop web UI is intentionally modeled on the late-2014 Twitter.com experience** (post January 2014 lighter redesign and April 2014 profile redesign): compact layout, white top navigation (Home / Connect / Discover / Me), left mini-profile + compose + Who to follow + Trends, reverse-chronological home timeline, 140-character Tweets, Favorites (not Likes), Retweets, and historically styled profiles with large header and overlapping avatar.

**This is not Twitter or X.** Branding, assets, code, and data model are original. Do not use Twitter trademarks, logos, or proprietary assets.

## Features (implemented core)

- Registration / login / logout with Argon2id password hashing and PostgreSQL sessions
- Reverse-chronological home timeline from followed users
- Tweet compose (140 characters) with live counter
- Profiles (2014-style header + avatar + stats + tabs)
- Follow / unfollow, follower & following lists
- Favorite / unfavorite, Retweet / undo
- Mentions & hashtag extraction, basic Trends
- Connect (notifications: follow, favorite, retweet, reply, mention)
- Discover (popular Tweets, suggestions, trends)
- Search (Tweets + people)
- Settings (account, profile, password stubs)
- CSRF protection, Helmet, rate limiting, secure cookies
- Docker Compose (app + PostgreSQL)
- Host Caddy reverse-proxy ready (no Caddy container)

## Requirements

- Node.js 20+
- Docker & Docker Compose (recommended) **or** local PostgreSQL 14+
- Host-installed Caddy for production TLS (optional for local HTTP)

## Quick start with Docker Compose

```bash
cd linkora
cp .env.example .env
# Edit SESSION_SECRET to a long random string

docker compose up -d --build
```

Wait for Postgres health, then run migrations and seed **inside** the app container (or from host if `DATABASE_URL` points at the published port):

```bash
# Using docker exec
docker compose exec linkora node migrations/run.js
docker compose exec linkora node seeds/run.js
```

Open http://localhost:3000

**Seed accounts** (password for all: `password123`):

- `alice`, `bob`, `charlie`, `diana`, `linkora`, `devuser`

## Local development (without Docker for the app)

1. Start PostgreSQL and create database/user matching `.env`.
2. `npm install`
3. `cp .env.example .env` and set `DATABASE_URL` / `SESSION_SECRET`
4. `npm run migrate`
5. `npm run seed`
6. `npm run dev` (or `npm start`)

## Environment

See `.env.example`. Important variables:

| Variable | Purpose |
|----------|---------|
| `NODE_ENV` | `development` / `production` |
| `PORT` | App port (default 3000) |
| `DATABASE_URL` | PostgreSQL connection string |
| `SESSION_SECRET` | Long random secret for signed cookies |
| `BASE_URL` | Public origin (for links / redirects) |
| `TRUST_PROXY` | Set `1` behind Caddy/reverse proxy |
| `UPLOAD_DIR` | Media storage path |
| `MAX_UPLOAD_SIZE` | Bytes |

## Production with host Caddy

The Compose file exposes the Node app on host port **3000**. Caddy on the host should reverse-proxy to it:

```
linkora.example.com {
    reverse_proxy 127.0.0.1:3000
}
```

See `Caddyfile.example`. The app sets `trust proxy`, secure cookies when `NODE_ENV=production`, and does **not** terminate TLS itself.

## Migrations & seeds

```bash
npm run migrate   # applies migrations/*.sql in order
npm run seed      # development sample users & tweets (skips if users exist)
```

## Backups

```bash
# Dump
docker compose exec postgres pg_dump -U linkora linkora > backup-$(date +%Y%m%d).sql

# Restore
cat backup-YYYYMMDD.sql | docker compose exec -T postgres psql -U linkora linkora
```

Also back up the Docker volume `linkora_pgdata` and `linkora_uploads` if using local media storage.

## Project structure

```
src/           Express app, routes, models, middleware
views/         EJS templates (2014-inspired layout)
public/        CSS, JS, images, uploads
migrations/    SQL migrations
seeds/         Dev seed data
Dockerfile     Multi-stage, non-root
docker-compose.yml   linkora + postgres only (no Caddy image)
```

## Security notes

- Passwords: Argon2id
- Sessions: PostgreSQL store, httpOnly, sameSite=lax, secure in production
- CSRF on state-changing form posts
- Helmet CSP (adjusted for inline styles used by the historical UI)
- Rate limits on global traffic and auth/tweet actions
- Parameterized SQL throughout
- Reserved usernames blocked at registration

## Historical UI target

- White top bar: Home, Connect, Discover, Me + logo + search + DM + settings + Tweet
- Left column: mini profile, compose, Who to follow, Trends
- Center: dense Tweet stream (Reply / Retweet / Favorite / More)
- Profiles: large header, overlapping avatar, stats, Tweets / Tweets & replies / Photos & videos
- Terminology: Tweet, Favorite, Retweet, Connect, Discover (not Like / For You / Explore)

## Limitations / roadmap

This codebase delivers a **working core** suitable for development and further extension. Not every item in the original long specification is fully implemented (e.g. full DM UI, Lists CRUD, admin panel UI, media upload pipeline, WebSockets, complete test suite). The architecture (models, schema, routes, CSS variables, Docker) is structured so those modules can be added without rewrites.

## License

MIT (application code). Linkora name and original logo mark are for this project.
