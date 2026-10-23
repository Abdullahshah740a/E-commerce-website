'use client';
import { useState } from 'react';
import { youtubeVideo } from '@/lib/product-video';

export function ProductVideo({ url, title }: { url: string; title: string }) {
  const youtube = youtubeVideo(url);
  const [failed, setFailed] = useState(false);
  return (
    <div className="product-video">
      {youtube ? (
        <>
          <iframe
            src={youtube.embedUrl}
            title={title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            referrerPolicy="strict-origin-when-cross-origin"
            allowFullScreen
          />
          <a
            href={youtube.watchUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="video-fallback"
          >
            Watch on YouTube ↗
          </a>
        </>
      ) : failed ? (
        <p role="status">
          This video could not be loaded.{' '}
          <a href={url} target="_blank" rel="noopener noreferrer">
            Open video ↗
          </a>
        </p>
      ) : (
        <video
          src={url}
          controls
          playsInline
          preload="metadata"
          aria-label={title}
          onError={() => setFailed(true)}
        />
      )}
    </div>
  );
}
