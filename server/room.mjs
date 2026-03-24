import { Room } from 'colyseus';
import { Avatar, SimulationState } from './schema.mjs';

export class OpenWorldRoom extends Room {
    // When the room is initialized
    onCreate(options) {
        console.log("Room Created: OpenWorldRoom");
        
        // Setup the state schema
        this.setState(new SimulationState());
        
        // Spawn our 3 autonomous agents
        this.state.avatars.set("palantir", new Avatar("palantir", "Palantir", 5, 5));
        this.state.avatars.set("isildur", new Avatar("isildur", "Isildur", 10, 5));
        this.state.avatars.set("sentinel", new Avatar("sentinel", "Maria", 15, 5));

        // The core simulation tick (20 times per second)
        this.setSimulationInterval((deltaTime) => this.update(deltaTime), 50);

        // Listen for movement commands from clients
        this.onMessage("move", (client, data) => {
            const avatar = this.state.avatars.get(client.sessionId);
            if (avatar) {
                avatar.targetX = data.x;
                avatar.targetY = data.y;
                avatar.state = "walking";
                console.log(`${avatar.name} moving to ${data.x}, ${data.y}`);
            }
        });
    }

    // When a human player connects
    onJoin(client, options) {
        console.log(`Human joined: ${client.sessionId}`);
        const playerName = options.name || "Anduril";
        this.state.avatars.set(client.sessionId, new Avatar(client.sessionId, playerName, 0, 0));
    }

    // When a human player disconnects
    onLeave(client, consented) {
        console.log(`Human left: ${client.sessionId}`);
        this.state.avatars.delete(client.sessionId);
    }

    // The Server-Side Logic Loop
    update(deltaTime) {
        const deltaSec = deltaTime / 1000;
        const speed = 3.0;
        
        for (const [key, avatar] of this.state.avatars) {
            if (avatar.state === "walking") {
                const dx = avatar.targetX - avatar.x;
                const dy = avatar.targetY - avatar.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                
                if (dist > 0.1) {
                    avatar.x += (dx / dist) * speed * deltaSec;
                    avatar.y += (dy / dist) * speed * deltaSec;
                } else {
                    avatar.x = avatar.targetX;
                    avatar.y = avatar.targetY;
                    avatar.state = "idle";
                }
            }
        }
    }
}
