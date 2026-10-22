'use client';
import { useEffect, useRef } from 'react';
import Image from 'next/image';

export function ImageLightbox({
  src,
  name,
  onClose,
}: {
  src: string;
  name: string;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = dialog.current;
    const previousFocus = document.activeElement;
    const overflow = document.body.style.overflow;
    element?.showModal();
    document.body.style.overflow = 'hidden';
    return () => {
      element?.close();
      document.body.style.overflow = overflow;
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus();
    };
  }, []);
  return (
    <dialog
      ref={dialog}
      className="lightbox"
      aria-label={`Enlarged image of ${name}`}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <button className="button" onClick={onClose}>
        Close image ×
      </button>
      <Image src={src} alt={name} width={1200} height={1200} unoptimized />
    </dialog>
  );
}
