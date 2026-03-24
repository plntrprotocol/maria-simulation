const { Schema, type, MapSchema } = require('@colyseus/schema');

// The state of a single agent/player
class Avatar extends Schema {
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
type("string")(Avatar.prototype, "id");
type("string")(Avatar.prototype, "name");
type("number")(Avatar.prototype, "x");
type("number")(Avatar.prototype, "y");
type("number")(Avatar.prototype, "targetX");
type("number")(Avatar.prototype, "targetY");
type("string")(Avatar.prototype, "state");
type("number")(Avatar.prototype, "vtaDrive");
type("number")(Avatar.prototype, "socialDrive");

// The global state of the Simulation Room
class SimulationState extends Schema {
    constructor() {
        super();
        this.avatars = new MapSchema();
    }
}
type({ map: Avatar })(SimulationState.prototype, "avatars");

module.exports = { Avatar, SimulationState };
