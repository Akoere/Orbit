import { NextResponse } from 'next/server';
import { sendNotification } from '@/lib/email';

export async function POST(req) {
  try {
    const body = await req.json();
    const { email } = body;

    if (!email) {
      return NextResponse.json({ error: "No email provided" }, { status: 400 });
    }

    console.log("Attempting to send email to:", email);

    const result = await sendNotification(
        email, 
        "@OrbitSystem", 
        "Orbit", 
        "This is a test alert! Your notifications are officially active."
    );

    if (!result.success) {
        console.error("Resend Error:", result.error);
        throw new Error("Failed to send email via Resend");
    }

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error("API Route Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}