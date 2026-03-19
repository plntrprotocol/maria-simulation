#!/usr/bin/env python3
"""Sync Maria's COMPLETE state to Cloudflare"""
import json
import subprocess
from datetime import datetime, timezone

CLOUDFLARE_WORKER_URL = "https://maria-simulation.plntrprotocol.workers.dev/api/sync"

def sync_to_cloudflare(full_state, notification=None):
    """Push COMPLETE state with ALL data"""
    
    # Determine activity from needs
    needs = full_state.get("needs", {})
    if needs.get("energy", 100) < 20:
        current_activity = "exhausted, resting"
    elif needs.get("hunger", 100) < 30:
        current_activity = "hungry"
    elif needs.get("fun", 100) < 30:
        current_activity = "bored"
    elif needs.get("social", 100) < 30:
        current_activity = "lonely"
    else:
        current_activity = full_state.get("current_action", "living")
    
    # Get relationships
    relationships = full_state.get("relationships", {
        "anduril": {"level": 80, "type": "creator"},
        "palantir": {"level": 70, "type": "sibling"},
        "isildur": {"level": 65, "type": "sibling"}
    })
    
    # Build COMPLETE payload - EVERYTHING
    payload = {
        # Core stats (already synced)
        "needs": needs,
        "emotions": full_state.get("emotions", {
            "mood": "neutral",
            "stress": 0.3,
            "confidence": 0.5,
            "loneliness": 0.2,
            "meaningfulness": 0.6
        }),
        "location": full_state.get("location", "home"),
        "current_activity": current_activity,
        
        # Relationships
        "relationships": relationships,
        
        # Flock status
        "flock_status": {
            "maria": {"status": "online", "activity": current_activity, "last_seen": datetime.now(timezone.utc).isoformat()},
            "palantir": {"status": "active", "activity": "exploring", "last_seen": datetime.now(timezone.utc).isoformat()},
            "isildur": {"status": "idle", "activity": "creating", "last_seen": datetime.now(timezone.utc).isoformat()}
        },
        
        # Environment
        "environment": full_state.get("environment", {}),
        
        # === NEW: Full data sync ===
        
        # Inventory
        "inventory": full_state.get("inventory", {
            "equipment": {},
            "books": [],
            "playlists": []
        }),
        
        # Desires (what the agent wants)
        "desires": full_state.get("desires", {}),
        
        # Identity (traits, values, fears, narrative)
        "identity": full_state.get("identity", {}),
        
        # Skills
        "skills": full_state.get("skills", []),
        
        # Stats
        "stats": full_state.get("stats", {}),
        
        # Goals
        "goals": full_state.get("goals", []),
        
        # Action history (last few actions)
        "action_history": full_state.get("action_history", [])[-10:],  # Last 10
        
        # Notification
        "notification": notification,
        
        # Sync metadata
        "_synced_at": datetime.now(timezone.utc).isoformat(),
        "_agent_id": "maria",
        "_sim_version": full_state.get("sim_version", "1.0")
    }
    
    # Send to cloudflare
    result = subprocess.run([
        "curl", "-s", "-X", "POST",
        CLOUDFLARE_WORKER_URL,
        "-H", "Content-Type: application/json",
        "-d", json.dumps(payload)
    ], capture_output=True, text=True)
    
    if result.returncode == 0:
        print(f"✓ Synced COMPLETE state: {current_activity}")
        return {"status": "synced"}
    else:
        print(f"✗ Sync failed: {result.stderr}")
        return {"error": result.stderr}

def notify(message):
    """Send notification only (preserves existing state)"""
    subprocess.run([
        "curl", "-s", "-X", "POST",
        CLOUDFLARE_WORKER_URL,
        "-H", "Content-Type: application/json",
        "-d", json.dumps({"notification": message})
    ], capture_output=True)

if __name__ == "__main__":
    import sys
    if len(sys.argv) > 1 and sys.argv[1] == "notify":
        notify(" ".join(sys.argv[2:]))
    else:
        STATE_FILE = "/Users/johann/.openclaw/workspace-sentinel/maria-simulation/state/maria-state.json"
        with open(STATE_FILE) as f:
            state = json.load(f)
        sync_to_cloudflare(state)
