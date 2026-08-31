import type { FastifyPluginAsync } from 'fastify';
import { AdminController } from '../../modules/admin/admin.controller.js';

export const adminRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/admin/stats', AdminController.getStats);
  fastify.get('/providers/health', AdminController.getProviderHealth);
  fastify.post('/admin/sync', AdminController.triggerSync);
  fastify.post('/admin/sync/direct', AdminController.executeDirectSync);
};
