import type { FastifyRequest, FastifyReply } from 'fastify';
import { allotmentService } from './allotment.service.js';
import { singleCheckSchema, getResultParamsSchema } from './allotment.schema.js';

export class AllotmentController {
  public static async checkPAN(req: FastifyRequest, reply: FastifyReply) {
    const input = singleCheckSchema.parse(req.body);
    const result = await allotmentService.checkPAN(input);
    return reply.send({ success: true, data: result });
  }

  public static async getResult(req: FastifyRequest, reply: FastifyReply) {
    const params = getResultParamsSchema.parse(req.params);
    const result = await allotmentService.getResultById(params.id);
    if (!result) {
      return reply.status(404).send({ success: false, error: 'Allotment result record not found' });
    }
    return reply.send({ success: true, data: result });
  }
}
