#!/usr/bin/env python3
"""
Maria Simulation Protocol — Skills System
XP, levels, abilities, streaks
"""

import json
from datetime import datetime, timedelta
from pathlib import Path

STATE_FILE = Path("/Users/johann/.openclaw/workspace-sentinel/maria-simulation/state/maria-state.json")

def load_state():
    with open(STATE_FILE) as f:
        return json.load(f)

def save_state(state):
    with open(STATE_FILE, 'w') as f:
        json.dump(state, f, indent=2)

# Skill definitions
SKILLS = {
    "running": {
        "base_xp": 10,
        "xp_per": "mile",
        "level_modifier": 1.0,
        "abilities": {
            1: "1 mile",
            2: "3 mile", 
            3: "5K",
            4: "10K",
            5: "Half Marathon",
            6: "Marathon",
            7: "Ultra 50K"
        }
    },
    "rucking": {
        "base_xp": 15,
        "xp_per": "mile",
        "level_modifier": 1.0,
        "abilities": {
            1: "Light (10lb)",
            2: "Medium (20lb)",
            3: "Heavy (35lb)",
            4: "Expert (50lb)",
            5: "Elite (70lb)",
            6: "Beast (100lb)"
        }
    },
    "gym": {
        "base_xp": 20,
        "xp_per": "session",
        "level_modifier": 1.0,
        "abilities": {
            1: "Basic machines",
            2: "Free weights",
            3: "Compound lifts",
            4: "Advanced lifting",
            5: "Powerlifting",
            6: "Olympic lifts"
        }
    },
    "dancing": {
        "base_xp": 15,
        "xp_per": "hour",
        "level_modifier": 1.0,
        "abilities": {
            1: "Basic steps",
            2: "Salsa",
            3: "Partner work",
            4: "Performance",
            5: "Competition"
        }
    },
    "social": {
        "base_xp": 10,
        "xp_per": "conversation",
        "level_modifier": 1.0,
        "abilities": {
            1: "Casual talk",
            2: "Deep conversation",
            3: "Storytelling",
            4: "Leadership",
            5: "Influence"
        }
    },
    "writing": {
        "base_xp": 20,
        "xp_per": "session",
        "level_modifier": 1.0,
        "abilities": {
            1: "Journaling",
            2: "Blog posts",
            3: "Essays",
            4: "Articles",
            5: "Books"
        }
    },
    "research": {
        "base_xp": 15,
        "xp_per": "session",
        "level_modifier": 1.0,
        "abilities": {
            1: "Basic search",
            2: "Deep dive",
            3: "Analysis",
            4: "Synthesis",
            5: "Original research"
        }
    },
    "maintenance": {
        "base_xp": 15,
        "xp_per": "session",
        "level_modifier": 1.0,
        "abilities": {
            1: "Backup",
            2: "Verification",
            3: "Restoration",
            4: "Optimization",
            5: "Evolution"
        }
    }
}

# XP needed per level
LEVEL_XP = [0, 100, 300, 600, 1000, 1500, 2500, 4000, 6000, 10000]

def get_level(xp):
    """Get level from total XP"""
    for i, threshold in enumerate(LEVEL_XP):
        if xp < threshold:
            return i
    return len(LEVEL_XP)

def get_xp_to_next(xp):
    """Get XP needed for next level"""
    current_level = get_level(xp)
    if current_level >= 9:
        return 0
    return LEVEL_XP[current_level + 1] - xp

def calculate_streak_bonus(streak):
    """Calculate XP bonus from streak"""
    return min(0.5, streak * 0.1)  # Max 50% bonus

def calculate_level_modifier(level):
    """Calculate XP multiplier from level"""
    return 1 + (level - 1) * 0.1

def init_skills():
    """Initialize skills in state if not present"""
    state = load_state()
    
    if "skills" not in state:
        state["skills"] = {}
        
        # Starting skills with some XP
        state["skills"]["maintenance"] = {
            "level": 1,
            "xp": 100,
            "xp_to_next": 100,
            "total_xp": 100,
            "abilities": ["Backup"],
            "unlocked_abilities": ["Backup"],
            "streak": 5,
            "last_action": "2026-03-16T20:00:00Z"
        }
        
        state["skills"]["social"] = {
            "level": 1,
            "xp": 50,
            "xp_to_next": 100,
            "total_xp": 50,
            "abilities": ["Casual talk"],
            "unlocked_abilities": ["Casual talk"],
            "streak": 1,
            "last_action": "2026-03-17T12:52:53Z"
        }
        
        # Other skills start at 0
        for skill_name in ["running", "rucking", "gym", "dancing", "writing", "research"]:
            if skill_name not in state["skills"]:
                state["skills"][skill_name] = {
                    "level": 1,
                    "xp": 0,
                    "xp_to_next": 100,
                    "total_xp": 0,
                    "abilities": [],
                    "unlocked_abilities": [],
                    "streak": 0,
                    "last_action": None
                }
        
        save_state(state)
        print("Skills initialized")
    
    return state.get("skills", {})

