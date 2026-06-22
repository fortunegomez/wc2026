'use client';

// The responsive detail popup. On desktop it's a centered modal with a dimmed,
// click-outside-to-close overlay; on mobile it's a bottom sheet that can be
// tapped away (overlay) or swiped down to dismiss. Esc always closes. The
// desktop/mobile presentation is handled entirely in CSS — this component just
// manages open/close, scroll-lock, and the swipe gesture.

import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';

export function Popup({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
}) {
  const [dragY, setDragY] = useState(0);
  const startY = useRef<number | null>(null);

  useEffect(() => {
    if (!open) return;
    setDragY(0);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;

  const onTouchStart = (e: React.TouchEvent) => {
    startY.current = e.touches[0].clientY;
  };
  const onTouchMove = (e: React.TouchEvent) => {
    if (startY.current === null) return;
    const dy = e.touches[0].clientY - startY.current;
    if (dy > 0) setDragY(dy);
  };
  const onTouchEnd = () => {
    if (dragY > 90) onClose();
    else setDragY(0);
    startY.current = null;
  };

  return (
    <div className="pop-overlay" onClick={onClose}>
      <div
        className="pop-panel"
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        style={dragY ? { transform: `translateY(${dragY}px)` } : undefined}
      >
        <div
          className="pop-gripzone"
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
        >
          <div className="pop-grip" aria-hidden="true" />
        </div>
        <div className="pop-head">
          <div className="pop-title">{title}</div>
          <button className="pop-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        <div className="pop-body">{children}</div>
      </div>
    </div>
  );
}
