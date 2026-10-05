const express = require("express");
const bcrypt = require("bcryptjs");
const db = require("../db/connection");
const requirePageAuth = require("../middleware/requirePageAuth");
const requirePageAdmin = require("../middleware/requirePageAdmin");

const router = express.Router();

function currentUser(req) {
  if (!req.session.userId) return null;
  return db.prepare("SELECT user_id, name, email, role FROM users WHERE user_id = ?").get(req.session.userId);
}

router.get("/", (req, res) => res.redirect(req.session.userId ? "/dashboard" : "/login"));

// ---------- Auth pages ----------
router.get("/login", (req, res) => {
  if (req.session.userId) return res.redirect("/dashboard");
  res.render("login", { error: null });
});

router.post("/login", (req, res) => {
  const { email, password } = req.body;
  const u = db.prepare("SELECT * FROM users WHERE email = ?").get(email);
  if (!u || !bcrypt.compareSync(password, u.password)) {
    return res.render("login", { error: "Invalid email or password." });
  }
  req.session.userId = u.user_id;
  req.session.role = u.role;
  res.redirect("/dashboard");
});

router.get("/register", (req, res) => {
  if (req.session.userId) return res.redirect("/dashboard");
  res.render("register", { error: null });
});

router.post("/register", (req, res) => {
  const { name, email, password } = req.body;
  const existing = db.prepare("SELECT user_id FROM users WHERE email = ?").get(email);
  if (existing) return res.render("register", { error: "An account with this email already exists." });
  const result = db
    .prepare("INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, 'developer')")
    .run(name, email, bcrypt.hashSync(password, 10));
  req.session.userId = result.lastInsertRowid;
  req.session.role = "developer";
  res.redirect("/dashboard");
});

router.get("/logout", (req, res) => req.session.destroy(() => res.redirect("/login")));

// ---------- Dashboard ----------
router.get("/dashboard", requirePageAuth, (req, res) => {
  const user = currentUser(req);
  const counts = {
    open: db.prepare("SELECT COUNT(*) n FROM bugs b JOIN statuses s ON s.status_id=b.status_id WHERE s.name='Open'").get().n,
    inProgress: db.prepare("SELECT COUNT(*) n FROM bugs b JOIN statuses s ON s.status_id=b.status_id WHERE s.name='In Progress'").get().n,
    resolved: db.prepare("SELECT COUNT(*) n FROM bugs b JOIN statuses s ON s.status_id=b.status_id WHERE s.name IN ('Resolved','Closed')").get().n,
    critical: db.prepare("SELECT COUNT(*) n FROM bugs WHERE priority='Critical'").get().n,
  };
  const recentBugs = db
    .prepare(
      `SELECT b.bug_id, b.title, b.priority, c.name AS category, s.name AS status, u2.name AS assigned_to
       FROM bugs b
       JOIN categories c ON c.category_id=b.category_id
       JOIN statuses s ON s.status_id=b.status_id
       LEFT JOIN users u2 ON u2.user_id=b.assigned_to
       ORDER BY b.date_reported DESC LIMIT 5`
    )
    .all();
  res.render("dashboard", { user, counts, recentBugs });
});

// ---------- Report a bug ----------
router.get("/report-bug", requirePageAuth, (req, res) => {
  const user = currentUser(req);
  const categories = db.prepare("SELECT * FROM categories ORDER BY name").all();
  res.render("report-bug", { user, categories, duplicateOf: null });
});

