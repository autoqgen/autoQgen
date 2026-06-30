import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";

import { connectDB } from "@/lib/db";

import Exam from "@/models/Exam";
import Category from "@/models/Category";
import Board from "@/models/Board";

/* ==========================================
   CREATE EXAM
========================================== */

export async function POST(req: NextRequest) {
  try {
    await connectDB();

    const body = await req.json();

    const {
      name,
      slug,
      type = "OTHER",
      category = null,
      board = null,
      year = null,
      session = "",
      description = "",
      order = 0,
    } = body;

    if (!name || !slug) {
      return NextResponse.json(
        {
          success: false,
          message: "Name and slug are required.",
        },
        { status: 400 },
      );
    }

    if (category && !mongoose.Types.ObjectId.isValid(category)) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid category id.",
        },
        { status: 400 },
      );
    }

    if (board && !mongoose.Types.ObjectId.isValid(board)) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid board id.",
        },
        { status: 400 },
      );
    }

    if (category) {
      const categoryExists = await Category.findById(category);

      if (!categoryExists) {
        return NextResponse.json(
          {
            success: false,
            message: "Category not found.",
          },
          { status: 404 },
        );
      }
    }

    if (board) {
      const boardExists = await Board.findById(board);

      if (!boardExists) {
        return NextResponse.json(
          {
            success: false,
            message: "Board not found.",
          },
          { status: 404 },
        );
      }
    }

    const exists = await Exam.findOne({
      slug,
      year,
    });

    if (exists) {
      return NextResponse.json(
        {
          success: false,
          message: "Exam already exists.",
        },
        { status: 409 },
      );
    }

    const exam = await Exam.create({
      name,
      slug,
      type,
      category,
      board,
      year,
      session,
      description,
      order,
    });

    return NextResponse.json(
      {
        success: true,
        message: "Exam created successfully.",
        data: exam,
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
   GET ALL EXAMS
========================================== */

export async function GET() {
  try {
    await connectDB();

    const exams = await Exam.find({
      isActive: true,
    })
      .populate("category", "name slug")
      .populate("board", "name slug")
      .sort({
        order: 1,
        year: -1,
        name: 1,
      });

    return NextResponse.json({
      success: true,
      count: exams.length,
      data: exams,
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
