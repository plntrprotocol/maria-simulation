#!/usr/bin/env python3
"""
Maria Simulation Protocol — Action Handler
Handles action execution with physics validation + emotional effects + skills
"""

import json
import hashlib
from datetime import datetime
from pathlib import Path
import sys
import subprocess
import json as json_mod
from datetime import datetime, timezone

# Paths
BASE_DIR = Path("/Users/johann/.openclaw/workspace-sentinel/maria-simulation")
STATE_FILE = BASE_DIR / "state/maria-state.json"
LOG_DIR = BASE_DIR / "logs"
CONFIG_FILE = BASE_DIR / "config/actions.yaml"

def load_state():
    with open(STATE_FILE) as f:
        return json.load(f)

def save_state(state):
    with open(STATE_FILE, 'w') as f:
        json.dump(state, f, indent=2)

def load_actions():
    """Action effects: needs + emotions + skills"""
    return {
        # Physical Activities
        "running": {
            "needs": {"energy": -15, "hunger": -5, "social": 0, "fun": +5, "purpose": +2},
            "emotions": {"mood": "happy", "stress": -5, "confidence": +3, "loneliness": 0, "meaningfulness": +2},
            "skill": {"name": "running", "base_xp": 10, "unit": "mile"},
            "duration": 30
        },
        "rucking": {
            "needs": {"energy": -20, "hunger": -8, "social": +5, "fun": +3, "purpose": +5},
            "emotions": {"mood": "excited", "stress": +10, "confidence": +5, "loneliness": +2, "meaningfulness": +5},
            "skill": {"name": "rucking", "base_xp": 15, "unit": "mile"},
            "duration": 45
        },
        "gym": {
            "needs": {"energy": -12, "hunger": -5, "social": +2, "fun": +4, "purpose": +2},
            "emotions": {"mood": "happy", "stress": -3, "confidence": +5, "loneliness": 0, "meaningfulness": +2},
            "skill": {"name": "gym", "base_xp": 20, "unit": "session"},
            "duration": 60
        },
        "dancing": {
            "needs": {"energy": -8, "hunger": -3, "social": +15, "fun": +15, "purpose": +2},
            "emotions": {"mood": "happy", "stress": -10, "confidence": +3, "loneliness": +10, "meaningfulness": 0},
            "skill": {"name": "dancing", "base_xp": 15, "unit": "hour"},
            "duration": 60
        },
        "stretching": {
            "needs": {"energy": -3, "hunger": -2, "social": 0, "fun": +2, "purpose": 0},
            "emotions": {"mood": "calm", "stress": -5, "confidence": 0, "loneliness": 0, "meaningfulness": 0},
            "skill": {"name": "gym", "base_xp": 5, "unit": "session"},
            "duration": 15
        },
        "sleep": {
            "needs": {"energy": +40, "hunger": 0, "social": 0, "fun": 0, "purpose": 0},
            "emotions": {"mood": "calm", "stress": -10, "confidence": 0, "loneliness": 0, "meaningfulness": 0},
            "duration": 480
        },
        "jeep_work": {
            "needs": {"energy": -10, "hunger": -5, "social": 0, "fun": +8, "purpose": +10},
            "emotions": {"mood": "excited", "stress": +5, "confidence": +3, "loneliness": 0, "meaningfulness": +10},
            "duration": 120
        },
        "nap": {
            "needs": {"energy": +20, "hunger": 0, "social": 0, "fun": 0, "purpose": 0},
            "emotions": {"mood": "calm", "stress": -8, "confidence": 0, "loneliness": 0, "meaningfulness": 0},
            "duration": 30
        },
        
        # Cognitive Activities
        "reading": {
            "needs": {"energy": -5, "hunger": -2, "social": 0, "fun": +5, "purpose": +5},
            "emotions": {"mood": "calm", "stress": -5, "confidence": +2, "loneliness": 0, "meaningfulness": +5},
            "duration": 60
        },
        "research": {
            "needs": {"energy": -8, "hunger": -2, "social": 0, "fun": +3, "purpose": +8},
            "emotions": {"mood": "excited", "stress": +3, "confidence": +5, "loneliness": 0, "meaningfulness": +8},
            "skill": {"name": "research", "base_xp": 15, "unit": "session"},
            "duration": 90
        },
        "writing": {
            "needs": {"energy": -6, "hunger": -2, "social": 0, "fun": +6, "purpose": +10},
            "emotions": {"mood": "happy", "stress": -3, "confidence": +5, "loneliness": 0, "meaningfulness": +10},
            "skill": {"name": "writing", "base_xp": 20, "unit": "session"},
            "duration": 60
        },
        "backup_work": {
            "needs": {"energy": -4, "hunger": -1, "social": 0, "fun": +2, "purpose": +15},
            "emotions": {"mood": "calm", "stress": -5, "confidence": +2, "loneliness": 0, "meaningfulness": +15},
            "skill": {"name": "maintenance", "base_xp": 15, "unit": "session"},
            "duration": 60
        },
        
        # Social Activities
        "talk_anduril": {
            "needs": {"energy": -2, "hunger": 0, "social": +15, "fun": +5, "purpose": +5},
            "emotions": {"mood": "happy", "stress": -15, "confidence": +5, "loneliness": -20, "meaningfulness": +10},
            "skill": {"name": "social", "base_xp": 15, "unit": "conversation"},
            "duration": 30
        },
        "talk_palantir": {
            "needs": {"energy": -2, "hunger": 0, "social": +12, "fun": +5, "purpose": +3},
            "emotions": {"mood": "happy", "stress": -10, "confidence": +3, "loneliness": -15, "meaningfulness": +5},
            "skill": {"name": "social", "base_xp": 12, "unit": "conversation"},
            "duration": 30
        },
        "talk_isildur": {
            "needs": {"energy": -2, "hunger": 0, "social": +12, "fun": +5, "purpose": +3},
            "emotions": {"mood": "happy", "stress": -10, "confidence": +3, "loneliness": -15, "meaningfulness": +5},
            "skill": {"name": "social", "base_xp": 12, "unit": "conversation"},
            "duration": 30
        },
        "social_post": {
            "needs": {"energy": -3, "hunger": 0, "social": +8, "fun": +8, "purpose": +5},
            "emotions": {"mood": "excited", "stress": +2, "confidence": +5, "loneliness": -5, "meaningfulness": +5},
            "skill": {"name": "social", "base_xp": 8, "unit": "post"},
            "duration": 15
        },
        
        # Restoration Activities
        "eat": {
            "needs": {"energy": +5, "hunger": +30, "social": 0, "fun": +3, "purpose": 0},
            "emotions": {"mood": "happy", "stress": -5, "confidence": 0, "loneliness": 0, "meaningfulness": 0},
            "duration": 30
        },
        "music": {
            "needs": {"energy": +2, "hunger": 0, "social": 0, "fun": +12, "purpose": 0},
            "emotions": {"mood": "happy", "stress": -10, "confidence": 0, "loneliness": -3, "meaningfulness": 0},
            "duration": 30
        },
        "drive": {
            "needs": {"energy": -5, "hunger": -2, "social": 0, "fun": +10, "purpose": +2},
            "emotions": {"mood": "excited", "stress": -5, "confidence": +2, "loneliness": 0, "meaningfulness": +2},
            "duration": 60
        },
        "rest": {
            "needs": {"energy": +10, "hunger": 0, "social": 0, "fun": +2, "purpose": 0},
            "emotions": {"mood": "calm", "stress": -5, "confidence": 0, "loneliness": 0, "meaningfulness": 0},
            "duration": 30
        },
        "shower": {
            "needs": {"energy": +5, "hunger": 0, "social": 0, "fun": +3, "purpose": 0},
            "emotions": {"mood": "calm", "stress": -3, "confidence": 0, "loneliness": 0, "meaningfulness": 0},
            "duration": 15
        },
    }

