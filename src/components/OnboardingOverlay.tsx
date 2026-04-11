'use client';

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';

export interface OnboardingStep {
  id: string;
  title: string;
  body: string;
  target: React.RefObject<HTMLElement | null>;
  enabled?: boolean;
}

interface OnboardingOverlayProps {
  steps: OnboardingStep[];
  onFinish: () => void;
  onSkip?: () => void;
}

export function OnboardingOverlay({ steps, onFinish, onSkip }: OnboardingOverlayProps) {
  const calloutRef = useRef<HTMLDivElement>(null);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const [calloutPos, setCalloutPos] = useState({ top: 0, left: 0 });

  const availableSteps = useMemo(
    () => steps.filter(step => step.enabled !== false && step.target.current),
    [steps]
  );

  const currentIndex = currentId
    ? availableSteps.findIndex(step => step.id === currentId)
    : -1;
  const activeIndex = currentIndex >= 0 ? currentIndex : 0;
  const activeStep = availableSteps[activeIndex];

  useEffect(() => {
    if (!availableSteps.length) return;
    if (!activeStep || activeStep.id !== currentId) {
      setCurrentId(availableSteps[0].id);
    }
  }, [availableSteps, activeStep, currentId]);

  useLayoutEffect(() => {
    if (!activeStep?.target.current) {
      setTargetRect(null);
      return;
    }
    const updateRect = () => {
      const rect = activeStep.target.current?.getBoundingClientRect() ?? null;
      setTargetRect(rect);
    };
    updateRect();
    window.addEventListener('resize', updateRect);
    window.addEventListener('scroll', updateRect, true);
    return () => {
      window.removeEventListener('resize', updateRect);
      window.removeEventListener('scroll', updateRect, true);
    };
  }, [activeStep]);

  useLayoutEffect(() => {
    if (!targetRect || !calloutRef.current) return;
    const padding = 12;
    const { innerWidth, innerHeight } = window;
    const calloutWidth = calloutRef.current.offsetWidth;
    const calloutHeight = calloutRef.current.offsetHeight;

    let left = targetRect.right + padding;
    let top = targetRect.top + targetRect.height / 2 - calloutHeight / 2;

    if (left + calloutWidth > innerWidth - padding) {
      left = targetRect.left - calloutWidth - padding;
    }
    if (left < padding) left = padding;
    if (top + calloutHeight > innerHeight - padding) {
      top = innerHeight - calloutHeight - padding;
    }
    if (top < padding) top = padding;

    setCalloutPos({ top, left });
  }, [targetRect, activeStep]);

  if (!availableSteps.length || !activeStep) return null;

  const handleNext = () => {
    if (activeIndex >= availableSteps.length - 1) {
      onFinish();
      return;
    }
    setCurrentId(availableSteps[activeIndex + 1].id);
  };

  const handleBack = () => {
    if (activeIndex <= 0) return;
    setCurrentId(availableSteps[activeIndex - 1].id);
  };

  return (
    <div className="fixed inset-0 z-50 pointer-events-none" role="presentation">
      <div className="absolute inset-0 bg-black/60" />
      {targetRect && (
        <div
          className="absolute border-2 border-indigo-400/90 rounded-xl shadow-[0_0_0_8px_rgba(99,102,241,0.25),0_0_32px_rgba(99,102,241,0.35)] pointer-events-none"
          style={{
            top: targetRect.top - 6,
            left: targetRect.left - 6,
            width: targetRect.width + 12,
            height: targetRect.height + 12,
          }}
        />
      )}

      <div
        ref={calloutRef}
        role="dialog"
        aria-modal="true"
        aria-label={`Onboarding step ${activeIndex + 1} of ${availableSteps.length}: ${activeStep.title}`}
        className="absolute max-w-[380px] bg-white dark:bg-zinc-950/95 border border-indigo-300/60 dark:border-indigo-500/40 rounded-2xl shadow-[0_18px_50px_rgba(15,23,42,0.35),0_0_30px_rgba(99,102,241,0.25)] p-5 text-zinc-900 dark:text-zinc-100 pointer-events-auto backdrop-blur"
        style={{ top: calloutPos.top, left: calloutPos.left }}
        onKeyDown={(e) => {
          if (e.key === 'Escape') (onSkip ?? onFinish)();
          if (e.key === 'ArrowRight') handleNext();
          if (e.key === 'ArrowLeft') handleBack();
        }}
      >
        <div className="text-[11px] uppercase tracking-[0.24em] text-indigo-500/80 dark:text-indigo-300/70 mb-2">
          Step {activeIndex + 1} / {availableSteps.length}
        </div>
        <h3 className="text-base font-semibold mb-2">{activeStep.title}</h3>
        <p className="text-sm text-zinc-600 dark:text-zinc-300 mb-5">{activeStep.body}</p>
        <div className="flex items-center justify-between text-sm">
          <button
            onClick={onSkip ?? onFinish}
            className="text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white"
          >
            Don't show again
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={handleBack}
              disabled={activeIndex === 0}
              className="px-3 py-1.5 rounded-md border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 disabled:opacity-40"
            >
              Back
            </button>
            <button
              onClick={handleNext}
              autoFocus
              className="px-3 py-1.5 rounded-md bg-indigo-600 text-white hover:bg-indigo-500"
            >
              {activeIndex === availableSteps.length - 1 ? 'Done' : 'Next'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
