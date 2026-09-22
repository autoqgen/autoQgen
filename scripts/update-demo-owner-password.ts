import { loadEnvFiles } from "./load-env";

loadEnvFiles();

const TARGET_EMAIL = "abdullahakib313@gmail.com";
const NEW_PASSWORD = "1234";

async function main(): Promise<void> {
  if (process.env.NODE_ENV === "production") {
    throw new Error("This demo account update must not be run against a production database.");
  }

  const { connectDB, disconnectDB } = await import("@/lib/db");
  const { hashPassword } = await import("@/lib/auth/password");
  const { User } = await import("@/models");

  await connectDB();

  try {
    const user = await User.findOne({ email: TARGET_EMAIL }).select("_id").lean().exec();
    if (!user) {
      console.log(`User not found: ${TARGET_EMAIL}`);
      return;
    }

    const password = await hashPassword(NEW_PASSWORD);
    const result = await User.collection.updateOne(
      { _id: user._id },
      { $set: { password } },
    );

    if (result.modifiedCount !== 1) {
      throw new Error(`Password update failed for ${TARGET_EMAIL}.`);
    }

    console.log(`User found and password updated successfully: ${TARGET_EMAIL}`);
  } finally {
    await disconnectDB();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
