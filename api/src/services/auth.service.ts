import { Service } from 'typedi';
import bcrypt from 'bcrypt';
import { UserRepository } from 'src/database/repositories/user.repository';
import { signToken } from 'src/utils/jwt.utils';

@Service()
export class AuthService {
  constructor(private readonly userRepository: UserRepository) {}

  async register(username: string, email: string, password: string) {
    const [existingEmail, existingUsername] = await Promise.all([
      this.userRepository.findByEmail(email),
      this.userRepository.findByUsername(username),
    ]);

    if (existingEmail) throw new Error('Email already in use');
    if (existingUsername) throw new Error('Username already taken');

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await this.userRepository.create({ username, email, password: hashedPassword });

    const token = signToken({ userId: user._id.toString(), username: user.username });
    return { token, user: { id: user._id, username: user.username, email: user.email } };
  }

  async login(email: string, password: string) {
    const user = await this.userRepository.findByEmail(email);
    if (!user) throw new Error('Invalid credentials');

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) throw new Error('Invalid credentials');

    const token = signToken({ userId: user._id.toString(), username: user.username });
    return { token, user: { id: user._id, username: user.username, email: user.email } };
  }
}
