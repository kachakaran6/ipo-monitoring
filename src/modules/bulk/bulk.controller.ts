import type { FastifyRequest, FastifyReply } from 'fastify';
import { bulkService } from './bulk.service.js';
import { createBulkCheckSchema, getBulkJobParamsSchema } from './bulk.schema.js';

export class BulkController {
  public static async createBulkJob(req: FastifyRequest, reply: FastifyReply) {
    const input = createBulkCheckSchema.parse(req.body);
    const result = await bulkService.createBulkJob(input);
    return reply.status(202).send({ success: true, data: result });
  }

  public static async getBulkJob(req: FastifyRequest, reply: FastifyReply) {
    const params = getBulkJobParamsSchema.parse(req.params);
    const result = await bulkService.getBulkJobStatus(params.id);
    if (!result) {
      return reply.status(404).send({ success: false, error: 'Bulk job not found' });
    }
    return reply.send({ success: true, data: result });
  }
}
