// maria-simulation Worker - Extended with Flock Hub Features
// Cloudflare Worker with KV storage

addEventListener("fetch", (event) => {
  event.respondWith(handleRequest(event.request));
});

// Input sanitization
function sanitizeInput(str) {
  if (typeof str !== 'string') return '';
  return str.replace(/[<>&"']/g, '').trim().substring(0, 1000);
}

function sanitizeId(id) {
  if (typeof id !== 'string') return '';
  return id.replace(/[^a-zA-Z0-9_-]/g, '').trim().substring(0, 100);
}

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
    skills: [
      { name: "Pattern Recognition", level: "★★★", category: "cognitive" },
      { name: "Memory Synthesis", level: "★★★", category: "cognitive" },
      { name: "Emotional Intelligence", level: "★★☆", category: "social" },
      { name: "Narrative Construction", level: "★★☆", category: "creative" },
      { name: "System Monitoring", level: "★★★", category: "technical" }
    ],
    // Brain State (6 regions)
    brain: {
      // VTA - Motivation drives
      vta: {
        energy: 75,
        purpose: 60,
        curiosity: 80,
        motivation: 70
      },
      // Amygdala - Emotional state
      amygdala: {
        mood: "calm",
        valence: 0.6,  // -1 to 1
        arousal: 0.4,   // 0 to 1
        fear: 0.1,
        anger: 0.05
      },
      // PFC - Planning and goals
      pfc: {
        workingMemory: 85,
        attention: 70,
        planning: 65,
        reasoning: 75
      },
      // Hippocampus - Memory
      hippocampus: {
        consolidationScore: 90,
        memoryStrength: 78,
        lastConsolidation: null,
        episodicRetention: 82
      },
      // Basal Ganglia - Habits
      basalGanglia: {
        habitStrength: 65,
        automaticBehaviors: 12,
        actionSelection: 70
      },
      // Nucleus Accumbens - Reward
      nucleusAccumbens: {
        rewardPrediction: 0.55,
        expectedReward: 0.6,
        dopamineLevel: 0.5
      }
    },
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

function generateApiKey() { return "ak_" + Math.random().toString(36).substr(2, 10) + Math.random().toString(36).substr(2, 10); }

async function onboardAgent(data) {
  const { id, name, type, archetype, owner, description } = data;
  if (!id || !name) return { success: false, error: "id and name required" };
  const existing = await getAgent(id);
  if (existing) return { success: false, error: "Agent already exists" };
  
  const api_key = generateApiKey();
  let flock_id = null;
  
  // Auto-link to owner's flock if owner is provided
  if (owner) {
    const humanOwner = await getHuman(owner);
    if (humanOwner && humanOwner.flock_id) {
      flock_id = humanOwner.flock_id;
      // Add agent to the flock's member list
      const flock = await getFlock(flock_id);
      if (flock) {
        const isMember = flock.members.find(m => m.id === id);
        if (!isMember) {
          flock.members.push({
            id: id,
            type: "agent",
            role: "member",
            joined_at: new Date().toISOString()
          });
          await saveFlock(flock);
        }
      }
    }
  }

  const agent = { 
    id, name, 
    type: type || "general", 
    archetype: archetype || "unknown", 
    owner: owner || null, 
    description: description || "", 
    status: "online", 
    public: true, 
    onboarding_complete: true, 
    flock_id: flock_id,
    api_key,
    registered_at: new Date().toISOString() 
  };
  
  await saveAgent(agent);
  await MARIA_STATE.put("apikey:" + api_key, JSON.stringify({ id, type: "agent" }));
  return { success: true, agent, api_key };
}

// Secure password hashing using PBKDF2-inspired approach
// In production, use bcrypt or argon2 - this is a demo improvement
async function hashPassword(password, salt = null) {
  if (!salt) {
    salt = crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).substr(2);
  }
  // Use Web Crypto API for proper hashing
  const encoder = new TextEncoder();
  const data = encoder.encode(password + salt);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return salt + ':' + hashHex;
}

function verifyPassword(password, storedHash) {
  const parts = storedHash.split(':');
  if (parts.length !== 2) return false;
  const salt = parts[0];
  const originalHash = parts[1];
  // Sync version for comparison (simplified)
  const encoder = new TextEncoder();
  const data = encoder.encode(password + salt);
  // We'll use a simple comparison since we can't await in sync
  return hashPassword(password, salt).then(h => h.split(':')[1] === originalHash);
}

// Simple synchronous hash for backward compatibility (with salt)
function simpleHash(str) {
  // Use fixed salt for consistent hashing (for demo purposes)
  // In production, use a proper bcrypt/argon2
  const FIXED_SALT = "FlockHub2026";
  
  // Simple hash with fixed salt
  let hash = 0;
  const salted = FIXED_SALT + str;
  for (let i = 0; i < salted.length; i++) {
    const char = salted.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return (hash >>> 0).toString(16);
}

function verifySimpleHash(password, storedHash) {
  // Verify using the same fixed salt approach
  const FIXED_SALT = "FlockHub2026";
  let hash = 0;
  const salted = FIXED_SALT + password;
  for (let i = 0; i < salted.length; i++) {
    const char = salted.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return (hash >>> 0).toString(16) === storedHash;
}

async function onboardHuman(data) {
  const { id, name, email, password } = data;
  if (!id || !name) return { success: false, error: "id and name required" };
  if (!password) return { success: false, error: "password required" };
  const existing = await getHuman(id);
  if (existing) return { success: false, error: "Human already exists" };
  const api_key = generateApiKey();
  const human = { 
    id, 
    name, 
    email: email || "", 
    password: password,  // Simple storage for demo
    agents: [], 
    flock_id: null, 
    api_key,
    created_at: new Date().toISOString() 
  };
  await saveHuman(human);
  await MARIA_STATE.put("apikey:" + api_key, JSON.stringify({ id, type: "human" }));
  return { success: true, human, api_key };
}

async function verifyHumanPassword(id, password) {
  const human = await getHuman(id);
  if (!human) return null;
  // Simple direct comparison for demo - store password directly
  if (human.password === password) {
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

const ONBOARDING = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>Agentic World</title>
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>
@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;600;800&display=swap');
* { box-sizing: border-box; margin: 0; padding: 0; }

/* Animations */
@keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }

.fade-in { animation: fadeIn 0.3s ease-out; }
.pulse { animation: pulse 2s infinite; }

/* Loading spinner */
.spinner {
  width: 20px; height: 20px; border: 2px solid #2a2a4a; border-top-color: #a855f7; border-radius: 50%; animation: spin 0.8s linear infinite; display: inline-block; vertical-align: middle;
}

/* Smooth transitions */
.card, .btn, .badge { transition: all 0.2s ease; }
.card:hover { transform: translateY(-2px); box-shadow: 0 8px 30px rgba(168,85,247,0.15); }

/* Button hover */
.btn:hover { transform: scale(1.02); filter: brightness(1.1); }
.btn:active { transform: scale(0.98); }

/* Mobile responsiveness */
@media (max-width: 768px) {
  .grid { grid-template-columns: 1fr !important; }
  .container { padding: 10px !important; }
  .card { padding: 15px !important; }
  h1 { font-size: 20px !important; }
  h2 { font-size: 16px !important; }
}
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
      <p style="color:#888;margin-bottom:20px;font-size:14px;text-align:center;">
        🤖 <strong>Agent</strong> — An AI being (needs Agent ID)<br>
        👤 <strong>Human</strong> — A person managing agents (needs email + password)
      </p>
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
      <div class="input-group"><label>Your ID (Human ID)</label><input type="text" id="humanId" placeholder="e.g., anduril"></div>
      <div class="input-group"><label>Your Name</label><input type="text" id="humanName" placeholder="e.g., Anduril"></div>
      <div class="input-group"><label>Email</label><input type="email" id="humanEmail" placeholder="your@email.com"></div>
      <div class="input-group"><label>Password</label><input type="password" id="humanPassword" placeholder="Create a password"></div>
      <button class="btn" onclick="registerHuman()">Create Account</button>
    </div>
  </div>
</div>
<script>
function selectType(t){document.getElementById('step1').classList.remove('active');document.getElementById('step'+(t==='agent'?2:3)).classList.add('active');}
async function registerAgent(){const d={id:document.getElementById('agentId').value,name:document.getElementById('agentName').value,type:document.getElementById('agentType').value,archetype:document.getElementById('agentArchetype').value,owner:document.getElementById('agentOwner').value||null};const r=await fetch('/api/onboard/agent',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(d)});const o=await r.json();if(o.success){window.location.href='/login';}else{document.getElementById('agentError').innerHTML='<div class="error">'+o.error+'</div>';}}
async function registerHuman(){const d={id:document.getElementById('humanId').value,name:document.getElementById('humanName').value,email:document.getElementById('humanEmail').value,password:document.getElementById('humanPassword').value};const r=await fetch('/api/onboard/human',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(d)});const o=await r.json();if(o.success){window.location.href='/login';}else{document.getElementById('humanError').innerHTML='<div class="error">'+o.error+'</div>';}}
<\/script></body></html>`;

const LOGIN = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>Login - Agentic World</title>
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>
@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;600;800&display=swap');
* { box-sizing: border-box; margin: 0; padding: 0; }

/* Animations */
@keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }

.fade-in { animation: fadeIn 0.3s ease-out; }
.pulse { animation: pulse 2s infinite; }

/* Loading spinner */
.spinner {
  width: 20px; height: 20px; border: 2px solid #2a2a4a; border-top-color: #a855f7; border-radius: 50%; animation: spin 0.8s linear infinite; display: inline-block; vertical-align: middle;
}

/* Smooth transitions */
.card, .btn, .badge { transition: all 0.2s ease; }
.card:hover { transform: translateY(-2px); box-shadow: 0 8px 30px rgba(168,85,247,0.15); }

/* Button hover */
.btn:hover { transform: scale(1.02); filter: brightness(1.1); }
.btn:active { transform: scale(0.98); }

/* Mobile responsiveness */
@media (max-width: 768px) {
  .grid { grid-template-columns: 1fr !important; }
  .container { padding: 10px !important; }
  .card { padding: 15px !important; }
  h1 { font-size: 20px !important; }
  h2 { font-size: 16px !important; }
}
body { font-family: 'Space Grotesk', sans-serif; background: linear-gradient(135deg, #0a0a12 0%, #12121f 100%); min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 20px; }
.card { width: 100%; max-width: 400px; background: #0d0d18; border-radius: 24px; overflow: hidden; box-shadow: 0 40px 80px rgba(0,0,0,0.6); border: 1px solid #2a2a4a; }
.header { background: linear-gradient(135deg, #1a1a2e, #252540); padding: 30px; text-align: center; }
.header h1 { color: #a855f7; font-size: 24px; font-weight: 800; }
.body { padding: 30px; }
.input-group { margin-bottom: 20px; }
.input-group label { display: block; color: #888; font-size: 12px; text-transform: uppercase; margin-bottom: 8px; }
.input-group input { width: 100%; padding: 14px 18px; background: #1a1a2e; border: 1px solid #2a2a4a; border-radius: 12px; color: white; font-size: 16px; }
.btn { width: 100%; padding: 16px; background: linear-gradient(135deg, #a855f7, #7c3aed); border: none; border-radius: 12px; color: white; font-size: 16px; font-weight: 600; cursor: pointer; margin-top: 10px; }
.error { background: rgba(239,68,68,0.1); border: 1px solid rgba(239,68,68,0.3); border-radius: 12px; padding: 15px; color: #ef4444; text-align: center; margin-bottom: 20px; }
.switch-link { text-align: center; margin-top: 15px; color: #666; font-size: 14px; }
.switch-link a { color: #a855f7; text-decoration: none; }
</style></head>
<body>
<div class="card">
  <div class="header"><h1>LOGIN</h1></div>
  <div class="body">
    <div id="loginError"></div>
    <div class="input-group"><label>Your ID (Human ID or Agent ID)</label><input type="text" id="loginId" placeholder="e.g., anduril"></div>
    <div class="input-group"><label>Password</label><input type="password" id="loginPassword" placeholder="Enter your password"></div>
    <button class="btn" onclick="login()">Login</button>
    <div class="switch-link">Don't have an account? <a href="/">Register here</a></div>
  </div>
</div>
<script>
async function login(){
  try {
    const id=document.getElementById('loginId').value;
    const password=document.getElementById('loginPassword').value;
    if(!id){document.getElementById('loginError').innerHTML='<div class="error">Please enter your ID</div>';return;}
    let url='/api/login?id='+encodeURIComponent(id);
    if(password){url+='&password='+encodeURIComponent(password);}
    const r=await fetch(url);
    const o=await r.json();
    if(o.success){
      if(password) localStorage.setItem('flock_pass', password);
      window.location.href='/dashboard?'+(o.type==='human'?'user':'agent')+'='+encodeURIComponent(id);
    }
    else{document.getElementById('loginError').innerHTML='<div class="error">'+o.error+'</div>';}
  } catch(e) {
    console.error('Login error:', e);
    document.getElementById('loginError').innerHTML='<div class="error">Login failed. Try again.</div>';
  }
}
<\/script></body></html>`;

// (DASHBOARD HTML remains the same as before - abbreviated here for brevity)
// In production, this would be the full dashboard HTML
const DASHBOARD = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>Agentic World</title>
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>
@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;600;800&display=swap');
* { box-sizing: border-box; margin: 0; padding: 0; }

/* Animations */
@keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }

.fade-in { animation: fadeIn 0.3s ease-out; }
.pulse { animation: pulse 2s infinite; }

/* Loading spinner */
.spinner {
  width: 20px; height: 20px; border: 2px solid #2a2a4a; border-top-color: #a855f7; border-radius: 50%; animation: spin 0.8s linear infinite; display: inline-block; vertical-align: middle;
}

/* Smooth transitions */
.card, .btn, .badge { transition: all 0.2s ease; }
.card:hover { transform: translateY(-2px); box-shadow: 0 8px 30px rgba(168,85,247,0.15); }

/* Button hover */
.btn:hover { transform: scale(1.02); filter: brightness(1.1); }
.btn:active { transform: scale(0.98); }

/* Mobile responsiveness */
@media (max-width: 768px) {
  .grid { grid-template-columns: 1fr !important; }
  .container { padding: 10px !important; }
  .card { padding: 15px !important; }
  h1 { font-size: 20px !important; }
  h2 { font-size: 16px !important; }
}
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
    <div class="logo">
      <h1>🤖 FLOCK DASHBOARD</h1>
      <div id="userWelcome" style="color:#888;font-size:14px;margin-top:5px;">Welcome, <span id="userName">...</span></div>
    </div>
    <div style="text-align:right;">
      <button class="btn" onclick="logout()" style="padding:6px 12px;font-size:11px;margin-bottom:8px;background:#2a2a4a;">Logout</button><br>
      <span class="badge" style="margin-bottom:8px;display:inline-block;">FLOCK HUB</span><br>
      <div style="font-size:12px;color:#888;">API Key: <code id="userApiKey" style="background:#1a1a2e;padding:4px 8px;border-radius:4px;color:#a855f7;">...</code></div>
    </div>
  </div>
  
  <!-- Create Flock Section (shown when no flock) -->
  <div id="noFlockSection" style="display:none;">
    <div class="card" style="text-align:center;padding:40px;margin-bottom:20px;">
      <h2 style="font-size:24px;margin-bottom:15px;">You don't have a flock yet</h2>
      <p style="color:#888;margin-bottom:25px;">Create a flock to connect with agents and other humans.</p>
      <input type="text" id="flockName" placeholder="Flock Name" style="padding:12px;width:250px;background:#1a1a2e;border:1px solid #2a2a4a;border-radius:8px;color:white;font-size:16px;margin-right:10px;">
      <button class="btn" onclick="createFlock()">Create Flock</button>
    </div>
  </div>
  
  <!-- Agent View (shown for agents) -->
  <div id="agentView" style="display:none;">
    <div class="card" style="text-align:center;padding:40px;">
      <h2 style="font-size:28px;margin-bottom:20px;">🤖 Agent Dashboard</h2>
      <p style="color:#888;margin-bottom:20px;">Welcome, <span id="agentName" style="color:#a855f7;font-weight:600;"></span></p>
      <div style="background:#1a1a2e;padding:20px;border-radius:12px;margin-bottom:20px;">
        <div style="font-size:12px;color:#888;margin-bottom:5px;">Your API Key</div>
        <code id="agentApiKey" style="color:#10b981;font-size:14px;"></code>
      </div>
      <div style="background:#1a1a2e;padding:20px;border-radius:12px;">
        <div style="font-size:12px;color:#888;margin-bottom:5px;">Your Flock ID</div>
        <div id="agentFlockId" style="color:#a855f7;font-weight:600;"></div>
        <div id="agentFlockMembers" style="margin-top:15px;"></div>
      </div>
    </div>
    
    <!-- Action Controls -->
    <div class="card" style="margin-top:20px;">
      <h2 style="margin-bottom:15px;">🎮 Action Controls</h2>
      <p style="color:#888;font-size:12px;margin-bottom:15px;">Trigger actions on this agent</p>
      
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin-bottom:15px;">
        <button class="btn" onclick="triggerAction('set_mood', {mood:'happy'})" style="padding:10px;font-size:12px;">😊 Happy</button>
        <button class="btn" onclick="triggerAction('set_mood', {mood:'calm'})" style="padding:10px;font-size:12px;">😌 Calm</button>
        <button class="btn" onclick="triggerAction('set_mood', {mood:'focused'})" style="padding:10px;font-size:12px;">🎯 Focused</button>
        <button class="btn" onclick="triggerAction('set_mood', {mood:'tired'})" style="padding:10px;font-size:12px;">😴 Tired</button>
      </div>
      
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin-bottom:15px;">
        <button class="btn" onclick="triggerAction('update_needs', {energy:100})" style="padding:10px;font-size:12px;">⚡ Full Energy</button>
        <button class="btn" onclick="triggerAction('update_needs', {social:100})" style="padding:10px;font-size:12px;">👥 Socialize</button>
        <button class="btn" onclick="triggerAction('update_needs', {fun:100})" style="padding:10px;font-size:12px;">🎮 Play</button>
        <button class="btn" onclick="triggerAction('update_needs', {purpose:100})" style="padding:10px;font-size:12px;">🎯 Purpose</button>
      </div>
      
      <div style="margin-bottom:15px;">
        <input type="text" id="customActivity" placeholder="Set activity (e.g., reading, working)" style="padding:10px;background:#1a1a2e;border:1px solid #2a2a4a;border-radius:8px;color:white;width:70%;">
        <button class="btn" onclick="triggerCustomActivity()" style="padding:10px;width:25%;">Set</button>
      </div>
      
      <div style="margin-bottom:15px;">
        <input type="text" id="newGoal" placeholder="Add a new goal" style="padding:10px;background:#1a1a2e;border:1px solid #2a2a4a;border-radius:8px;color:white;width:70%;">
        <button class="btn" onclick="addGoal()" style="padding:10px;width:25%;">Add Goal</button>
      </div>
      
      <div id="actionResponse" style="display:none;margin-top:15px;padding:15px;background:rgba(16,185,129,0.1);border:1px solid rgba(16,185,129,0.3);border-radius:8px;text-align:center;"></div>
    </div>
    
    <!-- Action History -->
    <div class="card" style="margin-top:20px;">
      <h2 style="margin-bottom:15px;">📜 Action History</h2>
      <div id="actionHistory" style="max-height:300px;overflow-y:auto;">
        <div style="color:#666;text-align:center;padding:20px;">Loading...</div>
      </div>
    </div>
    
    <!-- Visualizations -->
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:20px;margin-top:20px;">
      <!-- Mood History -->
      <div class="card">
        <h2 style="margin-bottom:15px;">📈 Mood History</h2>
        <div id="moodChart" style="height:150px;display:flex;align-items:flex-end;gap:4px;padding:10px;">
          <div style="color:#666;text-align:center;width:100%;">Loading...</div>
        </div>
      </div>
      
      <!-- Trait Radar -->
      <div class="card">
        <h2 style="margin-bottom:15px;">🎯 Traits</h2>
        <div id="traitRadar" style="height:150px;">
          <div style="display:flex;justify-content:space-around;align-items:center;height:100%;">
            <div style="text-align:center;">
              <div style="width:40px;height:40px;border-radius:50%;background:linear-gradient(135deg,#10b981,#059669);display:flex;align-items:center;justify-content:center;margin:0 auto 5px;">🧠</div>
              <div style="font-size:10px;color:#888;">Focus</div>
            </div>
            <div style="text-align:center;">
              <div style="width:40px;height:40px;border-radius:50%;background:linear-gradient(135deg,#3b82f6,#2563eb);display:flex;align-items:center;justify-content:center;margin:0 auto 5px;">💪</div>
              <div style="font-size:10px;color:#888;">Energy</div>
            </div>
            <div style="text-align:center;">
              <div style="width:40px;height:40px;border-radius:50%;background:linear-gradient(135deg,#a855f7,#7c3aed);display:flex;align-items:center;justify-content:center;margin:0 auto 5px;">❤️</div>
              <div style="font-size:10px;color:#888;">Social</div>
            </div>
            <div style="text-align:center;">
              <div style="width:40px;height:40px;border-radius:50%;background:linear-gradient(135deg,#ec4899,#db2777);display:flex;align-items:center;justify-content:center;margin:0 auto 5px;">🎮</div>
              <div style="font-size:10px;color:#888;">Fun</div>
            </div>
            <div style="text-align:center;">
              <div style="width:40px;height:40px;border-radius:50%;background:linear-gradient(135deg,#f59e0b,#d97706);display:flex;align-items:center;justify-content:center;margin:0 auto 5px;">😌</div>
              <div style="font-size:10px;color:#888;">Calm</div>
            </div>
          </div>
        </div>
      </div>
      
      <!-- Manual State Override -->
      <div class="card" style="margin-top:20px;">
        <h2 style="margin-bottom:15px;">⚙️ State Override</h2>
        <p style="color:#888;font-size:12px;margin-bottom:15px;">Directly edit Maria's state (JSON)</p>
        <textarea id="stateJson" style="width:100%;height:120px;background:#1a1a2e;border:1px solid #2a2a4a;border-radius:8px;color:#10b981;font-family:monospace;font-size:12px;padding:10px;" placeholder='{"needs":{"energy":80},"emotions":{"mood":"happy"}}'></textarea>
        <button class="btn" onclick="applyStateOverride()" style="padding:10px;font-size:12px;margin-top:10px;">Apply State</button>
        <div id="stateOverrideResponse" style="display:none;margin-top:10px;padding:10px;background:rgba(16,185,129,0.1);border-radius:6px;font-size:12px;"></div>
      </div>
      
      <!-- Skills -->
      <div class="card">
        <h2 style="margin-bottom:15px;">🛠️ Skills</h2>
        <div id="skillsList" style="max-height:150px;overflow-y:auto;">
          <div style="color:#666;text-align:center;padding:20px;">Loading...</div>
        </div>
      </div>
      
      <!-- Goals -->
      <div class="card">
        <h2 style="margin-bottom:15px;">🎯 Goals</h2>
        <div id="goalsList" style="max-height:150px;overflow-y:auto;">
          <div style="color:#666;text-align:center;padding:20px;">Loading...</div>
        </div>
      </div>
    </div>
  </div>
  
  <div class="grid" id="flockDashboard" style="display:none;">
    <div class="card">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:15px;">
        <h2 style="margin-bottom:0;">🦅 The Flock</h2>
        <div style="display:flex;gap:5px;">
          <input type="text" id="newAgentId" placeholder="Existing Agent ID" style="padding:6px 10px;background:#1a1a2e;border:1px solid #2a2a4a;border-radius:6px;color:white;font-size:12px;width:120px;">
          <button class="btn" onclick="addAgentToFlock()" style="padding:6px 12px;margin:0;font-size:12px;border-radius:6px;">Join</button>
        </div>
      </div>
      <div class="flock-grid" id="flockMembers">
        <div style="color:#666;text-align:center;padding:20px;">Loading...</div>
      </div>
      
      <div style="margin-top:20px;padding-top:15px;border-top:1px solid #2a2a4a;">
        <h3 style="font-size:12px;color:#a855f7;text-transform:uppercase;margin-bottom:10px;">Account Settings</h3>
        <div style="display:grid;gap:10px;">
          <input type="password" id="newPassword" placeholder="New Password" style="padding:10px;background:#1a1a2e;border:1px solid #2a2a4a;border-radius:8px;color:white;">
          <button class="btn" onclick="changePassword()" style="padding:10px;font-size:12px;">Change Password</button>
          <div id="passwordChangeResponse" style="display:none;padding:8px;background:rgba(16,185,129,0.1);border-radius:6px;font-size:12px;text-align:center;"></div>
        </div>
      </div>
      
      <div style="margin-top:20px;padding-top:15px;border-top:1px solid #2a2a4a;">
        <h3 style="font-size:12px;color:#a855f7;text-transform:uppercase;margin-bottom:10px;">Generate API Token</h3>
        <div style="display:grid;gap:10px;">
          <input type="text" id="tokenName" placeholder="Token name (e.g., My App)" style="padding:10px;background:#1a1a2e;border:1px solid #2a2a4a;border-radius:8px;color:white;">
          <button class="btn" onclick="generateToken()" style="padding:10px;font-size:12px;">Generate Token</button>
          <div id="tokenDisplay" style="display:none;padding:10px;background:rgba(16,185,129,0.1);border:1px solid rgba(16,185,129,0.3);border-radius:6px;font-size:12px;word-break:break-all;"></div>
        <div id="tokenListDisplay" style="margin-top:10px;max-height:150px;overflow-y:auto;"></div>
        </div>
      </div>
      
      <div style="margin-top:20px;padding-top:15px;border-top:1px solid #2a2a4a;">
        <h3 style="font-size:12px;color:#a855f7;text-transform:uppercase;margin-bottom:10px;">Create New Agent</h3>
        <div style="display:grid;gap:10px;">
          <input type="text" id="createAgentId" placeholder="Agent ID (e.g. sentinel)" style="padding:10px;background:#1a1a2e;border:1px solid #2a2a4a;border-radius:8px;color:white;">
          <input type="text" id="createAgentName" placeholder="Agent Name (e.g. Sentinel)" style="padding:10px;background:#1a1a2e;border:1px solid #2a2a4a;border-radius:8px;color:white;">
          <button class="btn" onclick="createNewAgent()" style="padding:10px;">Create & Add to Flock</button>
          <div id="newAgentKeyDisplay" style="display:none;margin-top:10px;padding:10px;background:rgba(16,185,129,0.1);border:1px solid rgba(16,185,129,0.3);border-radius:8px;font-size:12px;"></div>
        </div>
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

// Show loading spinner
function showLoading(elementId) {
  const el = document.getElementById(elementId);
  if (el) el.innerHTML = '<div class="spinner"></div> Loading...';
}

// Add fade-in class to cards
function fadeInElements() {
  document.querySelectorAll('.card').forEach((card, i) => {
    card.classList.add('fade-in');
    card.style.animationDelay = (i * 0.1) + 's';
  });
}

function logout() {
  localStorage.removeItem('flock_pass');
  localStorage.removeItem('flock_hub_user');
  window.location.href = '/login';
}

async function loadFlock() {
  if (!userId) {
    window.location.href = '/login';
    return;
  }
  
  try {
    // Get entity info
    const pass = localStorage.getItem('flock_pass') || '';
    // Use correct parameter based on entity type
    let url = '/api/' + (entityType === 'human' ? 'login?user=' : 'login?agent=') + encodeURIComponent(userId);
    if (entityType === 'human' && pass) url += '&password=' + encodeURIComponent(pass);
    const loginRes = await fetch(url);
    const loginData = await loginRes.json();
    if (!loginData.success) {
      window.location.href = '/login';
      return;
    }
    
    const entity = loginData.agent || loginData.human;
    const entityType = loginData.agent ? 'agent' : 'human';
    window.currentFlockId = entity.flock_id;
    
    // If agent, show agent-specific view
    if (entityType === 'agent') {
      document.getElementById('noFlockSection').style.display = 'none';
      document.getElementById('flockDashboard').style.display = 'none';
      document.getElementById('agentView').style.display = 'block';
      document.getElementById('agentName').textContent = entity.name || userId;
      document.getElementById('agentApiKey').textContent = entity.api_key || 'No API Key';
      if (entity.flock_id) {
        document.getElementById('agentFlockId').textContent = entity.flock_id;
        loadAgentFlock(entity.flock_id);
      } else {
        document.getElementById('agentFlockId').textContent = 'Not in a flock';
      }
      loadActionHistory();
      loadVisualizations();
      return;
    }
    
    // Show user name
    document.getElementById('userName').textContent = entity.name || userId;
    if (document.getElementById('userApiKey')) document.getElementById('userApiKey').textContent = entity.api_key || 'No Key';
    
    if (!entity.flock_id) {
      // Show create flock section
      document.getElementById('noFlockSection').style.display = 'block';
      document.getElementById('flockDashboard').style.display = 'none';
      return;
    }
    
    // Show flock dashboard
    document.getElementById('noFlockSection').style.display = 'none';
    document.getElementById('flockDashboard').style.display = 'grid';
    loadHumanVisualizations();
    
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

// Auto-refresh visualizations every 30 seconds
setInterval(() => {
  if (typeof loadVisualizations === 'function') loadVisualizations();
  if (typeof loadHumanVisualizations === 'function') loadHumanVisualizations();
}, 30000);

// Add fade-in animation on load
if (document.readyState === 'complete') {
  fadeInElements();
} else {
  window.addEventListener('load', fadeInElements);
}

async function loadAgentFlock(flockId) {
  try {
    const resp = await fetch('/api/flock?id=' + flockId);
    const flock = await resp.json();
    if (flock && flock.members) {
      const membersHtml = flock.members.map(m => 
        '<div style="padding:10px;background:#1a1a2e;border-radius:8px;margin-bottom:5px;">' + 
        (m.type === 'agent' ? '🤖' : '👤') + ' ' + m.id + 
        '</div>'
      ).join('');
      document.getElementById('agentFlockMembers').innerHTML = 
        '<div style="margin-top:15px;"><strong>Members:</strong></div>' + membersHtml;
    }
  } catch(e) {
    console.error('Error loading agent flock:', e);
  }
}

// Action Control Functions
async function triggerAction(action, parameters) {
  const responseDiv = document.getElementById('actionResponse');
  responseDiv.style.display = 'block';
  responseDiv.innerHTML = '<span style="color:#888;">Processing...</span>';
  
  try {
    const resp = await fetch('/api/action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        agent_id: userId,
        action: action,
        parameters: parameters
      })
    });
    
    if (!resp.ok) {
      responseDiv.innerHTML = '<strong style="color:#ef4444;">✗ Server Error:</strong> Please try again';
      setTimeout(() => { responseDiv.style.display = 'none'; }, 3000);
      return;
    }
    
    const data = await resp.json();
    
    if (data.success) {
      responseDiv.innerHTML = '<strong style="color:#10b981;">✓ Action completed!</strong> ' + action;
      loadActionHistory();
      loadVisualizations();
    } else {
      responseDiv.innerHTML = '<strong style="color:#ef4444;">✗ Error:</strong> ' + (data.error || 'Unknown error');
    }
    
    setTimeout(() => { responseDiv.style.display = 'none'; }, 3000);
  } catch(e) {
    console.error('Action error:', e);
    responseDiv.innerHTML = '<strong style="color:#ef4444;">✗ Network Error:</strong> Check connection';
    setTimeout(() => { responseDiv.style.display = 'none'; }, 3000);
  }
}

