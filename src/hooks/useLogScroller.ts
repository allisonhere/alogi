import { useState, useRef, useCallback, useEffect } from 'react';

export interface UseLogScrollerProps {
  contentLength: number;
  rowHeight: number;
  overscan?: number;
}

export function useLogScroller({ contentLength, rowHeight, overscan = 12 }: UseLogScrollerProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [viewportRange, setViewportRange] = useState({ start: 0, end: 0 });
  const [scrollMetrics, setScrollMetrics] = useState({ top: 0, height: 0, scrollHeight: 0 });

  const updateViewport = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (el.scrollHeight <= 0) {
      setViewportRange({ start: 0, end: 1 });
      return;
    }
    const start = el.scrollTop / el.scrollHeight;
    const end = (el.scrollTop + el.clientHeight) / el.scrollHeight;
    setViewportRange({
      start: Math.max(0, Math.min(1, start)),
      end: Math.max(0, Math.min(1, end)),
    });
    setScrollMetrics({
      top: el.scrollTop,
      height: el.clientHeight,
      scrollHeight: el.scrollHeight,
    });
  }, []);

  const viewportRaf = useRef<number | null>(null);
  const scheduleViewportUpdate = useCallback(() => {
    if (viewportRaf.current !== null) return;
    viewportRaf.current = requestAnimationFrame(() => {
      viewportRaf.current = null;
      updateViewport();
    });
  }, [updateViewport]);

  useEffect(() => {
    updateViewport();
    window.addEventListener('resize', scheduleViewportUpdate);
    return () => window.removeEventListener('resize', scheduleViewportUpdate);
  }, [updateViewport, scheduleViewportUpdate]);

  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, []);

  const startIndex = Math.max(0, Math.floor(scrollMetrics.top / rowHeight) - overscan);
  const visibleCount = Math.ceil((scrollMetrics.height || 0) / rowHeight) + overscan * 2;
  const endIndex = Math.min(contentLength, startIndex + visibleCount);

  return {
    scrollRef,
    viewportRange,
    scrollMetrics,
    scheduleViewportUpdate,
    scrollToBottom,
    startIndex,
    endIndex,
    visibleCount
  };
}
