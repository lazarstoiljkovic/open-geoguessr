import { Service } from 'typedi';
import { IUser, UserModel } from '../models/user.model';
import { BaseRepository } from './base.repository';

@Service()
export class UserRepository extends BaseRepository<IUser> {
  constructor() {
    super(UserModel);
  }

  async findByEmail(email: string): Promise<IUser | null> {
    return this.findOne({ email });
  }

  async findByUsername(username: string): Promise<IUser | null> {
    return this.findOne({ username });
  }

  async updateScore(userId: string, scoreToAdd: number): Promise<void> {
    await this.model.findByIdAndUpdate(userId, {
      $inc: { totalScore: scoreToAdd, gamesPlayed: 1 },
    }).exec();
  }

  async getLeaderboard(limit = 20): Promise<IUser[]> {
    return this.model.find()
      .sort({ totalScore: -1 })
      .limit(limit)
      .select('username totalScore gamesPlayed createdAt')
      .exec();
  }
}
