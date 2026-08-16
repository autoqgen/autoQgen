import { z } from "zod";

import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH, checkPasswordPolicy } from "@/lib/auth/password";

/**
 * Authentication payload schemas.
 *
 * Password rules live here AND in checkPasswordPolicy so client and server share
 * exactly one definition — the previous project validated a six-character
 * minimum in the browser and nothing at all on the server.
 */

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, "Email is required.")
  .max(254, "Email must be at most 254 characters.")
  .email("Enter a valid email address.");

export const passwordSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH, `Password must be at least ${PASSWORD_MIN_LENGTH} characters.`)
  .max(PASSWORD_MAX_LENGTH, `Password must be at most ${PASSWORD_MAX_LENGTH} characters.`)
  .superRefine((value, ctx) => {
    for (const issue of checkPasswordPolicy(value)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: issue.message });
    }
  });

export const nameSchema = z
  .string()
  .trim()
  .min(2, "Name must be at least 2 characters.")
  .max(120, "Name must be at most 120 characters.");

/**
 * Registration input.
 *
 * Note what is absent: `role`. The previous project destructured `role` from the
 * request body straight into `User.create()`, so anyone could self-provision
 * `super_admin`. Unknown keys are stripped by Zod's default object behaviour and
 * the service assigns the role itself.
 */
export const registerSchema = z
  .object({
    name: nameSchema,
    email: emailSchema,
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match.",
  });

export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Password is required.").max(PASSWORD_MAX_LENGTH),
});

export type LoginInput = z.infer<typeof loginSchema>;

export const forgotPasswordSchema = z.object({
  email: emailSchema,
});

export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z
  .object({
    token: z.string().trim().length(64, "Reset link is invalid or incomplete."),
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match.",
  });

export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Current password is required.").max(PASSWORD_MAX_LENGTH),
    newPassword: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match.",
  })
  .refine((data) => data.newPassword !== data.currentPassword, {
    path: ["newPassword"],
    message: "New password must be different from the current password.",
  });

export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

export const updateProfileSchema = z.object({
  name: nameSchema,
  image: z.string().trim().max(2000000, "Image output is too large (max 2MB).").optional().default(""),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

