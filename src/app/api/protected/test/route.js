import jwt from "jsonwebtoken";

export async function GET(req) {
  try {
    const authHeader = req.headers.get("authorization");

    console.log("AUTH HEADER:", authHeader); // 🔥 debug 1

    if (!authHeader) {
      return Response.json({ message: "No token provided" }, { status: 401 });
    }

    const token = authHeader.split(" ")[1];

    console.log("TOKEN:", token); // 🔥 debug 2

    if (!token) {
      return Response.json({ message: "Token missing" }, { status: 401 });
    }

    console.log("JWT SECRET:", process.env.JWT_SECRET); // 🔥 debug 3

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    console.log("DECODED USER:", decoded); // 🔥 debug 4

    return Response.json({
      message: "Authorized ✅",
      user: decoded,
    });
  } catch (err) {
    console.log("JWT ERROR:", err); // 🔥 debug 5

    return Response.json(
      {
        message: "Invalid token",
        error: err.message,
      },
      { status: 401 },
    );
  }
}
