import Router from 'koa-router';
import { Container } from 'typedi';
import { AuthService } from 'src/services/auth.service';

const router = new Router({ prefix: '/auth' });
const authService = () => Container.get(AuthService);

router.post('/register', async (ctx) => {
  const { username, email, password } = ctx.request.body as Record<string, string>;

  if (!username || !email || !password) {
    ctx.status = 400;
    ctx.body = { message: 'username, email and password are required' };
    return;
  }

  try {
    const result = await authService().register(username, email, password);
    ctx.status = 201;
    ctx.body = result;
  } catch (err: unknown) {
    ctx.status = 409;
    ctx.body = { message: err instanceof Error ? err.message : 'Registration failed' };
  }
});

router.post('/login', async (ctx) => {
  const { email, password } = ctx.request.body as Record<string, string>;

  if (!email || !password) {
    ctx.status = 400;
    ctx.body = { message: 'email and password are required' };
    return;
  }

  try {
    const result = await authService().login(email, password);
    ctx.body = result;
  } catch (err: unknown) {
    ctx.status = 401;
    ctx.body = { message: err instanceof Error ? err.message : 'Login failed' };
  }
});

export default router;
