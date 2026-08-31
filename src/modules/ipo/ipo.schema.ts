import { z } from 'zod';

export const listIposQuerySchema = z.object({
  status: z.enum(['UPCOMING', 'OPEN', 'CLOSED', 'ALLOTMENT_PENDING', 'ALLOTTED', 'LISTED', 'COMPLETED', 'WITHDRAWN']).optional(),
  type: z.enum(['MAINBOARD', 'SME']).optional(),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
});

export const getIpoParamsSchema = z.object({
  id: z.string().min(1),
});

export type ListIposQuery = z.infer<typeof listIposQuerySchema>;
export type GetIpoParams = z.infer<typeof getIpoParamsSchema>;
