import fs from 'fs';

export async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.promises.access(filePath, fs.constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

export class Utils {

  public static async getFileChecksum(filePath: string): Promise<string> {
    try {
      const fileBuffer = await fs.promises.readFile(filePath);
      const crypto = require('crypto');
      const hashSum = crypto.createHash('md5');
      hashSum.update(fileBuffer);
      return hashSum.digest('hex').substring(0, 8);
    } catch (e) {
      return Date.now().toString();
    }
  }
  public static getChecksum(content: string): string {
    try {
      const crypto = require('crypto');
      const hashSum = crypto.createHash('md5');
      hashSum.update(content);
      return hashSum.digest('hex').substring(0, 8);
    } catch (e) {
      return Date.now().toString();
    }
  }
}
