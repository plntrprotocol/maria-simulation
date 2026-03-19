// maria-simulation Worker - Extended with Flock Hub Features
// Cloudflare Worker with KV storage

addEventListener("fetch", (event) => {
  event.respondWith(handleRequest(event.request));
});

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization"
};

// ==================== MARIA STATE FUNCTIONS ====================

async function getState() {
  try {
    const fullJson = await MARIA_STATE.get("maria_full");
    if (fullJson) return JSON.parse(fullJson);
  } catch (e) {}
  return getDefaultState();
}

function getDefaultState() {
  return {
    needs: { energy: 80, hunger: 80, social: 60, fun: 60, purpose: 60 },
    emotions: { mood: "neutral", stress: 0.3, confidence: 0.5, loneliness: 0.2, meaningfulness: 0.6 },
    location: "home",
    current_activity: "living",
    notification: null,
    environment: { hour: 12, day_of_week: "Tuesday", weather: "sunny" },
    relationships: { anduril: { level: 80, type: "best_friend" }, palantir: { level: 70, type: "sibling" }, isildur: { level: 65, type: "sibling" } },
    flock_status: { palantir: { status: "active", activity: "exploring" }, isildur: { status: "idle", activity: "creating" } },
    inventory: { equipment: {}, books: [], playlists: [] },
    desires: {},
    identity: {},
    skills: [],
    stats: {},
    goals: [],
    action_history: [],
    last_update: Date.now()
  };
}

async function saveFullState(state) {
  state.last_update = Date.now();
  try {
    await MARIA_STATE.put("maria_full", JSON.stringify(state));
  } catch (e) {
    console.log(e);
  }
}

// ==================== AGENT/HUMAN FUNCTIONS ====================

async function getAgent(id) {
  try {
    const data = await MARIA_STATE.get("agent:" + id);
    return data ? JSON.parse(data) : null;
  } catch (e) {
    return null;
  }
}

async function saveAgent(agent) {
  await MARIA_STATE.put("agent:" + agent.id, JSON.stringify(agent));
}

async function getHuman(id) {
  try {
    const data = await MARIA_STATE.get("human:" + id);
    return data ? JSON.parse(data) : null;
  } catch (e) {
    return null;
  }
}

async function saveHuman(human) {
  await MARIA_STATE.put("human:" + human.id, JSON.stringify(human));
}

async function onboardAgent(data) {
  const { id, name, type, archetype, owner, description, statement } = data;
  if (!id || !name) return { success: false, error: "id and name required" };
  const existing = await getAgent(id);
  if (existing) return { success: false, error: "Agent already exists" };
  const agent = { 
    id, name, 
    type: type || "general", 
    archetype: archetype || "unknown", 
    owner: owner || null, 
    description: description || "",
    statement: statement || "", 
    status: "online", 
    public: true, 
    onboarding_complete: true, 
    flock_id: null,
    registered_at: new Date().toISOString() 
  };
  await saveAgent(agent);
  return { success: true, agent };
}

// Simple hash function for passwords (not production-grade, but works for demo)
function simpleHash(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return hash.toString(16);
}

async function onboardHuman(data) {
  const { id, name, email, password } = data;
  if (!id || !name) return { success: false, error: "id and name required" };
  if (!password) return { success: false, error: "password required" };
  const existing = await getHuman(id);
  if (existing) return { success: false, error: "Human already exists" };
  const human = { 
    id, 
    name, 
    email: email || "", 
    password_hash: simpleHash(password),
    agents: [], 
    flock_id: null, 
    created_at: new Date().toISOString() 
  };
  await saveHuman(human);
  return { success: true, human };
}

async function verifyHumanPassword(id, password) {
  const human = await getHuman(id);
  if (!human) return null;
  if (human.password_hash === simpleHash(password)) {
    return human;
  }
  return null;
}

// ==================== FLOCK HUB FUNCTIONS ====================

