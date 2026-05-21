import Koa from 'koa';
import Router from 'koa-router';
import logger from 'koa-logger';
import json from 'koa-json';
import bodyParser from 'koa-bodyparser';
import cors from '@koa/cors';
import apiRoutes from './routes';

const app = new Koa();

app.use(cors({ origin: '*', allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'] }));
app.use(json());
app.use(bodyParser());
app.use(logger());

app.use(async (ctx, next) => {
  try {
    await next();
  } catch (err: unknown) {
    ctx.status = 500;
    ctx.body = { message: err instanceof Error ? err.message : 'Internal server error' };
  }
});

const router = new Router().use('/api', apiRoutes.routes(), apiRoutes.allowedMethods());
app.use(router.routes());
app.use(router.allowedMethods());

export default app;
