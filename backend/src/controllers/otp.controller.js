import { Resend } from "resend";
import dotenv from "dotenv";
import { Redis } from "@upstash/redis";

dotenv.config();

const redis = Redis.fromEnv();

export const sendOtp = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }
    const generatedOtp = Math.floor(100000 + Math.random() * 900000).toString();
    const emailHtml = `
      <div style="font-family: 'Inter', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); color: #f8fafc; padding: 40px; border-radius: 24px; border: 1px solid rgba(255, 255, 255, 0.1); box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #ffffff; margin: 0; font-size: 32px; font-weight: 700; letter-spacing: -0.5px;">Verify Your Email</h1>
          <p style="color: #94a3b8; font-size: 16px; margin-top: 12px;">Use the OTP below to complete your sign-up process.</p>
        </div>
        <div style="background: rgba(255, 255, 255, 0.05); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 16px; padding: 40px; text-align: center; margin-bottom: 30px;">
          <span style="font-size: 48px; font-weight: 800; color: #60a5fa; letter-spacing: 12px; display: block; text-shadow: 0 0 20px rgba(96, 165, 250, 0.4);">${generatedOtp}</span>
        </div>
        <p style="color: #64748b; font-size: 14px; text-align: center; margin: 0;">If you didn't request this code, you can safely ignore this email.</p>
      </div>`;
    const resend = new Resend(process.env.RESEND_API_KEY);
    const { data, error } = await resend.emails.send({
      from: "noreply@notejs.in",
      to: [email],
      subject: "Your OTP Code",
      html: emailHtml,
    });
    if (error) {
      console.error("Error sending email:", error);
      return res.status(400).json({ message: "Error sending email", error });
    }

    // Store the OTP in Upstash Redis with a TTL of 5 minutes (300 seconds)
    await redis.set(`otp:${email}`, generatedOtp, { ex: 300 });

    res.status(200).json({ message: "Email sent successfully", data });
  } catch (error) {
    console.error("Error in sendOtp controller: ", error);
    res.status(500).json({ message: error.message });
  }
};

export const verifyOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({ message: "Email and OTP are required" });
    }

    // Retrieve OTP from Redis
    const storedOtp = await redis.get(`otp:${email}`);

    if (!storedOtp) {
      return res.status(400).json({ message: "OTP expired or not found" });
    }

    // Ensure OTP matches (storedOtp might be numeric or string, so we convert both to string)
    if (storedOtp.toString() !== otp.toString()) {
      return res.status(400).json({ message: "Invalid OTP" });
    }

    // Delete OTP after successful verification so it cannot be reused
    await redis.del(`otp:${email}`);

    res.status(200).json({ message: "OTP verified successfully" });
  } catch (error) {
    console.error("Error in verifyOtp controller: ", error);
    res.status(500).json({ message: error.message });
  }
};
