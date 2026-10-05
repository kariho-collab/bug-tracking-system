const path = require("path");
const fs = require("fs");
const Database = require("better-sqlite3");
const bcrypt = require("bcryptjs");

const dbPath = path.join(__dirname, "bugtracker.db");
if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);

const db = new Database(dbPath);
db.exec(fs.readFileSync(path.join(__dirname, "schema.sql"), "utf8"));

const categories = ["Auth", "UI", "Data", "Reports", "Performance"];
const statuses = ["Open", "In Progress", "Resolved", "Closed", "Reopened"];

const insertCategory = db.prepare("INSERT INTO categories (name) VALUES (?)");
categories.forEach((c) => insertCategory.run(c));

const insertStatus = db.prepare("INSERT INTO statuses (name) VALUES (?)");
statuses.forEach((s) => insertStatus.run(s));

const insertUser = db.prepare(
  "INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)"
);
const pw = (p) => bcrypt.hashSync(p, 10);
const adminId = insertUser.run("Alex Wambugu", "alex@axiomlabs.dev", pw("Passw0rd!"), "administrator").lastInsertRowid;
const devId = insertUser.run("J. Otieno", "j.otieno@example.com", pw("DevPass1!"), "developer").lastInsertRowid;
const testerId = insertUser.run("M. Njeri", "m.njeri@example.com", pw("TestPass1!"), "developer").lastInsertRowid;

const catId = {};
categories.forEach((c, i) => (catId[c] = i + 1));
const statusId = {};
statuses.forEach((s, i) => (statusId[s] = i + 1));

const insertBug = db.prepare(`
  INSERT INTO bugs (title, description, date_reported, resolved_at, priority, category_id, status_id, reported_by, assigned_to)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
`);
const insertComment = db.prepare(`
  INSERT INTO comments (bug_id, user_id, comment_text, timestamp) VALUES (?, ?, ?, ?)
`);

function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 19).replace("T", " ");
}

const bugs = [
  {
    title: "App freezes during login",
    description: "App becomes unresponsive when a user retries login after an invalid password attempt.",
    reported: 12, resolved: null, priority: "Critical", category: "Auth",
    status: "In Progress", reportedBy: adminId, assignedTo: devId,
    comments: [
      { by: devId, text: "Reproduced on Android 13 emulator, investigating retry handler.", days: 11 },
      { by: adminId, text: "Status changed from Open to In Progress", days: 11 },
    ],
  },
  {
    title: "Report freezes app",
    description: "Submitting the bug report form with a long description causes the UI thread to hang.",
    reported: 10, resolved: 6, priority: "Critical", category: "UI",
    status: "Closed", reportedBy: adminId, assignedTo: devId,
    comments: [
      { by: devId, text: "Status changed from Open to In Progress", days: 9 },
      { by: devId, text: "Fixed by moving validation off the main thread.", days: 7 },
      { by: adminId, text: "Status changed from In Progress to Resolved", days: 6 },
      { by: adminId, text: "Verified fix on three devices. Status changed from Resolved to Closed", days: 6 },
    ],
  },
  {
    title: "Wrong totals shown",
    description: "Dashboard summary card shows a stale count of open bugs after a status change.",
    reported: 8, resolved: 5, priority: "Medium", category: "Data",
    status: "Resolved", reportedBy: testerId, assignedTo: devId,
    comments: [
      { by: devId, text: "Status changed from Open to In Progress", days: 7 },
      { by: devId, text: "Status changed from In Progress to Resolved", days: 5 },
    ],
  },
  {
    title: "Export button missing",
    description: "The export-to-CSV button is not visible on the reports page on smaller screens.",
    reported: 6, resolved: null, priority: "Low", category: "Reports",
    status: "Open", reportedBy: testerId, assignedTo: null,
    comments: [],
  },
  {
    title: "Slow report generation",
    description: "The reports page takes over ten seconds to load once there are more than 100 bugs logged.",
    reported: 15, resolved: 4, priority: "Medium", category: "Performance",
    status: "Reopened", reportedBy: adminId, assignedTo: devId,
    comments: [
      { by: devId, text: "Status changed from Open to In Progress", days: 14 },
      { by: devId, text: "Status changed from In Progress to Resolved", days: 10 },
      { by: adminId, text: "Status changed from Resolved to Closed", days: 9 },
      { by: testerId, text: "Still slow on the September data set. Status changed from Closed to Reopened", days: 4 },
    ],
  },
  {
    title: "Minor spacing issue on settings panel",
    description: "Low-priority cosmetic issue retained to demonstrate the Open/Low tracker state.",
    reported: 3, resolved: null, priority: "Low", category: "UI",
    status: "Open", reportedBy: testerId, assignedTo: null,
    comments: [],
  },
];

for (const b of bugs) {
  const result = insertBug.run(
    b.title,
    b.description,
    daysAgo(b.reported),
    b.resolved !== null ? daysAgo(b.resolved) : null,
    b.priority,
    catId[b.category],
    statusId[b.status],
    b.reportedBy,
    b.assignedTo
  );
  for (const c of b.comments) {
    insertComment.run(result.lastInsertRowid, c.by, c.text, daysAgo(c.days));
  }
}

console.log("Database initialized at", dbPath);
console.log("Seeded categories:", categories.join(", "));
console.log("Seeded statuses:", statuses.join(", "));
console.log("Seeded users: alex@axiomlabs.dev (administrator), j.otieno@example.com (developer), m.njeri@example.com (developer)");
console.log(`Seeded ${bugs.length} sample bugs with comment history`);

db.close();
