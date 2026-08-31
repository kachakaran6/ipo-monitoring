import type { FastifyPluginAsync } from 'fastify';
import { PANController } from '../../modules/pan/pan.controller.js';

export const panRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post('/pans', PANController.createPAN);
  fastify.get('/pans', PANController.listPANs);
  fastify.delete('/pans/:id', PANController.deletePAN);
};
