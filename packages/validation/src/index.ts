import { z } from "zod";

export const envBoolean = z.enum(["true", "false"]).transform((value) => value === "true");
export const nonEmptyString = z.string().trim().min(1);