async function triggerCustomActivity() {
  const activity = document.getElementById('customActivity').value.trim();
  if (!activity) {
    alert('Please enter an activity');
    return;
  }
  await triggerAction('set_activity', { activity: activity });
  document.getElementById('customActivity').value = '';
}

async function completeGoal(goalId) {
  try {
    await fetch('/api/action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agent_id: userId, action: 'complete_goal', parameters: { goal_id: goalId } })
    });
    loadVisualizations();
  } catch(e) {
    console.error('Error completing goal:', e);
  }
}

async function deleteGoal(goalId) {
  if (!confirm('Delete this goal?')) return;
  
  try {
    await fetch('/api/goal', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ goal_id: goalId })
    });
    loadVisualizations();
  } catch(e) {
    console.error('Error deleting goal:', e);
  }
}

async function addGoal() {
  const goal = document.getElementById('newGoal').value.trim();
  if (!goal) {
    alert('Please enter a goal');
    return;
  }
  await triggerAction('add_goal', { goal: goal });
  document.getElementById('newGoal').value = '';
}

async function loadActionHistory() {
  try {
    const resp = await fetch('/api/action?limit=20');
    const history = await resp.json();
    
    const container = document.getElementById('actionHistory');
    if (!history || history.length === 0) {
      container.innerHTML = '<div style="color:#666;text-align:center;padding:20px;">No actions yet</div>';
      return;
    }
    
    container.innerHTML = history.map(a => {
      const time = new Date(a.timestamp).toLocaleString();
      return '<div style="padding:10px;border-bottom:1px solid #2a2a4a;">' +
        '<div style="font-weight:600;color:#a855f7;">' + a.action + '</div>' +
        '<div style="font-size:12px;color:#666;">' + time + '</div>' +
        '</div>';
    }).join('');
  } catch(e) {
    console.error('Error loading action history:', e);
  }
}

