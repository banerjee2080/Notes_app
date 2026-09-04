import { Resend } from "resend";
import dotenv from "dotenv";

dotenv.config();

const FROM = "noreply@notejs.in";
const APP_URL = process.env.APP_URL || "https://www.notejs.in/";

// Make user text safe to put inside HTML.
const escapeHtml = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

export const sendWelcomeEmail = async (toEmail, fullName) => {
  try {
    const safeName = escapeHtml(fullName);

    const html = `
      <div style="font-family: 'Inter', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); color: #f8fafc; padding: 40px; border-radius: 24px; border: 1px solid rgba(255, 255, 255, 0.1); box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #ffffff; margin: 0; font-size: 32px; font-weight: 700; letter-spacing: -0.5px;">Welcome to Our App!</h1>
          <p style="color: #94a3b8; font-size: 16px; margin-top: 12px;">We're thrilled to have you on board.</p>
        </div>
        <div style="background: rgba(255, 255, 255, 0.05); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 16px; padding: 30px; text-align: center; margin-bottom: 30px;">
          <p style="font-size: 20px; color: #e2e8f0; margin: 0;">Hi <strong style="color: #60a5fa; font-weight: 600;">${safeName}</strong>,</p>
          <p style="font-size: 16px; color: #cbd5e1; margin-top: 16px; line-height: 1.6;">Your account has been created successfully. You can now explore all the features and start your journey with us.</p>
        </div>
        <div style="text-align: center; margin-top: 30px;">
          <a href="${APP_URL}" style="background: linear-gradient(to right, #3b82f6, #4f46e5); color: #ffffff; padding: 14px 32px; border-radius: 50px; text-decoration: none; font-weight: 600; font-size: 16px; display: inline-block; box-shadow: 0 10px 15px -3px rgba(59, 130, 246, 0.3);">Get Started</a>
        </div>
      </div>`;

    const resend = new Resend(process.env.RESEND_API_KEY);
    const { error } = await resend.emails.send({
      from: FROM,
      to: [toEmail],
      subject: "Welcome to Our App!",
      html,
    });

    if (error) console.error("Welcome email failed:", error);
  } catch (err) {
    // Never let a mail failure break signup.
    console.error("sendWelcomeEmail crashed:", err.message);
  }
};
