import * as p from '@clack/prompts';

export * from '@clack/prompts';

export function handleCancel(value: any): void {
  if (p.isCancel(value)) {
    p.cancel('Operation cancelled.');
    process.exit(0);
  }
}

export async function askQuestion(message: string, placeholder = '', defaultValue = ''): Promise<string> {
  const result = await p.text({
    message,
    placeholder,
    defaultValue,
  });
  if (p.isCancel(result)) {
    p.cancel('Operation cancelled.');
    process.exit(0);
  }
  return (result as string).trim();
}

export async function askChoice(message: string, options: (string | { label: string; value: string; hint?: string })[]): Promise<string> {
  const formattedOptions = options.map((opt) => {
    if (typeof opt === 'string') {
      return { label: opt, value: opt };
    }
    return opt;
  });

  const result = await p.select({
    message,
    options: formattedOptions,
  });

  if (p.isCancel(result)) {
    p.cancel('Operation cancelled.');
    process.exit(0);
  }

  return result as string;
}

export async function askYesNo(message: string, defaultYes = true): Promise<boolean> {
  const result = await p.confirm({
    message,
    initialValue: defaultYes,
  });

  if (p.isCancel(result)) {
    p.cancel('Operation cancelled.');
    process.exit(0);
  }

  return Boolean(result);
}

export function closeInteractiveConsole(): void {
  // No-op for clack compatibility
}
