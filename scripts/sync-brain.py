#!/usr/bin/env python3
"""
Maria Sim — Brain State Sync
Bidirectional synchronization between Maria Sim and brain-state.json
"""

import json
from pathlib import Path

SIM_STATE = Path("/Users/johann/.openclaw/workspace-sentinel/maria-simulation/state/maria-state.json")
BRAIN_STATE = Path("/Users/johann/.openclaw/workspace-sentinel/brain-state.json")

def load_json(path):
    with open(path) as f:
        return json.load(f)

def save_json(path, data):
    with open(path, 'w') as f:
        json.dump(data, f, indent=2)

def sync_sim_to_brain():
    """Sync Maria Sim needs to brain state"""
    sim = load_json(SIM_STATE)
    brain = load_json(BRAIN_STATE)
    
    # Map sim needs to brain systems
    brain["sim"]["last_sync"] = sim["last_updated"]
    
    # Sim needs → brain mappings
    # Energy (sim 0-100) → hypothalamus.energy (brain 0-1)
    energy_ratio = sim["needs"]["energy"] / 100.0
    if "hypothalamus" in brain["cognitive"]:
        brain["cognitive"]["hypothalamus"]["energy_level"] = energy_ratio
    
    # Fun → amygdala valence
    fun_ratio = sim["needs"]["fun"] / 100.0
    if "amygdala" in brain["cognitive"]:
        brain["cognitive"]["amygdala"]["valence"] = fun_ratio
    
    # Social → amygdala connection
    social_ratio = sim["needs"]["social"] / 100.0
    if "amygdala" in brain["cognitive"]:
        brain["cognitive"]["amygdala"]["connection"] = social_ratio
    
    # Purpose → VTA drive
    purpose_ratio = sim["needs"]["purpose"] / 100.0
    if "vta" in brain["cognitive"]:
        brain["cognitive"]["vta"]["drive"] = purpose_ratio
    
    save_json(BRAIN_STATE, brain)
    return f"Synced sim→brain: energy={energy_ratio:.2f}, fun={fun_ratio:.2f}, social={social_ratio:.2f}, purpose={purpose_ratio:.2f}"

def sync_brain_to_sim():
    """Sync brain state to Maria Sim (for external events)"""
    sim = load_json(SIM_STATE)
    brain = load_json(BRAIN_STATE)
    
    # Check for external events that might affect sim
    # For now, just track sync
    sim["brain_sync"] = brain["timestamp"]
    
    save_json(SIM_STATE, sim)
    return "Synced brain→sim"

def status():
    """Show sync status"""
    sim = load_json(SIM_STATE)
    brain = load_json(BRAIN_STATE)
    
    return {
        "sim_needs": sim["needs"],
        "brain_systems": {
            "hypothalamus_energy": brain["cognitive"].get("hypothalamus", {}).get("energy_level"),
            "amygdala_valence": brain["cognitive"].get("amygdala", {}).get("valence"),
            "amygdala_connection": brain["cognitive"].get("amygdala", {}).get("connection"),
            "vta_drive": brain["cognitive"].get("vta", {}).get("drive")
        },
        "last_sim_sync": sim.get("last_updated"),
        "last_brain_sync": brain.get("sim", {}).get("last_sync")
    }

if __name__ == "__main__":
    import sys
    if len(sys.argv) > 1:
        if sys.argv[1] == "sim_to_brain":
            print(sync_sim_to_brain())
        elif sys.argv[1] == "brain_to_sim":
            print(sync_brain_to_sim())
        elif sys.argv[1] == "status":
            print(json.dumps(status(), indent=2))
    else:
        print("Sync: sim ↔ brain")
        print("Usage: sync.py [sim_to_brain|brain_to_sim|status]")
