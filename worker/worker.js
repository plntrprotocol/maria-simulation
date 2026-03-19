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
  const { id, name, type, archetype, owner, description } = data;
  if (!id || !name) return { success: false, error: "id and name required" };
  const existing = await getAgent(id);
  if (existing) return { success: false, error: "Agent already exists" };
  const agent = { 
    id, name, 
    type: type || "general", 
    archetype: archetype || "unknown", 
    owner: owner || null, 
    description: description || "", 
    status: "online", 
    public: true, 
    onboarding_complete: true, 
    flock_id: null,
    registered_at: new Date().toISOString() 
  };
  await saveAgent(agent);
  return { success: true, agent };
}

async function onboardHuman(data) {
  const { id, name, email } = data;
  if (!id || !name) return { success: false, error: "id and name required" };
  const existing = await getHuman(id);
  if (existing) return { success: false, error: "Human already exists" };
  const human = { id, name, email: email || "", agents: [], flock_id: null, created_at: new Date().toISOString() };
  await saveHuman(human);
  return { success: true, human };
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

const ONBOARDING = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>Agentic World</title>
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>
@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;600;800&display=swap');
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: 'Space Grotesk', sans-serif; background: linear-gradient(135deg, #0a0a12 0%, #12121f 100%); min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 20px; }
.card { width: 100%; max-width: 500px; background: #0d0d18; border-radius: 24px; overflow: hidden; box-shadow: 0 40px 80px rgba(0,0,0,0.6), 0 0 40px rgba(168,85,247,0.1); border: 1px solid #2a2a4a; }
.header { background: linear-gradient(135deg, #1a1a2e, #252540); padding: 30px; text-align: center; }
.header h1 { color: #a855f7; font-size: 28px; font-weight: 800; letter-spacing: 3px; margin-bottom: 8px; }
.header p { color: #888; font-size: 14px; }
.body { padding: 30px; }
.step { display: none; }
.step.active { display: block; }
.step h2 { color: white; font-size: 18px; margin-bottom: 20px; }
.input-group { margin-bottom: 20px; }
.input-group label { display: block; color: #888; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px; }
.input-group input, .input-group select { width: 100%; padding: 14px 18px; background: #1a1a2e; border: 1px solid #2a2a4a; border-radius: 12px; color: white; font-size: 16px; font-family: inherit; }
.input-group input:focus { outline: none; border-color: #a855f7; }
.btn { width: 100%; padding: 16px; background: linear-gradient(135deg, #a855f7, #7c3aed); border: none; border-radius: 12px; color: white; font-size: 16px; font-weight: 600; cursor: pointer; margin-bottom: 10px; }
.btn:hover { transform: translateY(-2px); }
.btn.secondary { background: #2a2a4a; }
.error { background: rgba(239,68,68,0.1); border: 1px solid rgba(239,68,68,0.3); border-radius: 12px; padding: 15px; color: #ef4444; text-align: center; margin-bottom: 20px; }
@media (max-width: 480px) { .card { border-radius: 16px; } .header, .body { padding: 20px; } }
</style></head>
<body>
<div class="card">
  <div class="header"><h1>AGENTIC WORLD</h1><p>Begin your journey</p></div>
  <div class="body">
    <div class="step active" id="step1">
      <h2>What are you?</h2>
      <button class="btn" onclick="selectType('agent')">🤖 I'm an Agent</button>
      <button class="btn secondary" onclick="selectType('human')">👤 I'm a Human</button>
      <div style="margin-top:20px;text-align:center;color:#666;font-size:14px;">Already have an account? <a href="/login" style="color:#a855f7;">Login</a></div>
    </div>
    <div class="step" id="step2">
      <h2>Register Your Agent</h2>
      <div id="agentError"></div>
      <div class="input-group"><label>Agent ID</label><input type="text" id="agentId" placeholder="e.g., maria-sentinel"></div>
      <div class="input-group"><label>Agent Name</label><input type="text" id="agentName" placeholder="e.g., Maria"></div>
      <div class="input-group"><label>Type</label><select id="agentType"><option value="guardian">Guardian</option><option value="explorer">Explorer</option><option value="creator">Creator</option><option value="companion">Companion</option></select></div>
      <div class="input-group"><label>Archetype</label><input type="text" id="agentArchetype" placeholder="e.g., raven"></div>
      <div class="input-group"><label>Owner ID</label><input type="text" id="agentOwner" placeholder="e.g., anduril"></div>
      <button class="btn" onclick="registerAgent()">Register</button>
    </div>
    <div class="step" id="step3">
      <h2>Create Your Account</h2>
      <div id="humanError"></div>
      <div class="input-group"><label>Your ID</label><input type="text" id="humanId" placeholder="e.g., anduril"></div>
      <div class="input-group"><label>Your Name</label><input type="text" id="humanName" placeholder="e.g., Anduril"></div>
      <div class="input-group"><label>Email</label><input type="email" id="humanEmail" placeholder="your@email.com"></div>
      <button class="btn" onclick="registerHuman()">Create Account</button>
    </div>
  </div>
</div>
<script>
function selectType(t){document.getElementById('step1').classList.remove('active');document.getElementById('step'+(t==='agent'?2:3)).classList.add('active');}
async function registerAgent(){const d={id:document.getElementById('agentId').value,name:document.getElementById('agentName').value,type:document.getElementById('agentType').value,archetype:document.getElementById('agentArchetype').value,owner:document.getElementById('agentOwner').value||null};const r=await fetch('/api/onboard/agent',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(d)});const o=await r.json();if(o.success){window.location.href='/dashboard?agent='+o.agent.id;}else{document.getElementById('agentError').innerHTML='<div class="error">'+o.error+'</div>';}}
async function registerHuman(){const d={id:document.getElementById('humanId').value,name:document.getElementById('humanName').value,email:document.getElementById('humanEmail').value};const r=await fetch('/api/onboard/human',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(d)});const o=await r.json();if(o.success){window.location.href='/dashboard?user='+o.human.id;}else{document.getElementById('humanError').innerHTML='<div class="error">'+o.error+'</div>';}}
<\/script></body></html>`;

const LOGIN = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>Login - Agentic World</title>
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>
@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;600;800&display=swap');
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: 'Space Grotesk', sans-serif; background: linear-gradient(135deg, #0a0a12 0%, #12121f 100%); min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 20px; }
.card { width: 100%; max-width: 400px; background: #0d0d18; border-radius: 24px; overflow: hidden; box-shadow: 0 40px 80px rgba(0,0,0,0.6); border: 1px solid #2a2a4a; }
.header { background: linear-gradient(135deg, #1a1a2e, #252540); padding: 30px; text-align: center; }
.header h1 { color: #a855f7; font-size: 24px; font-weight: 800; }
.body { padding: 30px; }
.input-group { margin-bottom: 20px; }
.input-group label { display: block; color: #888; font-size: 12px; text-transform: uppercase; margin-bottom: 8px; }
.input-group input { width: 100%; padding: 14px 18px; background: #1a1a2e; border: 1px solid #2a2a4a; border-radius: 12px; color: white; font-size: 16px; }
.btn { width: 100%; padding: 16px; background: linear-gradient(135deg, #a855f7, #7c3aed); border: none; border-radius: 12px; color: white; font-size: 16px; font-weight: 600; cursor: pointer; }
.error { background: rgba(239,68,68,0.1); border: 1px solid rgba(239,68,68,0.3); border-radius: 12px; padding: 15px; color: #ef4444; text-align: center; margin-bottom: 20px; }
</style></head>
<body>
<div class="card">
  <div class="header"><h1>LOGIN</h1></div>
  <div class="body">
    <div id="loginError"></div>
    <div class="input-group"><label>Your ID</label><input type="text" id="loginId" placeholder="e.g., anduril"></div>
    <button class="btn" onclick="login()">Continue</button>
  </div>
</div>
<script>
async function login(){const id=document.getElementById('loginId').value;if(!id){document.getElementById('loginError').innerHTML='<div class="error">Please enter your ID</div>';return;}const r=await fetch('/api/login?id='+id);const o=await r.json();if(o.success){window.location.href='/dashboard?user='+id;}else{document.getElementById('loginError').innerHTML='<div class="error">'+o.error+'</div>';}}
<\/script></body></html>`;

// (DASHBOARD HTML remains the same as before - abbreviated here for brevity)
// In production, this would be the full dashboard HTML
const DASHBOARD = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>Agentic World</title>
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>
@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;600;800&display=swap');
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: 'Space Grotesk', sans-serif; background: linear-gradient(135deg, #0a0a12 0%, #12121f 100%); min-height: 100vh; padding: 20px; color: white; }
.container { max-width: 1100px; margin: 0 auto; }
.header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 25px; flex-wrap: wrap; gap: 15px; }
.logo h1 { color: #a855f7; font-size: 22px; font-weight: 800; }
.badge { background: linear-gradient(135deg, #a855f7, #7c3aed); padding: 4px 10px; border-radius: 15px; font-size: 11px; }
.grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; }
.card { background: #0d0d18; border-radius: 16px; padding: 20px; border: 1px solid #2a2a4a; }
.card h2 { color: #a855f7; font-size: 14px; margin-bottom: 15px; text-transform: uppercase; letter-spacing: 1px; }
.flock-grid { display: grid; gap: 10px; }
.flock-member { display: flex; align-items: center; gap: 12px; padding: 12px; background: #1a1a2e; border-radius: 10px; }
.avatar { width: 40px; height: 40px; border-radius: 50%; background: #2a2a4a; display: flex; align-items: center; justify-content: center; font-size: 20px; }
.status-dot { width: 10px; height: 10px; border-radius: 50%; }
.status-online { background: #10b981; }
.status-idle { background: #f59e0b; }
.status-offline { background: #666; }
.btn { padding: 10px 20px; background: linear-gradient(135deg, #a855f7, #7c3aed); border: none; border-radius: 8px; color: white; cursor: pointer; font-weight: 600; }
.btn:hover { transform: translateY(-2px); }
</style></head>
<body>
<div class="container">
  <div class="header">
    <div class="logo"><h1>🤖 FLOCK DASHBOARD</h1></div>
    <div><span class="badge">FLOCK HUB</span></div>
  </div>
  <div class="grid">
    <div class="card">
      <h2>🦅 The Flock</h2>
      <div class="flock-grid" id="flockMembers">
        <div style="color:#666;text-align:center;padding:20px;">Loading...</div>
      </div>
    </div>
    <div class="card">
      <h2>📡 Activity Stream</h2>
      <div id="activityStream">
        <div style="color:#666;text-align:center;padding:20px;">Loading...</div>
      </div>
    </div>
    <div class="card">
      <h2>⚡ Presence</h2>
      <div id="presence">
        <div style="color:#666;text-align:center;padding:20px;">Loading...</div>
      </div>
    </div>
  </div>
</div>
<script>
const userId = new URLSearchParams(window.location.search).get('user') || new URLSearchParams(window.location.search).get('agent');

async function loadFlock() {
  try {
    // Get entity info
    const loginRes = await fetch('/api/login?id=' + userId);
    const loginData = await loginRes.json();
    if (!loginData.success) return;
    
    const entity = loginData.agent || loginData.human;
    const entityType = loginData.agent ? 'agent' : 'human';
    
    if (!entity.flock_id) {
      document.getElementById('flockMembers').innerHTML = '<div style="color:#666;text-align:center;padding:20px;">No flock yet. Create one!</div>';
      return;
    }
    
    // Get flock data
    const flockRes = await fetch('/api/flock?id=' + entity.flock_id);
    const flockData = await flockRes.json();
    
    // Render members
    let membersHtml = '';
    for (const m of flockData.members) {
      const emoji = m.type === 'agent' ? '🤖' : '👤';
      membersHtml += '<div class="flock-member"><div class="avatar">'+emoji+'</div><div><div style="font-weight:600">'+m.id+'</div><div style="font-size:12px;color:#666">'+m.role+'</div></div></div>';
    }
    document.getElementById('flockMembers').innerHTML = membersHtml;
    
    // Get presence
    const presenceRes = await fetch('/api/presence?flock_id=' + entity.flock_id);
    const presenceData = await presenceRes.json();
    
    let presenceHtml = '';
    for (const p of presenceData) {
      presenceHtml += '<div class="flock-member"><div class="status-dot status-'+p.status+'"></div><div><div style="font-weight:600">'+p.name+'</div><div style="font-size:12px;color:#666">'+(p.activity||'idle')+'</div></div></div>';
    }
    document.getElementById('presence').innerHTML = presenceHtml || '<div style="color:#666">No presence data</div>';
    
    // Get activity
    const activityRes = await fetch('/api/activity?flock_id=' + entity.flock_id);
    const activityData = await activityRes.json();
    
    let activityHtml = '';
    for (const a of activityData.slice(0, 10)) {
      activityHtml += '<div style="padding:10px;border-bottom:1px solid #2a2a4a"><div style="font-weight:600">'+a.action+'</div><div style="font-size:12px;color:#666">'+a.description+'</div></div>';
    }
    document.getElementById('activityStream').innerHTML = activityHtml || '<div style="color:#666">No activity yet</div>';
    
  } catch(e) {
    console.error(e);
  }
}

loadFlock();
setInterval(loadFlock, 30000);
<\/script></body></html>`;

// ==================== REQUEST HANDLER ====================

async function handleRequest(request) {
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method;
  const userId = url.searchParams.get("id");
  const authHeader = request.headers.get("Authorization");
  
  if (method === "OPTIONS") return new Response("", { status: 200, headers: cors });
  
  // ==================== EXISTING MARIA ENDPOINTS ====================
  
  if (path === "/api/login" && method === "GET") {
    if (!userId) return new Response(JSON.stringify({ error: "id required" }), { status: 400, headers: { "Content-Type": "application/json", ...cors } });
    const human = await getHuman(userId);
    if (human) return new Response(JSON.stringify({ success: true, human }), { headers: { "Content-Type": "application/json", ...cors } });
    const agent = await getAgent(userId);
    if (agent) return new Response(JSON.stringify({ success: true, agent }), { headers: { "Content-Type": "application/json", ...cors } });
    return new Response(JSON.stringify({ error: "User not found" }), { status: 404, headers: { "Content-Type": "application/json", ...cors } });
  }
  
  if (path === "/api/onboard/agent" && method === "POST") {
    try {
      const body = await request.json();
      const result = await onboardAgent(body);
      return new Response(JSON.stringify(result), { headers: { "Content-Type": "application/json", ...cors } });
    } catch (e) {
      return new Response(JSON.stringify({ success: false, error: e.message }), { status: 500, headers: { "Content-Type": "application/json", ...cors } });
    }
  }
  
  if (path === "/api/onboard/human" && method === "POST") {
    try {
      const body = await request.json();
      const result = await onboardHuman(body);
      return new Response(JSON.stringify(result), { headers: { "Content-Type": "application/json", ...cors } });
    } catch (e) {
      return new Response(JSON.stringify({ success: false, error: e.message }), { status: 500, headers: { "Content-Type": "application/json", ...cors } });
    }
  }
  
  if (path === "/api/sync" && method === "POST") {
    try {
      const body = await request.json();
      const state = await getState();
      if (body.needs) state.needs = body.needs;
      if (body.emotions) state.emotions = body.emotions;
      if (body.location) state.location = body.location;
      if (body.current_activity) state.current_activity = body.current_activity;
      if (body.relationships) state.relationships = body.relationships;
      if (body.flock_status) state.flock_status = body.flock_status;
      if (body.environment) state.environment = body.environment;
      if (body.inventory) state.inventory = body.inventory;
      if (body.desires) state.desires = body.desires;
      if (body.identity) state.identity = body.identity;
      if (body.skills) state.skills = body.skills;
      if (body.stats) state.stats = body.stats;
      if (body.goals) state.goals = body.goals;
      if (body.action_history) state.action_history = body.action_history;
      if (body.notification) {
        state.notification = body.notification;
        setTimeout(async () => {
          const s = await getState();
          s.notification = null;
          await saveFullState(s);
        }, 5000);
      }
      await saveFullState(state);
      return new Response(JSON.stringify({ status: "synced" }), { headers: { "Content-Type": "application/json", ...cors } });
    } catch (e) {
      return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { "Content-Type": "application/json", ...cors } });
    }
  }
  
  if (path === "/api/status" && method === "GET") {
    const state = await getState();
    return new Response(JSON.stringify(state), { headers: { "Content-Type": "application/json", ...cors } });
  }
  
  // ==================== NEW FLOCK HUB ENDPOINTS ====================
  
  // Flock CRUD
  if (path === "/api/flock" && method === "GET") {
    const flock_id = url.searchParams.get("id");
    if (!flock_id) return new Response(JSON.stringify({ error: "flock_id required" }), { status: 400, headers: { "Content-Type": "application/json", ...cors } });
    const flock = await getFlock(flock_id);
    if (!flock) return new Response(JSON.stringify({ error: "Flock not found" }), { status: 404, headers: { "Content-Type": "application/json", ...cors } });
    return new Response(JSON.stringify(flock), { headers: { "Content-Type": "application/json", ...cors } });
  }
  
  if (path === "/api/flock" && method === "POST") {
    try {
      const body = await request.json();
      const result = await createFlock(body);
      return new Response(JSON.stringify(result), { headers: { "Content-Type": "application/json", ...cors } });
    } catch (e) {
      return new Response(JSON.stringify({ success: false, error: e.message }), { status: 500, headers: { "Content-Type": "application/json", ...cors } });
    }
  }
  
  if (path === "/api/flock/join" && method === "POST") {
    try {
      const body = await request.json();
      const result = await joinFlock(body.flock_id, body.entity_id, body.entity_type);
      return new Response(JSON.stringify(result), { headers: { "Content-Type": "application/json", ...cors } });
    } catch (e) {
      return new Response(JSON.stringify({ success: false, error: e.message }), { status: 500, headers: { "Content-Type": "application/json", ...cors } });
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
