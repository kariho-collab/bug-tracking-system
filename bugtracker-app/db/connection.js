const path = require("path");
const Database = require("better-sqlite3");

const db = new Database(path.join(__dirname, "bugtracker.db"));
db.pragma("foreign_keys = ON");

module.exports = db;
