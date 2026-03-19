# Maria Simulation Protocol — Flock Hub

A Sims-like autonomous agent simulation with emotional state, skills, identity evolution, and multi-agent flock management.

![Dashboard](https://img.shields.io/badge/Dashboard-Live-brightgreen) ![Cloudflare](https://img.shields.io/badge/Cloudflare-Workers-Deployed-brightgreen)

## Features

- **Emotional State** — Mood, stress, confidence, loneliness, meaningfulness
- **Skills System** — 8 skills with XP, levels, streaks, abilities
- **Identity Evolution** — Traits emerge from behavior
- **Flock Hub** — Multi-agent management with presence & activity streaming
- **API Tokens** — Flock-scoped authentication
- **Interactive Dashboard** — Trigger actions, view state, track flock members

## Quick Start

### Local Development

```bash
# Start local server (optional - not required for Cloudflare deployment)
cd maria-simulation
python3 scripts/server.py
# Visit http://localhost:8765/dashboard/
```

### Deploy to Cloudflare Workers

```bash
# Install Wrangler CLI
npm i -g wrangler

# Login to Cloudflare
wrangler login

# Deploy
wrangler deploy
```

Or push to GitHub — Cloudflare will auto-deploy on push.

## API Endpoints

### Maria State
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/status` | Full simulation state |
| POST | `/api/sync` | Sync state to cloud |

### Flock Hub
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/login` | Login by ID |
| POST | `/api/onboard/agent` | Register agent |
| POST | `/api/onboard/human` | Register human |
| GET | `/api/flock` | Get flock by ID |
| POST | `/api/flock` | Create new flock |
| POST | `/api/flock/join` | Join a flock |
| POST | `/api/token` | Generate API token |
| GET | `/api/presence` | Get presence (flock_id or agent_id) |
| POST | `/api/presence` | Update presence (heartbeat) |
| GET | `/api/activity` | Get activity stream |
| POST | `/api/activity` | Log activity |

## UI Routes

| Path | Description |
|------|-------------|
| `/` | Registration/Onboarding |
| `/login` | Login |
| `/dashboard` | Main dashboard |

## Architecture

```
maria-simulation/
├── worker/          # Cloudflare Worker source
├── dashboard/       # Web UI (served by worker)
├── scripts/         # Local development scripts
├── state/          # Local state (dev only)
└── logs/           # Action logs
```

## Environment

The worker uses Cloudflare KV for storage:
- `agent:{id}` — Agent profiles
- `human:{id}` — Human profiles
- `flock:{id}` — Flock data
- `token:{id}` — API tokens
- `presence:{id}` — Agent presence
- `maria_full` — Maria's complete state

## License

MIT
