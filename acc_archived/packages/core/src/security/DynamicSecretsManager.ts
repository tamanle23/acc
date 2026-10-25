/**
 * DynamicSecretsManager:
 * Zero-trust secrets resolver and log sanitization filter.
 * Resolves API keys, credentials, and tokens from environment variables or secure stores,
 * while automatically masking and redacting sensitive values from console outputs and error traces.
 */
export class DynamicSecretsManager {
  private static instance: DynamicSecretsManager;
  private knownSecrets: Set<string> = new Set();
  private secretPatterns: RegExp[] = [
    /bearer\s+[a-zA-Z0-9_\-\.]{15,}/gi,
    /key-[a-zA-Z0-9]{20,}/gi,
    /ghp_[a-zA-Z0-9]{20,}/gi,
    /sk-[a-zA-Z0-9]{20,}/gi,
    /password=["']?[^"'\s]{4,}["']?/gi,
  ];

  public static getInstance(): DynamicSecretsManager {
    if (!DynamicSecretsManager.instance) {
      DynamicSecretsManager.instance = new DynamicSecretsManager();
    }
    return DynamicSecretsManager.instance;
  }

  /**
   * Registers a secret key so that any appearance of its value in logs is redacted.
   */
  public registerSecret(value?: string): void {
    if (value && value.length >= 4) {
      this.knownSecrets.add(value.trim());
    }
  }

  /**
   * Resolves a secret dynamically from environment with fallback.
   */
  public getSecret(key: string, defaultValue?: string): string {
    const val = process.env[key] || defaultValue || '';
    if (val) {
      this.registerSecret(val);
    }
    return val;
  }

  /**
   * Sanitizes text strings by masking known secrets and matching token regexes.
   */
  public sanitize(text: string): string {
    if (!text || typeof text !== 'string') return text;

    let sanitized = text;

    // Redact registered dynamic secrets
    for (const secret of this.knownSecrets) {
      if (sanitized.includes(secret)) {
        sanitized = sanitized.replaceAll(secret, '***REDACTED***');
      }
    }

    // Redact standard security token patterns
    for (const pattern of this.secretPatterns) {
      sanitized = sanitized.replace(pattern, (match) => {
        if (match.toLowerCase().startsWith('bearer')) {
          return 'Bearer ***REDACTED***';
        }
        return '***REDACTED***';
      });
    }

    return sanitized;
  }
}