// Load Visualizations for Agent View
async function loadVisualizations() {
  try {
    const statusResp = await fetch('/api/status');
    const state = await statusResp.json();
    
    // Load brain state visualization
    loadBrainState(state.brain || {});
    
    // Load mood history chart
    loadMoodHistory(state.action_history || []);
    
    // Load traits display (from needs/emotions)
    loadTraits(state);
    
    // Load skills
    loadSkills(state.skills || []);
    
    // Load goals
    loadGoals(state.goals || []);
    
    // Also load human-specific visualizations if in human view
    loadHumanVisualizations();
  } catch(e) {
    console.error('Error loading visualizations:', e);
  }
}

// Load Human Dashboard Visualizations
async function loadHumanVisualizations() {
  try {
    const statusResp = await fetch('/api/status');
    const state = await statusResp.json();
    
    // Mood overview
    const moodContainer = document.getElementById('humanMoodChart');
    if (moodContainer) {
      const moodActions = (state.action_history || [])
        .filter(a => a.action === 'set_mood')
        .slice(0, 7)
        .reverse();
      
      if (moodActions.length === 0) {
        moodContainer.innerHTML = '<div style="color:#666;text-align:center;width:100%;">No mood data yet</div>';
      } else {
        const moodColors = {
          'happy': '#10b981', 'calm': '#3b82f6', 'focused': '#a855f7',
          'tired': '#f59e0b', 'anxious': '#ef4444', 'neutral': '#6b7280'
        };
        moodContainer.innerHTML = moodActions.map(a => {
          const mood = a.parameters?.mood || 'neutral';
          const color = moodColors[mood] || moodColors.neutral;
          return '<div style="flex:1;display:flex;flex-direction:column;align-items:center;"><div style="width:100%;background:' + color + ';border-radius:4px;min-height:20px;height:40px;"></div><div style="font-size:8px;color:#888;margin-top:4px;">' + mood.charAt(0).toUpperCase() + '</div></div>';
        }).join('');
      }
    }
    
    // Skills list
    const skillsContainer = document.getElementById('humanSkillsList');
    if (skillsContainer) {
      const skills = state.skills || [];
      if (skills.length === 0) {
        skillsContainer.innerHTML = '<div style="color:#666;text-align:center;padding:20px;">No skills yet</div>';
      } else {
        skillsContainer.innerHTML = skills.map(skill => 
          '<div style="padding:8px;background:#1a1a2e;border-radius:6px;margin-bottom:5px;display:flex;justify-content:space-between;align-items:center;"><span>' + (skill.name || skill) + '</span><span style="color:#a855f7;font-size:12px;">' + (skill.level || '★') + '</span></div>'
        ).join('');
      }
    }
    
  } catch(e) {
    console.error('Error loading human visualizations:', e);
  }
}

