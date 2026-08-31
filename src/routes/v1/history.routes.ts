import type { FastifyPluginAsync } from 'fastify';
import { HistoryController } from '../../modules/history/history.controller.js';

export const historyRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/pans/:id/history', HistoryController.getHistory);
  fastify.get('/history/:id', HistoryController.getHistory);
};
