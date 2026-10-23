const youtubeHosts = new Set([
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'music.youtube.com',
  'youtu.be',
  'www.youtu.be',
  'youtube-nocookie.com',
  'www.youtube-nocookie.com',
]);

export function isYouTubeUrl(value: string) {
  try {
    return youtubeHosts.has(new URL(value).hostname);
  } catch {
    return false;
  }
}

export function youtubeVideo(value: string) {
  try {
    const url = new URL(value);
    if (
      url.protocol !== 'https:' ||
      url.username ||
      url.password ||
      url.port ||
      !youtubeHosts.has(url.hostname)
    )
      return null;
    const parts = url.pathname.split('/').filter(Boolean);
    const id = url.hostname.endsWith('youtu.be')
      ? parts[0]
      : url.pathname === '/watch'
        ? url.searchParams.get('v')
        : ['embed', 'shorts', 'live', 'v'].includes(parts[0])
          ? parts[1]
          : null;
    if (!id || !/^[\w-]{11}$/.test(id)) return null;
    const embed = new URL(`https://www.youtube-nocookie.com/embed/${id}`);
    embed.searchParams.set('playsinline', '1');
    embed.searchParams.set('rel', '0');
    const timestamp =
      url.searchParams.get('start') ||
      url.searchParams.get('t') ||
      new URLSearchParams(url.hash.slice(1)).get('t') ||
      '';
    const match = /^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/.exec(timestamp);
    const seconds = /^\d+$/.test(timestamp)
      ? Number(timestamp)
      : match
        ? Number(match[1] || 0) * 3600 + Number(match[2] || 0) * 60 + Number(match[3] || 0)
        : 0;
    if (Number.isSafeInteger(seconds) && seconds > 0)
      embed.searchParams.set('start', String(seconds));
    return { id, embedUrl: embed.href, watchUrl: `https://www.youtube.com/watch?v=${id}` };
  } catch {
    return null;
  }
}