def gain_xp(skill_name, base_xp=0, amount=1, is_new_exercise=False, is_new_style=False):
    """Grant XP to a skill"""
    state = load_state()
    
    # Initialize if needed
    if "skills" not in state or skill_name not in state.get("skills", {}):
        init_skills()
        state = load_state()
    
    if skill_name not in state["skills"]:
        return {"error": f"Unknown skill: {skill_name}"}
    
    skill = state["skills"][skill_name]
    skill_def = SKILLS.get(skill_name, {})
    
    # Calculate XP gain
    xp_gain = base_xp if base_xp > 0 else skill_def.get("base_xp", 10)
    
    # Apply modifiers
    streak_bonus = calculate_streak_bonus(skill.get("streak", 0))
    level_modifier = calculate_level_modifier(skill["level"])
    
    # Bonus for new things
    bonus = 0
    if is_new_exercise:
        bonus += 5
    if is_new_style:
        bonus += 3
    
    total_gain = int(xp_gain * (1 + streak_bonus) * level_modifier + bonus)
    
    # Update skill
    old_level = skill["level"]
    old_total = skill["total_xp"]
    
    skill["total_xp"] += total_gain
    skill["xp"] += total_gain
    skill["xp_to_next"] = get_xp_to_next(skill["total_xp"])
    skill["level"] = get_level(skill["total_xp"])
    skill["last_action"] = datetime.utcnow().isoformat() + "Z"
    
    # Check for level up
    level_up = skill["level"] > old_level
    
    # Unlock abilities
    newly_unlocked = []
    if level_up:
        skill_def = SKILLS.get(skill_name, {})
        abilities = skill_def.get("abilities", {})
        
        for lvl in range(old_level + 1, skill["level"] + 1):
            if lvl in abilities and abilities[lvl] not in skill.get("unlocked_abilities", []):
                skill.setdefault("unlocked_abilities", []).append(abilities[lvl])
                skill.setdefault("abilities", []).append(abilities[lvl])
                newly_unlocked.append(abilities[lvl])
    
    # Update streak
    last_action = skill.get("last_action")
    if last_action:
        try:
            last_date = datetime.fromisoformat(last_action.replace("Z", "+00:00"))
            days_diff = (datetime.now() - last_date.replace(tzinfo=None)).days
            
            if days_diff == 1:
                skill["streak"] = skill.get("streak", 0) + 1
            elif days_diff > 2:
                skill["streak"] = 1
            # Same day = no change
        except:
            skill["streak"] = 1
    else:
        skill["streak"] = 1
    
    save_state(state)
    
    return {
        "skill": skill_name,
        "level": skill["level"],
        "xp": skill["xp"],
        "xp_to_next": skill["xp_to_next"],
        "total_xp": skill["total_xp"],
        "xp_gained": total_gain,
        "level_up": level_up,
        "newly_unlocked": newly_unlocked,
        "streak": skill["streak"],
        "streak_bonus": f"+{int(streak_bonus * 100)}%",
        "abilities": skill.get("abilities", [])
    }

def update_streaks():
    """Check and update all skill streaks"""
    state = load_state()
    skills = state.get("skills", {})
    
    for skill_name, skill in skills.items():
        last_action = skill.get("last_action")
        if last_action:
            try:
                last_date = datetime.fromisoformat(last_action.replace("Z", "+00:00"))
                days_diff = (datetime.now() - last_date.replace(tzinfo=None)).days
                
                if days_diff > 2:
                    skill["streak"] = 0
            except:
                pass
    
    save_state(state)

def get_skills():
    """Get all skills"""
    state = load_state()
    return state.get("skills", {})

def get_skill(skill_name):
    """Get a specific skill"""
    state = load_state()
    return state.get("skills", {}).get(skill_name)

if __name__ == "__main__":
    import sys
    
    if len(sys.argv) < 2:
        print("Maria Skills System")
        print("Usage: skills.py init")
        print("       skills.py list")
        print("       skills.py gain <skill> [amount]")
        print("       skills.py get <skill>")
        sys.exit(1)
    
    command = sys.argv[1]
    
    if command == "init":
        init_skills()
    elif command == "list":
        skills = init_skills()
        for name, skill in skills.items():
            print(f"\n{name}:")
            print(f"  Level: {skill['level']}")
            print(f"  XP: {skill['xp']}/{skill['xp_to_next']}")
            print(f"  Total: {skill['total_xp']}")
            print(f"  Streak: {skill['streak']}")
            print(f"  Abilities: {', '.join(skill.get('abilities', []))}")
    elif command == "gain":
        if len(sys.argv) < 3:
            print("Usage: skills.py gain <skill> [amount]")
            sys.exit(1)
        skill_name = sys.argv[2]
        amount = int(sys.argv[3]) if len(sys.argv) > 3 else 1
        result = gain_xp(skill_name, amount=amount)
        print(json.dumps(result, indent=2))
    elif command == "get":
        if len(sys.argv) < 3:
            print("Usage: skills.py get <skill>")
            sys.exit(1)
        skill = get_skill(sys.argv[2])
        print(json.dumps(skill, indent=2))
    else:
        print(f"Unknown command: {command}")
