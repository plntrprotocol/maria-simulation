import { Schema, type } from '@colyseus/schema';

// The state of a single agent/player
export class Avatar extends Schema {
    constructor(id, name, x, y) {
        super();
        this.id = id;
        this.name = name;
        this.x = x;
        this.y = y;
        this.targetX = x;
        this.targetY = y;
        this.state = "idle"; // idle, walking, interacting, sleeping
        this.vtaDrive = 0.5; // Novelty/Motivation
        this.socialDrive = 0.5; // Connection
    }
}
type("string", true)(Avatar.prototype, "id");
type("string", true)(Avatar.prototype, "name");
type("number", true)(Avatar.prototype, "x");
type("number", true)(Avatar.prototype, "y");
type("number", true)(Avatar.prototype, "targetX");
type("number", true)(Avatar.prototype, "targetY");
type("string", true)(Avatar.prototype, "state");
type("number", true)(Avatar.prototype, "vtaDrive");
type("number", true)(Avatar.prototype, "socialDrive");

// The global state of the Simulation Room
export class SimulationState extends Schema {
    constructor() {
        super();
        this.avatars = new Map();
    }
}
type({ map: Avatar }, true)(SimulationState.prototype, "avatars");
