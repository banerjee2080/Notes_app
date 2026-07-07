import bcrypt from "bcrypt";
import { generateToken } from "../lib/utils.js";
import User from "../models/user.model.js";
import cloudinary from "../lib/cloudinary.js";
import { Vibrant } from "node-vibrant/node";

export const signup = async (req, res) => {
  try {
    const { email, fullName, password } = req.body;
    if (!email || !fullName || !password) {
      return res.status(400).json({ message: "All fields are required" });
    }
    if (password.length < 6) {
      return res
        .status(400)
        .json({ message: "Password must atleast be 6 characters long" });
    }

    const user = await User.findOne({ email });
    if (user) return res.status(400).json({ message: "Email already exists" });

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = new User({
      fullName,
      email,
      password: hashedPassword,
    });

    if (newUser) {
      await newUser.save();
      generateToken(newUser._id, res);
      res.status(201).json({
        _id: newUser._id,
        fullName: newUser.fullName,
        email: newUser.email,
        profilePic: newUser.profilePic,
        backgroundImg: newUser.backgroundImg,
        main_colour: newUser.main_colour,
        accent_colour: newUser.accent_colour,
        accent_colour2: newUser.accent_colour2,
      });
    } else {
      res.status(400).json({ message: "Invalid User Details" });
    }
  } catch (error) {
    console.log("Error in signup: ", error);
    res.status(500).json({ message: error.message });
  }
};

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(400).json({ message: "Invalid Credentials" });
    }

    const isPasswordCorrect = await bcrypt.compare(password, user.password);
    if (!isPasswordCorrect)
      return res.status(400).json({ message: "Invalid Credentials" });

    generateToken(user._id, res);
    res.status(201).json({
      _id: user._id,
      fullName: user.fullName,
      email: user.email,
      profilePic: user.profilePic,
      backgroundImg: user.backgroundImg,
      main_colour: user.main_colour,
      accent_colour: user.accent_colour,
      accent_colour2: user.accent_colour2,
    });
  } catch (error) {
    console.log("Error in login: ", error);
    res.status(500).json({ message: error.message });
  }
};

export const logout = (req, res) => {
  try {
    res.cookie("jwt", "", {
      maxAge: 0,
      httpOnly: true,
      sameSite: "strict",
      secure: process.env.NODE_ENV !== "development",
    });
    res.status(200).json({ message: "Logout Successful" });
  } catch (error) {
    console.log("Error in the logout: ", error);
    res.status(500).json({ message: error.message });
  }
};

export const updateProfile = async (req, res) => {
  try {
    const { profilePic } = req.body;
    const userId = req.user._id;

    if (!profilePic)
      return res.status(400).json({ message: "Profile Picture is missing!" });

    const uploadedPic = await cloudinary.uploader.upload(profilePic);
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { profilePic: uploadedPic.secure_url },
      { returnDocument: "after" },
    );

    res.status(200).json(updatedUser);
  } catch (error) {
    console.log("Error in updatePath: ", error);
    res.status(500).json({ message: error.message });
  }
};

export const checkAuth = (req, res) => {
  try {
    res.status(200).json(req.user);
  } catch (error) {
    console.log("Error in checkAuth controller", error.message);
    res.status(500).json({ message: error.message });
  }
};

import { Resend } from "resend";

export const sendMail = async (req, res) => {
  try {
    const { receiverMail, subject, htmlContent } = req.body;

    if (!receiverMail || !subject || !htmlContent) {
      return res.status(400).json({ message: "All fields are required" });
    }

    const resend = new Resend(process.env.RESEND_API_KEY);
    const { data, error } = await resend.emails.send({
      from: "noreply@notejs.in",
      to: [receiverMail],
      subject: subject,
      html: htmlContent,
    });

    if (error) {
      console.error("Error sending email:", error);
      return res.status(400).json({ message: "Error sending email", error });
    }

    res.status(200).json({ message: "Email sent successfully", data });
  } catch (error) {
    console.log("Error in sendMail controller: ", error);
    res.status(500).json({ message: error.message });
  }
};

export const setBackgroundImg = async (req, res) => {
  try {
    const { backgroundImg } = req.body;
    const userId = req.user._id;
    if (!backgroundImg)
      return res.status(400).json({ message: "Background Image is required!" });
    const uploadedImg = await cloudinary.uploader.upload(backgroundImg);
    let main_colour = "";
    let accent_colour = "";
    let accent_colour2 = "";
    try {
      const palette = await Vibrant.from(uploadedImg.secure_url).getPalette();
      main_colour = palette.Vibrant ? palette.Vibrant.hex : "";
      accent_colour = palette.LightVibrant ? palette.LightVibrant.hex : "";
      accent_colour2 = palette.DarkVibrant ? palette.DarkVibrant.hex : "";
    } catch (err) {
      console.log("Error extracting colors with Vibrant: ", err.message);
    }
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      {
        backgroundImg: uploadedImg.secure_url,
        main_colour,
        accent_colour,
        accent_colour2,
      },
      { returnDocument: "after" },
    );
    res.status(200).json(updatedUser);
  } catch (error) {
    console.log("Error in setBackgroundImg controller", error.message);
    res.status(500).json({ message: error.message });
  }
};
