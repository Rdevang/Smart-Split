"""
Smart Split Load Testing with Locust
=====================================

Usage:
    # Install dependencies
    pip install -r requirements.txt

    # Run with web UI (recommended)
    locust -f locustfile.py --host=https://smart-split-one.vercel.app

    # Run headless (CI/CD)
    locust -f locustfile.py --host=https://smart-split-one.vercel.app \
           --headless -u 100 -r 10 --run-time 60s

    # Open http://localhost:8089 for the web UI

Environment Variables (for authenticated testing):
    SUPABASE_URL=https://cizakzarkdgieclbwljy.supabase.co
    SUPABASE_ANON_KEY=your_anon_key
    TEST_USER_EMAIL=loadtest@example.com
    TEST_USER_PASSWORD=your_password
"""

import os
import random
import time
import json
from locust import HttpUser, task, between, events
from faker import Faker
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

fake = Faker()

# Supabase configuration
SUPABASE_URL = os.getenv("SUPABASE_URL", "https://cizakzarkdgieclbwljy.supabase.co")
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY", "")

# Test user credentials (create these in Supabase)
TEST_USERS = [
    {
        "email": os.getenv("TEST_USER_EMAIL", "loadtest1@smartsplit.test"),
        "password": os.getenv("TEST_USER_PASSWORD", "LoadTest123!"),
    },
    {
        "email": os.getenv("TEST_USER_EMAIL_2", "loadtest2@smartsplit.test"),
        "password": os.getenv("TEST_USER_PASSWORD_2", "LoadTest123!"),
    },
    {
        "email": os.getenv("TEST_USER_EMAIL_3", "loadtest3@smartsplit.test"),
        "password": os.getenv("TEST_USER_PASSWORD_3", "LoadTest123!"),
    },
]


def get_supabase_token(email: str, password: str) -> dict | None:
    """
    Authenticate with Supabase and get access token.
    Returns dict with access_token and user info, or None if failed.
    """
    import requests
    
    if not SUPABASE_ANON_KEY:
        print("⚠️ SUPABASE_ANON_KEY not set - authenticated tests will be skipped")
        return None
    
    try:
        response = requests.post(
            f"{SUPABASE_URL}/auth/v1/token?grant_type=password",
            headers={
                "apikey": SUPABASE_ANON_KEY,
                "Content-Type": "application/json",
            },
            json={
                "email": email,
                "password": password,
            },
            timeout=10,
        )
        
        if response.status_code == 200:
            data = response.json()
            return {
                "access_token": data.get("access_token"),
                "user_id": data.get("user", {}).get("id"),
                "email": email,
            }
        else:
            print(f"❌ Auth failed for {email}: {response.status_code} - {response.text}")
            return None
    except Exception as e:
        print(f"❌ Auth error for {email}: {e}")
        return None


class PublicUser(HttpUser):
    """
    Simulates anonymous users browsing public pages.
    These users don't authenticate and only access public endpoints.
    """
    
    weight = 3  # 3x more likely than authenticated users
    wait_time = between(1, 5)  # Wait 1-5 seconds between tasks
    
    @task(10)
    def view_landing_page(self):
        """Most common action - view the landing page"""
        with self.client.get("/", catch_response=True, name="Landing Page") as response:
            if response.status_code == 200:
                response.success()
            else:
                response.failure(f"Status code: {response.status_code}")
    
    @task(5)
    def view_login_page(self):
        """View the login page"""
        with self.client.get("/login", catch_response=True, name="Login Page") as response:
            if response.status_code == 200:
                response.success()
            else:
                response.failure(f"Status code: {response.status_code}")
    
    @task(5)
    def view_register_page(self):
        """View the registration page"""
        with self.client.get("/register", catch_response=True, name="Register Page") as response:
            if response.status_code == 200:
                response.success()
            else:
                response.failure(f"Status code: {response.status_code}")
    
    @task(3)
    def view_feedback_page(self):
        """View the public feedback page"""
        with self.client.get("/feedback", catch_response=True, name="Feedback Page") as response:
            if response.status_code == 200:
                response.success()
            else:
                response.failure(f"Status code: {response.status_code}")
    
    @task(2)
    def view_forgot_password(self):
        """View forgot password page"""
        with self.client.get("/forgot-password", catch_response=True, name="Forgot Password") as response:
            if response.status_code == 200:
                response.success()
            else:
                response.failure(f"Status code: {response.status_code}")


