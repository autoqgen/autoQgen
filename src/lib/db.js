import mongoose from "mongoose";

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  throw new Error("❌ MONGODB_URI is not defined in .env.local");
}

global.mongoose = global.mongoose || { conn: null, promise: null };

export const connectDB = async () => {
  if (global.mongoose.conn) {
    return global.mongoose.conn;
  }

  try {
    global.mongoose.promise =
      global.mongoose.promise ||
      mongoose.connect(MONGODB_URI, {
        dbName: "AutoQgen",
        serverSelectionTimeoutMS: 8000,
        maxPoolSize: 10,
        bufferCommands: false,
      });

    global.mongoose.conn = await global.mongoose.promise;

    console.log("✅ MongoDB Connected");
    return global.mongoose.conn;
  } catch (err) {
    global.mongoose.promise = null;
    console.log("❌ MongoDB Error:", err);
    throw err;
  }
};
