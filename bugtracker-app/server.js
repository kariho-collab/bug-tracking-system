const express = require("express");
const session = require("express-session");

const authRoutes = require("./routes/auth");
const bugRoutes = require("./routes/bugs");
const reportRoutes = require("./routes/reports");
const userRoutes = require("./routes/users");
const pageRoutes = require("./routes/pages");

const app = express();
app.set("view engine", "ejs");
app.set("views", __dirname + "/views");
app.use(express.static(__dirname + "/public"));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(
  session({
    secret: "bug-tracker-dev-secret",
    resave: false,
    saveUninitialized: false,
  })
);

app.use("/api", authRoutes);
app.use("/api/bugs", bugRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/users", userRoutes);

app.use("/", pageRoutes);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Bug tracker server listening on port ${PORT}`));