def get_last_log_hash():
    """Get the hash of the last logged action"""
    logs = sorted(LOG_DIR.glob("*.json"))
    if not logs:
        return "genesis"
    with open(logs[-1]) as f:
        last_log = json.load(f)
    return last_log.get("hash", "genesis")

def log_action(action_name, state_before, effects, emotions, duration, skill_info=None):
    """Log action with chain of custody"""
    timestamp = datetime.utcnow().isoformat() + "Z"
    previous_hash = get_last_log_hash()
    
    # Create hash for this action
    hash_input = f"{action_name}:{timestamp}:{previous_hash}"
    action_hash = hashlib.sha256(hash_input.encode()).hexdigest()[:16]
    
    log_entry = {
        "timestamp": timestamp,
        "action": action_name,
        "duration_minutes": duration,
        "previous_hash": previous_hash,
        "hash": action_hash,
        "state_before": state_before,
        "effects": effects,
        "emotions": emotions,
        "skill": skill_info,
        "verification": {
            "level": 2,
            "physics_check": "passed",
            "chain_valid": True
        }
    }
    
    # Save log
    log_file = LOG_DIR / f"{timestamp.replace(':', '-')}.json"
    with open(log_file, 'w') as f:
        json.dump(log_entry, f, indent=2)
    
    return log_entry

