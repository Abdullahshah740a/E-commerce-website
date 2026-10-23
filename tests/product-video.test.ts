import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { youtubeVideo } from '@/lib/product-video';
import { ProductVideo } from '@/components/product-video';

describe('product videos', () => {
  const id = 'M7lc1UVf-VE';
  it.each([
    `https://www.youtube.com/watch?v=${id}&list=ignored`,
    `https://youtu.be/${id}?si=share`,
    `https://m.youtube.com/watch?v=${id}`,
    `https://youtube.com/shorts/${id}`,
    `https://youtube.com/live/${id}`,
    `https://www.youtube-nocookie.com/embed/${id}`,
  ])('recognizes a YouTube video URL: %s', (url) => {
    expect(youtubeVideo(url)?.id).toBe(id);
    expect(youtubeVideo(url)?.embedUrl).toBe(
      `https://www.youtube-nocookie.com/embed/${id}?playsinline=1&rel=0`,
    );
  });
  it.each([
    'https://youtube.com/playlist?list=abc',
    'https://youtube.com/@channel',
    'https://youtube.com/watch?v=invalid',
    `https://youtube.com.evil.test/watch?v=${id}`,
    `https://evil.test/embed/${id}`,
    `http://youtube.com/watch?v=${id}`,
    `https://user:secret@youtube.com/watch?v=${id}`,
    'javascript:alert(1)',
  ])('does not embed unsupported or spoofed URLs: %s', (url) => {
    expect(youtubeVideo(url)).toBeNull();
  });
  it('retains share-link start times without forwarding arbitrary player options', () => {
    const video = youtubeVideo(`https://youtu.be/${id}?t=1m30s&autoplay=1`);
    expect(video?.embedUrl).toContain('start=90');
    expect(video?.embedUrl).not.toContain('autoplay');
  });
  it('renders a YouTube iframe with referrer/fullscreen support, rather than a native file player', () => {
    const html = renderToStaticMarkup(
      createElement(ProductVideo, { url: `https://youtu.be/${id}`, title: 'Product video' }),
    );
    expect(html).toContain('<iframe');
    expect(html).toContain('referrerPolicy="strict-origin-when-cross-origin"');
    expect(html).toContain('allowFullScreen');
    expect(html).toContain('Watch on YouTube');
    expect(html).not.toContain('<video');
  });
  it('keeps uploaded/direct videos playable with native controls', () => {
    const html = renderToStaticMarkup(
      createElement(ProductVideo, {
        url: 'https://cdn.example.com/product.webm?token=sample',
        title: 'Product video',
      }),
    );
    expect(html).toContain('<video');
    expect(html).toContain('controls');
    expect(html).not.toContain('<iframe');
  });
});
