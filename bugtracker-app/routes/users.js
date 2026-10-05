const express = require("express");
const bcrypt = require("bcryptjs");
const db = require("../db/connection");
const requireAdmin = require("../middleware/requireAdmin");

const router = express.Router();

// GET /api/users - list all users (admin only)
router.get("/", requireAdmin, (req, res) => {
  const users = db.prepare("SELECT user_id, name, email, role FROM users ORDER BY name").all();
  res.json({ count: users.length, users });
});

// POST /api/users - create a user (admin only)
router.post("/", requireAdmin, (req, res) => {
  const { name, email, password, role } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ error: "name, email, and password are required" });
  }
  const existing = db.prepare("SELECT user_id FROM users WHERE email = ?").get(email);
  if (existing) {
    return res.status(409).json({ error: "An account with this email already exists" });
  }
  const result = db
    .prepare("INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)")
    .run(name, email, bcrypt.hashSync(password, 10), role || "developer");
  res.status(201).json({ user_id: result.lastInsertRowid, name, email, role: role || "developer" });
});

// PATCH /api/users/:id - change a user's role (admin only)
router.patch("/:id", requireAdmin, (req, res) => {
  const { role } = req.body;
  if (!role) return res.status(400).json({ error: "role is required" });
  const user = db.prepare("SELECT * FROM users WHERE user_id = ?").get(req.params.id);
  if (!user) return res.status(404).json({ error: "User not found" });
  db.prepare("UPDATE users SET role = ? WHERE user_id = ?").run(role, req.params.id);
  res.json({ message: `${user.name}'s role updated to ${role}` });
});

// DELETE /api/users/:id - remove a user (admin only)
router.delete("/:id", requireAdmin, (req, res) => {
  const user = db.prepare("SELECT * FROM users WHERE user_id = ?").get(req.params.id);
  if (!user) return res.status(404).json({ error: "User not found" });
  if (Number(req.params.id) === req.session.userId) {
    return res.status(400).json({ error: "You cannot remove your own account" });
  }
  db.prepare("DELETE FROM users WHERE user_id = ?").run(req.params.id);
  res.json({ message: `${user.name} removed` });
});

module.exports = router;
