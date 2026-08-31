import type { IPODataProvider, IPO, IPOSubscriptionData } from './IPODataProvider.interface.js';

export class MockIPOProvider implements IPODataProvider {
  public readonly name = 'MOCK_IPO_PROVIDER';

  private mockIpos: IPO[] = [
    {
      id: '7b8d1b22-83b6-4b2a-a9f1-a1e4c9f13110',
      symbol: 'TECHCORP',
      companyName: 'TechCorp Innovations Limited',
      slug: 'techcorp-innovations',
      isin: 'INE123A01019',
      exchange: 'NSE',
      issueType: 'BOOK_BUILT',
      mainboardOrSme: 'MAINBOARD',
      status: 'ALLOTMENT_PENDING',
      openDate: new Date('2026-08-25T04:30:00Z'),
      closeDate: new Date('2026-08-28T11:30:00Z'),
      allotmentDate: new Date('2026-08-31T11:30:00Z'),
      listingDate: new Date('2026-09-03T04:30:00Z'),
      faceValue: 10,
      priceBandMin: 320,
      priceBandMax: 340,
      issuePrice: 340,
      lotSize: 44,
      minimumApplication: 44,
      issueSize: 1250.5,
      registrar: 'MUFG_INTIME',
      registrarUrl: 'https://linkintime.co.in',
      subscription: {
        qib: 85.4,
        nii: 42.1,
        retail: 18.75,
        employee: 2.5,
        total: 48.9,
      },
      gmp: 65,
      gmpPercentage: 19.12,
      source: 'MOCK_IPO_PROVIDER',
    },
    {
      id: '8c9e2c33-94c7-5c3b-b0f2-b2f5d0a24221',
      symbol: 'NEXUSFIN',
      companyName: 'Nexus Finance & Wealth Limited',
      slug: 'nexus-finance-wealth',
      isin: 'INE456B02028',
      exchange: 'BOTH',
      issueType: 'BOOK_BUILT',
      mainboardOrSme: 'MAINBOARD',
      status: 'OPEN',
      openDate: new Date('2026-08-30T04:30:00Z'),
      closeDate: new Date('2026-09-02T11:30:00Z'),
      allotmentDate: new Date('2026-09-05T11:30:00Z'),
      faceValue: 5,
      priceBandMin: 510,
      priceBandMax: 540,
      issuePrice: 540,
      lotSize: 27,
      minimumApplication: 27,
      issueSize: 3400,
      registrar: 'KFINTECH',
      registrarUrl: 'https://ris.kfintech.com/ipostatus/',
      subscription: {
        qib: 12.2,
        nii: 8.4,
        retail: 5.1,
        employee: 1.2,
        total: 7.8,
      },
      gmp: 110,
      gmpPercentage: 20.37,
      source: 'MOCK_IPO_PROVIDER',
    },
  ];

  public async getUpcomingIPOs(): Promise<IPO[]> {
    return this.mockIpos.filter((i) => i.status === 'UPCOMING');
  }

  public async getOpenIPOs(): Promise<IPO[]> {
    return this.mockIpos.filter((i) => i.status === 'OPEN');
  }

  public async getClosedIPOs(): Promise<IPO[]> {
    return this.mockIpos.filter(
      (i) => i.status === 'CLOSED' || i.status === 'ALLOTMENT_PENDING' || i.status === 'ALLOTTED'
    );
  }

  public async getIPO(id: string): Promise<IPO | null> {
    return this.mockIpos.find((i) => i.id === id || i.slug === id || i.symbol === id) || null;
  }

  public async getSubscriptionData(id: string): Promise<IPOSubscriptionData | null> {
    const ipo = await this.getIPO(id);
    return ipo?.subscription || null;
  }
}