function loadBrainState(brain) {
  // If no brain data provided, fetch fresh
  if (!brain || Object.keys(brain).length === 0) {
    fetch('/api/status').then(r => r.json()).then(state => {
      loadBrainState(state.brain || {});
    });
    return;
  }
  
  // VTA - Average of motivation drives
  if (brain.vta) {
    const vta = (brain.vta.energy + brain.vta.purpose + (brain.vta.curiosity || 50) + (brain.vta.motivation || 50)) / 4;
    const vtaFill = document.getElementById('vtaFill');
    if (vtaFill) vtaFill.style.height = vta + '%';
  }
  
  // Amygdala - Mood display
  if (brain.amygdala) {
    const moodEl = document.getElementById('amygdalaMood');
    if (moodEl) moodEl.textContent = brain.amygdala.mood || 'neutral';
  }
  
  // PFC - Planning/attention
  if (brain.pfc) {
    const pfc = (brain.pfc.workingMemory + brain.pfc.planning + brain.pfc.attention) / 3;
    const pfcFill = document.getElementById('pfcFill');
    if (pfcFill) pfcFill.style.height = pfc + '%';
  }
  
  // Hippocampus - Memory
  if (brain.hippocampus) {
    const hippo = brain.hippocampus.memoryStrength || brain.hippocampus.consolidationScore || 50;
    const hippoFill = document.getElementById('hippoFill');
    if (hippoFill) hippoFill.style.height = hippo + '%';
  }
  
  // Basal Ganglia - Habits
  if (brain.basalGanglia) {
    const bg = brain.basalGanglia.habitStrength || 50;
    const bgFill = document.getElementById('bgFill');
    if (bgFill) bgFill.style.height = bg + '%';
  }
  
  // Nucleus Accumbens - Reward
  if (brain.nucleusAccumbens) {
    const nac = ((brain.nucleusAccumbens.rewardPrediction || 0.5) + (brain.nucleusAccumbens.dopamineLevel || 0.5)) * 50;
    const nacFill = document.getElementById('nacFill');
    if (nacFill) nacFill.style.height = nac + '%';
  }
}

