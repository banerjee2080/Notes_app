/** The authenticated user as the server returns it from /auth/*. */
export interface AuthUser {
  _id: string;
  /** Some endpoints echo `id` instead of `_id`; call sites accept either. */
  id?: string;
  fullName: string;
  email: string;
  profilePic?: string;
  backgroundImg?: string;
  main_colour?: string;
  accent_colour?: string;
  accent_colour2?: string;
  createdAt?: string;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface SignupPayload {
  fullName: string;
  email: string;
  password: string;
  verificationToken: string;
}

/** Returns the id an endpoint gave us, whichever field it used. */
export const userIdOf = (user: AuthUser | null | undefined): string | undefined =>
  user?._id ?? user?.id;
