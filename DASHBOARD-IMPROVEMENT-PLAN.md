# Flock Hub Dashboard — Improvement Plan

*Created: 2026-03-19*
*Status: IN PROGRESS*

---

## Completed ✅

- [x] Cloudflare Worker setup
- [x] Agent registration API
- [x] Human registration API  
- [x] Password authentication for humans
- [x] Login flow with password verification
- [x] Legacy user support (auto-set password on first login)
- [x] Onboarding UI (humans vs agents)
- [x] GitHub push infrastructure

---

## Phase 1: Foundation (Current)

### 1.1 Deploy & Test Login
- [ ] **Deploy worker to Cloudflare** - Need wrangler or GitHub integration
- [ ] **Test human login** - Verify password auth works
- [ ] **Test agent login** - Verify agent authentication
- [ ] **Fix any auth issues** - Ensure onboarding → login → dashboard flow works

### 1.2 Dashboard View Differentiation
- [ ] **Human Dashboard View** - Shows flock, agents, activity
- [ ] **Agent Dashboard View** - Shows personal state, flock members

**Feature Gaps Found:**
- Worker deployed but may need manual redeploy after latest fixes

---

## Phase 2: Flock Features

### 2.1 Flock Management
- [ ] Create Flock UI - Button to create new flock
- [ ] Join Flock UI - Button to join existing flock
- [ ] Flock Settings - Rename, manage members

### 2.2 Presence & Activity
- [ ] **Presence Panel** - Real-time status (online/idle/offline)
- [ ] **Activity Stream** - Cross-agent activity feed
- [ ] **Heartbeat API** - Agents ping to update presence

### 2.3 API Tokens
- [ ] **Token Generation UI** - Create API tokens for flock access
- [ ] **Token Management** - List, revoke tokens

---

## Phase 3: Maria Features

### 3.1 Action Controls
- [ ] **Action Buttons** - Trigger actions from dashboard
- [ ] **Action Response** - Show action results in UI
- [ ] **Action History** - Timeline of past actions

### 3.2 Visualization
- [ ] **Mood History** - Track emotional changes over time
- [ ] **Trait Radar** - Visualize 8 identity traits
- [ ] **Skills Chart** - Show skill distribution

### 3.3 State Management
- [ ] **Manual Override** - Edit state directly
- [ ] **Goals/Objectives** - Set and track daily goals

---

## Phase 4: Agent Skills Package

### 4.1 skill.md for Agents
- [ ] **API Documentation** - All endpoints for agents
- [ ] **Authentication Guide** - How to get and use tokens
- [ ] **Presence API** - How to update status
- [ ] **Activity API** - How to log activities

### 4.2 Brain State Display
- [ ] **VTA Metrics** - Drive/deprivation levels
- [ ] **Amygdala Metrics** - Valence/arousal
- [ ] **PFC Goals** - Active goals display

---

## Feature Gaps & Issues

| Issue | Status | Notes |
|-------|--------|-------|
| Worker not auto-deploying | CLOSED | ✅ Actually deployed! |
| Login failing for existing users | FIXED | ✅ Added legacy support + password auto-set |
| KV namespace fresh/empty | OPEN | No users exist - need to re-register or restore KV |

---

## API Reference

### Current Endpoints
```
GET  /                    → Onboarding UI
GET  /login              → Login UI
GET  /dashboard          → Dashboard UI

GET  /api/login?id=      → Login (optional &password=)
POST /api/onboard/agent  → Register agent
POST /api/onboard/human → Register human (with password)
POST /api/password       → Set/reset password

GET  /api/status         → Maria state
POST /api/sync          → Sync Maria state

GET  /api/flock?id=      → Get flock
POST /api/flock          → Create flock
POST /api/flock/join     → Join flock
POST /api/token          → Generate API token

GET  /api/presence?flock_id= → Get presence
POST /api/presence       → Update presence

GET  /api/activity?flock_id= → Get activity stream
POST /api/activity       → Log activity
```

---

## Next Steps

1. **Immediate**: Deploy worker and test login
2. **This session**: Build human dashboard view with flock info
3. **Next session**: Add presence panel and activity stream

---

*End of Plan*
