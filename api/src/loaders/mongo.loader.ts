import mongoose from 'mongoose';

export default async function mongoLoader(): Promise<void> {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/open-geoguessr';
  await mongoose.connect(uri);
  console.log('MongoDB connected');
}
