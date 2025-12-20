#!/usr/bin/env python3
"""
Setup script to create test users in Supabase for load testing.

Usage:
    1. Set your SUPABASE_URL and SUPABASE_SERVICE_KEY in environment
    2. Run: python setup_test_users.py

Note: This requires the SERVICE_ROLE key (not the anon key) to create users.
Get it from: Supabase Dashboard → Settings → API → service_role key
"""

import os
import requests
from dotenv import load_dotenv

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL", "https://cizakzarkdgieclbwljy.supabase.co")
# Use SERVICE_ROLE key for admin operations (creating users)
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY", "")

TEST_USERS = [
    {"email": "loadtest1@smartsplit.test", "password": "LoadTest123!", "name": "Load Test User 1"},
    {"email": "loadtest2@smartsplit.test", "password": "LoadTest123!", "name": "Load Test User 2"},
    {"email": "loadtest3@smartsplit.test", "password": "LoadTest123!", "name": "Load Test User 3"},
]


def create_user(email: str, password: str, name: str) -> bool:
    """Create a user via Supabase Admin API"""
    
    if not SUPABASE_SERVICE_KEY:
        print("❌ SUPABASE_SERVICE_KEY not set!")
        print("   Get it from: Supabase Dashboard → Settings → API → service_role key")
        return False
    
    try:
        # Create user via Admin API
        response = requests.post(
            f"{SUPABASE_URL}/auth/v1/admin/users",
            headers={
                "apikey": SUPABASE_SERVICE_KEY,
                "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
                "Content-Type": "application/json",
            },
            json={
                "email": email,
                "password": password,
                "email_confirm": True,  # Auto-confirm email
                "user_metadata": {
                    "full_name": name,
                },
            },
            timeout=10,
        )
        
        if response.status_code == 200 or response.status_code == 201:
            print(f"✅ Created user: {email}")
            return True
        elif response.status_code == 422:
            # User already exists
            print(f"⚠️ User already exists: {email}")
            return True
        else:
            print(f"❌ Failed to create {email}: {response.status_code}")
            print(f"   Response: {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ Error creating {email}: {e}")
        return False


def main():
    print("=" * 50)
    print("🔧 Smart Split Load Test User Setup")
    print("=" * 50)
    print()
    
    if not SUPABASE_SERVICE_KEY:
        print("❌ SUPABASE_SERVICE_KEY environment variable not set!")
        print()
        print("To set it:")
        print("  export SUPABASE_SERVICE_KEY='your_service_role_key'")
        print()
        print("Get the key from:")
        print("  Supabase Dashboard → Settings → API → service_role (secret)")
        print()
        return
    
    print(f"Supabase URL: {SUPABASE_URL}")
    print()
    
    success_count = 0
    for user in TEST_USERS:
        if create_user(user["email"], user["password"], user["name"]):
            success_count += 1
    
    print()
    print("=" * 50)
    print(f"✅ Setup complete: {success_count}/{len(TEST_USERS)} users ready")
    print("=" * 50)
    print()
    print("Next steps:")
    print("1. Copy env.example to .env")
    print("2. Add your SUPABASE_ANON_KEY to .env")
    print("3. Run: locust -f locustfile.py --host=https://smart-split-one.vercel.app")


if __name__ == "__main__":
    main()

