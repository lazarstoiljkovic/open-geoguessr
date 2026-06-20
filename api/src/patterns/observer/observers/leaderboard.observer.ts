import { Service } from 'typedi';
import { UserRepository } from 'src/database/repositories/user.repository';
import { GameObserver, GameOverEvent } from '../game-observer.interface';

@Service()
export class LeaderboardObserver implements GameObserver {
  constructor(private readonly userRepository: UserRepository) {}

  async onGameOver(event: GameOverEvent): Promise<void> {
    await Promise.all(
      event.players.map((player) =>
        this.userRepository.updateScore(player.userId, player.score),
      ),
    );
  }
}
