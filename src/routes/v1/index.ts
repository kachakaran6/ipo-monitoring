import type { FastifyPluginAsync } from 'fastify';
import { ipoRoutes } from './ipo.routes.js';
import { panRoutes } from './pan.routes.js';
import { checkRoutes } from './check.routes.js';
import { bulkRoutes } from './bulk.routes.js';
import { historyRoutes } from './history.routes.js';
import { adminRoutes } from './admin.routes.js';

export const v1Routes: FastifyPluginAsync = async (fastify) => {
  await fastify.register(ipoRoutes);
  await fastify.register(panRoutes);
  await fastify.register(checkRoutes);
  await fastify.register(bulkRoutes);
  await fastify.register(historyRoutes);
  await fastify.register(adminRoutes);
};
