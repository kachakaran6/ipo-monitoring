import type { FastifyRequest, FastifyReply } from 'fastify';
import { historyService } from './history.service.js';
import { getPanParamsSchema } from '../pan/pan.schema.js';

export class HistoryController {
  public static async getHistory(req: FastifyRequest, reply: FastifyReply) {
    const params = getPanParamsSchema.parse(req.params);
    const result = await historyService.getPANHistory(params.id);
    return reply.send({ success: true, data: result });
  }
}
