import mongoose from "mongoose";

/**
 * Shared database harness.
 *
 * Prefers an explicitly supplied MONGODB_URI; falls back to
 * mongodb-memory-server when USE_MEMORY_MONGO is set. Returns null when neither
 * is available so suites can skip rather than fail.
 */

interface Harness {
  uri: string;
  stop: () => Promise<void>;
}

export async function startDatabase(): Promise<Harness | null> {
  const explicit = process.env.MONGODB_URI;

  if (explicit && !process.env.USE_MEMORY_MONGO) {
    try {
      await mongoose.connect(explicit, { serverSelectionTimeoutMS: 3_000 });
      return {
        uri: explicit,
        stop: async () => {
          await mongoose.connection.dropDatabase();
          await mongoose.disconnect();
        },
      };
    } catch {
      return null;
    }
  }

  try {
    const { MongoMemoryServer } = await import("mongodb-memory-server");
    const server = await MongoMemoryServer.create();
    const uri = server.getUri();
    process.env.MONGODB_URI = uri;
    await mongoose.connect(uri);

    return {
      uri,
      stop: async () => {
        await mongoose.disconnect();
        await server.stop();
      },
    };
  } catch {
    return null;
  }
}

export async function clearCollections(): Promise<void> {
  const collections = mongoose.connection.collections;
  await Promise.all(Object.values(collections).map((collection) => collection.deleteMany({})));
}
