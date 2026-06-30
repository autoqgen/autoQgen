import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";

import { connectDB } from "@/lib/db";
import Subject from "@/models/Subject";
import Category from "@/models/Category";

/* ==========================================
   CREATE SUBJECT
========================================== */

export async function POST(req: NextRequest) {
  try {
    await connectDB();

    const body = await req.json();

    const { name, slug, category } = body;

    // Validation
    if (!name || !slug || !category) {
      return NextResponse.json(
        {
          success: false,
          message: "Name, slug and category are required.",
        },
        { status: 400 },
      );
    }

    // ObjectId Validation
    if (!mongoose.Types.ObjectId.isValid(category)) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid category id.",
        },
        { status: 400 },
      );
    }

    // Category Exists?
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

    // Duplicate Subject (within same category)
    const exists = await Subject.findOne({
      category,
      $or: [{ name }, { slug }],
    });

    if (exists) {
      return NextResponse.json(
        {
          success: false,
          message: "Subject already exists in this category.",
        },
        { status: 409 },
      );
    }

    // Create Subject
    const subject = await Subject.create({
      name,
      slug,
      category,
    });

    return NextResponse.json(
      {
        success: true,
        message: "Subject created successfully.",
        data: subject,
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

/* ==========================================
   GET ALL SUBJECTS
========================================== */

export async function GET() {
  try {
    await connectDB();

    const subjects = await Subject.find({ isActive: true })
      .populate("category", "name slug")
      .sort({ createdAt: -1 });

    return NextResponse.json({
      success: true,
      count: subjects.length,
      data: subjects,
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