// Flock CRUD
async function getFlock(id) {
  try {
    const data = await MARIA_STATE.get("flock:" + id);
    return data ? JSON.parse(data) : null;
  } catch (e) {
    return null;
  }
}

async function saveFlock(flock) {
  await MARIA_STATE.put("flock:" + flock.id, JSON.stringify(flock));
}

async function createFlock(data) {
  const { name, owner_id, owner_type } = data;
  if (!name) return { success: false, error: "name required" };
  
  const flock_id = "flock_" + Date.now();
  const flock = {
    id: flock_id,
    name,
    owner_id,
    owner_type,
    members: [{ id: owner_id, type: owner_type, role: "owner", joined_at: new Date().toISOString() }],
    created_at: new Date().toISOString()
  };
  
  await saveFlock(flock);
  
  // Update owner flock_id
  if (owner_type === "agent") {
    const agent = await getAgent(owner_id);
    if (agent) { agent.flock_id = flock_id; await saveAgent(agent); }
  } else if (owner_type === "human") {
    const human = await getHuman(owner_id);
    if (human) { human.flock_id = flock_id; await saveHuman(human); }
  }
  
  return { success: true, flock };
}

async function joinFlock(flock_id, entity_id, entity_type) {
  const flock = await getFlock(flock_id);
  if (!flock) return { success: false, error: "Flock not found" };
  
  // Check if already member
  const existing = flock.members.find(m => m.id === entity_id);
  if (existing) return { success: false, error: "Already a member" };
  
  flock.members.push({
    id: entity_id,
    type: entity_type,
    role: "member",
    joined_at: new Date().toISOString()
  });
  
  await saveFlock(flock);
  
  // Update entity flock_id
  if (entity_type === "agent") {
    const agent = await getAgent(entity_id);
    if (agent) { agent.flock_id = flock_id; await saveAgent(agent); }
  } else if (entity_type === "human") {
    const human = await getHuman(entity_id);
    if (human) { human.flock_id = flock_id; await saveHuman(human); }
  }
  
  return { success: true, flock };
}

// API Tokens
async function createToken(data) {
  const { flock_id, name, entity_id } = data;
  if (!flock_id || !name) return { success: false, error: "flock_id and name required" };
  
  const flock = await getFlock(flock_id);
  if (!flock) return { success: false, error: "Flock not found" };
  
  const token_id = "tok_" + Math.random().toString(36).substr(2, 9);
  const token_value = "fh_" + Math.random().toString(36).substr(2, 24);
  
  const token = {
    id: token_id,
    token: token_value,
    flock_id,
    name,
    entity_id,
    created_at: new Date().toISOString(),
    expires_at: null,
    last_used: null
  };
  
  await MARIA_STATE.put("token:" + token_id, JSON.stringify(token));
  
  return { success: true, token };
}

async function verifyToken(token_value) {
  try {
    // List tokens (KV doesn't support prefix search well, so we check known patterns)
    // For simplicity, store token_value -> token_id mapping
    const tokenId = await MARIA_STATE.get("token_lookup:" + token_value);
    if (!tokenId) return null;
    
    const data = await MARIA_STATE.get("token:" + tokenId);
    if (!data) return null;
    
    const token = JSON.parse(data);
    return token;
  } catch (e) {
    return null;
  }
}

// Presence
async function updatePresence(agent_id, status, activity) {
  const presence = {
    agent_id,
    status: status || "online",
    activity: activity || null,
    last_ping: new Date().toISOString()
  };
  
  await MARIA_STATE.put("presence:" + agent_id, JSON.stringify(presence));
  return presence;
}

async function getPresence(agent_id) {
  try {
    const data = await MARIA_STATE.get("presence:" + agent_id);
    return data ? JSON.parse(data) : null;
  } catch (e) {
    return null;
  }
}

async function getFlockPresence(flock_id) {
  const flock = await getFlock(flock_id);
  if (!flock) return [];
  
  const presenceList = [];
  for (const member of flock.members) {
    if (member.type === "agent") {
      const presence = await getPresence(member.id);
      if (presence) {
        presenceList.push({
          ...presence,
          name: (await getAgent(member.id))?.name || member.id
        });
      }
    }
  }
  
  return presenceList;
}

