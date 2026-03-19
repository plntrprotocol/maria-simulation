#!/usr/bin/env python3
"""
Maria Sim Dashboard Server
Serves the dashboard and provides API endpoints
"""

import http.server
import socketserver
import json
import os
from pathlib import Path
from datetime import datetime
import urllib.parse
import subprocess

PORT = 8787
BASE_DIR = Path("/Users/johann/.openclaw/workspace-sentinel/maria-simulation")

class MariaHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(BASE_DIR), **kwargs)
    
    def do_GET(self):
        if self.path == '/api/status':
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            
            state_file = BASE_DIR / "state/maria-state.json"
            with open(state_file) as f:
                state = json.load(f)
            
            response = {
                "needs": state["needs"],
                "emotions": state.get("emotions", {}),
                "skills": state.get("skills", {}),
                "identity": state.get("identity", {}),
                "environment": state.get("environment", {}),
                "inventory": state.get("inventory", {}),
                "current_action": state.get("current_action"),
                "timestamp": datetime.utcnow().isoformat() + "Z"
            }
            self.wfile.write(json.dumps(response).encode())
            
        elif self.path == '/api/logs':
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            
            log_dir = BASE_DIR / 'logs'
            logs = sorted(log_dir.glob('*.json'), reverse=True)[:20]
            log_data = []
            for log in logs:
                with open(log) as f:
                    log_data.append(json.load(f))
            self.wfile.write(json.dumps(log_data).encode())
            
        else:
            super().do_GET()
    
    def do_POST(self):
        if self.path == '/api/action':
            content_length = int(self.headers.get('Content-Length', 0))
            post_data = self.rfile.read(content_length).decode('utf-8')
            
            try:
                action_name = json.loads(post_data).get('action')
                if not action_name:
                    self.send_response(400)
                    self.send_header('Content-type', 'application/json')
                    self.end_headers()
                    self.wfile.write(json.dumps({'error': 'No action provided'}).encode())
                    return
                
                result = subprocess.run(
                    ['python3', str(BASE_DIR / 'scripts/maria-action.py'), action_name],
                    capture_output=True, text=True, cwd=str(BASE_DIR)
                )
                
                self.send_response(200)
                self.send_header('Content-type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                
                if result.returncode == 0:
                    self.wfile.write(result.stdout.encode())
                else:
                    self.wfile.write(json.dumps({'error': result.stderr}).encode())
            except Exception as e:
                self.send_response(500)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({'error': str(e)}).encode())
        else:
            self.send_response(404)
            self.end_headers()

print(f"Starting Maria Sim Dashboard on http://localhost:{PORT}")
print(f"Dashboard: http://localhost:{PORT}/dashboard/")
print(f"API: http://localhost:{PORT}/api/status")

with socketserver.TCPServer(("", PORT), MariaHandler) as httpd:
    httpd.serve_forever()
