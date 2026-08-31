import type { FastifyPluginAsync } from 'fastify';
import { AllotmentController } from '../../modules/allotment/allotment.controller.js';

export const checkRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post('/check', AllotmentController.checkPAN);
  fastify.get('/results/:id', AllotmentController.getResult);
};
