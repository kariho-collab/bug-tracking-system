const express = require("express");
const bcrypt = require("bcryptjs");
const db = require("../db/connection");

const router = express.Router();

// POST /api/register - create a new user account
router.post("/register", (req, res) => {
  const { name, email, password, role } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ error: "name, email, and password are required" });
  }

  const existing = db.prepare("SELECT user_id FROM users WHERE email = ?").get(email);
  if (existing) {
    return res.status(409).json({ error: "An account with this email already exists" });
  }

  const passwordHash = bcrypt.hashSync(password, 10);
  const result = db
    .prepare("INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)")
    .run(name, email, passwordHash, role || "developer");

  res.status(201).json({
    user_id: result.lastInsertRowid,
    name,
    email,
    role: role || "developer",
  });
});

// POST /api/login - authenticate and start a session
router.post("/login", (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: "email and password are required" });
  }

  const user = db.prepare("SELECT * FROM users WHERE email = ?").get(email);

  if (!user || !bcrypt.compareSync(password, user.password)) {
    return res.status(401).json({ error: "Invalid email or password" });
  }

  req.session.userId = user.user_id;
  req.session.role = user.role;

  res.json({
    message: "Login successful",
    user: { user_id: user.user_id, name: user.name, email: user.email, role: user.role },
  });
});

// POST /api/logout
router.post("/logout", (req, res) => {
  req.session.destroy(() => res.json({ message: "Logged out" }));
});

module.exports = router;
