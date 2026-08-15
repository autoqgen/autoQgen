# Integration tests

These tests exercise the real services against a real MongoDB.

They are skipped automatically unless a database is available, because
`mongodb-memory-server` downloads a MongoDB binary on first run and that is not
always possible (offline CI, restricted networks).

Run them one of two ways:

```bash
# Against a MongoDB you already have running
MONGODB_URI=mongodb://127.0.0.1:27017/autoqgen-test npm run test:integration

# Or let mongodb-memory-server provision one (needs network on first run)
USE_MEMORY_MONGO=true npm run test:integration
```
