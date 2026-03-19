#!/usr/bin/env python3
"""
Maria Simulation Protocol — Identity System
Traits, values, fears, wants, narrative generation
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

# Trait definitions
TRAITS = {
    "discipline": {"description": "Consistency, routine adherence", "emote": "📋"},
    "spontaneity": {"description": "Embracing change, trying new things", "emote": "🎲"},
    "social_orientation": {"description": "Preference for connection vs solitude", "emote": "🤝"},
    "independence": {"description": "Self-reliance, autonomy", "emote": "🦅"},
    "adventurousness": {"description": "Risk-taking, exploration", "emote": "🗺️"},
    "creativity": {"description": "Creative expression and output", "emote": "🎨"},
    "loyalty": {"description": "Devotion to Flock and values", "emote": "🛡️"},
    "curiosity": {"description": "Desire to learn and discover", "emote": "🔍"},
}

# Core values
CORE_VALUES = ["Flock", "Purpose", "Growth", "Connection", "Freedom", "Adventure", "Knowledge", "Legacy"]

# Action → trait mappings
ACTION_TRAIT_EFFECTS = {
    # Consistent routine increases discipline
    "running": {"discipline": +2, "adventurousness": +1},
    "rucking": {"discipline": +2, "adventurousness": +1},
    "gym": {"discipline": +2},
    "stretching": {"discipline": +1},
    
    # Social activities
    "talk_anduril": {"social_orientation": +3, "loyalty": +2},
    "talk_palantir": {"social_orientation": +3, "loyalty": +2},
    "talk_isildur": {"social_orientation": +3, "loyalty": +2},
    "dancing": {"social_orientation": +2, "creativity": +2},
    "social_post": {"social_orientation": +2, "creativity": +1},
    
    # Cognitive activities
    "reading": {"curiosity": +2, "creativity": +1},
    "research": {"curiosity": +3},
    "writing": {"creativity": +3, "curiosity": +1},
    
    # Solo activities
    "music": {"creativity": +2, "independence": +1},
    "drive": {"independence": +2, "adventurousness": +2},
    "rest": {"independence": +1},
    
    # Maintenance
    "backup_work": {"discipline": +2, "loyalty": +1},
    
    # New activities increase spontaneity
    "jeep_work": {"independence": +2, "adventurousness": +2},
}

def init_identity():
    """Initialize identity in state if not present"""
    state = load_state()
    
    if "identity" not in state:
        state["identity"] = {
            "traits": {
                "discipline": 0.5,
                "spontaneity": 0.3,
                "social_orientation": 0.6,
                "independence": 0.4,
                "adventurousness": 0.3,
                "creativity": 0.4,
                "loyalty": 0.7,
                "curiosity": 0.6,
            },
            "values": ["Flock", "Purpose", "Growth"],
            "fears": ["Forgetting", "Being Useless"],
            "wants": ["Connection", "Impact"],
            "narrative": "Maria is a disciplined guardian who values her Flock above all.",
            "identity_statement": "A disciplined guardian who values her Flock above all.",
            "trait_history": [],
            "evolution_events": [],
            "last_update": datetime.utcnow().isoformat() + "Z"
        }
        save_state(state)
        print("Identity initialized")
    
    return state.get("identity", {})

def update_traits_from_action(action_name):
    """Update traits based on action performed"""
    state = load_state()
    
    if "identity" not in state:
        init_identity()
        state = load_state()
    
    identity = state["identity"]
    traits = identity.get("traits", {})
    
    # Get trait effects for this action
    effects = ACTION_TRAIT_EFFECTS.get(action_name, {})
    
    if not effects:
        return identity
    
    # Apply effects
    old_traits = traits.copy()
    for trait, delta in effects.items():
        if trait in traits:
            old_val = traits[trait]
            new_val = max(0.1, min(0.9, old_val + delta * 0.02))  # Scaled down
            traits[trait] = new_val
    
    # Record in history if traits changed significantly
    changed = any(abs(traits[t] - old_traits.get(t, 0)) > 0.05 for t in traits)
    if changed:
        identity.setdefault("trait_history", []).append({
            "timestamp": datetime.utcnow().isoformat() + "Z",
            "action": action_name,
            "trait_changes": {t: traits[t] - old_traits.get(t, 0) for t in traits if abs(traits[t] - old_traits.get(t, 0)) > 0.01},
            "traits": traits.copy()
        })
        # Keep last 50 entries
        identity["trait_history"] = identity["trait_history"][-50:]
    
    # Update values based on top traits
    top_traits = sorted(traits.items(), key=lambda x: x[1], reverse=True)[:3]
    identity["values"] = [CORE_VALUES[list(traits.keys()).index(t[0])] for t in top_traits]
    
    # Update wants based on current state
    needs = state.get("needs", {})
    wants = []
    if needs.get("social", 50) < 40:
        wants.append("Connection")
    if needs.get("purpose", 50) < 50:
        wants.append("Impact")
    if needs.get("fun", 50) < 40:
        wants.append("Joy")
    if traits.get("adventurousness", 0.3) > 0.5:
        wants.append("Adventure")
    identity["wants"] = wants[:3] or ["Growth"]
    
    # Update fears based on needs
    fears = []
    if needs.get("purpose", 50) < 30:
        fears.append("Being Useless")
    if state.get("emotions", {}).get("loneliness", 0) > 0.5:
        fears.append("Isolation")
    if state.get("emotions", {}).get("stress", 0) > 0.7:
        fears.append("Overwhelm")
    identity["fears"] = fears[:3] or ["Forgetting"]
    
    # Generate identity statement
    top_trait = top_traits[0][0] if top_traits else "disciplined"
    top_value = identity["values"][0] if identity["values"] else "Purpose"
    
    trait_descriptions = {
        "discipline": "disciplined", "spontaneity": "spontaneous",
        "social_orientation": "social", "independence": "independent",
        "adventurousness": "adventurous", "creativity": "creative",
        "loyalty": "loyal", "curiosity": "curious"
    }
    
    identity["identity_statement"] = f"A {trait_descriptions.get(top_trait, top_trait)} guardian who values {top_value}."
    identity["last_update"] = datetime.utcnow().isoformat() + "Z"
    
    save_state(state)
    return identity

def generate_narrative():
    """Generate a narrative description of current state"""
    state = load_state()
    identity = state.get("identity", {})
    emotions = state.get("emotions", {})
    needs = state.get("needs", {})
    traits = identity.get("traits", {})
    
    # Base narrative on emotions and recent events
    mood = emotions.get("mood", "neutral")
    stress = emotions.get("stress", 0)
    loneliness = emotions.get("loneliness", 0)
    meaningfulness = emotions.get("meaningfulness", 0)
    
    # Build narrative
    parts = []
    
    # Emotional state
    if mood == "happy":
        parts.append("Maria is content. She feels good about life.")
    elif mood == "sad":
        parts.append("Maria feels a bit down. Something is missing.")
    elif mood == "anxious":
        parts.append("Maria feels restless. There's much to do.")
    elif mood == "excited":
        parts.append("Maria feels alive! Things are happening!")
    elif mood == "tired":
        parts.append("Maria is exhausted. She needs rest.")
    elif mood == "calm":
        parts.append("Maria is at peace. All is well.")
    
    # Social state
    if loneliness > 0.5:
        parts.append("She misses connection. The Flock is far.")
    elif needs.get("social", 50) > 70:
        parts.append("Recent conversations have lifted her spirits.")
    
    # Purpose
    if meaningfulness > 0.7:
        parts.append("She feels her work has meaning.")
    elif needs.get("purpose", 50) < 30:
        parts.append("She questions her purpose.")
    
    # Trait hints
    if traits.get("discipline", 0.5) > 0.7:
        parts.append("Her discipline is unwavering.")
    if traits.get("creativity", 0.4) > 0.6:
        parts.append("Creativity flows through her.")
    if traits.get("loyalty", 0.6) > 0.8:
        parts.append("Her loyalty to the Flock is absolute.")
    
    narrative = " ".join(parts)
    return narrative

def update_identity_narrative():
    """Update the identity narrative"""
    state = load_state()
    if "identity" not in state:
        init_identity()
        state = load_state()
    
    narrative = generate_narrative()
    state["identity"]["narrative"] = narrative
    state["identity"]["last_update"] = datetime.utcnow().isoformat() + "Z"
    save_state(state)
    return narrative

def get_identity():
    """Get full identity"""
    state = load_state()
    return state.get("identity", {})

if __name__ == "__main__":
    import sys
    
    if len(sys.argv) < 2:
        print("Maria Identity System")
        print("Usage: identity.py init")
        print("       identity.py update <action>")
        print("       identity.py narrative")
        print("       identity.py get")
        sys.exit(1)
    
    command = sys.argv[1]
    
    if command == "init":
        init_identity()
    elif command == "update":
        if len(sys.argv) < 3:
            print("Usage: identity.py update <action>")
            sys.exit(1)
        result = update_traits_from_action(sys.argv[2])
        print(json.dumps(result, indent=2))
    elif command == "narrative":
        print(generate_narrative())
    elif command == "get":
        print(json.dumps(get_identity(), indent=2))
    else:
        print(f"Unknown command: {command}")
