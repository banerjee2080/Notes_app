import { useState } from "react";
import { useAuthStore } from "../stores/useAuthStore.js";
import { Camera, Mail, User, Loader2, Calendar, ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router";

const ProfilePage = () => {
  const { authUser, updateProfile, isUpdatingProfile } = useAuthStore();
  const [selectedImage, setSelectedImage] = useState(null);
  const navigate = useNavigate();

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.readAsDataURL(file);

    reader.onload = async () => {
      const base64Img = reader.result;
      setSelectedImage(base64Img);
      await updateProfile({ profilePic: base64Img });
    };
  };

  return (
    <div className="flex-1 overflow-y-auto pt-20 pb-10 flex items-center justify-center p-4">
      {/* Glassmorphic Container */}
      <div className="w-full max-w-2xl bg-white/5 backdrop-blur-xl border border-white/10 p-8 sm:p-10 rounded-3xl relative overflow-hidden shadow-2xl shadow-black/50">
        {/* Subtle background glow effect */}
        <div className="absolute -top-20 -right-20 w-72 h-72 bg-blue-500/20 rounded-full blur-3xl opacity-50 pointer-events-none"></div>
        <div className="absolute -bottom-20 -left-20 w-72 h-72 bg-indigo-500/20 rounded-full blur-3xl opacity-50 pointer-events-none"></div>

        <div className="relative z-10">
          <button
            onClick={() => navigate("/")}
            className="mb-4 flex items-center gap-2 text-white/60 hover:text-white transition-colors py-2 px-3 rounded-lg hover:bg-white/10"
          >
            <ArrowLeft className="size-4" />
            Back to Home
          </button>

          <div className="text-center mb-10">
            <h1 className="text-3xl font-semibold tracking-tight text-white mb-2">
              Profile
            </h1>
            <p className="text-white/60 text-sm">
              Manage your personal information
            </p>
          </div>

          {/* Avatar Upload Section */}
          <div className="flex flex-col items-center mb-10">
            <div className="relative group">
              <div className="w-32 h-32 rounded-full overflow-hidden border-4 border-white/10 shadow-xl shadow-black/20 relative z-10 transition-transform duration-300 group-hover:scale-[1.02]">
                <img
                  src={authUser.profilePic || selectedImage || "/avatar.png"}
                  alt="Profile picture"
                  className="w-full h-full object-cover"
                />

                {/* Upload Overlay */}
                <label
                  htmlFor="avatar-upload"
                  className={`absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 cursor-pointer backdrop-blur-sm ${isUpdatingProfile ? "pointer-events-none" : ""}`}
                >
                  {isUpdatingProfile ? (
                    <Loader2 className="size-8 text-white animate-spin" />
                  ) : (
                    <Camera className="size-8 text-white" />
                  )}
                </label>
              </div>

              <input
                type="file"
                id="avatar-upload"
                className="hidden"
                accept="image/*"
                onChange={handleImageUpload}
                disabled={isUpdatingProfile}
              />
            </div>
            <p className="mt-4 text-sm text-white/60 font-medium">
              {isUpdatingProfile ? "Uploading..." : "Click image to update"}
            </p>
          </div>

          {/* Profile Details section */}
          <div className="space-y-4">
            <h2 className="text-lg font-semibold mb-4 text-white/80">
              Account Details
            </h2>

            <div className="bg-white/5 backdrop-blur-md rounded-3xl p-4 border border-white/10 flex items-center gap-4 transition-all duration-300 hover:bg-white/10">
              <div className="w-10 h-10 rounded-2xl bg-blue-500/20 flex items-center justify-center text-blue-400">
                <User className="size-5" />
              </div>
              <div className="flex-1">
                <p className="text-xs text-white/50 uppercase font-semibold tracking-wider">
                  Full Name
                </p>
                <p className="text-sm font-medium mt-0.5 text-white">
                  {authUser.fullName}
                </p>
              </div>
            </div>

            <div className="bg-white/5 backdrop-blur-md rounded-3xl p-4 border border-white/10 flex items-center gap-4 transition-all duration-300 hover:bg-white/10">
              <div className="w-10 h-10 rounded-2xl bg-purple-500/20 flex items-center justify-center text-purple-400">
                <Mail className="size-5" />
              </div>
              <div className="flex-1">
                <p className="text-xs text-white/50 uppercase font-semibold tracking-wider">
                  Email
                </p>
                <p className="text-sm font-medium mt-0.5 text-white">{authUser.email}</p>
              </div>
            </div>

            <div className="bg-white/5 backdrop-blur-md rounded-3xl p-4 border border-white/10 flex items-center gap-4 transition-all duration-300 hover:bg-white/10">
              <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 flex items-center justify-center text-emerald-400">
                <Calendar className="size-5" />
              </div>
              <div className="flex-1">
                <p className="text-xs text-white/50 uppercase font-semibold tracking-wider">
                  Member Since
                </p>
                <p className="text-sm font-medium mt-0.5 text-white">
                  {authUser.createdAt?.split("T")[0] || "Unknown"}
                </p>
              </div>
              <div className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-semibold shadow-sm shadow-black/10">
                Active
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfilePage;
