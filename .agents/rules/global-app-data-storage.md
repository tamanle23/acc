# CLI Distribution Storage Rule

## 🚨 Mandatory Rule: Use Home Directory for Global Assets

To ensure the `visual-story-telling-generator` can be successfully compiled and distributed as a standalone binary (e.g., using `bun build --compile`), **you MUST NOT use `__dirname` or relative paths to store downloaded binaries, caches, global configuration, or heavy machine learning models.**

### Requirements:
1. **Global App Directory**: Any globally downloaded assets (like FFmpeg binaries, AI upscaler engines, or ML model `.bin` files) MUST be stored in the user's home directory.
2. **Directory Path**: Always resolve the app directory using `os.homedir()` under the namespace `.visual-storyteller`.
   - *Implementation*: `path.join(os.homedir(), '.visual-storyteller', ...)`
3. **Why?**:
   - Compiled binaries have restricted/ephemeral `__dirname` paths.
   - Prevents `EACCES` write permission errors when the tool is installed globally (e.g., in `/usr/local/bin` or `C:\Program Files`).
   - Ensures heavy files are downloaded only once globally across the operating system.

### Example (Correct):
```typescript
import os from 'os';
import path from 'path';

// ✅ CORRECT: Safe for standalone CLI distribution
const cacheDir = path.join(os.homedir(), '.visual-storyteller', 'cache');
```

### Example (Incorrect):
```typescript
import path from 'path';

// ❌ INCORRECT: Will break when compiled or globally installed
const cacheDir = path.join(__dirname, '..', 'cache');
```
