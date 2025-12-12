# GitHub OAuth Setup Guide

This guide walks through setting up GitHub OAuth for Smart Split.

## Prerequisites

- A GitHub account
- Access to Smart Split's Supabase dashboard

## Step 1: Create a GitHub OAuth App

1. Go to GitHub Settings → Developer settings → OAuth Apps
   - Direct link: https://github.com/settings/developers

2. Click "New OAuth App"

3. Fill in the application details:
   - **Application name**: `Smart Split` (or `Smart Split - Development` for local)
   - **Homepage URL**: 
     - Production: `https://smart-split-one.vercel.app`
     - Development: `http://localhost:3000`
   - **Authorization callback URL**: 
     - Production: `https://cizakzarkdgieclbwljy.supabase.co/auth/v1/callback`
     - Development: `https://cizakzarkdgieclbwljy.supabase.co/auth/v1/callback`
   - **Enable Device Flow**: Leave unchecked

4. Click "Register application"

5. On the next page:
   - Copy the **Client ID**
   - Click "Generate a new client secret" and copy the **Client Secret**

## Step 2: Configure Supabase

1. Go to your Supabase Dashboard: https://supabase.com/dashboard

2. Select the `cizakzarkdgieclbwljy` project

3. Navigate to **Authentication** → **Providers**

4. Find **GitHub** in the list and click to expand

5. Toggle "Enable GitHub provider" to ON

6. Enter your credentials:
   - **Client ID**: Paste from GitHub
   - **Client Secret**: Paste from GitHub

7. Click "Save"

## Step 3: Add Redirect URLs in Supabase

1. In Supabase, go to **Authentication** → **URL Configuration**

2. Add these to **Redirect URLs**:
   ```
   http://localhost:3000/auth/callback
   https://smart-split-one.vercel.app/auth/callback
   ```

3. Click "Save"

## Step 4: Verify Setup

1. Run the app locally:
   ```bash
   npm run dev
   ```

2. Go to http://localhost:3000/login

3. Click "GitHub" login button

4. You should be redirected to GitHub to authorize

5. After authorization, you should be redirected back to the dashboard

## Troubleshooting

### "The redirect_uri is not valid"
- Double-check the Authorization callback URL in GitHub matches exactly:
  `https://cizakzarkdgieclbwljy.supabase.co/auth/v1/callback`

### "OAuth error" after GitHub authorization
- Verify the Client ID and Client Secret are correct in Supabase
- Check that the GitHub app is not suspended

### Not redirecting back to the app
- Ensure `NEXT_PUBLIC_SITE_URL` is set correctly in Vercel
- For local development, it should redirect to localhost:3000

## Production Checklist

- [ ] GitHub OAuth App created with production URLs
- [ ] Client ID and Secret added to Supabase
- [ ] Redirect URLs configured in Supabase
- [ ] `NEXT_PUBLIC_SITE_URL` set in Vercel environment variables
- [ ] Tested login flow in production

## Security Notes

1. Never commit OAuth secrets to version control
2. Use separate OAuth apps for development and production
3. Regularly rotate client secrets
4. Monitor OAuth app usage in GitHub settings

