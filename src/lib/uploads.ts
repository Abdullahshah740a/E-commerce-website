export const MAX_UPLOAD = 3 * 1024 * 1024;
export function detectMedia(
  bytes: Uint8Array,
): { mime: string; extension: string; type: 'image' | 'video' } | null {
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff)
    return { mime: 'image/jpeg', extension: 'jpg', type: 'image' };
  if ([137, 80, 78, 71, 13, 10, 26, 10].every((v, i) => bytes[i] === v))
    return { mime: 'image/png', extension: 'png', type: 'image' };
  const ascii = (start: number, end: number) => String.fromCharCode(...bytes.slice(start, end));
  if (ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP')
    return { mime: 'image/webp', extension: 'webp', type: 'image' };
  if (ascii(4, 8) === 'ftyp') return { mime: 'video/mp4', extension: 'mp4', type: 'video' };
  if ([0x1a, 0x45, 0xdf, 0xa3].every((v, i) => bytes[i] === v))
    return { mime: 'video/webm', extension: 'webm', type: 'video' };
  return null;
}
