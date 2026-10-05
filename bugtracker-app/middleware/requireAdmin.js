module.exports = function requireAdmin(req, res, next) {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ error: "You must be logged in to perform this action" });
  }
  if (req.session.role !== "administrator") {
    return res.status(403).json({ error: "This action requires administrator privileges" });
  }
  next();
};
