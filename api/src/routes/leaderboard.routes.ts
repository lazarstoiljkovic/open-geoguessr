import Router from 'koa-router';
import { Container } from 'typedi';
import { UserRepository } from 'src/database/repositories/user.repository';

const router = new Router({ prefix: '/leaderboard' });

router.get('/', async (ctx) => {
  const userRepository = Container.get(UserRepository);
  const users = await userRepository.getLeaderboard(20);
  ctx.body = {
    leaderboard: users.map((u, i) => ({
      rank: i + 1,
      username: u.username,
      totalScore: u.totalScore,
      gamesPlayed: u.gamesPlayed,
    })),
  };
});

export default router;
