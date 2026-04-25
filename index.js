import express from "express";
import bodyParser from "body-parser";
import pg from "pg";
import bcrypt from "bcrypt";
import passport from "passport";
import { Strategy } from "passport-local";
import GoogleStrategy from "passport-google-oauth2";
import session from "express-session";
import env from "dotenv";
import connectPgSimple from "connect-pg-simple";

import path from "path";
import { fileURLToPath } from "url";

env.config();

const app = express();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
// -----------------------------------------------------------

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));

const { Pool } = pg;

const db = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

const pgSession = connectPgSimple(session);

app.use(session({
    store: new pgSession({
      pool: db,
      tableName: 'session'
    }),
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie:{
        maxAge: 1000 * 60 * 60 * 24 // 1 day
    },
}));

const saltRounds = 10;

app.use(passport.initialize());
app.use(passport.session());

app.get("/",(req,res)=>{
    if(req.isAuthenticated()){
        res.redirect("/notes");
    }
    else{
        res.render("home.ejs");
    }
});

app.get("/login",(req,res)=>{
    res.render("login.ejs");
});

app.get(
  "/auth/google",
  passport.authenticate("google", {
    scope: ["profile", "email"],
  })
);

app.post(
  "/login",
  passport.authenticate("local", {
    successRedirect: "/notes",
    failureRedirect: "/login",
  })
);

app.get("/notes",async(req,res)=>{
    if(req.isAuthenticated()){
        try{
            const result = await db.query("SELECT * FROM notes WHERE user_id = $1",[req.user.id]);
            res.render("notes.ejs", { notes: result.rows, user: req.user });
        }
        catch(err){
            console.error("Error fetching notes:", err);
            res.status(500).render("error.ejs", { status: 500, message: "We encountered a problem fetching your notes. Please try again." });
        }
    }
    else{
        res.redirect("/login");
    }
});

app.get("/notes/new", (req,res)=>{
    if(req.isAuthenticated()){
        res.render("note.ejs", { note: null });
    }
    else{
        res.redirect("/login");
    }
});

app.get("/notes/search", async(req,res)=>{
    if(req.isAuthenticated()){
        const key = req.query.q;
        try{
            const result = await db.query("SELECT * FROM notes WHERE user_id = $1 AND (title ILIKE $2 OR note ILIKE $2)",[req.user.id, `%${key}%`]);
            res.render("notes.ejs", { notes: result.rows, user: req.user });
        }
        catch(err){
            console.error("Error searching notes:", err);
            res.status(500).render("error.ejs", { status: 500, message: "We encountered a problem searching your notes. Please try again." });
        }
    }
    else{
        res.redirect("/login");
    }
});

app.post("/notes", async(req,res)=>{
    if(req.isAuthenticated()){
        try{
            const title = req.body.title;
            const content = req.body.note;
            const result = await db.query("INSERT INTO notes (title, note, user_id) VALUES ($1, $2, $3) RETURNING *",[title,content,req.user.id]);
            
            const actionClicked = req.body.action;
            if(actionClicked === "save"){
                res.redirect("/notes/" + result.rows[0].id);
            }
            else{
                res.redirect("/notes");
            }
        }
        catch(err){
            console.error("Error saving note:", err);
            res.status(500).render("error.ejs", { status: 500, message: "We encountered a problem saving your new note. Please try again." });
        }
    }
    else{
        res.redirect("/login");
    }
});

app.get("/notes/:id", async(req,res)=>{
    if(req.isAuthenticated()){
        try{
            const noteId = req.params.id;
            const result = await db.query("SELECT * FROM notes WHERE id = $1 AND user_id = $2",[noteId, req.user.id]);
            if(result.rows.length > 0){
                res.render("note.ejs", { note: result.rows[0] });
            }
            else{
                res.redirect("/notes");
            }
        }
        catch(err){
            console.error("Error fetching specific note:", err);
            res.status(500).render("error.ejs", { status: 500, message: "We encountered a problem opening this note. It may have been deleted." });
        }
    }
    else{
        res.redirect("/login");
    }
});

app.post("/notes/:id", async(req,res)=>{
    if(req.isAuthenticated()){
        try{
            const noteId = req.params.id;
            const title = req.body.title;
            const content = req.body.note;
            const result = await db.query("UPDATE notes SET title = $1, note = $2 WHERE id = $3 AND user_id = $4 RETURNING *",[title, content, noteId, req.user.id]);
            
            const actionClicked = req.body.action;
            if(actionClicked === "save"){
                res.redirect("/notes/" + noteId);
            }
            else{
                res.redirect("/notes");
            }
        }
        catch(err){
            console.error("Error updating note:", err);
            res.status(500).render("error.ejs", { status: 500, message: "We encountered a problem updating your note. Please try again." });
        }
    }
    else{
        res.redirect("/login");
    }
});

