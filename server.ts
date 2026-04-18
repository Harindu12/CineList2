import express from 'express';
import { createServer as createViteServer } from 'vite';
import Database from 'better-sqlite3';
import path from 'path';
import cors from 'cors';

const db = new Database('data.db'); // creates data.db locally

// Initialize table
db.exec(`
  CREATE TABLE IF NOT EXISTS items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    type TEXT,
    year TEXT,
    director TEXT,
    genre TEXT,
    rating TEXT,
    cast_json TEXT,
    synopsis TEXT,
    status TEXT,
    progress INTEGER,
    poster TEXT,
    createdAt INTEGER
  )
`);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(express.json());

  // API Routes
  app.get('/api/items', (req, res) => {
    const rows = db.prepare('SELECT * FROM items ORDER BY createdAt DESC').all();
    const items = rows.map((r: any) => ({
      ...r,
      cast: r.cast_json ? JSON.parse(r.cast_json) : undefined
    }));
    res.json(items);
  });

  app.post('/api/items', (req, res) => {
    const data = req.body;
    const stmt = db.prepare(`
      INSERT INTO items (title, type, year, director, genre, rating, cast_json, synopsis, status, progress, poster, createdAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const info = stmt.run(
      data.title,
      data.type,
      data.year || null,
      data.director || null,
      data.genre || null,
      data.rating || null,
      data.cast ? JSON.stringify(data.cast) : null,
      data.synopsis || null,
      data.status || 'plan',
      data.progress || 0,
      data.poster || null,
      Date.now()
    );
    res.json({ id: info.lastInsertRowid });
  });

  app.patch('/api/items/:id', (req, res) => {
    const { id } = req.params;
    const updates = req.body;
    const fields = Object.keys(updates).filter(f => f !== 'id' && f !== 'cast_json' && f !== 'createdAt');
    
    if (fields.length === 0) {
      res.json({ success: true });
      return;
    }

    const setClause = fields.map(f => `${f} = ?`).join(', ');
    const values = fields.map(f => {
      if (f === 'cast') return JSON.stringify(updates[f]);
      return updates[f];
    });

    const stmt = db.prepare(`UPDATE items SET ${setClause} WHERE id = ?`);
    stmt.run(...values, id);
    res.json({ success: true });
  });

  app.delete('/api/items/:id', (req, res) => {
    const { id } = req.params;
    db.prepare('DELETE FROM items WHERE id = ?').run(id);
    res.json({ success: true });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*all', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