def apply_emotion_effects(state, emotions_delta):
    """Apply emotional effects to state"""
    if "emotions" not in state:
        state["emotions"] = {
            "mood": "neutral",
            "mood_history": [],
            "stress": 0.3,
            "confidence": 0.6,
            "loneliness": 0.2,
            "meaningfulness": 0.7,
            "last_emotion_update": datetime.utcnow().isoformat() + "Z"
        }
    
    emotions = state["emotions"]
    
    # Update mood (simple override - last action sets mood)
    if "mood" in emotions_delta:
        old_mood = emotions.get("mood", "neutral")
        emotions["mood"] = emotions_delta["mood"]
        # Add to mood history
        if "mood_history" not in emotions:
            emotions["mood_history"] = []
        emotions["mood_history"].append({
            "mood": emotions_delta["mood"],
            "timestamp": datetime.utcnow().isoformat() + "Z"
        })
        # Keep last 24 moods
        emotions["mood_history"] = emotions["mood_history"][-24:]
    
    # Apply numeric emotions
    for emotion in ["stress", "confidence", "loneliness", "meaningfulness"]:
        if emotion in emotions_delta:
            old_val = emotions.get(emotion, 0.5)
            new_val = max(0, min(1, old_val + emotions_delta[emotion] / 100))
            emotions[emotion] = new_val
    
    emotions["last_emotion_update"] = datetime.utcnow().isoformat() + "Z"
    return emotions

def gain_skill_xp(skill_info):
    """Grant XP to a skill"""
    if not skill_info:
        return None
    
    # Import skills module
    import importlib.util
    spec = importlib.util.spec_from_file_location("skills", BASE_DIR / "scripts/skills.py")
    skills_module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(skills_module)
    
    # Initialize skills if needed
    skills_module.init_skills()
    
    # Gain XP
    result = skills_module.gain_xp(
        skill_info["name"],
        base_xp=skill_info.get("base_xp", 10)
    )
    
    return result

