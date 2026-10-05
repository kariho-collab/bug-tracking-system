const express = require("express");
const db = require("../db/connection");
const requireAuth = require("../middleware/requireAuth");

const router = express.Router();

// POST /api/bugs - report a new bug, with duplicate detection
router.post("/", requireAuth, (req, res) => {
  const { title, description, category_id, priority } = req.body;

  if (!title || !description || !category_id || !priority) {
    return res
      .status(400)
      .json({ error: "title, description, category_id, and priority are required" });
  }

  // Duplicate-detection check: an open/in-progress/reopened bug in the same
  // category with a closely matching title is treated as the same defect,
  // per the lifecycle flowchart in Chapter Two, section 2.3.2.
  const possibleDuplicate = db
    .prepare(
      `SELECT b.bug_id, b.title, s.name AS status
       FROM bugs b
       JOIN statuses s ON s.status_id = b.status_id
       WHERE b.category_id = ?
         AND s.name IN ('Open', 'In Progress', 'Reopened')
         AND LOWER(b.title) = LOWER(?)`
    )
    .get(category_id, title.trim());

  if (possibleDuplicate) {
    return res.status(200).json({
      message: "A matching open bug already exists. Linked as duplicate instead of creating a new record.",
      duplicate_of: possibleDuplicate,
    });
  }

  const openStatus = db.prepare("SELECT status_id FROM statuses WHERE name = 'Open'").get();

  const result = db
    .prepare(
      `INSERT INTO bugs (title, description, priority, category_id, status_id, reported_by)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .run(title.trim(), description, priority, category_id, openStatus.status_id, req.session.userId);

  res.status(201).json({
    message: "Bug reported successfully",
    bug_id: result.lastInsertRowid,
  });
});

// GET /api/bugs - list bugs, with optional filters
router.get("/", requireAuth, (req, res) => {
  const { status, priority, category } = req.query;

  let sql = `
    SELECT b.bug_id, b.title, b.priority, b.date_reported,
           c.name AS category, s.name AS status,
           u1.name AS reported_by, u2.name AS assigned_to
    FROM bugs b
    JOIN categories c ON c.category_id = b.category_id
    JOIN statuses s ON s.status_id = b.status_id
    JOIN users u1 ON u1.user_id = b.reported_by
    LEFT JOIN users u2 ON u2.user_id = b.assigned_to
    WHERE 1 = 1
  `;
  const params = [];

  if (status) {
    sql += " AND s.name = ?";
    params.push(status);
  }
  if (priority) {
    sql += " AND b.priority = ?";
    params.push(priority);
  }
  if (category) {
    sql += " AND c.name = ?";
    params.push(category);
  }
  sql += " ORDER BY b.date_reported DESC";

  const bugs = db.prepare(sql).all(...params);
  res.json({ count: bugs.length, bugs });
});

// GET /api/bugs/:id - bug detail with comment history
router.get("/:id", requireAuth, (req, res) => {
  const bug = db
    .prepare(
      `SELECT b.*, c.name AS category, s.name AS status,
              u1.name AS reported_by_name, u2.name AS assigned_to_name
       FROM bugs b
       JOIN categories c ON c.category_id = b.category_id
       JOIN statuses s ON s.status_id = b.status_id
       JOIN users u1 ON u1.user_id = b.reported_by
       LEFT JOIN users u2 ON u2.user_id = b.assigned_to
       WHERE b.bug_id = ?`
    )
    .get(req.params.id);

  if (!bug) return res.status(404).json({ error: "Bug not found" });

  const comments = db
    .prepare(
      `SELECT cm.comment_text, cm.timestamp, u.name AS author
       FROM comments cm JOIN users u ON u.user_id = cm.user_id
       WHERE cm.bug_id = ? ORDER BY cm.timestamp ASC`
    )
    .all(req.params.id);

  res.json({ ...bug, comments });
});

// PATCH /api/bugs/:id/status - update status, logged as a comment automatically
router.patch("/:id/status", requireAuth, (req, res) => {
  const { status } = req.body;
  const bug = db.prepare("SELECT * FROM bugs WHERE bug_id = ?").get(req.params.id);
  if (!bug) return res.status(404).json({ error: "Bug not found" });

  const newStatus = db.prepare("SELECT * FROM statuses WHERE name = ?").get(status);
  if (!newStatus) return res.status(400).json({ error: "Unknown status" });

  const oldStatus = db.prepare("SELECT name FROM statuses WHERE status_id = ?").get(bug.status_id);

  // Track resolution timestamp for the average-resolution-time report: set it
  // when a bug becomes Resolved or Closed, clear it if the bug is reopened.
  let resolvedAtClause = "";
  if (["Resolved", "Closed"].includes(newStatus.name) && !bug.resolved_at) {
    resolvedAtClause = ", resolved_at = datetime('now')";
  } else if (newStatus.name === "Reopened") {
    resolvedAtClause = ", resolved_at = NULL";
  }

  db.prepare(`UPDATE bugs SET status_id = ?${resolvedAtClause} WHERE bug_id = ?`).run(
    newStatus.status_id,
    bug.bug_id
  );
  db.prepare(
    "INSERT INTO comments (bug_id, user_id, comment_text) VALUES (?, ?, ?)"
  ).run(bug.bug_id, req.session.userId, `Status changed from ${oldStatus.name} to ${newStatus.name}`);

  res.json({ message: `Bug #${bug.bug_id} status updated to ${newStatus.name}` });
});

// PATCH /api/bugs/:id/assign - assign a bug to a user
router.patch("/:id/assign", requireAuth, (req, res) => {
  const { assigned_to } = req.body;
  const bug = db.prepare("SELECT * FROM bugs WHERE bug_id = ?").get(req.params.id);
  if (!bug) return res.status(404).json({ error: "Bug not found" });

  const user = db.prepare("SELECT name FROM users WHERE user_id = ?").get(assigned_to);
  if (!user) return res.status(400).json({ error: "Unknown user" });

  db.prepare("UPDATE bugs SET assigned_to = ? WHERE bug_id = ?").run(assigned_to, bug.bug_id);
  db.prepare(
    "INSERT INTO comments (bug_id, user_id, comment_text) VALUES (?, ?, ?)"
  ).run(bug.bug_id, req.session.userId, `Assigned to ${user.name}`);

  res.json({ message: `Bug #${bug.bug_id} assigned to ${user.name}` });
});

// POST /api/bugs/:id/comments - add a comment to a bug
router.post("/:id/comments", requireAuth, (req, res) => {
  const { comment_text } = req.body;
  if (!comment_text) return res.status(400).json({ error: "comment_text is required" });

  const bug = db.prepare("SELECT bug_id FROM bugs WHERE bug_id = ?").get(req.params.id);
  if (!bug) return res.status(404).json({ error: "Bug not found" });

  db.prepare(
    "INSERT INTO comments (bug_id, user_id, comment_text) VALUES (?, ?, ?)"
  ).run(bug.bug_id, req.session.userId, comment_text);

  res.status(201).json({ message: "Comment added" });
});

module.exports = router;
