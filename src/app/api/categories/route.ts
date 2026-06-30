import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import Category from "@/models/Category";

/* ==========================================
   CREATE CATEGORY
========================================== */
export async function POST(req: NextRequest) {
  try {
    await connectDB();

    const body = await req.json();

    const { name, slug, description } = body;

    // Validation
    if (!name || !slug) {
      return NextResponse.json(
        {
          success: false,
          message: "Name and slug are required.",
        },
        { status: 400 }
      );
    }

    // Check duplicate
    const exists = await Category.findOne({
      $or: [{ name }, { slug }],
    });

    if (exists) {
      return NextResponse.json(
        {
          success: false,
          message: "Category already exists.",
        },
        { status: 409 }
      );
    }

    // Create
    const category = await Category.create({
      name,
      slug,
      description,
    });

    return NextResponse.json(
      {
        success: true,
        message: "Category created successfully.",
        data: category,
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error(error);

    return NextResponse.json(
      {
        success: false,
        message: error.message,
      },
      { status: 500 }
    );
  }
}

/* ==========================================
   GET ALL CATEGORIES
========================================== */
export async function GET() {
  try {
    await connectDB();

    const categories = await Category.find({
      isActive: true,
    }).sort({ createdAt: -1 });

    return NextResponse.json({
      success: true,
      count: categories.length,
      data: categories,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        message: error.message,
      },
      { status: 500 }
    );
  }
}