import {
  intro,
  outro,
  select,
  text,
  confirm,
  spinner,
  note,
  cancel,
  isCancel,
  log,
} from '@clack/prompts';
import { fileExists } from '@acc/core';

/**
 * Asserts that a Clack prompt result was not cancelled by the user.
 * If cancelled, prints a standard cancellation message and terminates cleanly.
 */
export function guardCancel<T>(val: T | symbol, cancelMessage = 'Operation cancelled.'): asserts val is T {
  if (isCancel(val)) {
    cancel(cancelMessage);
    process.exit(0);
  }
}

/**
 * Interactive select prompt with strong return typing and automatic cancel guard.
 */
export async function promptSelect<T extends string>(params: {
  message: string;
  options: Array<{ label: string; value: T; hint?: string }>;
  initialValue?: T;
}): Promise<T> {
  const result = await select({
    message: params.message,
    options: params.options,
    initialValue: params.initialValue,
  });
  guardCancel(result);
  return result as T;
}

/**
 * Interactive text input prompt with automatic trim and cancel guard.
 */
export async function promptText(params: {
  message: string;
  placeholder?: string;
  defaultValue?: string;
  validate?: (value: string) => string | Error | Promise<string | Error | undefined> | undefined;
}): Promise<string> {
  const result = await text({
    message: params.message,
    placeholder: params.placeholder,
    defaultValue: params.defaultValue,
    validate: params.validate,
  });
  guardCancel(result);
  const trimmed = result.trim();
  return trimmed.length > 0 ? trimmed : (params.defaultValue ?? '');
}

/**
 * Interactive file/directory path prompt with optional existence validation.
 */
export async function promptPath(params: {
  message: string;
  placeholder?: string;
  defaultPath?: string;
  mustExist?: boolean;
}): Promise<string> {
  return promptText({
    message: params.message,
    placeholder: params.placeholder,
    defaultValue: params.defaultPath,
    validate: async (val) => {
      const target = (val || '').trim() || (params.defaultPath ?? '');
      if (!target) {
        return 'Path cannot be empty.';
      }
      if (params.mustExist !== false) {
        const exists = await fileExists(target);
        if (!exists) {
          return `Target path does not exist: ${target}`;
        }
      }
      return undefined;
    },
  });
}

/**
 * Interactive numeric input prompt with default fallback and boundary bounds.
 */
export async function promptNumber(params: {
  message: string;
  defaultValue: number;
  min?: number;
  max?: number;
}): Promise<number> {
  const str = await promptText({
    message: params.message,
    placeholder: params.defaultValue.toString(),
    defaultValue: params.defaultValue.toString(),
    validate: (val) => {
      const candidate = (val || '').trim() || params.defaultValue.toString();
      const parsed = parseFloat(candidate);
      if (isNaN(parsed)) {
        return 'Please enter a valid number.';
      }
      if (params.min !== undefined && parsed < params.min) {
        return `Number must be at least ${params.min}.`;
      }
      if (params.max !== undefined && parsed > params.max) {
        return `Number cannot exceed ${params.max}.`;
      }
      return undefined;
    },
  });
  const parsed = parseFloat(str);
  return isNaN(parsed) ? params.defaultValue : parsed;
}

/**
 * Interactive boolean confirmation prompt with cancel guard.
 */
export async function promptConfirm(params: {
  message: string;
  initialValue?: boolean;
}): Promise<boolean> {
  const result = await confirm({
    message: params.message,
    initialValue: params.initialValue ?? true,
  });
  guardCancel(result);
  return Boolean(result);
}

export {
  intro,
  outro,
  select,
  text,
  confirm,
  spinner,
  note,
  cancel,
  isCancel,
  log,
};