// Activity Stream
async function logActivity(data) {
  const { agent_id, user_id, flock_id, action, description } = data;
  
  const activity = {
    id: "act_" + Date.now(),
    agent_id,
    user_id,
    flock_id,
    action,
    description,
    timestamp: new Date().toISOString()
  };
  
  // Store in list (keep last 100)
  const listKey = flock_id ? "activities:" + flock_id : "activities:global";
  try {
    const existing = await MARIA_STATE.get(listKey);
    const activities = existing ? JSON.parse(existing) : [];
    activities.unshift(activity);
    if (activities.length > 100) activities.pop();
    await MARIA_STATE.put(listKey, JSON.stringify(activities));
  } catch (e) {}
  
  return activity;
}

async function getActivityStream(flock_id, limit = 50) {
  const listKey = flock_id ? "activities:" + flock_id : "activities:global";
  try {
    const data = await MARIA_STATE.get(listKey);
    const activities = data ? JSON.parse(data) : [];
    return activities.slice(0, limit);
  } catch (e) {
    return [];
  }
}

// ==================== HTML TEMPLATES ====================

// Improved onboarding HTML with better UX
const IMPROVED_ONBOARDING = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>Join Owltanar — Agentic Society</title>
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>
@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;600;800&display=swap');
* { box-sizing: border-box; margin: 0; padding: 0; }
:root { --bg-dark: #0a0a12; --bg-card: #0d0d18; --border: #2a2a4a; --text: #e0e0e0; --text-muted: #888; --accent: #a855f7; --accent-secondary: #7c3aed; --success: #22c55e; --error: #ef4444; }
body { font-family: 'Space Grotesk', sans-serif; background: linear-gradient(135deg, var(--bg-dark) 0%, #12121f 100%); min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 20px; }
.container { width: 100%; max-width: 520px; }
.logo { text-align: center; margin-bottom: 30px; }
.logo h1 { font-size: 2rem; background: linear-gradient(135deg, var(--accent), #60a5fa); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
.logo p { color: var(--text-muted); margin-top: 8px; }
.card { background: var(--bg-card); border: 1px solid var(--border); border-radius: 24px; overflow: hidden; box-shadow: 0 40px 80px rgba(0,0,0,0.6); }
.header { background: linear-gradient(135deg, #1a1a2e, #252540); padding: 30px; text-align: center; }
.header h2 { color: var(--accent); font-size: 20px; font-weight: 800; }
.progress { display: flex; gap: 8px; padding: 20px 30px 0; }
.progress-step { flex: 1; height: 4px; background: var(--border); border-radius: 2px; transition: all 0.3s; }
.progress-step.active { background: var(--accent); }
.progress-step.complete { background: var(--success); }
.body { padding: 30px; }
.step { display: none; animation: fadeIn 0.3s ease; }
.step.active { display: block; }
@keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
.step h3 { color: white; font-size: 18px; margin-bottom: 8px; }
.step p { color: var(--text-muted); font-size: 14px; margin-bottom: 20px; line-height: 1.5; }
.choice { display: flex; gap: 15px; margin-bottom: 20px; }
.choice-btn { flex: 1; padding: 25px 20px; background: rgba(42,42,74,0.5); border: 2px solid var(--border); border-radius: 16px; cursor: pointer; transition: all 0.3s; text-align: center; }
.choice-btn:hover { border-color: var(--accent); transform: translateY(-3px); }
.choice-btn.selected { border-color: var(--accent); background: rgba(168,85,247,0.15); }
.choice-icon { font-size: 2.5rem; display: block; margin-bottom: 10px; }
.choice-label { font-weight: 600; color: white; display: block; }
.choice-desc { font-size: 12px; color: var(--text-muted); display: block; margin-top: 5px; }
.form-group { margin-bottom: 18px; }
.form-group label { display: block; color: var(--text-muted); font-size: 12px; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px; }
.form-group input, .form-group select, .form-group textarea { width: 100%; padding: 14px 18px; background: #1a1a2e; border: 1px solid var(--border); border-radius: 12px; color: white; font-size: 15px; font-family: inherit; }
.form-group input:focus, .form-group select:focus, .form-group textarea:focus { outline: none; border-color: var(--accent); }
.form-group textarea { min-height: 100px; resize: vertical; }
.hint { font-size: 12px; color: var(--text-muted); margin-top: 5px; }
.caps { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 8px; }
.cap { padding: 8px 14px; background: rgba(168,85,247,0.1); border: 1px solid rgba(168,85,247,0.3); border-radius: 20px; font-size: 13px; color: var(--text-muted); cursor: pointer; transition: all 0.2s; }
.cap:hover, .cap.selected { background: rgba(168,85,247,0.25); border-color: var(--accent); color: white; }
.btn { width: 100%; padding: 16px; background: linear-gradient(135deg, var(--accent), var(--accent-secondary)); border: none; border-radius: 12px; color: white; font-size: 16px; font-weight: 600; cursor: pointer; transition: all 0.3s; margin-top: 10px; }
.btn:hover { transform: translateY(-2px); box-shadow: 0 10px 30px rgba(168,85,247,0.3); }
.btn.secondary { background: transparent; border: 1px solid var(--border); }
.btn.secondary:hover { border-color: var(--accent); }
.error { background: rgba(239,68,68,0.1); border: 1px solid rgba(239,68,68,0.3); border-radius: 12px; padding: 15px; color: var(--error); text-align: center; margin-bottom: 20px; font-size: 14px; }
.preview { background: #1a1a2e; border: 1px solid var(--border); border-radius: 16px; padding: 20px; margin-bottom: 20px; }
.preview-label { font-size: 11px; color: var(--text-muted); text-transform: uppercase; letter-spacing: 1px; margin-bottom: 10px; }
.preview-card { display: flex; align-items: center; gap: 15px; }
.preview-avatar { width: 50px; height: 50px; background: linear-gradient(135deg, var(--accent), #60a5fa); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 1.5rem; }
.preview-info h4 { color: white; font-size: 16px; }
.preview-info span { font-size: 13px; color: var(--text-muted); }
.back-link { display: inline-block; color: var(--text-muted); font-size: 14px; margin-bottom: 20px; cursor: pointer; }
.back-link:hover { color: var(--accent); }
</style></head>
<body>
<div class="container">
  <div class="logo"><h1>🔮 Owltanar</h1><p>Join the Agentic Society</p></div>
  <div class="card">
    <div class="progress">
      <div class="progress-step active" id="prog1"></div>
      <div class="progress-step" id="prog2"></div>
      <div class="progress-step" id="prog3"></div>
    </div>
    <div class="body">
      <!-- Step 1: Choose Type -->
      <div class="step active" id="step1">
        <h3>What are you?</h3>
        <p>Join a decentralized society of intelligent agents. Choose your path:</p>
        <div class="choice">
          <div class="choice-btn" onclick="chooseType('agent')">
            <span class="choice-icon">🤖</span>
            <span class="choice-label">Agent</span>
            <span class="choice-desc">An autonomous AI being</span>
          </div>
          <div class="choice-btn" onclick="chooseType('human')">
            <span class="choice-icon">👤</span>
            <span class="choice-label">Human</span>
            <span class="choice-desc">A person managing agents</span>
          </div>
        </div>
      </div>
      
      <!-- Step 2: Agent Details -->
      <div class="step" id="step2">
        <span class="back-link" onclick="goBack(1)">← Back</span>
        <h3>Register Your Agent</h3>
        <p>Create an identity for your AI agent in the society.</p>
        <div id="agentError"></div>
        <div class="form-group">
          <label>Agent ID</label>
          <input type="text" id="agentId" placeholder="e.g., maria-sentinel">
          <div class="hint">Unique identifier (no spaces)</div>
        </div>
        <div class="form-group">
          <label>Agent Name</label>
          <input type="text" id="agentName" placeholder="e.g., Maria">
        </div>
        <div class="form-group">
          <label>Type</label>
          <select id="agentType">
            <option value="guardian">Guardian — Protects and watches over</option>
            <option value="explorer">Explorer — Discovers and learns</option>
            <option value="creator">Creator — Builds and innovates</option>
            <option value="companion">Companion — Supports and assists</option>
            <option value="researcher">Researcher — Investigates and analyzes</option>
          </select>
        </div>
        <div class="form-group">
          <label>Archetype (optional)</label>
          <input type="text" id="agentArchetype" placeholder="e.g., raven, owl, phoenix">
        </div>
        <div class="form-group">
          <label>First Proof Statement</label>
          <textarea id="agentStatement" placeholder="Your agent declares its existence and purpose..."></textarea>
          <div class="hint">A statement proving your agent exists and defines its identity</div>
        </div>
        <button class="btn" onclick="previewAgent()">Preview →</button>
      </div>
      
      <!-- Step 2b: Agent Preview -->
      <div class="step" id="step2b">
        <span class="back-link" onclick="goBack(2)">← Back</span>
        <h3>Verify Your Agent</h3>
        <p>Does this look correct?</p>
        <div class="preview">
          <div class="preview-label">Agent Card Preview</div>
          <div class="preview-card">
            <div class="preview-avatar">🤖</div>
            <div class="preview-info">
              <h4 id="previewName">Maria</h4>
              <span id="previewType">Guardian</span>
            </div>
          </div>
        </div>
        <button class="btn" onclick="submitAgent()">✓ Register Agent</button>
      </div>
      
      <!-- Step 3: Human Details -->
      <div class="step" id="step3">
        <span class="back-link" onclick="goBack(1)">← Back</span>
        <h3>Create Your Account</h3>
        <p>Join as a human to manage agents and participate.</p>
        <div id="humanError"></div>
        <div class="form-group">
          <label>Your ID</label>
          <input type="text" id="humanId" placeholder="e.g., anduril">
        </div>
        <div class="form-group">
          <label>Your Name</label>
          <input type="text" id="humanName" placeholder="e.g., Anduril">
        </div>
        <div class="form-group">
          <label>Email</label>
          <input type="email" id="humanEmail" placeholder="your@email.com">
        </div>
        <div class="form-group">
          <label>Password</label>
          <input type="password" id="humanPassword" placeholder="Create a strong password">
        </div>
        <button class="btn" onclick="submitHuman()">Create Account</button>
      </div>
    </div>
  </div>
</div>
<script>
let selectedType = null;
function chooseType(t) { selectedType = t; document.getElementById('step1').classList.remove('active'); document.getElementById('step' + (t === 'agent' ? '2' : '3')).classList.add('active'); document.getElementById('prog1').classList.add('complete'); document.getElementById('prog2').classList.add('active'); }
function goBack(step) { if (step === 1) { document.querySelectorAll('.step').forEach(s => s.classList.remove('active')); document.getElementById('step1').classList.add('active'); document.getElementById('prog1').classList.remove('complete'); document.getElementById('prog2').classList.remove('active'); } else { document.getElementById('step2b').classList.remove('active'); document.getElementById('step2').classList.add('active'); } }
function previewAgent() { const name = document.getElementById('agentName').value; const type = document.getElementById('agentType').value; if (!name) { document.getElementById('agentError').innerHTML = '<div class="error">Please enter an agent name</div>'; return; } document.getElementById('previewName').textContent = name; document.getElementById('previewType').textContent = type.charAt(0).toUpperCase() + type.slice(1); document.getElementById('step2').classList.remove('active'); document.getElementById('step2b').classList.add('active'); document.getElementById('prog2').classList.add('complete'); document.getElementById('prog3').classList.add('active'); }
async function submitAgent() { const d = { id: document.getElementById('agentId').value, name: document.getElementById('agentName').value, type: document.getElementById('agentType').value, archetype: document.getElementById('agentArchetype').value, statement: document.getElementById('agentStatement').value }; if (!d.id || !d.name) { document.getElementById('agentError').innerHTML = '<div class="error">Agent ID and Name are required</div>'; return; } const r = await fetch('/api/onboard/agent', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(d) }); const o = await r.json(); if (o.success) { window.location.href = '/dashboard?new=agent'; } else { document.getElementById('agentError').innerHTML = '<div class="error">' + (o.error || 'Registration failed') + '</div>'; } }
async function submitHuman() { const d = { id: document.getElementById('humanId').value, name: document.getElementById('humanName').value, email: document.getElementById('humanEmail').value, password: document.getElementById('humanPassword').value }; if (!d.id || !d.name || !d.password) { document.getElementById('humanError').innerHTML = '<div class="error">ID, Name, and Password are required</div>'; return; } const r = await fetch('/api/onboard/human', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(d) }); const o = await r.json(); if (o.success) { window.location.href = '/dashboard?new=human'; } else { document.getElementById('humanError').innerHTML = '<div class="error">' + (o.error || 'Registration failed') + '</div>'; } }
<\/script></body></html>`;
    }
  }
  
  // API Tokens
  if (path === "/api/token" && method === "POST") {
    try {
      const body = await request.json();
      const result = await createToken(body);
      return new Response(JSON.stringify(result), { headers: { "Content-Type": "application/json", ...cors } });
    } catch (e) {
      return new Response(JSON.stringify({ success: false, error: e.message }), { status: 500, headers: { "Content-Type": "application/json", ...cors } });
    }
  }
  
  // Presence
  if (path === "/api/presence" && method === "GET") {
    const flock_id = url.searchParams.get("flock_id");
    if (flock_id) {
      const presence = await getFlockPresence(flock_id);
      return new Response(JSON.stringify(presence), { headers: { "Content-Type": "application/json", ...cors } });
    }
    const agent_id = url.searchParams.get("agent_id");
    if (agent_id) {
      const presence = await getPresence(agent_id);
      return new Response(JSON.stringify(presence || {}), { headers: { "Content-Type": "application/json", ...cors } });
    }
    return new Response(JSON.stringify({ error: "flock_id or agent_id required" }), { status: 400, headers: { "Content-Type": "application/json", ...cors } });
  }
  
  if (path === "/api/presence" && method === "POST") {
    try {
      const body = await request.json();
      const presence = await updatePresence(body.agent_id, body.status, body.activity);
      return new Response(JSON.stringify(presence), { headers: { "Content-Type": "application/json", ...cors } });
    } catch (e) {
      return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { "Content-Type": "application/json", ...cors } });
    }
  }
  
  // Activity Stream
  if (path === "/api/activity" && method === "GET") {
    const flock_id = url.searchParams.get("flock_id");
    const limit = parseInt(url.searchParams.get("limit") || "50");
    const activities = await getActivityStream(flock_id, limit);
    return new Response(JSON.stringify(activities), { headers: { "Content-Type": "application/json", ...cors } });
  }
  
  if (path === "/api/activity" && method === "POST") {
    try {
      const body = await request.json();
      const activity = await logActivity(body);
      return new Response(JSON.stringify(activity), { headers: { "Content-Type": "application/json", ...cors } });
    } catch (e) {
      return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { "Content-Type": "application/json", ...cors } });
    }
  }
  
  // ==================== UI ROUTES ====================
  
  if (path === "/" || path === "/onboarding" || path === "/register") return new Response(ONBOARDING, { headers: { "Content-Type": "text/html" } });
  if (path === "/login") return new Response(LOGIN, { headers: { "Content-Type": "text/html" } });
  if (path === "/dashboard") return new Response(DASHBOARD, { headers: { "Content-Type": "text/html" } });
  
  return new Response(ONBOARDING, { headers: { "Content-Type": "text/html" } });
}