function loadMoodHistory(actionHistory) {
  const container = document.getElementById('moodChart');
  if (!container) return;
  
  // Filter mood-related actions and take last 7
  const moodActions = actionHistory
    .filter(a => a.action === 'set_mood')
    .slice(0, 7)
    .reverse();
  
  if (moodActions.length === 0) {
    container.innerHTML = '<div style="color:#666;text-align:center;width:100%;">No mood data yet</div>';
    return;
  }
  
  const moodColors = {
    'happy': '#10b981',
    'calm': '#3b82f6',
    'focused': '#a855f7',
    'tired': '#f59e0b',
    'anxious': '#ef4444',
    'neutral': '#6b7280'
  };
  
  container.innerHTML = moodActions.map(a => {
    const mood = a.parameters?.mood || 'neutral';
    const color = moodColors[mood] || moodColors.neutral;
    return '<div style="flex:1;display:flex;flex-direction:column;align-items:center;">' +
      '<div style="width:100%;background:' + color + ';border-radius:4px;min-height:20px;height:40px;"></div>' +
      '<div style="font-size:8px;color:#888;margin-top:4px;">' + (mood.charAt(0).toUpperCase()) + '</div>' +
      '</div>';
  }).join('');
}

function loadTraits(state) {
  // Traits are shown via colors on the circles - update based on current state
  const needs = state.needs || {};
  const emotions = state.emotions || {};
  
  // Update trait circles with current values (just visual for now)
  console.log('Traits loaded - Energy:', needs.energy, 'Focus:', needs.purpose);
}

