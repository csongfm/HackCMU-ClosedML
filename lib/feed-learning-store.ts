import type { Db } from 'mongodb';
import { MAX_FEEDBACK, type FeedbackExample } from './feed-learning';

export type LearningDocument = { _id: string; examples: FeedbackExample[] };
export async function readFeedback(db: Db, userId: string): Promise<FeedbackExample[]> {
  return (await db.collection<LearningDocument>('feedLearning').findOne({ _id: userId }))?.examples || [];
}

export async function saveFeedback(db: Db, userId: string, url?: string, example?: FeedbackExample, reset = false) {
  // One atomic document update prevents different tabs from losing each other's
  // votes. $literal prevents headline text being interpreted as Mongo expressions.
  const remaining = { $filter: { input: { $ifNull: ['$examples', []] }, as: 'item', cond: { $ne: ['$$item.url', { $literal: url || '' }] } } };
  const document = await db.collection<LearningDocument>('feedLearning').findOneAndUpdate(
    { _id: userId },
    [{ $set: { examples: reset ? [] : { $slice: [{ $concatArrays: [remaining, { $literal: example ? [example] : [] }] }, -MAX_FEEDBACK] } } }],
    { upsert: true, returnDocument: 'after' },
  );
  return document?.examples || [];
}
