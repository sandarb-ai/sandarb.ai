#!/bin/sh
# Start Sandarb server and seed demo data when DATABASE_URL is set.
# Demo data is visible only after login (dashboard, agents, contexts, etc.).

set -e
PORT="${PORT:-3000}"

# Start the server in the background
node server.js &
PID=$!

# Wait for the app to be ready (health check)
wait_for_health() {
  for i in 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15 16 17 18 19 20; do
    if node -e "
      require('http').get('http://127.0.0.1:${PORT}/api/health', (r) => {
        r.resume();
        process.exit(r.statusCode === 200 ? 0 : 1);
      }).on('error', () => process.exit(1));
    " 2>/dev/null; then
      return 0
    fi
    sleep 1
  done
  return 1
}

if wait_for_health; then
  # When DATABASE_URL is set, seed demo data (idempotent; safe to run every start)
  if [ -n "$DATABASE_URL" ]; then
    node -e "
      const http = require('http');
      const port = process.env.PORT || 3000;
      const req = http.request({
        hostname: '127.0.0.1',
        port,
        path: '/api/seed',
        method: 'POST'
      }, (res) => {
        res.resume();
        if (res.statusCode === 200) process.stdout.write('Seeded demo data (visible after login).\n');
      });
      req.on('error', () => {});
      req.end();
    " 2>/dev/null || true
  fi
fi

# Keep container running: wait for the server process
wait $PID
