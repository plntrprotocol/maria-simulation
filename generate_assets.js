const https = require('https');
const fs = require('fs');
const path = require('path');

const API_KEY = "dbe31540-b54f-47ae-a65b-224c9301b336";
const DIR = '/Users/johann/.openclaw/workspace-sentinel/maria-simulation/assets/pixel-buildings/';

const buildings = [
    { id: "flock-home", desc: "A modern minimalist upper-middle-class suburban home exterior. Clean white walls, sleek glass windows. High end modern architecture." },
    { id: "coffee-house", desc: "A trendy artisan coffee shop exterior. Matte black paneling, warm reclaimed wood accents." },
    { id: "library", desc: "A regal modern minimalist suburban library exterior. Tall vertical wooden louvers, expansive sleek dark glass." },
    { id: "art-gallery", desc: "A contemporary art museum exterior. White concrete, sheer glass, abstract shapes." },
    { id: "conservatory", desc: "An elegant glass botanical conservatory building exterior. Sleek modern steel framing." }
];

function postJSON(options, payload) {
    return new Promise((resolve, reject) => {
        const data = JSON.stringify(payload);
        const req = https.request({
            hostname: 'api.pixellab.ai',
            port: 443,
            path: '/v2/create-image-bitforge',
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${API_KEY}`,
                'Content-Type': 'application/json',
                'Content-Length': data.length
            }
        }, (res) => {
            let body = '';
            res.on('data', c => body += c);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(body));
                } catch(e) {
                    resolve({error: body});
                }
            });
        });
        req.on('error', reject);
        req.write(data);
        req.end();
    });
}

async function generateAll() {
    console.log("Generating PixelLab assets...");
    for (const b of buildings) {
        console.log(`Generating ${b.id}...`);
        try {
            const res = await postJSON({}, {
                description: b.desc,
                image_size: { width: 128, height: 128 },
                view: "low top-down",
                detail: "highly detailed",
                no_background: true
            });
            
            if (res.success && res.data && res.data.image && res.data.image.base64) {
                const buf = Buffer.from(res.data.image.base64, 'base64');
                fs.writeFileSync(path.join(DIR, b.id + '.png'), buf);
                console.log(`✓ Saved ${b.id}.png (${buf.length} bytes)`);
            } else {
                console.log(`✗ Failed ${b.id}:`, res.error || res.detail || "Unknown");
            }
        } catch(e) {
            console.log(`✗ Error ${b.id}:`, e.message);
        }
        await new Promise(r => setTimeout(r, 1000));
    }
    console.log("Done!");
}

generateAll();
