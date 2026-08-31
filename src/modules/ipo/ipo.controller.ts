import type { FastifyRequest, FastifyReply } from 'fastify';
import { ipoService } from './ipo.service.js';
import { listIposQuerySchema, getIpoParamsSchema } from './ipo.schema.js';

export class IPOController {
  public static async listIPOs(req: FastifyRequest, reply: FastifyReply) {
    const query = listIposQuerySchema.parse(req.query);
    const result = await ipoService.listIPOs(query);
    return reply.send({ success: true, data: result });
  }

  public static async getIPO(req: FastifyRequest, reply: FastifyReply) {
    const params = getIpoParamsSchema.parse(req.params);
    const ipo = await ipoService.getIPOById(params.id);
    return reply.send({ success: true, data: ipo });
  }

  public static async getSubscription(req: FastifyRequest, reply: FastifyReply) {
    const params = getIpoParamsSchema.parse(req.params);
    const subscription = await ipoService.getSubscriptionHistory(params.id);
    return reply.send({ success: true, data: subscription });
  }

  public static async createIPO(req: FastifyRequest, reply: FastifyReply) {
    const { createIpoSchema } = await import('./ipo.schema.js');
    const input = createIpoSchema.parse(req.body);
    const ipo = await ipoService.upsertIPO(input);
    return reply.status(201).send({ success: true, data: ipo });
  }

  public static async bulkCreateIPOs(req: FastifyRequest, reply: FastifyReply) {
    const { bulkCreateIpoSchema } = await import('./ipo.schema.js');
    const input = bulkCreateIpoSchema.parse(req.body);
    const result = await ipoService.bulkUpsertIPOs(input.ipos);
    return reply.status(201).send({ success: true, data: result });
  }
}
