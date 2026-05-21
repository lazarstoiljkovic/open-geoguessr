import { Context, Next } from 'koa';
import { verifyToken } from 'src/utils/jwt.utils';

export async function authMiddleware(ctx: Context, next: Next): Promise<void> {
  const authHeader = ctx.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    ctx.status = 401;
    ctx.body = { message: 'Unauthorized' };
    return;
  }

  const token = authHeader.slice(7);
  try {
    const payload = verifyToken(token);
    ctx.state.userId = payload.userId;
    ctx.state.username = payload.username;
    await next();
  } catch {
    ctx.status = 401;
    ctx.body = { message: 'Invalid token' };
  }
}
