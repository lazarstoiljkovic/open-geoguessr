import Router from 'koa-router';
import authRoutes from './auth.routes';
import roomsRoutes from './rooms.routes';
import leaderboardRoutes from './leaderboard.routes';
import gameRoutes from './game.routes';

const router = new Router();

router.use(authRoutes.routes(), authRoutes.allowedMethods());
router.use(roomsRoutes.routes(), roomsRoutes.allowedMethods());
router.use(leaderboardRoutes.routes(), leaderboardRoutes.allowedMethods());
router.use(gameRoutes.routes(), gameRoutes.allowedMethods());

export default router;
