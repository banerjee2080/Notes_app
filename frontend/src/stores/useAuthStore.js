import { create } from "zustand";
import axiosInstance from "../lib/axios.js";
import toast from "react-hot-toast";
import sendMail from "../lib/sendMail.js";

export const useAuthStore = create((set) => ({
  authUser: null,
  isSigningUp: false,
  isLoggingIn: false,
  isUpdatingProfile: false,
  isCheckingAuth: true,

  checkAuth: async () => {
    try {
      const res = await axiosInstance.get("/auth/check");
      set({ authUser: res.data });
    } catch (error) {
      if (error.response?.status !== 401) {
        console.log("Error in checkAuth: ", error);
      }
      set({ authUser: null });
    } finally {
      set({ isCheckingAuth: false });
    }
  },

  logout: async () => {
    try {
      await axiosInstance.get("/auth/logout");
      set({ authUser: null });
      toast.success("Logout Successful");
    } catch (error) {
      console.log("Error in logout: ", error);
      toast.error(error.response?.data?.message || error.message);
    }
  },

  login: async (formData) => {
    set({ isLoggingIn: true });
    try {
      const res = await axiosInstance.post("/auth/login", formData);
      set({ authUser: res.data });
      toast.success("Logged in Successfully");
    } catch (error) {
      console.log("Error in login: ", error);
      toast.error(error.response?.data?.message || error.message);
    } finally {
      set({ isLoggingIn: false });
    }
  },

  signup: async (formData) => {
    set({ isSigningUp: true });
    try {
      const res = await axiosInstance.post("/auth/signup", formData);
      set({ authUser: res.data });
      toast.success("Signed up successfully.");

      const welcomeHtml = `
      <div style="font-family: 'Inter', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); color: #f8fafc; padding: 40px; border-radius: 24px; border: 1px solid rgba(255, 255, 255, 0.1); box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #ffffff; margin: 0; font-size: 32px; font-weight: 700; letter-spacing: -0.5px;">Welcome to Our App!</h1>
          <p style="color: #94a3b8; font-size: 16px; margin-top: 12px;">We're thrilled to have you on board.</p>
        </div>
        <div style="background: rgba(255, 255, 255, 0.05); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 16px; padding: 30px; text-align: center; margin-bottom: 30px;">
          <p style="font-size: 20px; color: #e2e8f0; margin: 0;">Hi <strong style="color: #60a5fa; font-weight: 600;">${formData.fullName}</strong>,</p>
          <p style="font-size: 16px; color: #cbd5e1; margin-top: 16px; line-height: 1.6;">Your account has been created successfully. You can now explore all the features and start your journey with us.</p>
        </div>
        <div style="text-align: center; margin-top: 30px;">
          <a href="#" style="background: linear-gradient(to right, #3b82f6, #4f46e5); color: #ffffff; padding: 14px 32px; border-radius: 50px; text-decoration: none; font-weight: 600; font-size: 16px; display: inline-block; box-shadow: 0 10px 15px -3px rgba(59, 130, 246, 0.3);">Get Started</a>
        </div>
        <p style="color: #64748b; font-size: 14px; text-align: center; margin-top: 30px; margin-bottom: 0;">If you have any questions, feel free to reply to this email.</p>
      </div>`;

      sendMail(formData.email, "Welcome to Our App!", welcomeHtml);
    } catch (error) {
      console.log("Error in signup: ", error);
      toast.error(error.response?.data?.message || error.message);
    } finally {
      set({ isSigningUp: false });
    }
  },

  updateProfile: async (data) => {
    set({ isUpdatingProfile: true });
    try {
      const res = await axiosInstance.put("/auth/updateProfile", data);
      set({ authUser: res.data });
      toast.success("Profile Updated Successfully");
    } catch (error) {
      toast.error(error.response?.data?.message || error.message);
    } finally {
      set({ isUpdatingProfile: false });
    }
  },
}));