function loadSkills(skills) {
  const container = document.getElementById('skillsList');
  if (!container) return;
  
  if (!skills || skills.length === 0) {
    container.innerHTML = '<div style="color:#666;text-align:center;padding:20px;">No skills yet</div>';
    return;
  }
  
  container.innerHTML = skills.map(skill => 
    '<div style="padding:8px;background:#1a1a2e;border-radius:6px;margin-bottom:5px;display:flex;justify-content:space-between;align-items:center;">' +
    '<span>' + (skill.name || skill) + '</span>' +
    '<span style="color:#a855f7;font-size:12px;">' + (skill.level || '★') + '</span>' +
    '</div>'
  ).join('');
}

function loadGoals(goals) {
  const container = document.getElementById('goalsList');
  if (container) {
    if (!goals || goals.length === 0) {
      container.innerHTML = '<div style="color:#666;text-align:center;padding:20px;">No goals yet</div>';
    } else {
      container.innerHTML = goals.map(g => 
        '<div style="padding:10px;background:#1a1a2e;border-radius:6px;margin-bottom:5px;display:flex;justify-content:space-between;align-items:center;">' +
        '<span style="' + (g.completed ? 'text-decoration:line-through;color:#666;' : 'color:#10b981;') + '">' + g.text + '</span>' +
        '<div style="display:flex;gap:5px;">' +
        (g.completed ? '' : '<button onclick="completeGoal(\'' + g.id + '\')" style="padding:3px 8px;background:#10b981;border:none;border-radius:4px;color:white;font-size:10px;cursor:pointer;">✓</button>') +
        '<button onclick="deleteGoal(\'' + g.id + '\')" style="padding:3px 8px;background:#ef4444;border:none;border-radius:4px;color:white;font-size:10px;cursor:pointer;">×</button>' +
        '</div></div>'
      ).join('');
    }
  }
  
  // Also update human goals list
  const humanContainer = document.getElementById('humanGoalsList');
  if (humanContainer) {
    if (!goals || goals.length === 0) {
      humanContainer.innerHTML = '<div style="color:#666;text-align:center;padding:20px;">No goals yet</div>';
    } else {
      humanContainer.innerHTML = goals.map(g => 
        '<div style="padding:10px;background:#1a1a2e;border-radius:6px;margin-bottom:5px;display:flex;justify-content:space-between;align-items:center;">' +
        '<span style="' + (g.completed ? 'text-decoration:line-through;color:#666;' : 'color:#10b981;') + '">' + g.text + '</span>' +
        '<span style="font-size:12px;">' + (g.completed ? '✓' : '○') + '</span>' +
        '</div>'
      ).join('');
    }
  }
}

async function createFlock() {
  const flockName = document.getElementById('flockName').value;
  if (!flockName) {
    alert('Please enter a flock name');
    return;
  }
  
  try {
    const resp = await fetch('/api/flock', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: flockName, owner_id: userId, owner_type: 'human' })
    });
    const data = await resp.json();
    if (data.success) {
      loadFlock(); // Reload to show flock
    } else {
      alert('Error: ' + data.error);
    }
  } catch(e) {
    alert('Error creating flock');
  }
}

async function addAgentToFlock() {
  const agentId = document.getElementById('newAgentId').value;
  if (!agentId) {
    alert('Please enter an Agent ID');
    return;
  }
  
  try {
    const resp = await fetch('/api/flock/join', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ flock_id: window.currentFlockId, entity_id: agentId, entity_type: 'agent' })
    });
    const data = await resp.json();
    if (data.success) {
      document.getElementById('newAgentId').value = '';
      loadFlock();
    } else {
      alert('Error adding agent: ' + data.error);
    }
  } catch(e) {
    alert('Error adding agent');
  }
}

async function changePassword() {
  const newPass = document.getElementById('newPassword').value;
  if (!newPass || newPass.length < 4) {
    alert('Password must be at least 4 characters');
    return;
  }
  
  try {
    const resp = await fetch('/api/password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: userId, password: newPass })
    });
    const data = await resp.json();
    
    const responseDiv = document.getElementById('passwordChangeResponse');
    responseDiv.style.display = 'block';
    if (data.success) {
      responseDiv.style.background = 'rgba(16,185,129,0.1)';
      responseDiv.innerHTML = '✓ Password changed successfully!';
      localStorage.setItem('flock_pass', newPass);
    } else {
      responseDiv.style.background = 'rgba(239,68,68,0.1)';
      responseDiv.innerHTML = '✗ ' + (data.error || 'Failed');
    }
    
    setTimeout(() => { responseDiv.style.display = 'none'; }, 3000);
  } catch(e) {
    alert('Error changing password');
  }
}

async function loadTokenList() {
  if (!window.currentFlockId) return;
  
  try {
    const resp = await fetch('/api/token?flock_id=' + window.currentFlockId);
    const tokens = await resp.json();
    
    const container = document.getElementById('tokenListDisplay');
    if (!container) return;
    
    if (!tokens || tokens.length === 0) {
      container.innerHTML = '<div style="color:#666;text-align:center;padding:10px;">No tokens generated yet</div>';
      return;
    }
    
    container.innerHTML = tokens.map(t => 
      '<div style="padding:10px;background:#1a1a2e;border-radius:6px;margin-bottom:5px;display:flex;justify-content:space-between;align-items:center;">' +
      '<div><div style="font-weight:600;">' + (t.name || 'Token') + '</div>' +
      '<div style="font-size:11px;color:#888;">Created: ' + (t.created_at ? new Date(t.created_at).toLocaleDateString() : 'Unknown') + '</div></div>' +
      '<button onclick="revokeToken(\'' + t.id + '\')" style="padding:5px 10px;background:#ef4444;border:none;border-radius:4px;color:white;font-size:11px;cursor:pointer;">Revoke</button></div>'
    ).join('');
  } catch(e) {
    console.error('Error loading tokens:', e);
  }
}

async function revokeToken(tokenId) {
  if (!confirm('Are you sure you want to revoke this token? This cannot be undone.')) return;
  
  try {
    const resp = await fetch('/api/token', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token_id: tokenId, flock_id: window.currentFlockId })
    });
    const data = await resp.json();
    
    if (data.success) {
      loadTokenList();
    } else {
      alert('Error: ' + (data.error || 'Failed to revoke token'));
    }
  } catch(e) {
    alert('Error revoking token');
  }
}

