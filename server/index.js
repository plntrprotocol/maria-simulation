const { Server } = require("colyseus");
const { createServer } = require("http");
const express = require("express");
const cors = require("cors");
const { OpenWorldRoom } = require("./room");

const port = process.env.PORT || 2567;
const app = express();

app.use(cors());
app.use(express.json());

// Setup Colyseus Server
const server = new Server({
  server: createServer(app)
});

// Register our Simulation Room
server.define("open_world", OpenWorldRoom);

// Start the Headless Engine
server.listen(port);
console.log(`🤖 OpenWorld Headless Engine running on ws://localhost:${port}`);
