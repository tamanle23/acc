# Cross-Platform & Backward Compatibility Rule

## 🚨 Mandatory Rule: Cross-Platform & Backward Compatibility

Whenever designing an implementation plan, suggesting a solution, or writing code, you **MUST** ensure the following:

1. **Cross-Platform Compatibility**:
   - All code, scripts, and libraries must work seamlessly across Windows, Linux, and macOS.
   - When downloading or invoking external binaries (e.g., FFmpeg, AI models, upscalers like `realesrgan-ncnn-vulkan`), dynamically check `process.platform` (e.g., `win32`, `linux`, `darwin`).
   - Download the correct binary variant for the user's OS and architecture.
   - Handle OS-specific file extensions (e.g., appending `.exe` only on Windows).
   - Ensure execution permissions are correctly set on Unix systems (e.g., `chmod +x`).
   - Never hardcode OS-specific paths. Always use Node's `path` module.

2. **Backward Compatibility**:
   - Any new configurations, settings, or CLI flags MUST be optional and provide safe fallbacks.
   - Old projects or configuration files must continue to compile and render without errors when processed by the updated codebase.
