import type { FastifyPluginAsync } from 'fastify';
import { BulkController } from '../../modules/bulk/bulk.controller.js';

export const bulkRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post('/check/bulk', BulkController.createBulkJob);
  fastify.get('/jobs/:id', BulkController.getBulkJob);
};
