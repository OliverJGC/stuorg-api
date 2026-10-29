import { z } from "zod";

const nonBlankString = z.string().trim().min(1);
const utepEmail = z.string().trim().toLowerCase().email().refine(
  (email) => email.endsWith("@miners.utep.edu") || email.endsWith("@utep.edu"),
);

export const validateNameSchema = z.object({ name: nonBlankString });

export const createOrganizationSchema = z.object({
  name: nonBlankString,
  admin: z.object({
    firstName: nonBlankString,
    lastName: nonBlankString,
    email: utepEmail,
    password: z.string().min(8),
    role: nonBlankString,
  }),
});
