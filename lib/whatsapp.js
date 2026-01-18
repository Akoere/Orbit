import twilio from 'twilio';

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const client = twilio(accountSid, authToken);
const fromData = process.env.TWILIO_PHONE_NUMBER; 

export async function sendWhatsAppNotification(to, handle, platform) {
    try {
        const formatNumber = (num) => num.startsWith('whatsapp:') ? num : `whatsapp:${num}`;
        
        await client.messages.create({
            body: `🚀 Orbit Alert: ${handle} just posted on ${platform}! Check it out.`,
            from: formatNumber(fromData || '+14155238886'),
            to: formatNumber(to)
        });
        console.log(`WhatsApp sent to ${to}`);
        return true;
    } catch (error) {
        console.error("WhatsApp Failed:", error);
        return false;
    }
}
