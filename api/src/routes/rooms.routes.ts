import Router from 'koa-router';
import { Container } from 'typedi';
import { RoomService } from 'src/services/room.service';
import { authMiddleware } from 'src/middlewares/auth.middleware';
import { GameMode } from 'src/patterns/factory/game.factory';

const router = new Router({ prefix: '/rooms' });
const roomService = () => Container.get(RoomService);

router.post('/create', authMiddleware, async (ctx) => {
  const { mode } = ctx.request.body as { mode?: GameMode };
  const room = await roomService().createRoom(ctx.state.userId, ctx.state.username, mode);
  ctx.status = 201;
  ctx.body = { room: { id: room._id, code: room.code, status: room.status, players: room.players, totalRounds: room.totalRounds } };
});

router.post('/join', authMiddleware, async (ctx) => {
  const { code } = ctx.request.body as { code: string };

  if (!code) {
    ctx.status = 400;
    ctx.body = { message: 'Room code is required' };
    return;
  }

  try {
    const room = await roomService().joinRoom(code, ctx.state.userId, ctx.state.username);
    ctx.body = { room: { id: room!._id, code: room!.code, status: room!.status, players: room!.players, totalRounds: room!.totalRounds } };
  } catch (err: unknown) {
    ctx.status = 400;
    ctx.body = { message: err instanceof Error ? err.message : 'Failed to join room' };
  }
});

router.get('/:code', authMiddleware, async (ctx) => {
  const room = await roomService().getRoomByCode(ctx.params.code);
  if (!room) {
    ctx.status = 404;
    ctx.body = { message: 'Room not found' };
    return;
  }
  ctx.body = { room: { id: room._id, code: room.code, status: room.status, players: room.players, totalRounds: room.totalRounds } };
});

export default router;
