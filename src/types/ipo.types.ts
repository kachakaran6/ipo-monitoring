export type IPOLifecycleStatus =
  | 'UPCOMING'
  | 'OPEN'
  | 'CLOSED'
  | 'ALLOTMENT_PENDING'
  | 'ALLOTTED'
  | 'LISTED'
  | 'COMPLETED'
  | 'WITHDRAWN';

export type Exchange = 'NSE' | 'BSE' | 'BOTH';
export type IssueType = 'BOOK_BUILT' | 'FIXED_PRICE';
export type MainboardOrSME = 'MAINBOARD' | 'SME';

export interface IPOSubscriptionData {
  qib: number;
  nii: number;
  retail: number;
  employee: number;
  total: number;
  updatedAt?: Date;
}

export interface IPO {
  id: string;
  symbol: string;
  companyName: string;
  slug: string;
  isin?: string | null;
  exchange: Exchange;
  issueType: IssueType;
  mainboardOrSme: MainboardOrSME;
  status: IPOLifecycleStatus;

  openDate?: Date | null;
  closeDate?: Date | null;
  allotmentDate?: Date | null;
  refundDate?: Date | null;
  dematCreditDate?: Date | null;
  listingDate?: Date | null;

  faceValue?: number | null;
  priceBandMin?: number | null;
  priceBandMax?: number | null;
  issuePrice?: number | null;
  lotSize: number;
  minimumApplication: number;
  issueSize?: number | null; // in Crores INR

  registrar?: string | null;
  registrarUrl?: string | null;

  subscription?: IPOSubscriptionData;

  gmp?: number | null;
  gmpPercentage?: number | null;

  source: string;
  sourceUpdatedAt?: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
}
