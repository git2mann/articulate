import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY || "");

export async function GET() {
  try {
    if (!process.env.GOOGLE_AI_API_KEY) {
      return NextResponse.json({ error: "No API Key" });
    }
    
    // Attempt to list models to see what this key can actually see
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${process.env.GOOGLE_AI_API_KEY}`);
    const data = await response.json();
    
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message });
  }
}
