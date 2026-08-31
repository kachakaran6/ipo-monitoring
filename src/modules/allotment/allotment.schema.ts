import { z } from 'zod';

const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]$/;

export const singleCheckSchema = z.object({
  pan: z
    .string()
    .trim()
    .toUpperCase()
    .regex(PAN_REGEX, 'Invalid PAN format. Must be 5 letters, 4 digits, 1 letter'),
  ipoId: z.string().optional(),
  async: z.boolean().default(false),
});

export const getResultParamsSchema = z.object({
  id: z.string().uuid(),
});

export type SingleCheckInput = z.infer<typeof singleCheckSchema>;
export type GetResultParams = z.infer<typeof getResultParamsSchema>;
