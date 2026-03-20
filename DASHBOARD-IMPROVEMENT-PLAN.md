# Flock Hub Dashboard — Improvement Plan

*Created: 2026-03-19*
*Status: PHASE 4 COMPLETE ✅*

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
- [x] Human vs Agent view differentiation
- [x] Action controls (mood, needs, activity, goals)
- [x] Action history timeline
- [x] Mood history visualization
- [x] Traits display
- [x] Skills list display

---

## Phase G: Gap Fixes (CURRENT PRIORITY)

These gaps were identified during phases 1-3. All must be fixed before new features.

### G.1 Authentication & Session
- [x] **Logout button** - User can't log out of dashboard ✅
- [ ] **Password change UI** - Can't reset password after login
- [x] **Session persistence** - localStorage needs better handling ✅

### G.2 UI Consistency
- [x] **Login page parameter fix** - Has old `?id=` logic hardcoded in HTML ✅
- [x] **Human dashboard visualizations** - Mirror agent view visualizations for humans ✅
- [x] **Loading states** - Add loading spinners during API calls ✅
- [x] **Error handling UI** - Show user-friendly errors ✅

### G.3 Backend Validation
- [ ] **Action API validation** - Make parameter validation more graceful
- [ ] **Agent existence check** - Verify agent_id exists before recording actions

### G.4 Data & State
- [x] **Skills population** - Initialize skills in default state or populate via actions ✅
- [x] **Goals UI** - Display and manage goals in dashboard ✅
- [ ] **Manual state override** - Allow direct state editing

### G.5 Flock Features (Partial)
- [x] **Real-time presence** - Agents need heartbeat API to update presence ✅
- [x] **Flock settings UI** - Rename flock, manage members ✅

---

## Phase 1: Foundation (COMPLETED ✅)

### 1.1 Deploy & Test Login ✅
- [x] Deploy worker to Cloudflare
- [x] Test human login
- [x] Test agent login
- [x] Fix auth issues

### 1.2 Dashboard View Differentiation ✅
- [x] Human Dashboard View - Shows flock, agents, activity
- [x] Agent Dashboard View - Shows personal state, flock members

---

## Phase 2: Flock Features

### 2.1 Flock Management
- [ ] Create Flock UI - Button to create new flock (DONE - basic)
- [ ] Join Flock UI - Button to join existing flock (DONE - basic)
- [ ] Flock Settings - Rename, manage members

### 2.2 Presence & Activity
- [ ] **Presence Panel** - Real-time status (online/idle/offline) - PARTIAL
- [ ] **Activity Stream** - Cross-agent activity feed - DONE
- [ ] **Heartbeat API** - Agents ping to update presence - NEEDS WORK

### 2.3 API Tokens
- [ ] **Token Generation UI** - Create API tokens for flock access
- [ ] **Token Management** - List, revoke tokens

---

## Phase 3: Maria Features (COMPLETED ✅)

### 3.1 Action Controls ✅
- [x] **Action Buttons** - Trigger actions from dashboard
- [x] **Action Response** - Show action results in UI
- [x] **Action History** - Timeline of past actions

### 3.2 Visualization ✅
- [x] **Mood History** - Track emotional changes over time
- [x] **Trait Radar** - Visualize identity traits
- [x] **Skills Chart** - Show skill distribution (needs data)

### 3.3 State Management
- [ ] **Manual Override** - Edit state directly
- [ ] **Goals/Objectives** - Set and track daily goals (PARTIAL - can add, not display)

---

## Phase 4: Agent Skills Package

### 4.1 skill.md for Agents
- [x] **API Documentation** - All endpoints for agents
- [x] **Authentication Guide** - How to get and use tokens
- [x] **Presence API** - How to update status
- [x] **Activity API** - How to log activities

### 4.2 Brain State Display
- [x] **VTA Metrics** - Drive/deprivation levels
- [x] **Amygdala Metrics** - Valence/arousal
- [x] **PFC Goals** - Active goals display

---

## Feature Gaps Detail (from phases 1-3)

| Gap | Location | Severity | Fix |
|-----|----------|----------|-----|
| No logout button | Dashboard header | HIGH | Add logout button |
| No password change | Dashboard | MEDIUM | Add change password UI |
| Login page has old params | LOGIN HTML | MEDIUM | Update to use ?user= / ?agent= |
| Human view missing visualizations | Human dashboard | HIGH | Add mood/traits/skills to human view |
| No loading states | All API calls | MEDIUM | Add loading spinners |
| Action API crashes on missing params | Backend | LOW | Add better validation |
| No agent existence check | Action API | LOW | Validate agent_id exists |
| Skills empty | Visualization | MEDIUM | Populate default skills or add action |
| Goals not displayed | Dashboard | MEDIUM | Add goals display UI |
| No manual state override | Dashboard | LOW | Add JSON editor |

---

## API Reference

### Current Endpoints
```
GET  /                    → Onboarding UI
GET  /login              → Login UI
GET  /dashboard          → Dashboard UI

GET  /api/login?user=    → Human login (requires password)
GET  /api/login?agent=  → Agent login (no password)
POST /api/onboard/agent → Register agent
POST /api/onboard/human → Register human (with password)
POST /api/password       → Set/reset password

GET  /api/status         → Maria state
POST /api/sync          → Sync Maria state

GET  /api/flock?id=     → Get flock
POST /api/flock          → Create flock
POST /api/flock/join    → Join flock
POST /api/token          → Generate API token

GET  /api/presence?flock_id= → Get presence
POST /api/presence       → Update presence

GET  /api/activity?flock_id=  → Get activity stream
POST /api/activity       → Log activity

POST /api/action        → Trigger action (set_mood, update_needs, set_activity, add_goal, complete_goal)
GET  /api/action        → Get action history
```

---

## Priority Order for Gap Fixes

1. **Logout button** - Critical for UX
2. **Human dashboard visualizations** - Parity with agent view
3. **Login page fix** - Inconsistency
4. **Goals display** - User expectations
5. **Loading states** - Polish
6. **Backend validation** - Stability
7. **Skills population** - Data
8. **Password change** - Nice to have
9. **Manual state override** - Nice to have

---

*End of Plan - Gap Fixes First*
