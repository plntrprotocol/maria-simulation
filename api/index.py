#!/usr/bin/env python3
"""
Maria Simulation API - Vercel Serverless
"""

import json
import os
from pathlib import Path

# Initialize paths
BASE_DIR = Path(os.environ.get('MARIA_BASE_DIR', '/tmp/maria-sim'))
BASE_DIR.mkdir(parents=True, exist_ok=True)
STATE_FILE = BASE_DIR / "state.json"

# Default state
DEFAULT_STATE = {
    "needs": {"energy": 80, "hunger": 80, "social": 60, "fun": 60, "purpose": 60},
    "emotions": {"mood": "neutral", "stress": 0.3, "confidence": 0.5, "loneliness": 0.2, "meaningfulness": 0.6},
    "skills": {},
    "identity": {}
}

# Dashboard HTML
DASHBOARD = """<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>Maria Sim</title>
<style>body{font-family:system-ui;background:#0a0a0f;color:#e2e8f0;padding:20px}.c{max-width:800px;margin:0 auto}.s{background:#12121a;padding:20px;border-radius:12px;margin:10px 0}.n{display:grid;grid-template-columns:repeat(5,1fr);gap:10px}.n>div{background:#1a1a25;padding:15px;border-radius:8px;text-align:center}b{color:#7c3aed}.m{font-size:3em;text-align:center}button{background:#7c3aed;color:#fff;border:none;padding:10px 20px;border-radius:6px;cursor:pointer;margin:5px}button:hover{background:#6d28d9}</style></head>
<body><div class="c"><h1>🐦 Maria Sim</h1><div class="s"><div class="m" id="m">😐</div><div class="n" id="n">Loading...</div></div><h3>Actions</h3>
<button onclick="do('running')">Run</button><button onclick="do('rucking')">Ruck</button><button onclick="do('gym')">Gym</button><button onclick="do('talk_anduril')">Anduril</button><button onclick="do('talk_palantir')">Palantir</button><button onclick="do('research')">Research</button><button onclick="do('writing')">Write</button><button onclick="do('rest')">Rest</button><button onclick="do('music')">Music</button>
<div id="r"></div></div>
<script>const e={happy:'😊',sad:'😢',anxious:'😰',calm:'😌',excited:'🤩',neutral:'😐'};
async function l(){const r=await fetch('/api/status');const d=await r.json();document.getElementById('m').textContent=e[d.emotions?.mood]||'😐';const n=d.needs||{};document.getElementById('n').innerHTML=Object.entries(n).map(([k,v])=>'<div><b>'+k+'</b><br>'+v+'%</div>').join('');}
async function do(a){document.getElementById('r').textContent='...';const r=await fetch('/api/action',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:a})});const d=await r.json();document.getElementById('r').textContent=d.status==='success'?'✅ '+a:'❌ '+(d.error||'Error');l();}
l();</script></body></html>"""

def load_state():
    try:
        if STATE_FILE.exists():
            with open(STATE_FILE) as f:
                return json.load(f)
    except:
        pass
    return DEFAULT_STATE.copy()

def save_state(state):
    try:
        with open(STATE_FILE, 'w') as f:
            json.dump(state, f)
    except:
        pass

ACTIONS = {
    "running": {"energy": -15, "hunger": -5, "fun": +5, "purpose": +2},
    "rucking": {"energy": -20, "hunger": -8, "fun": +3, "purpose": +5},
    "gym": {"energy": -12, "hunger": -5, "fun": +4, "purpose": +2},
    "dancing": {"energy": -8, "hunger": -3, "social": +15, "fun": +15, "purpose": +2},
    "talk_anduril": {"energy": -2, "social": +15, "fun": +5, "purpose": +5},
    "talk_palantir": {"energy": -2, "social": +12, "fun": +5, "purpose": +3},
    "talk_isildur": {"energy": -2, "social": +12, "fun": +5, "purpose": +3},
    "research": {"energy": -8, "fun": +3, "purpose": +8},
    "writing": {"energy": -6, "fun": +6, "purpose": +10},
    "backup_work": {"energy": -4, "fun": +2, "purpose": +15},
    "rest": {"energy": +10, "fun": +2},
    "sleep": {"energy": +40},
    "music": {"energy": +2, "fun": +12},
    "eat": {"energy": +5, "hunger": +30, "fun": +3},
    "reading": {"energy": -5, "fun": +5, "purpose": +5},
    "drive": {"energy": -5, "fun": +10, "purpose": +2},
}

def handler(event, context):
    """Vercel handler"""
    path = event.get("path", "/")
    method = event.get("httpMethod", "GET")
    
    headers = {"Access-Control-Allow-Origin": "*", "Content-Type": "application/json"}
    
    if method == "OPTIONS":
        return {"statusCode": 200, "headers": {**headers, "Access-Control-Allow-Methods": "GET,POST,OPTIONS"}, "body": ""}
    
    # API endpoints
    if path == "/api/status" and method == "GET":
        return {"statusCode": 200, "headers": headers, "body": json.dumps(load_state())}
    
    if path == "/api/action" and method == "POST":
        try:
            body = json.loads(event.get("body", "{}"))
            action = body.get("action", "")
            if action not in ACTIONS:
                return {"statusCode": 400, "headers": headers, "body": json.dumps({"error": "Unknown action"})}
            
            state = load_state()
            needs = state.get("needs", {})
            for k, v in ACTIONS[action].items():
                needs[k] = max(0, min(100, needs.get(k, 50) + v))
            state["needs"] = needs
            state["emotions"] = {"mood": "happy" if "talk" in action else "neutral"}
            save_state(state)
            return {"statusCode": 200, "headers": headers, "body": json.dumps({"status": "success", "action": action})}
        except Exception as ex:
            return {"statusCode": 500, "headers": headers, "body": json.dumps({"error": str(ex)})}
    
    # Default - serve dashboard
    return {"statusCode": 200, "headers": {"Content-Type": "text/html"}, "body": DASHBOARD}
