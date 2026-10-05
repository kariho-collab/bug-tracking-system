module.exports = function requireAuth(req, res, next) {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ error: "You must be logged in to perform this action" });
  }
  next();
};
