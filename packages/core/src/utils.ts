import fs from 'fs';

export class Utils {

  public static getFileChecksum(filePath: string): string {
    try {
      const fileBuffer = fs.readFileSync(filePath);
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
