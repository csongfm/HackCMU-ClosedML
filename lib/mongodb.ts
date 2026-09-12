import { MongoClient, ServerApiVersion, type Db } from 'mongodb';

declare global {
  var brieflyMongoClientPromise: Promise<MongoClient> | undefined;
}

function createClient(): MongoClient {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI is not configured.');

  return new MongoClient(uri, {
    serverSelectionTimeoutMS: 8000,
    connectTimeoutMS: 8000,
    timeoutMS: 10000,
    serverApi: { version: ServerApiVersion.v1, strict: true, deprecationErrors: true },
  });
}

export async function getDatabase(): Promise<Db> {
  if (!global.brieflyMongoClientPromise) {
    const client = createClient();
    global.brieflyMongoClientPromise = client.connect().catch(async (error) => {
      global.brieflyMongoClientPromise = undefined;
      await client.close().catch(() => {});
      throw error;
    });
  }

  const client = await global.brieflyMongoClientPromise;
  return client.db(process.env.MONGODB_DB || 'briefly');
}
