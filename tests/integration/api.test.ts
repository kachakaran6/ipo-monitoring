import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../../src/app.js';
import type { FastifyInstance } from 'fastify';

describe('Fastify REST API Integration Tests', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /health should return 200 and status ok', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/health',
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.status).toBe('ok');
    expect(body.uptime).toBeGreaterThanOrEqual(0);
  });

  it('GET /api/v1/ipos should return paginated list of IPOs', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/ipos?page=1&limit=10',
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data.ipos)).toBe(true);
  });

  it('POST /api/v1/check with invalid PAN should return 400 validation error', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/check',
      payload: {
        pan: 'INVALID_PAN',
      },
    });

    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('POST /api/v1/pans with valid PAN should register profile and return masked PAN', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/pans',
      payload: {
        pan: 'ABCDE1234F',
        label: 'My Test Account',
      },
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.data.maskedPan).toBe('XXXXX1234F');
    expect(body.data.label).toBe('My Test Account');
  });

  it('POST /api/v1/check/bulk should create bulk job and return 202 accepted with Job ID', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/check/bulk',
      payload: {
        pans: [
          { pan: 'ABCDE1234F', label: 'Acct 1' },
          { pan: 'FGHIJ5678K', label: 'Acct 2' },
        ],
      },
    });

    expect(res.statusCode).toBe(202);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.data.jobId).toMatch(/^BULK-/);
    expect(body.data.totalPans).toBe(2);
  });
});
