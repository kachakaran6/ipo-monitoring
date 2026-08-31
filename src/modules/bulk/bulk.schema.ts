import { z } from 'zod';

const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]$/;

export const bulkPanItemSchema = z.object({
  pan: z.string().trim().toUpperCase().regex(PAN_REGEX),
  label: z.string().trim().optional(),
});

export const createBulkCheckSchema = z.object({
  pans: z
    .array(bulkPanItemSchema)
    .min(1, 'Must provide at least 1 PAN')
    .max(1000, 'Maximum 1,000 PANs allowed per bulk job'),
});

export const getBulkJobParamsSchema = z.object({
  id: z.string().min(1),
});

export type CreateBulkCheckInput = z.infer<typeof createBulkCheckSchema>;
export type GetBulkJobParams = z.infer<typeof getBulkJobParamsSchema>;