class AuthenticatedUser(HttpUser):
    """
    Simulates authenticated users performing typical app actions.
    Logs in at start and uses token for all requests.
    """
    
    weight = 2
    wait_time = between(2, 8)
    
    access_token: str | None = None
    user_id: str | None = None
    auth_headers: dict = {}
    
    def on_start(self):
        """Called when a user starts - authenticate with Supabase"""
        # Pick a random test user
        test_user = random.choice(TEST_USERS)
        
        auth_data = get_supabase_token(test_user["email"], test_user["password"])
        
        if auth_data:
            self.access_token = auth_data["access_token"]
            self.user_id = auth_data["user_id"]
            self.auth_headers = {
                "Authorization": f"Bearer {self.access_token}",
                "apikey": SUPABASE_ANON_KEY,
            }
            print(f"✅ Authenticated as {test_user['email']}")
        else:
            print(f"⚠️ Running without auth - some tests will be skipped")
    
    def _auth_get(self, path: str, name: str):
        """Helper for authenticated GET requests"""
        if not self.access_token:
            return
        
        # Set auth cookie for Next.js
        cookies = {
            "sb-cizakzarkdgieclbwljy-auth-token": json.dumps({
                "access_token": self.access_token,
                "token_type": "bearer",
            })
        }
        
        with self.client.get(
            path,
            cookies=cookies,
            catch_response=True,
            name=name
        ) as response:
            if response.status_code == 200:
                response.success()
            elif response.status_code == 401:
                response.failure("Unauthorized - token may be expired")
            elif response.status_code == 307 or response.status_code == 302:
                # Redirect to login - auth failed
                response.failure("Redirected to login")
            else:
                response.failure(f"Status: {response.status_code}")
    
    @task(10)
    def view_dashboard(self):
        """View the main dashboard"""
        self._auth_get("/dashboard", "Dashboard")
    
    @task(8)
    def view_groups_list(self):
        """View groups list"""
        self._auth_get("/groups", "Groups List")
    
    @task(6)
    def view_expenses_list(self):
        """View all expenses"""
        self._auth_get("/expenses", "Expenses List")
    
    @task(4)
    def view_activity_feed(self):
        """View activity feed"""
        self._auth_get("/activity", "Activity Feed")
    
    @task(3)
    def view_settings(self):
        """View profile settings"""
        self._auth_get("/settings/profile", "Profile Settings")
    
    @task(2)
    def view_feedback_history(self):
        """View user's feedback history"""
        self._auth_get("/feedback/history", "Feedback History")


