import { z } from 'zod';

const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]$/;

export const createPanSchema = z.object({
  pan: z
    .string()
    .trim()
    .toUpperCase()
    .regex(PAN_REGEX, 'Invalid PAN format. Must be 5 letters, 4 digits, 1 letter'),
  label: z.string().trim().max(100).optional(),
});

export const getPanParamsSchema = z.object({
  id: z.string().min(1, 'ID or PAN parameter is required'),
});

export const deletePanParamsSchema = z.object({
  id: z.string().min(1, 'ID parameter is required'),
});

export type CreatePanInput = z.infer<typeof createPanSchema>;
export type GetPanParams = z.infer<typeof getPanParamsSchema>;
