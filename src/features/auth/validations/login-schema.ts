import { z } from "zod";

const optionalText = (max: number) =>
  z.string().trim().max(max).optional().or(z.literal(""));

export const loginSchema = z
  .object({
    name: optionalText(80),
    restaurantName: optionalText(120),
    email: z
      .string()
      .trim()
      .email("Enter a valid email address.")
      .max(254, "Email address is too long.")
      .transform((value) => value.toLowerCase()),
    password: z
      .string()
      .min(10, "Password must be at least 10 characters.")
      .max(72, "Password is too long."),
    activationCode: optionalText(64),
    deviceKey: z
      .string()
      .trim()
      .min(16, "Device key is required.")
      .max(256, "Device key is too long."),
  })
  .strict();

export type LoginInput = z.infer<typeof loginSchema>;
