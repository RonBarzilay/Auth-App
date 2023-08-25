// brew services start mongodb-community
// mongosh
// show dbs
// use usersDB
// db.users.find({})
// brew services stop mongodb-community

// When creating a project require("dotenv").config() + create .env
require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const ejs = require("ejs");
const mongoose = require("mongoose");

// simple encrypt, mid-level md5, complex-level bcrypt
// let encrypt = require("mongoose-encryption");
// const md5 = require("md5"); // hash encryption
// const bcrypt = require("bcrypt");
// const saltRounds = 12;

// passport & session & passporrtLocalMongoose
const session = require("express-session");
const passport = require("passport");
const passporrtLocalMongoose = require("passport-local-mongoose");

// Google oauth20
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const findOrCreate = require("mongoose-findorcreate");

const app = express();
app.listen(3000);

app.use(express.static("public"));
app.set("view engine", "ejs");
app.use(
  bodyParser.urlencoded({
    extended: true,
  })
);

app.use(
  session({
    secret: "se",
    resave: false,
    saveUninitialized: false,
  })
);

app.use(passport.initialize());

app.use(passport.session());

mongoose.connect("mongodb://localhost:27017/userDB", { useNewUrlParser: true });

const userSchema = new mongoose.Schema({
  username: { type: String, required: true },
  password: { type: String },
  googleId: String,
  userPost: String,
});

userSchema.plugin(passporrtLocalMongoose);
userSchema.plugin(findOrCreate);

encKey = process.env.ENC_KEY;

// userSchema.plugin(encrypt, { secret: encKey, encryptedFields: ["password"] });
// This adds _ct and _ac fields to the schema, as well as pre 'init' and pre 'save' middleware,
// and encrypt, decrypt, sign, and authenticate instance methods

const User = new mongoose.model("User", userSchema);

passport.use(User.createStrategy());

// serializeUser & deserializeUser with passport-local-mongoose
// passport.serializeUser(User.serializeUser());
// passport.deserializeUser(User.deserializeUser());

// serializeUser & deserializeUser with any type of
passport.serializeUser(function (user, done) {
  done(null, user);
});

passport.deserializeUser(function (user, done) {
  done(null, user);
});

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.CLIENT_ID,
      clientSecret: process.env.CLIENT_SECRET,
      callbackURL: "http://localhost:3000/auth/google/post",
      userProfileURL: "https://www.googleapis.com/oauth2/v3/userinfo",
    },
    function (accessToken, refreshToken, profile, cb) {
      console.log(profile);

      User.findOrCreate({ googleId: profile.id }, function (err, user) {
        return cb(err, user);
      });
    }
  )
);

app.get("/", function (req, res) {
  res.render("home");
});

app.get("/auth/google", function (req, res) {
  // use passport to authenticate our users using the "google" strategy
  // and not "local" startegy
  // { scope: ["profile"] } = email, userId
  passport.authenticate("google", { scope: ["profile"] });
});

app.get(
  "auth/google/post",
  // if authenticate fails: failureRedirect: "/login"
  passport.authenticate("google", { failureRedirect: "/login" }),
  function (req, res) {
    // else res.redirect("/post");
    res.redirect("/post");
  }
);

app.get("/login", function (req, res) {
  res.render("login");
});

app.get("/register", function (req, res) {
  res.render("register");
});

app.get("/post", function (req, res) {
  User.find({ userPost: { $ne: null } }).then(function (foundUsers) {
    res.render("post", { usersWithPosts: foundUsers });
  });
});

// <form action="/register" method="POST">
app.post("/register", function (req, res) {
  // bcrypt.hash(req.body.password, saltRounds, function (err, hash) {
  //   const newUser = new User({
  //     email: req.body.username,
  //     // Convert to hash and save in DB as Hash
  //     password: hash,
  //   });
  //   newUser
  //     .save()
  //     .then((savedUser) => {
  //       console.log("User saved successfully:", savedUser);
  //       res.render("post");
  //     })
  //     .catch((error) => {
  //       console.error("Error saving user:", error);
  //     });
  // });
  console.log(req.body.username, ", ", req.body.password);

  User.register(
    { username: req.body.username },
    req.body.password,
    function (err, user) {
      if (err) {
        console.log(err);
        res.redirect("/register");
      } else {
        // Local is for simple username, password local register/authenticate
        passport.authenticate("local")(req, res, function () {
          res.redirect("/post");
        });
      }
    }
  );
});

// <form action="/login" method="POST">
app.post("/login", function (req, res) {
  // const username = req.body.username;
  // // From HTML
  // const password = req.body.password;
  // // 1. Check if user exist 2. Check if password is correct
  // User.findOne({ email: username })
  //   .then((foundUser) => {
  //     if (foundUser) {
  //       console.log("User found: ", foundUser);
  //       // 2. Check if password is correct hash=hash
  //       bcrypt.compare(password, foundUser.password, function (err, result) {
  //         if (result == true) {
  //           res.render("post");
  //           console.log("Correct password: ", password);
  //         } else {
  //           console.log(
  //             "Incorrect Password: ",
  //             password,
  //             ", ",
  //             foundUser.password,
  //             result
  //           );
  //         }
  //       });
  //     } else {
  //       console.log("User not found: ", username);
  //     }
  //   })
  //   .catch((error) => {
  //     console.error("Error finding user: ", username, error);
  //   });

  const user = new User({
    username: req.body.username,
    password: req.body.password,
  });

  req.login(user, function (err) {
    if (err) {
      console.log(err);
    } else {
      // Local is for simple username, password local login
      passport.authenticate("local")(req, res, function () {
        res.redirect("/post");
      });
    }
  });
});

app.get("/logout", function (req, res) {
  req.logout(function (err) {});
  res.redirect("/");
});

app.get("/submit", function (req, res) {
  if (req.isAuthenticated()) {
    // if user pass Authentication, then
    res.render("submit");
  } else {
    // else, we redirect user to login
    res.redirect("/login");
  }
});

// <form action="/submit" method="POST">
app.post("/submit", function (req, res) {
  const submittedSecret = req.body.post;
  console.log("id: ", req.user._id);
  User.findById(req.user._id).then(function (foundUser) {
    if (foundUser) {
      foundUser.userPost = submittedSecret;
      foundUser.save().then(function () {
        res.redirect("/post");
      });
    }
  });
});
