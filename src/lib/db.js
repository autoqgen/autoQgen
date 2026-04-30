import mongoose from "mongoose";

export const connectDB = async () => {
  try {
    if (mongoose.connection.readyState === 1) return;

    await mongoose.connect(process.env.MONGODB_URI, {
      dbName: "question-bank",
    });

    console.log("MongoDB Connected Successfully 🚀");
  } catch (error) {
    console.log("DB Connection Error:", error);
  }
};
