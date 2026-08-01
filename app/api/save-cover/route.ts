import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/db";

export async function POST(request: NextRequest) {
  try {
    const {
      imageUrl,
      filename,
      filePath,
      userId,
      prompt,
    } = await request.json();

    // 1. VALIDATION
    if (!imageUrl || !userId || !filePath || !filename) {
      return NextResponse.json(
        {
          success: false,
          message: "Missing required fields",
        },
        { status: 400 }
      );
    }

    // 2. FETCH IMAGE FROM AI URL
    const imageRes = await fetch(imageUrl);

    if (!imageRes.ok) {
      return NextResponse.json(
        {
          success: false,
          message: "Failed to fetch generated image",
        },
        { status: 400 }
      );
    }

    // 3. CONVERT IMAGE → BUFFER (FIX FOR VERCEL + SUPABASE)
    const arrayBuffer = await imageRes.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // 4. UPLOAD TO SUPABASE STORAGE
    const { error: uploadError } = await supabase.storage
      .from("book-covers")
      .upload(filePath, buffer, {
        contentType: "image/png",
        upsert: false,
      });

    if (uploadError) {
      console.error("UPLOAD ERROR:", uploadError);

      return NextResponse.json(
        {
          success: false,
          message: uploadError.message,
        },
        { status: 500 }
      );
    }

    // 5. SAVE METADATA TO DATABASE
    const { error: dbError } = await supabase
      .from("book_covers")
      .insert([
        {
          user_id: userId,
          name: filename,
          image_path: filePath,
          prompt: prompt || "",
        },
      ]);

    if (dbError) {
      console.error("DATABASE ERROR:", dbError);

      return NextResponse.json(
        {
          success: false,
          message: dbError.message,
        },
        { status: 500 }
      );
    }

    // 6. SUCCESS RESPONSE
    return NextResponse.json(
      {
        success: true,
        message: "Book cover uploaded successfully",
      },
      { status: 200 }
    );

  } catch (error: any) {
    console.error("SERVER ERROR:", error);

    return NextResponse.json(
      {
        success: false,
        message: error.message || "Internal server error",
      },
      { status: 500 }
    );
  }
}