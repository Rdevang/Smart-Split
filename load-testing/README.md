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

## Running Tests

### Web UI Mode (Recommended for Interactive Testing)

```bash
# Test Preview Environment
locust -f locustfile.py --host=https://smart-split-git-preview-rdevangs-projects.vercel.app

# Test Production (use carefully!)
locust -f locustfile.py --host=https://smart-split-one.vercel.app
```

Then open http://localhost:8089 in your browser.

### Headless Mode (For CI/CD)

```bash
# Quick test: 50 users, 10 users/sec spawn rate, 30 seconds
locust -f locustfile.py \
  --host=https://smart-split-git-preview-rdevangs-projects.vercel.app \
  --headless \
  -u 50 \
  -r 10 \
  --run-time 30s

# Medium test: 100 users, 20 users/sec, 2 minutes
locust -f locustfile.py \
  --host=https://smart-split-git-preview-rdevangs-projects.vercel.app \
  --headless \
  -u 100 \
  -r 20 \
  --run-time 2m

# Heavy test: 500 users, 50 users/sec, 5 minutes
locust -f locustfile.py \
  --host=https://smart-split-git-preview-rdevangs-projects.vercel.app \
  --headless \
  -u 500 \
  -r 50 \
  --run-time 5m
```

### Generate HTML Report

```bash
locust -f locustfile.py \
  --host=https://smart-split-git-preview-rdevangs-projects.vercel.app \
  --headless \
  -u 100 \
  -r 10 \
  --run-time 60s \
  --html=report.html
```

## Test Scenarios

| User Type | Weight | Description |
|-----------|--------|-------------|
| PublicUser | 3 | Anonymous users browsing public pages |
| SEOCrawler | 1 | Simulates search engine crawlers |
| APITester | 2 | Tests API endpoints |
| StaticAssetLoader | 1 | Tests static asset delivery |
| AggressiveLoadTester | 1 | High-frequency stress testing |

## Key Endpoints Tested

### Public Pages
- `/` - Landing page
- `/login` - Login page
- `/register` - Registration page
- `/feedback` - Feedback form
- `/forgot-password` - Password reset

### API Endpoints
- `/api/health` - Health check
- `/api/cache/health` - Redis cache status
- `/api/feedback` - Feedback submission (POST)

### SEO/Static
- `/sitemap.xml` - Sitemap
- `/robots.txt` - Robots file
- `/manifest.json` - PWA manifest
- `/favicon.svg` - Favicon

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
5. **Use Preview**: Always test on preview environment first!

## Troubleshooting

### Too Many 429 Errors
Rate limiting is working correctly. Reduce spawn rate or number of users.

### Connection Errors
Vercel may be throttling connections. Wait a few minutes and retry with fewer users.

### Slow Response Times
- Check Vercel function logs for errors
- Monitor Supabase connection pool
- Review Redis cache hit rates

## CI/CD Integration

Add to your GitHub Actions:

```yaml
- name: Load Test
  run: |
    pip install locust faker
    cd load-testing
    locust -f locustfile.py \
      --host=${{ secrets.PREVIEW_URL }} \
      --headless \
      -u 50 \
      -r 10 \
      --run-time 30s \
      --exit-code-on-error 1
```

