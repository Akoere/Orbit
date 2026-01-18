// lib/email.js

export async function sendNotification(toEmail, handle, platform, messageText) {
  const WEBHOOK_URL = process.env.MAKE_EMAIL_WEBHOOK; // Add this to .env.local

  if (!WEBHOOK_URL) {
    console.error("❌ Missing MAKE_EMAIL_WEBHOOK in .env.local");
    return { success: false, error: "Missing Webhook URL" };
  }

  try {
    const res = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: toEmail,
        subject: `Orbit Alert: Update from ${handle} (${platform})`,
        text: messageText,
        // We send clean data so Make can format it nicely
        handle: handle,
        platform: platform
      })
    });

    if (res.ok) {
      console.log(`✅ Webhook sent to Make.com for ${toEmail}`);
      return { success: true };
    } else {
      const err = await res.text();
      console.error(`❌ Make.com Error: ${err}`);
      return { success: false, error: err };
    }

  } catch (error) {
    console.error("❌ Email System Error:", error);
    return { success: false, error: error.message };
  }
}