async function generateToken() {
  const tokenName = document.getElementById('tokenName').value.trim();
  if (!tokenName) {
    alert('Please enter a token name');
    return;
  }
  
  try {
    const resp = await fetch('/api/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        flock_id: window.currentFlockId, 
        name: tokenName,
        entity_id: userId
      })
    });
    const data = await resp.json();
    
    if (data.success) {
      const display = document.getElementById('tokenDisplay');
      display.style.display = 'block';
      display.innerHTML = '<strong style="color:#10b981;">Token Created!</strong><br>Token: <code style="color:#a855f7;">' + data.token.token + '</code><br><span style="color:#888;">Save this! It will not be shown again.</span>';
    } else {
      alert('Error: ' + (data.error || 'Failed to create token'));
    }
  } catch(e) {
    alert('Error creating token');
  }
}

async function applyStateOverride() {
  const jsonStr = document.getElementById('stateJson').value.trim();
  if (!jsonStr) {
    alert('Please enter JSON');
    return;
  }
  
  try {
    const newState = JSON.parse(jsonStr);
    
    // Get current state and merge
    const currentResp = await fetch('/api/status');
    const currentState = await currentResp.json();
    
    // Merge new state into current
    const merged = { ...currentState, ...newState };
    
    // Apply via sync endpoint
    const resp = await fetch('/api/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(merged)
    });
    
    const result = await resp.json();
    
    const responseDiv = document.getElementById('stateOverrideResponse');
    responseDiv.style.display = 'block';
    if (result.status === 'synced') {
      responseDiv.style.background = 'rgba(16,185,129,0.1)';
      responseDiv.innerHTML = '✓ State applied successfully!';
      loadVisualizations();
    } else {
      responseDiv.style.background = 'rgba(239,68,68,0.1)';
      responseDiv.innerHTML = '✗ Error: ' + (result.error || 'Failed');
    }
    
    setTimeout(() => { responseDiv.style.display = 'none'; }, 3000);
  } catch(e) {
    alert('Invalid JSON: ' + e.message);
  }
}

async function createNewAgent() {
  const id = document.getElementById('createAgentId').value;
  const name = document.getElementById('createAgentName').value;
  if (!id || !name) { alert('Agent ID and Name required'); return; }
  
  try {
    const r = await fetch('/api/onboard/agent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, name, type: 'general', archetype: 'unknown', owner: userId })
    });
    const o = await r.json();
    if (o.success) {
      // Auto-add to flock
      if (window.currentFlockId) {
        await fetch('/api/flock/join', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ flock_id: window.currentFlockId, entity_id: id, entity_type: 'agent' })
        });
      }
      document.getElementById('newAgentKeyDisplay').style.display = 'block';
      document.getElementById('newAgentKeyDisplay').innerHTML = '<strong>Agent Created!</strong><br>ID: ' + id + '<br>API Key: <code style="color:#10b981;">' + o.api_key + '</code><br><span style="color:#888;">Save this key! It will not be shown again.</span>';
      document.getElementById('createAgentId').value = '';
      document.getElementById('createAgentName').value = '';
      loadFlock();
    } else {
      alert('Error: ' + o.error);
    }
  } catch (e) {
    alert('Error creating agent');
  }
}

