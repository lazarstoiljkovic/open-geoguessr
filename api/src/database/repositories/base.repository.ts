import { Document, FilterQuery, Model, UpdateQuery } from 'mongoose';

export interface PaginatedResult<T> {
  items: T[];
  totalItems: number;
  totalPages: number;
  currentPage: number;
}

export interface PaginationOptions {
  page?: number;
  limit?: number;
  sort?: string | Record<string, 1 | -1>;
}

export abstract class BaseRepository<T extends Document> {
  constructor(protected readonly model: Model<T>) {}

  async findById(id: string): Promise<T | null> {
    return this.model.findById(id).exec();
  }

  async findOne(filter: FilterQuery<T>): Promise<T | null> {
    return this.model.findOne(filter).exec();
  }

  async findMany(filter: FilterQuery<T> = {}): Promise<T[]> {
    return this.model.find(filter).exec();
  }

  async findPaginated(filter: FilterQuery<T>, options: PaginationOptions = {}): Promise<PaginatedResult<T>> {
    const { page = 1, limit = 20, sort = '-createdAt' } = options;
    const skip = (page - 1) * limit;

    const [items, totalItems] = await Promise.all([
      this.model.find(filter).sort(sort).skip(skip).limit(limit).exec(),
      this.model.countDocuments(filter).exec(),
    ]);

    return {
      items,
      totalItems,
      totalPages: Math.ceil(totalItems / limit),
      currentPage: page,
    };
  }

  async create(data: Partial<T>): Promise<T> {
    return new this.model(data).save() as unknown as Promise<T>;
  }

  async updateById(id: string, data: UpdateQuery<T>): Promise<T | null> {
    return this.model.findByIdAndUpdate(id, data, { new: true }).exec();
  }

  async updateOne(filter: FilterQuery<T>, data: UpdateQuery<T>): Promise<void> {
    await this.model.updateOne(filter, data).exec();
  }

  async deleteById(id: string): Promise<void> {
    await this.model.findByIdAndDelete(id).exec();
  }

  async deleteMany(filter: FilterQuery<T>): Promise<void> {
    await this.model.deleteMany(filter).exec();
  }

  async exists(filter: FilterQuery<T>): Promise<boolean> {
    return !!(await this.model.exists(filter));
  }

  async count(filter: FilterQuery<T> = {}): Promise<number> {
    return this.model.countDocuments(filter).exec();
  }
}
