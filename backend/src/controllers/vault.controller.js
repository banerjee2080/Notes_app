import User from "../models/user.model.js";
import Note from "../models/note.model.js";
import {
  isB64,
  verifierFor,
  verifierMatches,
  newPepper,
  sealPepper,
  openPepper,
} from "../lib/vaultSecrets.js";
import {
  consumeVerificationToken,
  normalizeEmail,
} from "../lib/otpSecurity.js";

const MIN_ITERATIONS = 300_000; // the browser uses 600k; refuse anything weak
const MAX_ITERATIONS = 5_000_000;
const FREE_ATTEMPTS = 5; // wrong PINs before lockouts start

// After FREE_ATTEMPTS: 1, 2, 4, 8 ... minutes, capped at a day. A 6-digit
// PIN then takes years to guess online.
const lockoutMs = (failed) =>
  failed < FREE_ATTEMPTS
    ? 0
    : Math.min(2 ** (failed - FREE_ATTEMPTS), 24 * 60) * 60_000;

const loadVault = (userId) =>
  User.findById(userId).select("+vault +vault_pending_pepper email").lean();

// GET /api/vault → { status: "none" } | { status: "set", salt, iterations, publicKey, lockedUntil }
export const getVault = async (req, res) => {
  try {
    const user = await loadVault(req.user._id);
    const v = user?.vault;
    if (!v) return res.status(200).json({ status: "none" });
    res.status(200).json({
      status: "set",
      salt: v.salt,
      iterations: v.iterations,
      publicKey: v.publicKey,
      lockedUntil: v.lockedUntil && v.lockedUntil > new Date() ? v.lockedUntil : null,
    });
  } catch (error) {
    console.error("Get vault error:", error);
    res.status(500).json({ message: "Server Error" });
  }
};

// POST /api/vault/setup/begin → { pepper }
// Step 1 of setup. The pepper is needed to wrap the new private key, and is
// only ever handed out here (before a vault exists) or after a correct PIN.
export const beginSetup = async (req, res) => {
  try {
    const pepper = newPepper();
    const result = await User.updateOne(
      { _id: req.user._id, vault: null },
      { $set: { vault_pending_pepper: sealPepper(pepper) } },
    );
    if (result.matchedCount === 0) {
      return res.status(409).json({ message: "A PIN is already set" });
    }
    res.status(200).json({ pepper: pepper.toString("base64") });
  } catch (error) {
    console.error("Begin vault setup error:", error);
    res.status(500).json({ message: "Server Error" });
  }
};

// POST /api/vault/setup  body: { salt, iterations, authKey, publicKey, wrappedPrivateKey: { iv, ct } }
export const setupVault = async (req, res) => {
  const { salt, iterations, authKey, publicKey, wrappedPrivateKey } = req.body ?? {};
  try {
    if (
      !isB64(salt, 16, 64) ||
      !Number.isInteger(iterations) ||
      iterations < MIN_ITERATIONS ||
      iterations > MAX_ITERATIONS ||
      !isB64(authKey, 40, 64) ||
      !isB64(publicKey, 80, 100) ||
      !isB64(wrappedPrivateKey?.iv, 16, 16) ||
      !isB64(wrappedPrivateKey?.ct, 100, 400)
    ) {
      return res.status(400).json({ message: "Invalid vault data" });
    }
    const user = await loadVault(req.user._id);
    if (user?.vault) return res.status(409).json({ message: "A PIN is already set" });
    if (!user?.vault_pending_pepper) {
      return res.status(400).json({ message: "Start the PIN setup again" });
    }
    const result = await User.updateOne(
      { _id: req.user._id, vault: null, vault_pending_pepper: user.vault_pending_pepper },
      {
        $set: {
          vault: {
            salt,
            iterations,
            verifier: verifierFor(authKey),
            pepper: user.vault_pending_pepper,
            publicKey,
            wrappedPrivateKey: { iv: wrappedPrivateKey.iv, ct: wrappedPrivateKey.ct },
          },
        },
        $unset: { vault_pending_pepper: 1 },
      },
    );
    if (result.modifiedCount === 0) {
      return res.status(409).json({ message: "Start the PIN setup again" });
    }
    res.status(201).json({ ok: true });
  } catch (error) {
    console.error("Vault setup error:", error);
    res.status(500).json({ message: "Server Error" });
  }
};

// POST /api/vault/unlock  body: { authKey } → { pepper, wrappedPrivateKey, publicKey }
export const unlockVault = async (req, res) => {
  const { authKey } = req.body ?? {};
  try {
    if (!isB64(authKey, 40, 64)) {
      return res.status(400).json({ message: "Invalid request" });
    }
    const user = await loadVault(req.user._id);
    const v = user?.vault;
    if (!v) return res.status(404).json({ message: "No PIN set" });
    if (v.lockedUntil && v.lockedUntil > new Date()) {
      return res
        .status(429)
        .json({ message: "Too many wrong PINs", lockedUntil: v.lockedUntil });
    }

    if (verifierMatches(authKey, v.verifier)) {
      if (v.failedAttempts) {
        await User.updateOne(
          { _id: req.user._id },
          { $set: { "vault.failedAttempts": 0, "vault.lockedUntil": null } },
        );
      }
      return res.status(200).json({
        pepper: openPepper(v.pepper).toString("base64"),
        wrappedPrivateKey: v.wrappedPrivateKey,
        publicKey: v.publicKey,
      });
    }

    // $inc is atomic, so parallel guesses can't share one attempt.
    const after = await User.findOneAndUpdate(
      { _id: req.user._id },
      { $inc: { "vault.failedAttempts": 1 } },
      { new: true, projection: { "vault.failedAttempts": 1 } },
    ).lean();
    const failed = after?.vault?.failedAttempts ?? FREE_ATTEMPTS;
    const wait = lockoutMs(failed);
    const lockedUntil = wait ? new Date(Date.now() + wait) : null;
    if (lockedUntil) {
      await User.updateOne(
        { _id: req.user._id },
        { $set: { "vault.lockedUntil": lockedUntil } },
      );
    }
    res.status(401).json({
      message: "Wrong PIN",
      lockedUntil,
      attemptsBeforeLockout: Math.max(0, FREE_ATTEMPTS - failed),
    });
  } catch (error) {
    console.error("Vault unlock error:", error);
    res.status(500).json({ message: "Server Error" });
  }
};

// POST /api/vault/reset  body: { verificationToken } (OTP purpose "vault_reset")
// Forgot the PIN: deletes the vault. Note keys wrapped for the old key pair are
// dropped too; an owner/admin of a shared note re-shares the key the next time
// they open it. Notes only you could read are lost - that's the point of E2E.
export const resetVault = async (req, res) => {
  const { verificationToken } = req.body ?? {};
  try {
    const user = await loadVault(req.user._id);
    const check = await consumeVerificationToken(
      verificationToken,
      normalizeEmail(user?.email),
      "vault_reset",
    );
    if (!check.ok) {
      return res.status(400).json({ message: "Email verification failed" });
    }
    await User.updateOne(
      { _id: req.user._id },
      { $unset: { vault: 1, vault_pending_pepper: 1 } },
    );
    await Note.updateMany(
      { "enc_keys.user": req.user._id },
      { $pull: { enc_keys: { user: req.user._id } } },
    );
    res.status(200).json({ ok: true });
  } catch (error) {
    console.error("Vault reset error:", error);
    res.status(500).json({ message: "Server Error" });
  }
};
