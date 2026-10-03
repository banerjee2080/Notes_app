import mongoose from "mongoose";

const vaultSchema = new mongoose.Schema(
  {
    salt: { type: String, required: true }, // PBKDF2 salt (base64)
    iterations: { type: Number, required: true },
    verifier: { type: String, required: true }, // HMAC(server secret, authKey)
    pepper: { type: String, required: true }, // sealed under the server secret
    publicKey: { type: String, required: true }, // ECDH P-256, raw, base64
    wrappedPrivateKey: {
      iv: { type: String, required: true },
      ct: { type: String, required: true },
    },
    failedAttempts: { type: Number, default: 0 },
    lockedUntil: { type: Date, default: null },
  },
  { _id: false },
);

const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
    },
    fullName: {
      type: String,
      required: true,
    },
    password: {
      type: String,
      required: false,
      minlength: 6,
    },
    googleId: {
      type: String,
      unique: true,
      sparse: true,
    },
    profilePic: {
      type: String,
      default: "",
    },
    backgroundImg: {
      type: String,
      default: "",
    },
    main_colour: {
      type: String,
      default: "",
    },
    accent_colour: {
      type: String,
      default: "",
    },
    accent_colour2: {
      type: String,
      default: "",
    },
    // PIN vault (see src/lib/vaultSecrets.js). select:false keeps it out of
    // req.user and /auth/check; the vault controller asks for it explicitly.
    vault: {
      type: vaultSchema,
      default: null,
      select: false,
    },
    // Sealed pepper handed out by /vault/setup/begin, waiting for /vault/setup.
    vault_pending_pepper: {
      type: String,
      default: null,
      select: false,
    },
  },
  { timestamps: true },
);

const User = mongoose.model("User", userSchema);
export default User;