app.get("/notes/:id/delete", async(req,res)=>{
    if(req.isAuthenticated()){
        try{
            const noteId = req.params.id;
            const result = await db.query("DELETE FROM notes WHERE id = $1 AND user_id = $2 RETURNING *",[noteId, req.user.id]);
            res.redirect("/notes");
        }
        catch(err){
            console.error("Error deleting note:", err);
            res.status(500).render("error.ejs", { status: 500, message: "We encountered a problem deleting your note. Please try again." });
        }
    }
    else{
        res.redirect("/login");
    }
});

app.post("/register", async (req, res) => {
  const email = req.body.username;
  const password = req.body.password;
  const confirmPassword = req.body.confirm_password;

  if (password !== confirmPassword) {
    const message = "Passwords do not match!";
    return res.render("register.ejs", { error: message });
  }

  try {
    const checkResult = await db.query("SELECT * FROM users WHERE email = $1", [
      email,
    ]);

    if (checkResult.rows.length > 0) {
      res.redirect("/login");
    } else {
      bcrypt.hash(password, saltRounds, async (err, hash) => {
        if (err) {
          console.error("Error hashing password:", err);
          res.status(500).render("error.ejs", { status: 500, message: "Internal server error during registration." });
        } else {
          const result = await db.query(
            "INSERT INTO users (email, password) VALUES ($1, $2) RETURNING *",
            [email, hash]
          );
          const user = result.rows[0];
          req.login(user, (err) => {
            console.log("success");
            res.redirect("/notes");
          });
        }
      });
    }
  } catch (err) {
    console.error("Error during registration:", err);
    res.status(500).render("error.ejs", { status: 500, message: "We encountered a database problem during registration. Please try again later." });
  }
});

app.get("/register",(req,res)=>{
    res.render("register.ejs");
});

app.get("/logout", (req, res, next) => {
  req.logout(function (err) {
    if (err) {
      return next(err);
    }
    res.redirect("/");
  });
});

app.get(
  "/auth/google/callback",
  passport.authenticate("google", {
    successRedirect: "/notes",
    failureRedirect: "/login",
  })
);

passport.use("local",
    new Strategy(
        async function(username,password,cb){
            try{
                const result = await db.query("SELECT * FROM users WHERE email = $1",[username]);
                if(result.rows.length>0){
                    const user = result.rows[0];
                    const storedPassword = user.password;

                    bcrypt.compare(password, storedPassword, (err,valid)=>{
                        if(err){
                            console.log("Error Running query.")
                            return cb(err);
                        }
                        else{
                            if(valid){
                                return cb(null,user);
                            }
                            else{
                                return cb(null,false);
                            }
                        }
                    })
                }
                else{
                    return cb("user not found!");
                }
            }
            catch(err){
                console.error("Local Strategy DB Error:", err);
                return cb(err);
            }
        }
    )
);

passport.use("google",
    new GoogleStrategy(
        {
            clientID: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
            callbackURL: process.env.GOOGLE_CALLBACK_URL || "http://localhost:3000/auth/google/callback",
            userProfileURL: "https://www.googleapis.com/oauth2/v3/userinfo",
        },
        async (accessToken, refreshToken, profile, cb) => {
            try {
                const result = await db.query("SELECT * FROM users WHERE email = $1", [profile.email]);
                
                if (result.rows.length === 0) {
                    const name = profile.displayName;
                    const picture = profile.picture;
                    
                    const newUser = await db.query(
                        "INSERT INTO users (email, name, picture) VALUES ($1, $2, $3) RETURNING *",
                        [profile.email, name, picture]
                    );
                    return cb(null, newUser.rows[0]);
                } else {
                    const result1 = await db.query("UPDATE users SET name = $1, picture = $2 WHERE email = $3 RETURNING *", [profile.displayName, profile.picture, profile.email]);
                    return cb(null, result1.rows[0]);
                }
            } 
            catch (err) {
                console.error("Google Strategy DB Error:", err);
                return cb(err);
            }
        }
    )
);

passport.serializeUser((user, cb) => {
  cb(null, user);
});

passport.deserializeUser((user, cb) => {
  cb(null, user);
});

const PORT = process.env.PORT || 3000;

if (process.env.NODE_ENV !== "production") {
  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
}

export default app;