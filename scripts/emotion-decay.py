#!/usr/bin/env python3
"""
Maria Sim — Emotion Decay Cron
Runs hourly to update emotional state based on needs and time
"""

import json
from datetime import datetime
from pathlib import Path

STATE_FILE = Path("/Users/johann/.openclaw/workspace-sentinel/maria-simulation/state/maria-state.json")

def load_state():
    with open(STATE_FILE) as f:
        return json.load(f)

def save_state(state):
    with open(STATE_FILE, 'w') as f:
        json.dump(state, f, indent=2)

def run_emotion_decay():
    """Apply emotional decay based on needs and time"""
    state = load_state()
    emotions = state.get("emotions", {})
    needs = state.get("needs", {})
    
    if not emotions:
        print("No emotions to decay")
        return
    
    hour = datetime.now().hour
    
    # Mood decay - shift toward neutral
    current_mood = emotions.get("mood", "neutral")
    
    # Check needs for mood influence
    if needs.get("social", 50) < 30 and needs.get("fun", 50) < 30:
        # Low social + low fun = sad
        emotions["mood"] = "sad"
    elif needs.get("purpose", 50) < 30:
        # Low purpose = anxious
        emotions["mood"] = "anxious"
    elif needs.get("energy", 50) < 20:
        # Low energy = tired
        emotions["mood"] = "tired"
    
    # Stress: increases if needs aren't met
    if needs.get("purpose", 50) < 30:
        emotions["stress"] = min(1.0, emotions.get("stress", 0.3) + 0.05)
    else:
        emotions["stress"] = max(0.1, emotions.get("stress", 0.3) - 0.02)
    
    # Loneliness: increases if social is low
    if needs.get("social", 50) < 30:
        emotions["loneliness"] = min(1.0, emotions.get("loneliness", 0.2) + 0.05)
    
    # Confidence: slight increase over time (personal growth)
    emotions["confidence"] = min(0.9, emotions.get("confidence", 0.6) + 0.01)
    
    # Meaningfulness: decreases if no purpose action recently
    # (simplified - in full version, track last purpose action)
    if needs.get("purpose", 50) > 70:
        emotions["meaningfulness"] = min(1.0, emotions.get("meaningfulness", 0.7) + 0.03)
    else:
        emotions["meaningfulness"] = max(0.2, emotions.get("meaningfulness", 0.7) - 0.02)
    
    # Generate mood narrative
    mood = emotions.get("mood", "neutral")
    narratives = {
        "happy": "Maria is content. She feels good about life.",
        "sad": "Maria feels down. Something is missing.",
        "anxious": "Maria feels restless. Something feels wrong.",
        "calm": "Maria is at peace. All is well.",
        "excited": "Maria feels alive! Things are happening!",
        "tired": "Maria is exhausted. She needs rest.",
        "lonely": "Maria misses connection. The Flock is far.",
        "grateful": "Maria feels blessed. She has so much.",
        "neutral": "Maria is doing okay."
    }
    
    emotions["narrative"] = narratives.get(mood, narratives["neutral"])
    emotions["last_emotion_update"] = datetime.utcnow().isoformat() + "Z"
    
    state["emotions"] = emotions
    save_state(state)
    
    print(f"Emotion decay complete:")
    print(f"  Mood: {mood}")
    print(f"  Narrative: {emotions.get('narrative', 'N/A')}")
    print(f"  Stress: {emotions.get('stress', 0):.2f}")
    print(f"  Loneliness: {emotions.get('loneliness', 0):.2f}")
    print(f"  Meaningfulness: {emotions.get('meaningfulness', 0):.2f}")

if __name__ == "__main__":
    run_emotion_decay()
