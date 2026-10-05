const express = require("express");
const db = require("../db/connection");
const requireAuth = require("../middleware/requireAuth");

const router = express.Router();

// GET /api/reports/summary - aggregate stats for the reports page
router.get("/summary", requireAuth, (req, res) => {
  const byStatus = db
    .prepare(
      `SELECT s.name AS status, COUNT(*) AS count
       FROM bugs b JOIN statuses s ON s.status_id = b.status_id
       GROUP BY s.name`
    )
    .all();

  const byCategory = db
    .prepare(
      `SELECT c.name AS category, COUNT(*) AS count
       FROM bugs b JOIN categories c ON c.category_id = b.category_id
       GROUP BY c.name`
    )
    .all();

  const total = db.prepare("SELECT COUNT(*) AS n FROM bugs").get().n;

  const avgResolutionDays = db
    .prepare(
      `SELECT AVG(julianday(resolved_at) - julianday(date_reported)) AS avg_days
       FROM bugs WHERE resolved_at IS NOT NULL`
    )
    .get().avg_days;

  const reopenedCount = db
    .prepare(
      `SELECT COUNT(*) AS n FROM comments WHERE comment_text LIKE '%to Reopened%'`
    )
    .get().n;

  res.json({
    total_bugs: total,
    by_status: byStatus,
    by_category: byCategory,
    avg_resolution_days: avgResolutionDays ? Number(avgResolutionDays.toFixed(1)) : null,
    reopened_rate: total ? Number(((reopenedCount / total) * 100).toFixed(1)) : 0,
  });
});

module.exports = router;
