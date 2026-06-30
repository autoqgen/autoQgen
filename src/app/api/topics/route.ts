import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";

import { connectDB } from "@/lib/db";

import Topic from "@/models/Topic";
import Category from "@/models/Category";
import Subject from "@/models/Subject";
import Chapter from "@/models/Chapter";

/* ==========================================
   CREATE TOPIC
========================================== */

export async function POST(req: NextRequest) {
  try {
    await connectDB();

    const body = await req.json();

    const {
      name,
      slug,
      category,
      subject,
      chapter,
      description,
      order = 0,
    } = body;

    if (!name || !slug || !category || !subject || !chapter) {
      return NextResponse.json(
        {
          success: false,
          message: "Name, slug, category, subject and chapter are required.",
        },
        { status: 400 },
      );
    }

    if (
      !mongoose.Types.ObjectId.isValid(category) ||
      !mongoose.Types.ObjectId.isValid(subject) ||
      !mongoose.Types.ObjectId.isValid(chapter)
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

    const chapterExists = await Chapter.findById(chapter);

    if (!chapterExists) {
      return NextResponse.json(
        {
          success: false,
          message: "Chapter not found.",
        },
        { status: 404 },
      );
    }

    const exists = await Topic.findOne({
      chapter,
      slug,
    });

    if (exists) {
      return NextResponse.json(
        {
          success: false,
          message: "Topic already exists.",
        },
        { status: 409 },
      );
    }

    const topic = await Topic.create({
      name,
      slug,
      category,
      subject,
      chapter,
      description,
      order,
    });

    return NextResponse.json(
      {
        success: true,
        message: "Topic created successfully.",
        data: topic,
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
   GET TOPICS
========================================== */

export async function GET() {
  try {
    await connectDB();

    const topics = await Topic.find({
      isActive: true,
    })
      .populate("category", "name slug")
      .populate("subject", "name slug")
      .populate("chapter", "name slug")
      .sort({
        order: 1,
        createdAt: -1,
      });

    return NextResponse.json({
      success: true,
      count: topics.length,
      data: topics,
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
