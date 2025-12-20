"""
Smart Split Load Testing with Locust
=====================================

Usage:
    # Install dependencies
    pip install -r requirements.txt

    # Run with web UI (recommended)
    locust -f locustfile.py --host=https://smart-split-git-preview-rdevangs-projects.vercel.app

    # Run headless (CI/CD)
    locust -f locustfile.py --host=https://smart-split-git-preview-rdevangs-projects.vercel.app \
           --headless -u 100 -r 10 --run-time 60s

    # Open http://localhost:8089 for the web UI
"""

import random
import string
import time
from locust import HttpUser, task, between, events
from faker import Faker

fake = Faker()


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


class APITester(HttpUser):
    """
    Tests API endpoints under load.
    """
    
    weight = 2
    wait_time = between(0.5, 2)
    
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
            # 200 = healthy, 503 = degraded (both are acceptable)
            if response.status_code in [200, 503]:
                response.success()
            else:
                response.failure(f"Cache health failed: {response.status_code}")
    
    @task(2)
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
            name="Submit Feedback"
        ) as response:
            if response.status_code == 200:
                response.success()
            elif response.status_code == 429:
                # Rate limited - expected behavior under load
                response.success()
            else:
                response.failure(f"Feedback submission failed: {response.status_code}")


class StaticAssetLoader(HttpUser):
    """
    Simulates loading static assets (JS, CSS, images).
    This helps test CDN and caching behavior.
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


class AggressiveLoadTester(HttpUser):
    """
    High-frequency requests to test rate limiting and server capacity.
    Use sparingly - this can trigger DDoS protection.
    """
    
    weight = 1
    wait_time = between(0.1, 0.3)  # Very fast requests
    
    @task(10)
    def rapid_landing_page(self):
        """Rapidly hit landing page"""
        self.client.get("/", name="Rapid Landing")
    
    @task(5)
    def rapid_api_health(self):
        """Rapidly hit health endpoint"""
        self.client.get("/api/health", name="Rapid Health")


# Event hooks for custom reporting
@events.request.add_listener
def on_request(request_type, name, response_time, response_length, exception, **kwargs):
    """Log slow requests"""
    if response_time > 2000:  # > 2 seconds
        print(f"⚠️ SLOW REQUEST: {name} took {response_time}ms")


@events.test_start.add_listener
def on_test_start(environment, **kwargs):
    """Called when test starts"""
    print("=" * 60)
    print("🚀 Smart Split Load Test Starting")
    print(f"   Target: {environment.host}")
    print("=" * 60)


@events.test_stop.add_listener
def on_test_stop(environment, **kwargs):
    """Called when test stops"""
    print("=" * 60)
    print("✅ Smart Split Load Test Complete")
    print("=" * 60)

