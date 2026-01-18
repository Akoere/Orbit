import { NextResponse } from 'next/server';
import twilio from 'twilio';

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const client = twilio(accountSid, authToken);
const fromData = process.env.TWILIO_PHONE_NUMBER; 

export async function POST(req) {
  try {
    const body = await req.json();
    const { phone } = body;

    if (!phone) {
      return NextResponse.json({ error: "No phone number provided" }, { status: 400 });
    }

    console.log("Sending WhatsApp to:", phone);

    // Note: For Twilio Sandbox, the 'from' number is usually strict (e.g., 'whatsapp:+14155238886')
    // and the 'to' number must also have 'whatsapp:' prefix.
    
    // We'll check if the environment variable already has 'whatsapp:' prefix, otherwise verify.
    // Usually sandbox numbers are fixed. 
    
    // Assuming the user puts the full "whatsapp:+123..." in ENV or we prepend it.
    // Safe bet for sandbox: prepend 'whatsapp:' if missing.
    
    const formatNumber = (num) => num.startsWith('whatsapp:') ? num : `whatsapp:${num}`;

    const message = await client.messages.create({
      body: '🚀 Orbit Alert: Using WhatsApp Notifications is currently active! This is a test message.',
      from: formatNumber(fromData || '+14155238886'), // Default Twilio Sandbox if env missing
      to: formatNumber(phone)
    });

    return NextResponse.json({ success: true, sid: message.sid });

  } catch (error) {
    console.error("WhatsApp Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
