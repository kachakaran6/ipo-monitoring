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

export const createIpoSchema = z.object({
  symbol: z.string().min(1).toUpperCase().trim(),
  companyName: z.string().min(1).trim(),
  isin: z.string().optional(),
  exchange: z.enum(['NSE', 'BSE', 'BOTH']).default('NSE'),
  issueType: z.enum(['BOOK_BUILT', 'FIXED_PRICE']).default('BOOK_BUILT'),
  mainboardOrSme: z.enum(['MAINBOARD', 'SME']).default('MAINBOARD'),
  status: z.enum(['UPCOMING', 'OPEN', 'CLOSED', 'ALLOTMENT_PENDING', 'ALLOTTED', 'LISTED', 'COMPLETED', 'WITHDRAWN']).default('OPEN'),
  openDate: z.coerce.date().optional(),
  closeDate: z.coerce.date().optional(),
  allotmentDate: z.coerce.date().optional(),
  refundDate: z.coerce.date().optional(),
  dematCreditDate: z.coerce.date().optional(),
  listingDate: z.coerce.date().optional(),
  faceValue: z.coerce.number().optional(),
  priceBandMin: z.coerce.number().optional(),
  priceBandMax: z.coerce.number().optional(),
  issuePrice: z.coerce.number().optional(),
  lotSize: z.coerce.number().min(1).default(1),
  minimumApplication: z.coerce.number().min(1).default(1),
  issueSize: z.coerce.number().optional(),
  registrar: z.string().optional(),
  registrarUrl: z.string().url().optional(),
  source: z.string().default('MANUAL_IMPORT'),
  sourceId: z.string().optional(),
  sourceUrl: z.string().optional(),
});

export const bulkCreateIpoSchema = z.object({
  ipos: z.array(createIpoSchema).min(1),
});

export type ListIposQuery = z.infer<typeof listIposQuerySchema>;
export type GetIpoParams = z.infer<typeof getIpoParamsSchema>;
export type CreateIpoInput = z.infer<typeof createIpoSchema>;
export type BulkCreateIpoInput = z.infer<typeof bulkCreateIpoSchema>;
