# Smart Split Load Testing

Load testing suite for Smart Split using [Locust](https://locust.io/).

## Setup

```bash
cd load-testing

# Create virtual environment (recommended)
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt
```

## Configuration for Authenticated Testing

### 1. Create Test Users in Supabase

Go to [Supabase Dashboard](https://supabase.com/dashboard/project/cizakzarkdgieclbwljy/auth/users) → Authentication → Users → **Add User**

Create these test users:
| Email | Password |
|-------|----------|
| loadtest1@smartsplit.test | LoadTest123! |
| loadtest2@smartsplit.test | LoadTest123! |
| loadtest3@smartsplit.test | LoadTest123! |

### 2. Configure Environment Variables

```bash
# Copy the example env file
cp .env.example .env

# Edit .env with your actual values
nano .env
```

Required variables:
```env
SUPABASE_URL=https://cizakzarkdgieclbwljy.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...  # Get from Supabase Dashboard

TEST_USER_EMAIL=loadtest1@smartsplit.test
TEST_USER_PASSWORD=LoadTest123!
```

Get your **SUPABASE_ANON_KEY** from: Supabase Dashboard → Settings → API → `anon` `public` key

## Running Tests

### Web UI Mode (Recommended for Interactive Testing)

```bash
# Test Production
locust -f locustfile.py --host=https://smart-split-one.vercel.app

# Test Preview Environment
locust -f locustfile.py --host=https://smart-split-git-preview-rdevangs-projects.vercel.app
```

Then open http://localhost:8089 in your browser.

### Headless Mode (For CI/CD)

```bash
# Quick test: 50 users, 10 users/sec spawn rate, 30 seconds
locust -f locustfile.py \
  --host=https://smart-split-one.vercel.app \
  --headless \
  -u 50 \
  -r 10 \
  --run-time 30s

# Medium test: 100 users, 20 users/sec, 2 minutes
locust -f locustfile.py \
  --host=https://smart-split-one.vercel.app \
  --headless \
  -u 100 \
  -r 20 \
  --run-time 2m

# Heavy test: 500 users, 50 users/sec, 5 minutes
locust -f locustfile.py \
  --host=https://smart-split-one.vercel.app \
  --headless \
  -u 500 \
  -r 50 \
  --run-time 5m
```

### Generate HTML Report

```bash
locust -f locustfile.py \
  --host=https://smart-split-one.vercel.app \
  --headless \
  -u 100 \
  -r 10 \
  --run-time 60s \
  --html=report.html
```

## Test Scenarios

### User Types

| User Type | Weight | Auth | Description |
|-----------|--------|------|-------------|
| PublicUser | 3 | ❌ | Anonymous users browsing public pages |
| AuthenticatedUser | 2 | ✅ | Logged-in users accessing dashboard, groups, etc. |
| APIUser | 2 | ✅ | Tests API endpoints with auth tokens |
| SEOCrawler | 1 | ❌ | Simulates search engine crawlers |
| StaticAssetLoader | 1 | ❌ | Tests static asset delivery |

### Endpoints Tested

#### Public Pages (No Auth)
- `/` - Landing page
- `/login` - Login page
- `/register` - Registration page
- `/feedback` - Feedback form
- `/forgot-password` - Password reset

#### Authenticated Pages
- `/dashboard` - Main dashboard
- `/groups` - Groups list
- `/expenses` - All expenses
- `/activity` - Activity feed
- `/settings/profile` - Profile settings
- `/feedback/history` - User's feedback history

#### API Endpoints
- `GET /api/health` - Health check
- `GET /api/cache/health` - Redis cache status
- `GET /api/feedback` - User's feedback (auth required)
- `POST /api/feedback` - Submit feedback

#### SEO/Static
- `/sitemap.xml` - Sitemap
- `/robots.txt` - Robots file
- `/manifest.json` - PWA manifest
- `/favicon.svg` - Favicon
- `/logo-icon.svg` - Logo

## Performance Targets

| Metric | Target | Critical |
|--------|--------|----------|
| Response Time (p50) | < 200ms | < 500ms |
| Response Time (p95) | < 500ms | < 2000ms |
| Response Time (p99) | < 1000ms | < 5000ms |
| Error Rate | < 0.1% | < 1% |
| Throughput | > 100 RPS | > 50 RPS |

## Tips

1. **Start Small**: Begin with 10-20 users and gradually increase
2. **Watch Rate Limits**: The app has rate limiting - some 429 errors are expected
3. **Monitor Vercel**: Check Vercel dashboard for function invocations and errors
4. **Check Supabase**: Monitor database connections in Supabase dashboard
5. **Token Expiration**: Supabase tokens expire after 1 hour - restart test for longer runs

## Troubleshooting

### Auth Failures
- Verify test users exist in Supabase Auth
- Check SUPABASE_ANON_KEY is correct
- Ensure passwords match

### Too Many 429 Errors
Rate limiting is working correctly. Reduce spawn rate or number of users.

### Connection Errors
Vercel may be throttling connections. Wait a few minutes and retry with fewer users.

### Slow Response Times
- Check Vercel function logs for errors
- Monitor Supabase connection pool
- Review Redis cache hit rates

### Preview Environment 401 Errors
Vercel preview deployments have authentication protection. Either:
1. Use production URL for load testing
2. Disable protection in Vercel Dashboard → Settings → Deployment Protection

## CI/CD Integration

Add to your GitHub Actions:

```yaml
- name: Load Test
  env:
    SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
    SUPABASE_ANON_KEY: ${{ secrets.SUPABASE_ANON_KEY }}
    TEST_USER_EMAIL: ${{ secrets.TEST_USER_EMAIL }}
    TEST_USER_PASSWORD: ${{ secrets.TEST_USER_PASSWORD }}
  run: |
    pip install locust faker python-dotenv requests
    cd load-testing
    locust -f locustfile.py \
      --host=${{ secrets.PREVIEW_URL }} \
      --headless \
      -u 50 \
      -r 10 \
      --run-time 30s \
      --exit-code-on-error 1
```
