import { connectDB } from "@/lib/db";
import User from "@/models/User";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

export async function POST(req) {
  await connectDB();

  const { email, password } = await req.json();

  const user = await User.findOne({ email });

  if (!user) {
    return Response.json({ message: "User not found" }, { status: 404 });
  }

  const match = await bcrypt.compare(password, user.password);

  if (!match) {
    return Response.json({ message: "Wrong password" }, { status: 401 });
  }

  const token = jwt.sign(
    { id: user._id, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: "7d" },
  );

  return Response.json({
    message: "Login successful",
    token,
  });
}