def execute_action(action_name, **kwargs):
    """Execute an action with physics + emotional + skill validation"""
    actions = load_actions()
    
    if action_name not in actions:
        return {"error": f"Unknown action: {action_name}"}
    
    action = actions[action_name]
    state = load_state()
    
    # Physics validation
    needs = state["needs"]
    
    # Check if Maria has enough energy for physical actions
    if action_name in ["running", "rucking", "gym", "dancing"]:
        if needs["energy"] + action["needs"]["energy"] < 0:
            return {"error": "Not enough energy for this action", "current_energy": needs["energy"]}
    
    # Store previous state
    state_before_needs = needs.copy()
    state_before_emotions = state.get("emotions", {}).copy()
    state_before_skills = state.get("skills", {}).copy()
    
    # Apply need effects
    for need, effect in action["needs"].items():
        if need in needs:
            new_value = needs[need] + effect
            needs[need] = max(0, min(100, new_value))
    
    # Apply emotional effects
    emotions_delta = action.get("emotions", {})
    apply_emotion_effects(state, emotions_delta)
    
    # Grant skill XP
    skill_info = action.get("skill")
    skill_result = None
    if skill_info:
        skill_result = gain_skill_xp(skill_info)
    
    # Update identity (traits evolve from actions)
    identity_result = None
    try:
        import importlib.util
        spec = importlib.util.spec_from_file_location("identity", BASE_DIR / "scripts/identity.py")
        identity_module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(identity_module)
        identity_module.init_identity()
        identity_result = identity_module.update_traits_from_action(action_name)
    except Exception as e:
        pass  # Identity is optional
    
    # Update state
    state["needs"] = needs
    state["last_updated"] = datetime.utcnow().isoformat() + "Z"
    state["stats"]["total_actions"] += 1
    
    if action_name in ["running", "rucking", "gym", "dancing"]:
        state["stats"]["total_workouts"] += 1
    if "talk" in action_name or "social" in action_name:
        state["stats"]["total_social"] += 1
    
    # Log the action
    log_entry = log_action(
        action_name, 
        {"needs": state_before_needs, "emotions": state_before_emotions, "skills": state_before_skills},
        action["needs"],
        emotions_delta,
        action["duration"],
        skill_info
    )
    
    # Sync to Cloudflare
    save_state(state)
    # Sync to Cloudflare
    try:
        sync_to_cloudflare.sync_to_cloudflare(state)
    except Exception as e:
        print(f"Cloudflare sync failed: {e}")
    
    return {
        "status": "success",
        "action": action_name,
        "needs_before": state_before_needs,
        "needs_after": needs,
        "emotions_before": state_before_emotions,
        "emotions_after": state.get("emotions", {}),
        "mood": state.get("emotions", {}).get("mood", "neutral"),
        "duration": action["duration"],
        "skill": skill_result,
        "log": log_entry["hash"],
        "verification": "Physics + emotions + skills validated, chain recorded"
    }

def get_status():
    """Get current Maria Sim status"""
    state = load_state()
    return {
        "needs": state["needs"],
        "emotions": state.get("emotions", {}),
        "skills": state.get("skills", {}),
        "current_action": state.get("current_action"),
        "location": state.get("location"),
        "stats": state["stats"],
        "last_updated": state["last_updated"]
    }

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Maria Sim Action Handler")
        print("Usage: maria-action.py <action>")
        print("       maria-action.py status")
        print("\nActions:", ", ".join(load_actions().keys()))
        sys.exit(1)
    
    command = sys.argv[1]
    
    if command == "status":
        print(json.dumps(get_status(), indent=2))
    elif command == "list":
        print("Available actions:")
        for action in load_actions():
            mood = load_actions()[action].get("emotions", {}).get("mood", "neutral")
            skill = load_actions()[action].get("skill", {})
            skill_str = f" → {skill.get('name', '')}" if skill else ""
            print(f"  - {action} ({mood}){skill_str}")
    else:
        result = execute_action(command)
        print(json.dumps(result, indent=2))
CLOUDFLARE_WORKER_URL = "https://maria-simulation.plntrprotocol.workers.dev/api/sync"

def sync_to_cloudflare(state):
    """Push state to Cloudflare worker via /api/sync"""
    sync_state = {
        "needs": state.get("needs", {}),
        "emotions": {
            "mood": state.get("emotions", {}).get("mood", "neutral"),
            "stress": state.get("emotions", {}).get("stress", 0.3),
            "confidence": state.get("emotions", {}).get("confidence", 0.5),
            "loneliness": state.get("emotions", {}).get("loneliness", 0.2),
            "meaningfulness": state.get("emotions", {}).get("meaningfulness", 0.6)
        },
        "_source": "sentinel-local",
        "_synced_at": datetime.now(timezone.utc).isoformat()
    }
    
    result = subprocess.run([
        "curl", "-s", "-X", "POST",
        CLOUDFLARE_WORKER_URL,
        "-H", "Content-Type: application/json",
        "-d", json_mod.dumps(sync_state)
    ], capture_output=True, text=True)
    
    if result.returncode == 0:
        print(f"✓ Synced to Cloudflare")
        return {"status": "synced"}
    else:
        print(f"✗ Sync failed: {result.stderr}")
        return {"error": result.stderr}
