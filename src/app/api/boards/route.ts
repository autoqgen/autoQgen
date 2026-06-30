import { NextRequest, NextResponse } from "next/server";

import { connectDB } from "@/lib/db";
import Board from "@/models/Board";

/* ==========================================
   CREATE BOARD
========================================== */

export async function POST(req: NextRequest) {
  try {
    await connectDB();

    const body = await req.json();

    const { name, slug, shortName, country = "Bangladesh", order = 0 } = body;

    if (!name || !slug) {
      return NextResponse.json(
        {
          success: false,
          message: "Name and slug are required.",
        },
        { status: 400 },
      );
    }

    const exists = await Board.findOne({
      $or: [{ name }, { slug }],
    });

    if (exists) {
      return NextResponse.json(
        {
          success: false,
          message: "Board already exists.",
        },
        { status: 409 },
      );
    }

    const board = await Board.create({
      name,
      slug,
      shortName,
      country,
      order,
    });

    return NextResponse.json(
      {
        success: true,
        message: "Board created successfully.",
        data: board,
      },
      { status: 201 },
    );
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        message: error.message,
      },
      { status: 500 },
    );
  }
}

/* ==========================================
   GET ALL BOARDS
========================================== */

export async function GET() {
  try {
    await connectDB();

    const boards = await Board.find({
      isActive: true,
    }).sort({
      order: 1,
      name: 1,
    });

    return NextResponse.json({
      success: true,
      count: boards.length,
      data: boards,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        message: error.message,
      },
      { status: 500 },
    );
  }
}
