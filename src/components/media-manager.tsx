'use client';
import Image from 'next/image';
import { useState } from 'react';
import { adminAction } from './admin-common';
import type { Media } from '@/lib/types';
import { ProductVideo } from './product-video';
export function MediaManager({
  productId,
  initialMedia,
}: {
  productId: string;
  initialMedia: Media[];
}) {
  const [media, setMedia] = useState([...initialMedia].sort((a, b) => a.position - b.position));
  const [progress, setProgress] = useState<number | null>(null);
  const [message, setMessage] = useState('');
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  async function upload(files: FileList | null) {
    if (!files) return;
    setBusy(true);
    setMessage('');
    try {
      for (const file of Array.from(files)) {
        if (file.size > 3 * 1024 * 1024)
          throw new Error(`${file.name} exceeds 3 MB. Compress it or use a hosted video URL.`);
        const data = new FormData();
        data.append('product_id', productId);
        data.append('file', file);
        const result = await new Promise<Media>((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.open('POST', '/api/admin/upload');
          xhr.timeout = 120000;
          xhr.ontimeout = () =>
            reject(
              new Error(
                'Upload timed out. Refresh to check whether the file was saved before retrying.',
              ),
            );
          xhr.upload.onprogress = (e) =>
            setProgress(e.lengthComputable ? Math.round((e.loaded / e.total) * 100) : 0);
          xhr.onload = () => {
            try {
              const r = JSON.parse(xhr.responseText);
              if (xhr.status >= 200 && xhr.status < 300) resolve(r.media);
              else reject(new Error(r.error || 'Upload failed.'));
            } catch {
              reject(new Error('Upload failed. Please try a smaller file.'));
            }
          };
          xhr.onerror = () => reject(new Error('Upload interrupted. Please try again.'));
          xhr.send(data);
        });
        setMedia((m) => [...m, result]);
      }
      setMessage('Media uploaded and saved.');
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Upload failed.');
    }
    setProgress(null);
    setBusy(false);
  }
  async function reorder(next: Media[], primary: string | null) {
    setBusy(true);
    try {
      await adminAction('media-order', {
        product_id: productId,
        ids: next.map((m) => m.id),
        primary,
      });
      setMedia(next.map((m, i) => ({ ...m, position: i, is_primary: m.id === primary })));
      setMessage('Media order saved.');
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Unable to reorder media.');
    }
    setBusy(false);
  }
  return (
    <section className="section">
      <h2>Images & videos (optional)</h2>
      <p>
        Add photos, videos, or both so customers can inspect the product before buying. You can also
        save a product without media. Uploaded media appears in its public product gallery when the
        product is active.
      </p>
      <p>
        JPEG, PNG, WebP, MP4 or WebM. Up to 3 MB per file to stay within server upload limits. For
        longer videos, use a YouTube link or an HTTPS URL to an MP4/WebM video. YouTube videos must
        allow embedding. Product media is public.
      </p>
      <label>
        Upload images or video
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp,video/mp4,video/webm"
          multiple
          disabled={busy}
          onChange={(e) => {
            void upload(e.target.files);
            e.target.value = '';
          }}
        />
      </label>
      {progress !== null && (
        <label>
          Upload progress: {progress}%<progress max={100} value={progress} />
        </label>
      )}
      <div className="media-grid">
        {media.map((m, i) => (
          <div key={m.id} className="media-card">
            {m.type === 'image' ? (
              <Image
                src={m.url}
                width={200}
                height={160}
                alt={`Product image ${i + 1}`}
                unoptimized
              />
            ) : (
              <ProductVideo url={m.url} title={`Product video ${i + 1}`} />
            )}
            <div className="row">
              {m.type === 'image' && (
                <button className="text-link" disabled={busy} onClick={() => reorder(media, m.id)}>
                  {m.is_primary ? '★ Primary' : 'Set primary'}
                </button>
              )}
              <button
                aria-label="Move media earlier"
                className="icon-button"
                disabled={busy || i === 0}
                onClick={() => {
                  const next = [...media];
                  [next[i - 1], next[i]] = [next[i], next[i - 1]];
                  void reorder(next, media.find((m) => m.is_primary)?.id ?? null);
                }}
              >
                ←
              </button>
              <button
                aria-label="Move media later"
                className="icon-button"
                disabled={busy || i === media.length - 1}
                onClick={() => {
                  const next = [...media];
                  [next[i + 1], next[i]] = [next[i], next[i + 1]];
                  void reorder(next, media.find((m) => m.is_primary)?.id ?? null);
                }}
              >
                →
              </button>
              <button
                className="text-link"
                disabled={busy}
                onClick={async () => {
                  if (!confirm('Permanently remove this media file?')) return;
                  setBusy(true);
                  try {
                    await adminAction('delete-media', { id: m.id });
                    setMedia((old) => old.filter((x) => x.id !== m.id));
                    setMessage('Media removed.');
                  } catch (e) {
                    setMessage(e instanceof Error ? e.message : 'Unable to remove media.');
                  }
                  setBusy(false);
                }}
              >
                Remove
              </button>
            </div>
          </div>
        ))}
      </div>
      <div className="row">
        <label className="grow">
          YouTube or direct video URL
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://www.youtube.com/watch?v=… or https://…/video.mp4"
          />
        </label>
        <button
          className="button secondary"
          disabled={busy || !url}
          onClick={async () => {
            setBusy(true);
            try {
              await adminAction('video-url', { product_id: productId, url });
              setUrl('');
              window.location.reload();
            } catch (e) {
              setMessage(e instanceof Error ? e.message : 'Unable to add video.');
            }
            setBusy(false);
          }}
        >
          Add video URL
        </button>
      </div>
      {message && (
        <p className="notice" role="status">
          {message}
        </p>
      )}
    </section>
  );
}