class APIUser(HttpUser):
    """
    Tests API endpoints with authentication.
    """
    
    weight = 2
    wait_time = between(1, 3)
    
    access_token: str | None = None
    user_id: str | None = None
    
    def on_start(self):
        """Authenticate on start"""
        test_user = random.choice(TEST_USERS)
        auth_data = get_supabase_token(test_user["email"], test_user["password"])
        
        if auth_data:
            self.access_token = auth_data["access_token"]
            self.user_id = auth_data["user_id"]
    
    def _api_headers(self):
        """Get headers for API requests"""
        headers = {"Content-Type": "application/json"}
        if self.access_token:
            headers["Authorization"] = f"Bearer {self.access_token}"
        return headers
    
    @task(5)
    def health_check(self):
        """Check API health endpoint"""
        with self.client.get("/api/health", catch_response=True, name="API Health") as response:
            if response.status_code == 200:
                response.success()
            else:
                response.failure(f"Health check failed: {response.status_code}")
    
    @task(3)
    def cache_health(self):
        """Check cache health"""
        with self.client.get("/api/cache/health", catch_response=True, name="Cache Health") as response:
            if response.status_code in [200, 503]:
                response.success()
            else:
                response.failure(f"Cache health failed: {response.status_code}")
    
    @task(2)
    def get_user_feedback(self):
        """Get user's feedback (authenticated)"""
        if not self.access_token:
            return
        
        cookies = {
            "sb-cizakzarkdgieclbwljy-auth-token": json.dumps({
                "access_token": self.access_token,
                "token_type": "bearer",
            })
        }
        
        with self.client.get(
            "/api/feedback",
            cookies=cookies,
            catch_response=True,
            name="Get Feedback API"
        ) as response:
            if response.status_code == 200:
                response.success()
            elif response.status_code == 401:
                response.failure("Unauthorized")
            else:
                response.failure(f"Failed: {response.status_code}")
    
    @task(1)
    def submit_feedback(self):
        """Submit feedback (rate limited endpoint)"""
        feedback_data = {
            "type": random.choice(["suggestion", "feature_request", "bug_report", "other"]),
            "title": fake.sentence(nb_words=6),
            "description": fake.paragraph(nb_sentences=3),
            "email": fake.email(),
            "name": fake.name(),
        }
        
        with self.client.post(
            "/api/feedback",
            json=feedback_data,
            catch_response=True,
            name="Submit Feedback API"
        ) as response:
            if response.status_code == 200:
                response.success()
            elif response.status_code == 429:
                response.success()  # Rate limited is expected
            else:
                response.failure(f"Failed: {response.status_code}")


class SEOCrawler(HttpUser):
    """
    Simulates search engine crawlers accessing SEO endpoints.
    """
    
    weight = 1
    wait_time = between(2, 10)
    
    @task(5)
    def fetch_sitemap(self):
        """Fetch sitemap.xml"""
        with self.client.get("/sitemap.xml", catch_response=True, name="Sitemap") as response:
            if response.status_code == 200 and "urlset" in response.text:
                response.success()
            else:
                response.failure(f"Invalid sitemap: {response.status_code}")
    
    @task(5)
    def fetch_robots(self):
        """Fetch robots.txt"""
        with self.client.get("/robots.txt", catch_response=True, name="Robots.txt") as response:
            if response.status_code == 200:
                response.success()
            else:
                response.failure(f"Status code: {response.status_code}")
    
    @task(2)
    def fetch_manifest(self):
        """Fetch manifest.json for PWA"""
        with self.client.get("/manifest.json", catch_response=True, name="Manifest") as response:
            if response.status_code == 200:
                response.success()
            else:
                response.failure(f"Status code: {response.status_code}")


class StaticAssetLoader(HttpUser):
    """
    Simulates loading static assets (JS, CSS, images).
    """
    
    weight = 1
    wait_time = between(0.1, 0.5)
    
    @task(5)
    def load_favicon(self):
        """Load favicon"""
        with self.client.get("/favicon.svg", catch_response=True, name="Favicon") as response:
            if response.status_code == 200:
                response.success()
            else:
                response.failure(f"Status code: {response.status_code}")
    
    @task(3)
    def load_logo(self):
        """Load logo"""
        with self.client.get("/logo-icon.svg", catch_response=True, name="Logo") as response:
            if response.status_code == 200:
                response.success()
            else:
                response.failure(f"Status code: {response.status_code}")


# Event hooks for custom reporting
@events.request.add_listener
def on_request(request_type, name, response_time, response_length, exception, **kwargs):
    """Log slow requests"""
    if response_time > 2000:  # > 2 seconds
        print(f"⚠️ SLOW REQUEST: {name} took {response_time:.0f}ms")


@events.test_start.add_listener
def on_test_start(environment, **kwargs):
    """Called when test starts"""
    print("=" * 60)
    print("🚀 Smart Split Load Test Starting")
    print(f"   Target: {environment.host}")
    print(f"   Supabase: {SUPABASE_URL}")
    print(f"   Auth configured: {'Yes' if SUPABASE_ANON_KEY else 'No'}")
    print("=" * 60)


@events.test_stop.add_listener
def on_test_stop(environment, **kwargs):
    """Called when test stops"""
    print("=" * 60)
    print("✅ Smart Split Load Test Complete")
    print("=" * 60)
