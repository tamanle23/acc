export function deterministicHashBytes(str: string): number[] {
  const bytes: number[] = [];
  let h1 = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h1 ^= str.charCodeAt(i);
    h1 = Math.imul(h1, 0x01000193);
  }
  for (let j = 0; j < 16; j++) {
    h1 ^= (j + 1) * 0x9e3779b9;
    bytes.push((h1 >>> ((j % 4) * 8)) & 0xff);
  }
  return bytes;
}
