module.exports = function requirePageAdmin(req, res, next) {
  if (!req.session || !req.session.userId) {
    return res.redirect("/login");
  }
  if (req.session.role !== "administrator") {
    return res.status(403).send("This page requires administrator privileges.");
  }
  next();
};