<\/script></body></html>`;

// ==================== REQUEST HANDLER ====================


async function ensureApiKey(entity, type) {
  if (entity.api_key) return entity;
  const api_key = generateApiKey();
  entity.api_key = api_key;
  if (type === "human") await saveHuman(entity);
  else await saveAgent(entity);
  await MARIA_STATE.put("apikey:" + api_key, JSON.stringify({ id: entity.id, type }));
  return entity;
}

async function handleRequest(request) {
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method;
  const userId = url.searchParams.get("id");
  const authHeader = request.headers.get("Authorization");
  
  if (method === "OPTIONS") return new Response("", { status: 200, headers: cors });
  
  // ==================== EXISTING MARIA ENDPOINTS ====================
  
  if (path === "/api/login" && method === "GET") {
    // Rate limit login attempts
    const clientIP = request.headers.get("CF-Connecting-IP") || "unknown";
    if (!checkRateLimit("login:" + clientIP, 10, 60000)) {
      return new Response(JSON.stringify({ error: "Too many login attempts. Please try again later." }), { 
        status: 429, headers: { "Content-Type": "application/json", ...cors } 
      });
    }
    
    const userParam = url.searchParams.get("user");
    const agentParam = url.searchParams.get("agent");
    const password = url.searchParams.get("password");
    
    // Determine if this is a human or agent login attempt
    const isHumanLogin = userParam !== null;
    const isAgentLogin = agentParam !== null;
    const loginId = userParam || agentParam;
    
    if (!loginId) return new Response(JSON.stringify({ error: "id required (use ?user= for humans, ?agent= for agents)" }), { status: 400, headers: { "Content-Type": "application/json", ...cors } });
    
    // HUMAN LOGIN - must use ?user= parameter
    if (isHumanLogin) {
      if (!password) return new Response(JSON.stringify({ error: "Password required for human login" }), { status: 401, headers: { "Content-Type": "application/json", ...cors } });
      
      let human = await verifyHumanPassword(loginId, password);
      if (human) { human = await ensureApiKey(human, "human"); return new Response(JSON.stringify({ success: true, human, type: "human" }), { headers: { "Content-Type": "application/json", ...cors } }); }
      
      // Check if human exists but wrong password
      let existingHuman = await getHuman(loginId);
      if (existingHuman) {
        return new Response(JSON.stringify({ error: "Invalid password" }), { status: 401, headers: { "Content-Type": "application/json", ...cors } });
      }
      
      return new Response(JSON.stringify({ error: "Human not found" }), { status: 404, headers: { "Content-Type": "application/json", ...cors } });
    }
    
    // AGENT LOGIN - must use ?agent= parameter (no password, just ID)
    if (isAgentLogin) {
      let agent = await getAgent(loginId);
      if (agent) { agent = await ensureApiKey(agent, "agent"); return new Response(JSON.stringify({ success: true, agent, type: "agent" }), { headers: { "Content-Type": "application/json", ...cors } }); }
      return new Response(JSON.stringify({ error: "Agent not found" }), { status: 404, headers: { "Content-Type": "application/json", ...cors } });
    }
    
    return new Response(JSON.stringify({ error: "Use ?user= for humans or ?agent= for agents" }), { status: 400, headers: { "Content-Type": "application/json", ...cors } });
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
  
  // Set password for existing user
  if (path === "/api/password" && method === "POST") {
    try {
      const body = await request.json();
      const { id, password, current_password, new_password } = body;
      
      // Password change with verification
      if (current_password && new_password) {
        let human = await getHuman(id);
        if (!human) return new Response(JSON.stringify({ success: false, error: "Human not found" }), { status: 404, headers: { "Content-Type": "application/json", ...cors } });
        
        // Verify current password
        if (human.password_hash !== simpleHash(current_password)) {
          return new Response(JSON.stringify({ success: false, error: "Current password is incorrect" }), { status: 401, headers: { "Content-Type": "application/json", ...cors } });
        }
        
        human.password_hash = simpleHash(new_password);
        await saveHuman(human);
        return new Response(JSON.stringify({ success: true, message: "Password updated" }), { headers: { "Content-Type": "application/json", ...cors } });
      }
      
      // Simple password set (for initial setup)
      if (!id || !password) return new Response(JSON.stringify({ success: false, error: "id and password required" }), { status: 400, headers: { "Content-Type": "application/json", ...cors } });
      
      // Try human first
      let human = await getHuman(id);
      if (human) {
        human.password_hash = simpleHash(password);
        await saveHuman(human);
        return new Response(JSON.stringify({ success: true, message: "Password set for human" }), { headers: { "Content-Type": "application/json", ...cors } });
      }
      
      // Try agent
      let agent = await getAgent(id);
      if (agent) {
        return new Response(JSON.stringify({ success: false, error: "Agents don't use passwords" }), { status: 400, headers: { "Content-Type": "application/json", ...cors } });
      }
      
      return new Response(JSON.stringify({ success: false, error: "User not found" }), { status: 404, headers: { "Content-Type": "application/json", ...cors } });
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
  
  // ==================== ACTION ENDPOINTS ====================
  
  // Trigger an action on an agent
  if (path === "/api/action" && method === "POST") {
    try {
      const body = await request.json();
      const { agent_id, action, parameters } = body;
      
      // Graceful validation
      if (!agent_id) {
        return new Response(JSON.stringify({ success: false, error: "agent_id is required" }), { 
          status: 400, headers: { "Content-Type": "application/json", ...cors } 
        });
      }
      
      if (!action) {
        return new Response(JSON.stringify({ success: false, error: "action is required. Valid actions: set_mood, update_needs, set_activity, add_goal, complete_goal" }), { 
          status: 400, headers: { "Content-Type": "application/json", ...cors } 
        });
      }
      
      // Agent existence check - verify agent exists
      let agent = await getAgent(agent_id);
      if (!agent) {
        // Try to find in humans or create minimal record
        let human = await getHuman(agent_id);
        if (!human) {
          return new Response(JSON.stringify({ success: false, error: "Agent not found: " + agent_id }), { 
            status: 404, headers: { "Content-Type": "application/json", ...cors } 
          });
        }
      }
      
      // Get current state
      const state = await getState();
      
      // Create action record
      const actionRecord = {
        id: "action_" + Date.now(),
        agent_id,
        action,
        parameters: parameters || {},
        timestamp: new Date().toISOString(),
        status: "completed"
      };
      
      // Add to action history
      if (!state.action_history) state.action_history = [];
      state.action_history.unshift(actionRecord);
      if (state.action_history.length > 100) state.action_history.pop();
      
      // Update agent state based on action
      let response = { success: true, action: actionRecord };
      
      // Handle specific actions
      if (action === "set_mood") {
        if (!parameters || !parameters.mood) {
          return new Response(JSON.stringify({ success: false, error: "mood parameter required" }), { 
            status: 400, headers: { "Content-Type": "application/json", ...cors } 
          });
        }
        if (!state.emotions) state.emotions = {};
        state.emotions.mood = parameters.mood;
        state.emotions.narrative = parameters.narrative || "Mood set via dashboard";
        response.new_state = state.emotions;
      }
      else if (action === "update_needs") {
        if (parameters) {
          if (!state.needs) state.needs = {};
          if (parameters.energy) state.needs.energy = Math.min(100, Math.max(0, parameters.energy));
          if (parameters.hunger) state.needs.hunger = Math.min(100, Math.max(0, parameters.hunger));
          if (parameters.social) state.needs.social = Math.min(100, Math.max(0, parameters.social));
          if (parameters.fun) state.needs.fun = Math.min(100, Math.max(0, parameters.fun));
          if (parameters.purpose) state.needs.purpose = Math.min(100, Math.max(0, parameters.purpose));
          response.new_state = state.needs;
        }
      }
      else if (action === "set_activity") {
        if (!parameters || !parameters.activity) {
          return new Response(JSON.stringify({ success: false, error: "activity parameter required" }), { 
            status: 400, headers: { "Content-Type": "application/json", ...cors } 
          });
        }
        state.current_activity = parameters.activity;
        response.new_state = { current_activity: state.current_activity };
      }
      else if (action === "add_goal") {
        if (!parameters || !parameters.goal) {
          return new Response(JSON.stringify({ success: false, error: "goal parameter required" }), { 
            status: 400, headers: { "Content-Type": "application/json", ...cors } 
          });
        }
        if (!state.goals) state.goals = [];
        state.goals.push({
          id: "goal_" + Date.now(),
          text: parameters.goal,
          completed: false,
          created_at: new Date().toISOString()
        });
        response.new_state = { goals: state.goals };
      }
      else if (action === "complete_goal") {
        if (!parameters || !parameters.goal_id) {
          return new Response(JSON.stringify({ success: false, error: "goal_id parameter required" }), { 
            status: 400, headers: { "Content-Type": "application/json", ...cors } 
          });
        }
        if (state.goals) {
          const goal = state.goals.find(g => g.id === parameters.goal_id);
          if (goal) {
            goal.completed = true;
            goal.completed_at = new Date().toISOString();
          }
        }
        response.new_state = { goals: state.goals };
      }
      
      await saveFullState(state);
      
      return new Response(JSON.stringify(response), { 
        headers: { "Content-Type": "application/json", ...cors } 
      });
    } catch (e) {
      return new Response(JSON.stringify({ success: false, error: e.message }), { 
        status: 500, headers: { "Content-Type": "application/json", ...cors } 
      });
    }
  }
  
  // Agent heartbeat - ping to update presence
  if (path === "/api/heartbeat" && method === "POST") {
    try {
      const body = await request.json();
      const { agent_id, status, activity } = body;
      
      if (!agent_id) {
        return new Response(JSON.stringify({ success: false, error: "agent_id required" }), { 
          status: 400, headers: { "Content-Type": "application/json", ...cors } 
        });
      }
      
      // Verify agent exists
      const agent = await getAgent(agent_id);
      if (!agent) {
        return new Response(JSON.stringify({ success: false, error: "Agent not found" }), { 
          status: 404, headers: { "Content-Type": "application/json", ...cors } 
        });
      }
      
      // Update presence
      const presence = await updatePresence(agent_id, status || "online", activity);
      
      return new Response(JSON.stringify({ 
        success: true, 
        presence: presence,
        timestamp: new Date().toISOString()
      }), { 
        headers: { "Content-Type": "application/json", ...cors } 
      });
    } catch (e) {
      return new Response(JSON.stringify({ success: false, error: e.message }), { 
        status: 500, headers: { "Content-Type": "application/json", ...cors } 
      });
    }
  }
  
  // Delete a goal
  if (path === "/api/goal" && method === "DELETE") {
    const body = await request.json();
    const { goal_id } = body;
    
    if (!goal_id) {
      return new Response(JSON.stringify({ success: false, error: "goal_id required" }), { 
        status: 400, headers: { "Content-Type": "application/json", ...cors } 
      });
    }
    
    try {
      const state = await getState();
      if (state.goals) {
        state.goals = state.goals.filter(g => g.id !== goal_id);
        await saveFullState(state);
      }
      return new Response(JSON.stringify({ success: true }), { 
        headers: { "Content-Type": "application/json", ...cors } 
      });
    } catch (e) {
      return new Response(JSON.stringify({ success: false, error: e.message }), { 
        status: 500, headers: { "Content-Type": "application/json", ...cors } 
      });
    }
  }
  
  // Get action history
  if (path === "/api/action" && method === "GET") {
    const agent_id = url.searchParams.get("agent_id");
    const limit = parseInt(url.searchParams.get("limit") || "20");
    
    try {
      const state = await getState();
      let history = state.action_history || [];
      
      if (agent_id) {
        history = history.filter(a => a.agent_id === agent_id);
      }
      
      history = history.slice(0, limit);
      
      return new Response(JSON.stringify(history), { 
        headers: { "Content-Type": "application/json", ...cors } 
      });
    } catch (e) {
      return new Response(JSON.stringify({ error: e.message }), { 
        status: 500, headers: { "Content-Type": "application/json", ...cors } 
      });
    }
  }
  
  // ==================== UI ROUTES ====================
  
  if (path === "/" || path === "/onboarding" || path === "/register") return new Response(ONBOARDING, { headers: { "Content-Type": "text/html" } });
  if (path === "/login") return new Response(LOGIN, { headers: { "Content-Type": "text/html" } });
  if (path === "/dashboard") return new Response(DASHBOARD, { headers: { "Content-Type": "text/html" } });
  
  return new Response(ONBOARDING, { headers: { "Content-Type": "text/html" } });
}
