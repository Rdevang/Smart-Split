# Phone Authentication Setup Guide

This guide walks through setting up phone (SMS) authentication for Smart Split using Supabase.

## Prerequisites

- Access to Smart Split's Supabase dashboard
- A Twilio account (or other supported SMS provider)

## Step 1: Set Up Twilio (SMS Provider)

Supabase uses Twilio as the default SMS provider for phone authentication.

### Create Twilio Account

1. Go to [Twilio](https://www.twilio.com/) and create an account
2. Verify your phone number during signup

### Get Twilio Credentials

1. Go to your Twilio Console Dashboard
2. Copy these values:
   - **Account SID** (starts with `AC...`)
   - **Auth Token** (hidden by default, click to reveal)

### Get a Twilio Phone Number

1. In Twilio Console, go to **Phone Numbers** → **Buy a Number**
2. Choose a number with SMS capabilities
3. Purchase the number (you get free credits on signup)
4. Copy the phone number (format: `+1234567890`)

## Step 2: Configure Supabase

1. Go to [Supabase Dashboard](https://supabase.com/dashboard)

2. Select your project (`cizakzarkdgieclbwljy`)

3. Go to **Authentication** → **Providers** → **Phone**

4. Toggle **"Enable Phone provider"** ON

5. Configure SMS settings:
   - **SMS Provider**: Twilio
   - **Twilio Account SID**: Paste from Twilio
   - **Twilio Auth Token**: Paste from Twilio
   - **Twilio Message Service SID** or **Twilio Phone Number**: Your Twilio number

6. Configure OTP settings:
   - **OTP Length**: 6 (recommended)
   - **OTP Expiry**: 60 seconds (or your preference)

7. Click **Save**

## Step 3: Configure Rate Limiting (Optional but Recommended)

1. In Supabase, go to **Authentication** → **Rate Limits**

2. Set appropriate limits:
   - **SMS OTP**: 3 per hour per phone number
   - **Verify OTP**: 10 per hour per phone number

## Step 4: Test Phone Authentication

1. Run the app locally:
   ```bash
   npm run dev
   ```

2. Go to http://localhost:3000/login

3. Click **"Sign in with Phone"**

4. Enter your phone number and click **Continue**

5. You should receive an SMS with a 6-digit code

6. Enter the code to complete sign-in

## Important Notes

### Phone Number Format

- Always use E.164 format: `+[country code][number]`
- Example: `+14155551234` for US, `+919876543210` for India

### Costs

- Twilio charges per SMS sent (typically $0.0075-$0.01 per SMS)
- Supabase includes phone auth in their pricing
- Consider rate limiting to control costs

### Testing

- Use Twilio's test credentials for development
- Or use your personal number for testing (free with Twilio credits)

## Troubleshooting

### "Phone provider is not enabled"
- Ensure Phone provider is toggled ON in Supabase
- Check that Twilio credentials are correct

### "SMS not received"
- Verify Twilio phone number has SMS capability
- Check Twilio logs for delivery status
- Ensure phone number format is correct (E.164)

### "Invalid OTP"
- OTP may have expired (default 60 seconds)
- User may have requested multiple OTPs (only latest is valid)

### "Rate limited"
- User has exceeded SMS rate limits
- Wait and try again later

## Alternative SMS Providers

Supabase also supports:
- **Vonage** (formerly Nexmo)
- **MessageBird**
- **Textlocal**

Configure these in the same Phone provider settings.

## Security Best Practices

1. **Enable rate limiting** to prevent SMS bombing
2. **Use short OTP expiry** (60 seconds recommended)
3. **Monitor Twilio usage** for unusual activity
4. **Set up Twilio alerts** for high SMS volume
5. **Never log OTP codes** in your application

## Production Checklist

- [ ] Twilio account verified for production
- [ ] Phone number purchased and configured
- [ ] Supabase Phone provider enabled
- [ ] Rate limits configured
- [ ] Tested with real phone numbers
- [ ] Twilio account upgraded (trial has limitations)

