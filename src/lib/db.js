import mongoose from "mongoose";

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  throw new Error("❌ MONGODB_URI is not defined in .env.local");
}

let cached = global.mongoose;

if (!cached) {
  cached = global.mongoose = { conn: null, promise: null };
}

export const connectDB = async () => {
  if (cached.conn) {
    console.log("♻️ Using cached MongoDB connection");
    return cached.conn;
  }

  try {
    cached.promise = mongoose.connect(MONGODB_URI, {
      dbName: "question-bank",
      serverSelectionTimeoutMS: 8000,
      maxPoolSize: 10,
      bufferCommands: false,
    });

    cached.conn = await cached.promise;

    console.log("✅ MongoDB Connected Stable");
    return cached.conn;
  } catch (err) {
    console.log("❌ MongoDB Connection Failed:");
    console.log(err);

    cached.promise = null; // reset cache on failure
    throw err;
  }
};
