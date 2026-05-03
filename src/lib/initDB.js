import { connectDB } from "./db";

let isConnected = false;

export const initDB = async () => {
  if (isConnected) return;

  try {
    await connectDB();
    console.log("✅ DB Connected at server start");
    isConnected = true;
  } catch (err) {
    console.log("❌ DB Connection Failed at server start");
    console.error(err);
  }
};