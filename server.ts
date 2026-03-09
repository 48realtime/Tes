import express from "express";
import { createServer as createViteServer } from "vite";
import { WebSocketServer, WebSocket } from "ws";
import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const db = new Database("realtime48.db");

// Initialize Database
db.exec(`
  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT
  );
  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user TEXT,
    text TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS playlist (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT,
    url TEXT
  );
`);

// Default settings
const defaultSettings = [
  ['live_status', 'false'],
  ['stream_url', ''],
  ['show_title', 'RealTime48 Live'],
  ['admin_password', 'dhatul01']
];

for (const [key, value] of defaultSettings) {
  const exists = db.prepare("SELECT 1 FROM settings WHERE key = ?").get(key);
  if (!exists) {
    db.prepare("INSERT INTO settings (key, value) VALUES (?, ?)").run(key, value);
  }
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Routes
  app.get("/api/state", (req, res) => {
    const settings = db.prepare("SELECT * FROM settings").all() as {key: string, value: string}[];
    const state: Record<string, any> = {};
    settings.forEach(s => state[s.key] = s.value);
    
    const messages = db.prepare("SELECT * FROM messages ORDER BY timestamp DESC LIMIT 50").all();
    const playlist = db.prepare("SELECT * FROM playlist").all();
    
    res.json({ ...state, messages: messages.reverse(), playlist });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  const server = app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });

  // WebSocket Server
  const wss = new WebSocketServer({ server });
  let viewerCount = 0;

  function broadcast(data: any) {
    const message = JSON.stringify(data);
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  }

  wss.on("connection", (ws) => {
    viewerCount++;
    broadcast({ type: "VIEWER_COUNT", count: viewerCount });

    ws.on("message", (data) => {
      try {
        const payload = JSON.parse(data.toString());
        
        if (payload.type === "CHAT_MESSAGE") {
          const stmt = db.prepare("INSERT INTO messages (user, text) VALUES (?, ?)");
          const info = stmt.run(payload.user, payload.text);
          broadcast({ 
            type: "CHAT_MESSAGE", 
            id: info.lastInsertRowid,
            user: payload.user, 
            text: payload.text,
            timestamp: new Date().toISOString()
          });
        }

        if (payload.type === "UPDATE_SETTINGS") {
          // Verify password (simple check for demo)
          if (payload.password === db.prepare("SELECT value FROM settings WHERE key = 'admin_password'").get().value) {
            const updateStmt = db.prepare("UPDATE settings SET value = ? WHERE key = ?");
            if (payload.live_status !== undefined) updateStmt.run(payload.live_status.toString(), 'live_status');
            if (payload.stream_url !== undefined) updateStmt.run(payload.stream_url, 'stream_url');
            if (payload.show_title !== undefined) updateStmt.run(payload.show_title, 'show_title');
            
            broadcast({ 
              type: "SETTINGS_UPDATED", 
              live_status: payload.live_status,
              stream_url: payload.stream_url,
              show_title: payload.show_title
            });
          }
        }

        if (payload.type === "PLAYLIST_ADD") {
            if (payload.password === db.prepare("SELECT value FROM settings WHERE key = 'admin_password'").get().value) {
                const stmt = db.prepare("INSERT INTO playlist (title, url) VALUES (?, ?)");
                stmt.run(payload.title, payload.url);
                const playlist = db.prepare("SELECT * FROM playlist").all();
                broadcast({ type: "PLAYLIST_UPDATED", playlist });
            }
        }

        if (payload.type === "PLAYLIST_REMOVE") {
            if (payload.password === db.prepare("SELECT value FROM settings WHERE key = 'admin_password'").get().value) {
                const stmt = db.prepare("DELETE FROM playlist WHERE id = ?");
                stmt.run(payload.id);
                const playlist = db.prepare("SELECT * FROM playlist").all();
                broadcast({ type: "PLAYLIST_UPDATED", playlist });
            }
        }
      } catch (e) {
        console.error("WS Error:", e);
      }
    });

    ws.on("close", () => {
      viewerCount--;
      broadcast({ type: "VIEWER_COUNT", count: Math.max(0, viewerCount) });
    });
  });
}

startServer();
