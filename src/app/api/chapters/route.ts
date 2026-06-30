import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";

import { connectDB } from "@/lib/db";
import Chapter from "@/models/Chapter";
import Subject from "@/models/Subject";
import Category from "@/models/Category";

/* ==========================
   CREATE CHAPTER
========================== */

export async function POST(req: NextRequest) {
  try {
    await connectDB();

    const body = await req.json();

    const { name, slug, category, subject, order = 0 } = body;

    if (!name || !slug || !category || !subject) {
      return NextResponse.json(
        {
          success: false,
          message: "Name, slug, category and subject are required.",
        },
        { status: 400 },
      );
    }

    if (
      !mongoose.Types.ObjectId.isValid(category) ||
      !mongoose.Types.ObjectId.isValid(subject)
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid ObjectId.",
        },
        { status: 400 },
      );
    }

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

    const subjectExists = await Subject.findById(subject);

    if (!subjectExists) {
      return NextResponse.json(
        {
          success: false,
          message: "Subject not found.",
        },
        { status: 404 },
      );
    }

    const exists = await Chapter.findOne({
      subject,
      slug,
    });

    if (exists) {
      return NextResponse.json(
        {
          success: false,
          message: "Chapter already exists.",
        },
        { status: 409 },
      );
    }

    const chapter = await Chapter.create({
      name,
      slug,
      category,
      subject,
      order,
    });

    return NextResponse.json(
      {
        success: true,
        message: "Chapter created successfully.",
        data: chapter,
      },
      { status: 201 },
    );
  } catch (error: any) {
    console.error(error);

    return NextResponse.json(
      {
        success: false,
        message: error.message,
      },
      { status: 500 },
    );
  }
}

/* ==========================
   GET CHAPTERS
========================== */

export async function GET() {
  try {
    await connectDB();

    const chapters = await Chapter.find({
      isActive: true,
    })
      .populate("category", "name slug")
      .populate("subject", "name slug")
      .sort({
        order: 1,
        createdAt: -1,
      });

    return NextResponse.json({
      success: true,
      count: chapters.length,
      data: chapters,
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
