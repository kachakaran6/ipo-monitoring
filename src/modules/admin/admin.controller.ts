import type { FastifyRequest, FastifyReply } from 'fastify';
import { adminService } from './admin.service.js';
import { ProviderHealthTracker } from '../../providers/health.js';

export class AdminController {
  public static async getStats(_req: FastifyRequest, reply: FastifyReply) {
    const stats = await adminService.getSystemStats();
    return reply.send({ success: true, data: stats });
  }

  public static async getProviderHealth(_req: FastifyRequest, reply: FastifyReply) {
    const health = await ProviderHealthTracker.getAllHealth();
    return reply.send({ success: true, data: health });
  }

  public static async triggerSync(_req: FastifyRequest, reply: FastifyReply) {
    const result = await adminService.triggerIPOSync();
    return reply.send({ success: true, data: result });
  }
}
