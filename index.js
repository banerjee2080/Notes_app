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

//env.config();

const app = express();
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));

/*app.use(session({
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
db.connect();*/

const PORT = process.env.PORT || 3000;

app.get("/",(req,res)=>{
    res.render("home.ejs");
});

app.get("/login",(req,res)=>{
    res.render("login.ejs");
});

app.get("/register",(req,res)=>{
    res.render("register.ejs");
});



/*passport.use("local",
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
});*/

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});