router.post("/report-bug", requirePageAuth, (req, res) => {
  const user = currentUser(req);
  const { title, description, category_id, priority } = req.body;
  const categories = db.prepare("SELECT * FROM categories ORDER BY name").all();

  const possibleDuplicate = db
    .prepare(
      `SELECT b.bug_id, b.title, s.name AS status
       FROM bugs b JOIN statuses s ON s.status_id=b.status_id
       WHERE b.category_id=? AND s.name IN ('Open','In Progress','Reopened') AND LOWER(b.title)=LOWER(?)`
    )
    .get(category_id, title.trim());

  if (possibleDuplicate) {
    return res.render("report-bug", { user, categories, duplicateOf: possibleDuplicate });
  }

  const openStatus = db.prepare("SELECT status_id FROM statuses WHERE name='Open'").get();
  const result = db
    .prepare(
      `INSERT INTO bugs (title, description, priority, category_id, status_id, reported_by)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .run(title.trim(), description, priority, category_id, openStatus.status_id, user.user_id);

  res.redirect(`/bugs/${result.lastInsertRowid}`);
});

// ---------- Bug tracker list ----------
router.get("/bugs", requirePageAuth, (req, res) => {
  const user = currentUser(req);
  const categories = db.prepare("SELECT * FROM categories ORDER BY name").all();
  const { status, priority, category } = req.query;

  let sql = `
    SELECT b.bug_id, b.title, b.priority, b.date_reported, c.name AS category, s.name AS status, u2.name AS assigned_to
    FROM bugs b
    JOIN categories c ON c.category_id=b.category_id
    JOIN statuses s ON s.status_id=b.status_id
    LEFT JOIN users u2 ON u2.user_id=b.assigned_to
    WHERE 1=1
  `;
  const params = [];
  if (status) { sql += " AND s.name=?"; params.push(status); }
  if (priority) { sql += " AND b.priority=?"; params.push(priority); }
  if (category) { sql += " AND c.name=?"; params.push(category); }
  sql += " ORDER BY b.date_reported DESC";

  const bugs = db.prepare(sql).all(...params);
  res.render("bugs", { user, bugs, categories, query: req.query });
});

// ---------- Bug detail ----------
router.get("/bugs/:id", requirePageAuth, (req, res) => {
  const user = currentUser(req);
  const bug = db
    .prepare(
      `SELECT b.*, c.name AS category, s.name AS status, u1.name AS reported_by_name, u2.name AS assigned_to_name
       FROM bugs b
       JOIN categories c ON c.category_id=b.category_id
       JOIN statuses s ON s.status_id=b.status_id
       JOIN users u1 ON u1.user_id=b.reported_by
       LEFT JOIN users u2 ON u2.user_id=b.assigned_to
       WHERE b.bug_id=?`
    )
    .get(req.params.id);
  if (!bug) return res.status(404).send("Bug not found");

  const comments = db
    .prepare(
      `SELECT cm.comment_text, cm.timestamp, u.name AS author
       FROM comments cm JOIN users u ON u.user_id=cm.user_id
       WHERE cm.bug_id=? ORDER BY cm.timestamp ASC`
    )
    .all(req.params.id);

  const developers = db.prepare("SELECT user_id, name FROM users ORDER BY name").all();

  res.render("bug-detail", { user, bug, comments, developers });
});

router.post("/bugs/:id/status", requirePageAuth, (req, res) => {
  const user = currentUser(req);
  const { status } = req.body;
  const bug = db.prepare("SELECT * FROM bugs WHERE bug_id=?").get(req.params.id);
  const newStatus = db.prepare("SELECT * FROM statuses WHERE name=?").get(status);
  const oldStatus = db.prepare("SELECT name FROM statuses WHERE status_id=?").get(bug.status_id);

  let resolvedAtClause = "";
  if (["Resolved", "Closed"].includes(newStatus.name) && !bug.resolved_at) {
    resolvedAtClause = ", resolved_at = datetime('now')";
  } else if (newStatus.name === "Reopened") {
    resolvedAtClause = ", resolved_at = NULL";
  }
  db.prepare(`UPDATE bugs SET status_id=?${resolvedAtClause} WHERE bug_id=?`).run(newStatus.status_id, bug.bug_id);
  db.prepare("INSERT INTO comments (bug_id, user_id, comment_text) VALUES (?, ?, ?)").run(
    bug.bug_id, user.user_id, `Status changed from ${oldStatus.name} to ${newStatus.name}`
  );
  res.redirect(`/bugs/${bug.bug_id}`);
});

router.post("/bugs/:id/assign", requirePageAuth, (req, res) => {
  const user = currentUser(req);
  const { assigned_to } = req.body;
  const bug = db.prepare("SELECT * FROM bugs WHERE bug_id=?").get(req.params.id);
  db.prepare("UPDATE bugs SET assigned_to=? WHERE bug_id=?").run(assigned_to || null, bug.bug_id);
  if (assigned_to) {
    const assignee = db.prepare("SELECT name FROM users WHERE user_id=?").get(assigned_to);
    db.prepare("INSERT INTO comments (bug_id, user_id, comment_text) VALUES (?, ?, ?)").run(
      bug.bug_id, user.user_id, `Assigned to ${assignee.name}`
    );
  }
  res.redirect(`/bugs/${bug.bug_id}`);
});

router.post("/bugs/:id/comment", requirePageAuth, (req, res) => {
  const user = currentUser(req);
  const { comment_text } = req.body;
  db.prepare("INSERT INTO comments (bug_id, user_id, comment_text) VALUES (?, ?, ?)").run(
    req.params.id, user.user_id, comment_text
  );
  res.redirect(`/bugs/${req.params.id}`);
});

// ---------- Reports ----------
router.get("/reports", requirePageAuth, (req, res) => {
  const user = currentUser(req);
  const byStatus = db
    .prepare("SELECT s.name AS status, COUNT(*) AS count FROM bugs b JOIN statuses s ON s.status_id=b.status_id GROUP BY s.name")
    .all();
  const byCategory = db
    .prepare("SELECT c.name AS category, COUNT(*) AS count FROM bugs b JOIN categories c ON c.category_id=b.category_id GROUP BY c.name")
    .all();
  const totalBugs = db.prepare("SELECT COUNT(*) n FROM bugs").get().n;
  const avg = db
    .prepare("SELECT AVG(julianday(resolved_at)-julianday(date_reported)) a FROM bugs WHERE resolved_at IS NOT NULL")
    .get().a;
  const reopenedCount = db.prepare("SELECT COUNT(*) n FROM comments WHERE comment_text LIKE '%to Reopened%'").get().n;

  res.render("reports", {
    user,
    byStatus,
    byCategory,
    totalBugs,
    avgResolutionDays: avg ? Number(avg.toFixed(1)) : null,
    reopenedRate: totalBugs ? Number(((reopenedCount / totalBugs) * 100).toFixed(1)) : 0,
  });
});

// ---------- Admin: users ----------
router.get("/users", requirePageAdmin, (req, res) => {
  const user = currentUser(req);
  const users = db.prepare("SELECT user_id, name, email, role FROM users ORDER BY name").all();
  res.render("users", { user, users });
});

router.post("/users", requirePageAdmin, (req, res) => {
  const { name, email, password, role } = req.body;
  const existing = db.prepare("SELECT user_id FROM users WHERE email=?").get(email);
  if (!existing) {
    db.prepare("INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)").run(
      name, email, bcrypt.hashSync(password, 10), role || "developer"
    );
  }
  res.redirect("/users");
});

router.post("/users/:id/role", requirePageAdmin, (req, res) => {
  db.prepare("UPDATE users SET role=? WHERE user_id=?").run(req.body.role, req.params.id);
  res.redirect("/users");
});

router.post("/users/:id/delete", requirePageAdmin, (req, res) => {
  if (Number(req.params.id) !== req.session.userId) {
    db.prepare("DELETE FROM users WHERE user_id=?").run(req.params.id);
  }
  res.redirect("/users");
});

module.exports = router;
