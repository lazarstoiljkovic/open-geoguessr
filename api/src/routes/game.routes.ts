import Router from 'koa-router';
import { Container } from 'typedi';
import { authMiddleware } from 'src/middlewares/auth.middleware';
import { GameService } from 'src/services/game.service';
const router = new Router({ prefix: '/game' });
const gameService = () => Container.get(GameService);

router.post('/start', authMiddleware, async (ctx) => {
  const { roomCode } = ctx.request.body as { roomCode: string };
  if (!roomCode) { ctx.status = 400; ctx.body = { message: 'roomCode is required' }; return; }

  try {
    await gameService().startGame(ctx.state.userId, roomCode);
    ctx.status = 200;
    ctx.body = { ok: true };
  } catch (err: unknown) {
    ctx.status = 400;
    ctx.body = { message: err instanceof Error ? err.message : 'Failed to start game' };
  }
});

router.post('/guess', authMiddleware, async (ctx) => {
  const { roomCode, lat, lng } = ctx.request.body as { roomCode: string; lat: number; lng: number };
  if (!roomCode || lat === undefined || lng === undefined) {
    ctx.status = 400; ctx.body = { message: 'roomCode, lat, lng are required' }; return;
  }

  try {
    const result = await gameService().submitGuess(ctx.state.userId, roomCode, lat, lng);
    ctx.status = 200;
    ctx.body = result; // { distanceKm, roundScore }
  } catch (err: unknown) {
    ctx.status = 400;
    ctx.body = { message: err instanceof Error ? err.message : 'Failed to submit guess' };
  }
});

router.post('/next-round', authMiddleware, async (ctx) => {
  const { roomCode } = ctx.request.body as { roomCode: string };
  if (!roomCode) { ctx.status = 400; ctx.body = { message: 'roomCode is required' }; return; }

  try {
    await gameService().nextRound(ctx.state.userId, roomCode);
    ctx.status = 200;
    ctx.body = { ok: true };
  } catch (err: unknown) {
    ctx.status = 400;
    ctx.body = { message: err instanceof Error ? err.message : 'Failed to advance round' };
  }
});

router.post('/hint', authMiddleware, async (ctx) => {
  const { roomCode, hintType } = ctx.request.body as { roomCode: string; hintType: 'continent' | 'country' };
  if (!roomCode || !hintType) {
    ctx.status = 400; ctx.body = { message: 'roomCode and hintType are required' }; return;
  }
  if (hintType !== 'continent' && hintType !== 'country') {
    ctx.status = 400; ctx.body = { message: 'hintType must be continent or country' }; return;
  }

  try {
    const result = await gameService().requestHint(ctx.state.userId, roomCode, hintType);
    ctx.status = 200;
    ctx.body = result;
  } catch (err: unknown) {
    ctx.status = 400;
    ctx.body = { message: err instanceof Error ? err.message : 'Failed to get hint' };
  }
});

export default router;
