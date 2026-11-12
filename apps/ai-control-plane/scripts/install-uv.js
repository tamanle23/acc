const { execSync } = require("child_process");
const path = require("path");

const venvPy = process.platform === "win32"
  ? path.join(".venv", "Scripts", "python.exe")
  : path.join(".venv", "bin", "python");

function isUvInstalled() {
  try {
    execSync("uv --version", { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

if (isUvInstalled()) {
  console.log("uv is already installed.");
} else {
  const platform = process.platform;
  console.log(`Detected platform: ${platform}. Installing uv...`);

  try {
    if (platform === "win32") {
      execSync(
        'powershell -ExecutionPolicy ByPass -c "irm https://astral.sh | iex"',
        { stdio: "inherit" }
      );
    } else if (platform === "darwin" || platform === "linux") {
      execSync("curl -LsSf https://astral.sh | sh", {
        stdio: "inherit",
      });
    } else {
      console.error(
        `Unsupported platform: ${platform}. Please install uv manually: https://astral.sh`
      );
      process.exit(1);
    }

    console.log("uv installed successfully.");
  } catch (error) {
    console.error("Failed to install uv automatically:", error.message);
    process.exit(1);
  }
}

console.log("Setting up .venv using uv...");
execSync("uv venv --python 3.12 --allow-existing", { stdio: "inherit" });
execSync(`uv pip install --python "${venvPy}" -U pip build hatchling -e .`, { stdio: "inherit" });
