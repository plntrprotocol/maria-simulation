import { Server } from "colyseus";
import { createServer } from "http";
import express from "express";
import cors from "cors";
import { OpenWorldRoom } from "./room.js";

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
