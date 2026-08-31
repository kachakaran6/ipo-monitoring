import type { FastifyRequest, FastifyReply } from 'fastify';
import { panService } from './pan.service.js';
import { createPanSchema, getPanParamsSchema } from './pan.schema.js';

export class PANController {
  public static async createPAN(req: FastifyRequest, reply: FastifyReply) {
    const input = createPanSchema.parse(req.body);
    const result = await panService.registerPAN(input);
    return reply.status(201).send({ success: true, data: result });
  }

  public static async listPANs(_req: FastifyRequest, reply: FastifyReply) {
    const result = await panService.listPANs();
    return reply.send({ success: true, data: result });
  }

  public static async deletePAN(req: FastifyRequest, reply: FastifyReply) {
    const params = getPanParamsSchema.parse(req.params);
    const deleted = await panService.deletePAN(params.id);
    if (!deleted) {
      return reply.status(404).send({ success: false, error: 'PAN profile not found' });
    }
    return reply.send({ success: true, message: 'PAN profile deleted successfully' });
  }
}
