import express from "express";
import bodyParser from "body-parser";
import pg from "pg";
import bcrypt from "bcrypt";
import passport from "passport";
import { Strategy } from "passport-local";
import GoogleStrategy from "passport-google-oauth2";
import session from "express-session";
import env from "dotenv";
import { url } from "node:inspector";

env.config();

const app = express();
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));

app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie:{
        maxAge: 1000 * 60 * 60 * 24 // 1 day
    },
}));

app.use(passport.initialize());
app.use(passport.session());


const db = new pg.Client({
  user: process.env.PG_USER,
  host: process.env.PG_HOST,
  database: process.env.PG_DATABASE,
  password: process.env.PG_PASSWORD,
  port: process.env.PG_PORT,
});
db.connect();

const PORT = process.env.PORT || 3000;

app.get("/",(req,res)=>{
    if(req.isAuthenticated()){
        res.redirect("/notes");
    }
    else{
        res.redirect("home.ejs");
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

app.get("/notes",(req,res)=>{
    if(req.isAuthenticated()){
        try{
            const result = db.query("SELECT * FROM notes WHERE user_id = $1",[req.user.id]);
            res.render("notes.ejs", { notes: result.rows });
        }
        catch(err){
            console.log(err);
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

app.post("/notes", async(req,res)=>{
    if(req.isAuthenticated()){
        try{
            const title = req.body.title;
            const content = req.body.content;
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
            console.log(err);
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
            console.log(err);
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
            const content = req.body.content;
            const result = await db.query("UPDATE notes SET title = $1, note = $2 WHERE id = $3 AND user_id = $4 RETURNING *",[title, content, noteId, req.user.id]);
            res.redirect("/notes/" + noteId);
        }
        catch(err){
            console.log(err);
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
            console.log(err);
        }
    }
    else{
        res.redirect("/login");
    }
});

app.post("/register", async (req, res) => {
  const email = req.body.username;
  const password = req.body.password;

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
    console.log(err);
  }
});
app.get("/register",(req,res)=>{
    res.render("register.ejs");
});



passport.use("local",
    new Strategy(
        async function(username,password,cb){
            try{
                const result = db.query("SELECT * FROM users WHERE email = $1",[username]);
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
                console.log(err);
            }
        }
    )
);

passport.use("google",
    new GoogleStrategy(
        {
            clientID: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
            callbackURL: "",
            userProfileURL: "https://www.googleapis.com/oauth2/v3/userinfo",
        },
        async (accessToken, refreshToken, profile, cb)=>{
            try{
                const result = await db.query("SELECT * FROM users WHERE email = $1", [profile.email]);
                if(result.rows.length===0){
                    const user = await db.query("INSERT INTO users (email,password) VALUES ($1,$2) RETURNING *",[profile.email,"google"]);
                    return cb(null,user);
                }
                else{
                    return cb(null,result);
                }
            }
            catch(err){
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

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});