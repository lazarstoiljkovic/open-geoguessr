import { Service } from 'typedi';
import { IUser, UserModel } from '../models/user.model';

@Service()
export class UserRepository {
  async create(data: { username: string; email: string; password: string }): Promise<IUser> {
    const user = new UserModel(data);
    return user.save();
  }

  async findById(id: string): Promise<IUser | null> {
    return UserModel.findById(id).exec();
  }

  async findByEmail(email: string): Promise<IUser | null> {
    return UserModel.findOne({ email }).exec();
  }

  async findByUsername(username: string): Promise<IUser | null> {
    return UserModel.findOne({ username }).exec();
  }

  async updateScore(userId: string, scoreToAdd: number): Promise<void> {
    await UserModel.findByIdAndUpdate(userId, {
      $inc: { totalScore: scoreToAdd, gamesPlayed: 1 },
    }).exec();
  }

  async getLeaderboard(limit = 20): Promise<IUser[]> {
    return UserModel.find()
      .sort({ totalScore: -1 })
      .limit(limit)
      .select('username totalScore gamesPlayed createdAt')
      .exec();
  }
}
