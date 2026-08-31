import type { FastifyPluginAsync } from 'fastify';
import { IPOController } from '../../modules/ipo/ipo.controller.js';

export const ipoRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/ipos', IPOController.listIPOs);
  fastify.post('/ipos', IPOController.createIPO);
  fastify.post('/ipos/bulk', IPOController.bulkCreateIPOs);
  fastify.get('/ipos/:id', IPOController.getIPO);
  fastify.get('/ipos/:id/subscription', IPOController.getSubscription);
};
