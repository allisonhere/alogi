'use client';

import { useLayoutEffect, useMemo, useRef, useState } from 'react';

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

  const resolvedCurrentId = currentId && availableSteps.some(step => step.id === currentId)
    ? currentId
    : (availableSteps[0]?.id ?? null);
  const currentIndex = resolvedCurrentId
    ? availableSteps.findIndex(step => step.id === resolvedCurrentId)
    : -1;
  const activeIndex = currentIndex >= 0 ? currentIndex : 0;
  const activeStep = availableSteps[activeIndex];

  useLayoutEffect(() => {
    let frame = 0;
    const updateRect = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        const rect = activeStep?.target.current?.getBoundingClientRect() ?? null;
        setTargetRect(rect);
      });
    };

    updateRect();
    window.addEventListener('resize', updateRect);
    window.addEventListener('scroll', updateRect, true);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener('resize', updateRect);
      window.removeEventListener('scroll', updateRect, true);
    };
  }, [activeStep]);

  useLayoutEffect(() => {
    if (!targetRect || !calloutRef.current) return;

    const frame = window.requestAnimationFrame(() => {
      const padding = 12;
      const { innerWidth, innerHeight } = window;
      const calloutWidth = calloutRef.current?.offsetWidth ?? 0;
      const calloutHeight = calloutRef.current?.offsetHeight ?? 0;

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
    });

    return () => window.cancelAnimationFrame(frame);
  }, [targetRect]);

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
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      {targetRect && (
        <div
          className="absolute border-2 rounded-[20px] pointer-events-none"
          style={{
            top: targetRect.top - 6,
            left: targetRect.left - 6,
            width: targetRect.width + 12,
            height: targetRect.height + 12,
            borderColor: 'var(--accent)',
            boxShadow: '0 0 0 8px color-mix(in srgb, var(--accent) 20%, transparent), 0 0 32px color-mix(in srgb, var(--accent) 26%, transparent)',
          }}
        />
      )}

      <div
        ref={calloutRef}
        role="dialog"
        aria-modal="true"
        aria-label={`Onboarding step ${activeIndex + 1} of ${availableSteps.length}: ${activeStep.title}`}
        className="absolute ui-card max-w-[380px] p-5 pointer-events-auto"
        style={{ top: calloutPos.top, left: calloutPos.left }}
        onKeyDown={(e) => {
          if (e.key === 'Escape') (onSkip ?? onFinish)();
          if (e.key === 'ArrowRight') handleNext();
          if (e.key === 'ArrowLeft') handleBack();
        }}
      >
        <div className="text-[11px] uppercase tracking-[0.24em] text-accent mb-2">
          Step {activeIndex + 1} / {availableSteps.length}
        </div>
        <h3 className="text-base font-semibold text-primary mb-2">{activeStep.title}</h3>
        <p className="text-sm text-secondary mb-5">{activeStep.body}</p>
        <div className="flex items-center justify-between text-sm">
          <button
            onClick={onSkip ?? onFinish}
            className="text-muted hover:text-primary"
          >
            Don&apos;t show again
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={handleBack}
              disabled={activeIndex === 0}
              className="ui-button ui-button-secondary px-3 py-1.5 disabled:opacity-40"
            >
              Back
            </button>
            <button
              onClick={handleNext}
              autoFocus
              className="ui-button ui-button-primary px-3 py-1.5"
            >
              {activeIndex === availableSteps.length - 1 ? 'Done' : 'Next'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
