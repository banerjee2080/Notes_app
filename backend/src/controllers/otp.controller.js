// backend/src/controllers/otp.controller.js
import { Resend } from "resend";
import dotenv from "dotenv";
import {
  ALLOWED_PURPOSES,
  normalizeEmail,
  generateOtp,
  storeOtp,
  checkOtp,
  consumeSendQuota,
  consumeIpQuota,
  issueVerificationToken,
} from "../lib/otpSecurity.js";

dotenv.config();

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const sendOtp = async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email);
    const purpose = req.body.purpose || "signup";

    if (!email || !EMAIL_REGEX.test(email)) {
      return res.status(400).json({ message: "A valid email is required" });
    }
    if (!ALLOWED_PURPOSES.includes(purpose)) {
      return res.status(400).json({ message: "Invalid request" });
    }

    const ip = req.ip || "unknown";
    const ipQuota = await consumeIpQuota(ip);
    if (!ipQuota.allowed) {
      return res.status(429).json({
        message:
          "Too many verification emails requested. Please try again later.",
        retryAfterSeconds: ipQuota.retryAfterSeconds,
      });
    }

    const emailQuota = await consumeSendQuota(email, purpose);
    if (!emailQuota.allowed) {
      return res.status(429).json({
        message: `Too many codes requested for this address. Try again in ${Math.ceil(
          emailQuota.retryAfterSeconds / 60,
        )} minute(s).`,
        retryAfterSeconds: emailQuota.retryAfterSeconds,
      });
    }

    const generatedOtp = generateOtp();

    const emailHtml = `
      <div style="font-family: 'Inter', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); color: #f8fafc; padding: 40px; border-radius: 24px; border: 1px solid rgba(255, 255, 255, 0.1); box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #ffffff; margin: 0; font-size: 32px; font-weight: 700; letter-spacing: -0.5px;">Verify Your Email</h1>
          <p style="color: #94a3b8; font-size: 16px; margin-top: 12px;">Use the OTP below to complete your sign-up process.</p>
        </div>
        <div style="background: rgba(255, 255, 255, 0.05); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 16px; padding: 40px; text-align: center; margin-bottom: 30px;">
          <span style="font-size: 48px; font-weight: 800; color: #60a5fa; letter-spacing: 12px; display: block; text-shadow: 0 0 20px rgba(96, 165, 250, 0.4);">${generatedOtp}</span>
        </div>
        <p style="color: #64748b; font-size: 14px; text-align: center; margin: 0;">This code expires in 5 minutes. If you didn't request it, you can safely ignore this email.</p>
      </div>`;

    await storeOtp(email, purpose, generatedOtp);

    const resend = new Resend(process.env.RESEND_API_KEY);
    const { error } = await resend.emails.send({
      from: "noreply@notejs.in",
      to: [email],
      subject: "Your OTP Code",
      html: emailHtml,
    });

    if (error) {
      console.error("Error sending email:", error);
      return res
        .status(400)
        .json({ message: "Could not send the verification email" });
    }

    return res.status(200).json({ message: "Verification code sent" });
  } catch (error) {
    console.error("Error in sendOtp controller: ", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

export const verifyOtp = async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email);
    const purpose = req.body.purpose || "signup";
    const otp = typeof req.body.otp === "string" ? req.body.otp.trim() : "";

    if (!email || !otp) {
      return res.status(400).json({ message: "Email and OTP are required" });
    }
    if (!ALLOWED_PURPOSES.includes(purpose)) {
      return res.status(400).json({ message: "Invalid request" });
    }
    if (!/^\d{6}$/.test(otp)) {
      return res.status(400).json({ message: "Invalid OTP" });
    }

    const result = await checkOtp(email, purpose, otp);

    if (!result.ok) {
      if (result.reason === "too_many_attempts") {
        return res.status(429).json({
          message: "Too many incorrect attempts. Please request a new code.",
        });
      }
      if (result.reason === "expired") {
        return res.status(400).json({ message: "OTP expired or not found" });
      }
      return res.status(400).json({
        message: "Invalid OTP",
        attemptsLeft: result.attemptsLeft,
      });
    }

    const verificationToken = issueVerificationToken(email, purpose);

    return res.status(200).json({
      message: "OTP verified successfully",
      verificationToken,
      expiresIn: 600,
    });
  } catch (error) {
    console.error("Error in verifyOtp controller: ", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};
