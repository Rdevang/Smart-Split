/**
 * Test Email Script
 * 
 * Usage: npx tsx scripts/test-email.ts <email>
 * Example: npx tsx scripts/test-email.ts your@email.com
 */

import { Resend } from "resend";
import * as dotenv from "dotenv";

// Load environment variables
dotenv.config({ path: ".env.local" });

const RESEND_API_KEY = process.env.RESEND_API_KEY;

if (!RESEND_API_KEY) {
    console.error("❌ RESEND_API_KEY not found in .env.local");
    process.exit(1);
}

const targetEmail = process.argv[2];

if (!targetEmail) {
    console.error("❌ Please provide an email address");
    console.log("Usage: npx tsx scripts/test-email.ts your@email.com");
    process.exit(1);
}

async function sendTestEmail() {
    const resend = new Resend(RESEND_API_KEY);

    console.log(`📧 Sending test email to: ${targetEmail}`);
    console.log(`📤 Using API key: ${RESEND_API_KEY?.slice(0, 10)}...`);

    try {
        const { data, error } = await resend.emails.send({
            from: "Smart Split <onboarding@resend.dev>", // Use Resend's test domain
            to: targetEmail,
            subject: "🧪 Smart Split - Test Email",
            html: `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f4f4f5; margin: 0; padding: 40px 20px;">
    <div style="max-width: 480px; margin: 0 auto; background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
        <div style="background: linear-gradient(135deg, #14b8a6 0%, #0d9488 100%); padding: 32px; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 24px;">🎉 Test Email Successful!</h1>
        </div>
        <div style="padding: 32px;">
            <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 16px;">
                If you're reading this, your email configuration is working correctly!
            </p>
            <div style="background: #dcfce7; border-radius: 12px; padding: 20px; text-align: center;">
                <p style="color: #166534; font-size: 16px; font-weight: 600; margin: 0;">
                    ✅ Resend API Connected
                </p>
            </div>
            <p style="color: #6b7280; font-size: 14px; line-height: 1.6; margin: 24px 0 0;">
                Sent at: ${new Date().toISOString()}
            </p>
        </div>
        <div style="background: #f9fafb; padding: 20px 32px; text-align: center;">
            <p style="color: #9ca3af; font-size: 12px; margin: 0;">
                Smart Split • Test Email
            </p>
        </div>
    </div>
</body>
</html>
            `.trim(),
        });

        if (error) {
            console.error("❌ Failed to send email:", error);
            process.exit(1);
        }

        console.log("✅ Email sent successfully!");
        console.log(`📨 Message ID: ${data?.id}`);
        console.log(`\n📬 Check your inbox at: ${targetEmail}`);

    } catch (err) {
        console.error("❌ Error:", err);
        process.exit(1);
    }
}

sendTestEmail();

