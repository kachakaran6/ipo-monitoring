import type { IPO, IPOSubscriptionData } from './ipo.types.js';
import type { AllotmentResult } from './allotment.types.js';

export interface IPODataProvider {
  readonly name: string;
  getUpcomingIPOs(): Promise<IPO[]>;
  getOpenIPOs(): Promise<IPO[]>;
  getClosedIPOs(): Promise<IPO[]>;
  getIPO(id: string): Promise<IPO | null>;
  getSubscriptionData(id: string): Promise<IPOSubscriptionData | null>;
}

export interface AllotmentProvider {
  readonly name: string;
  readonly supportedRegistrars: string[];
  supportsIPO(ipo: IPO): boolean;
  checkByPAN(pan: string, ipo: IPO): Promise<AllotmentResult>;
  checkByApplicationNumber(applicationNumber: string, ipo: IPO): Promise<AllotmentResult>;
}

export type ProviderHealthStatus = 'HEALTHY' | 'DEGRADED' | 'UNAVAILABLE';

export interface ProviderHealth {
  provider: string;
  successCount: number;
  failureCount: number;
  consecutiveFailures: number;
  latencyMs: number;
  lastSuccessAt?: Date | null;
  lastFailureAt?: Date | null;
  status: ProviderHealthStatus;
  updatedAt: Date;
}
