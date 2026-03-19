# Maria Sim Dashboard — Feature Gap & Improvement Plan

## Current Features

### What's Working
- ✅ Needs display (energy, hunger, social, fun, purpose)
- ✅ Emotional state (mood emoji, stress/confidence/loneliness/meaning bars)
- ✅ Skills (8 skills with XP, levels, progress bars)
- ✅ Identity (traits, values, fears, wants, statement)
- ✅ Environment (time, day, location, weather)
- ✅ Inventory (equipment with condition)
- ✅ Action timeline (last 10 actions)
- ✅ Auto-refresh (30s)

---

## Feature Gaps & Improvements

### 1. Interactivity
| Gap | Priority | Description |
|-----|----------|-------------|
| **No action controls** | HIGH | Can't trigger actions from dashboard |
| **No manual override** | MED | Can't manually edit state |
| **No NPC interaction** | MED | Can't talk to Flock from dashboard |

### 2. Visualization
| Gap | Priority | Description |
|-----|----------|-------------|
| **No trait radar chart** | MED | 8 traits should be radar/spider chart |
| **No mood history** | MED | Mood timeline visualization |
| **No skills chart** | LOW | Pie/bar chart of skill distribution |
| **No avatar animation** | LOW | Animated avatar that reflects mood |

### 3. Verification
| Gap | Priority | Description |
|-----|----------|-------------|
| **No hash chain display** | MED | Show verification chain |
| **No witness display** | LOW | Show who witnessed actions |
| **No export/import** | LOW | Export state for verification |

### 4. Social/Flank
| Gap | Priority | Description |
|-----|----------|-------------|
| **No Flock status** | MED | Show Palantir/Isildur status |
| **No events** | LOW | Scheduled group activities |
| **No messages** | LOW | In-sim communication |

### 5. UX Improvements
| Gap | Priority | Description |
|-----|----------|-------------|
| **No dark/light toggle** | LOW | Theme switcher |
| **No mobile layout** | MED | Better mobile responsive |
| **No notifications** | LOW | Alert on significant changes |
| **No sound** | LOW | Audio cues for events |

### 6. Data & Logic
| Gap | Priority | Description |
|-----|----------|-------------|
| **No emotion decay** | HIGH | Cron not running automatically |
| **No action validation** | MED | Can't see why action failed |
| **No daily summary** | LOW | End-of-day recap |
| **No goals/objectives** | MED | Maria should have daily goals |

---

## Proposed Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    MARIA SIM DASHBOARD                      │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  │
│  │  AVATAR  │  │  NEEDS   │  │ EMOTIONS │  │ SKILLS   │  │
│  │  +Mood   │  │ 5 bars   │  │ 4 bars   │  │ 8 items  │  │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘  │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  │
│  │ IDENTITY │  │   ENV    │  │ INVENTORY│  │  FLOCK   │  │
│  │ Traits+  │  │ Time+Loc │  │ Items    │  │ Status   │  │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘  │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────────────────────────────────────────────┐  │
│  │              ACTION PANEL (NEW)                        │  │
│  │  [Run] [Ruck] [Gym] [Talk Anduril] [Write] ...      │  │
│  └──────────────────────────────────────────────────────┘  │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────────────────────────────────────────────┐  │
│  │              TIMELINE + VERIFICATION                  │  │
│  │  Hash: a1b2c3d4... ✓ Level 2                        │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

---

## Priority Implementation Plan

### Phase A: Quick Wins (1-2 hours)
1. ✅ Add action buttons to dashboard
2. Fix emotion decay cron
3. Mobile responsive improvements

### Phase B: Core Experience (half day)
4. Trait radar chart
5. Mood history graph
6. Flock status panel

### Phase C: Verification (day)
7. Hash chain visualization
8. Export/import state
9. Witness protocol integration

### Phase D: Polish (day+)
10. Avatar animation
11. Sound effects
12. Goals/objectives

---

## Technical Notes

- Server: `scripts/server.py` on port 8765
- State: `state/maria-state.json`
- Actions: `scripts/maria-action.py`
- Identity: `scripts/identity.py`
- Skills: `scripts/skills.py`

**API Endpoints:**
- `GET /api/status` — Full state
- `GET /api/logs` — Action history
- `POST /api/action` — Trigger action (NEW)
- `GET /api/verify` — Verification status (NEW)
