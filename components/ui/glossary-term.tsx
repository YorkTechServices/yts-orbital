"use client";

import { CircleHelp, X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";

export default function GlossaryTerm({
  label,
  definition,
  className = "",
}: {
  label: string;
  definition: string;
  className?: string;
}) {
  const id = useId();
  const container = useRef<HTMLSpanElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const [visible, setVisible] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [position, setPosition] = useState({ left: 0, top: 0, above: false });

  const show = () => {
    const rect = trigger.current?.getBoundingClientRect();
    if (!rect) return;
    const halfWidth = Math.min(140, (window.innerWidth - 24) / 2);
    const left = Math.max(halfWidth + 12, Math.min(window.innerWidth - halfWidth - 12, rect.left + rect.width / 2));
    const above = rect.bottom + 130 > window.innerHeight;
    setPosition({ left, top: above ? rect.top - 8 : rect.bottom + 8, above });
    setVisible(true);
  };

  useEffect(() => {
    if (!pinned) return;
    const close = (event: PointerEvent) => {
      if (container.current?.contains(event.target as Node)) return;
      setPinned(false);
      setVisible(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setPinned(false);
      setVisible(false);
      trigger.current?.focus();
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [pinned]);

  return (
    <span ref={container} className={`glossary-term ${className}`.trim()}>
      <button
        ref={trigger}
        type="button"
        className="glossary-trigger"
        aria-expanded={pinned}
        aria-describedby={visible ? id : undefined}
        onMouseEnter={show}
        onMouseLeave={() => { if (!pinned) setVisible(false); }}
        onFocus={show}
        onBlur={() => { if (!pinned) setVisible(false); }}
        onClick={() => {
          if (pinned) {
            setPinned(false);
            setVisible(false);
          } else {
            setPinned(true);
            show();
          }
        }}
      >
        {label}<CircleHelp size={10} aria-hidden="true" />
      </button>
      {visible && createPortal(
        <span
          id={id}
          role="tooltip"
          className={`glossary-tooltip${position.above ? " above" : ""}`}
          style={{ left: position.left, top: position.top }}
        >
          <span className="glossary-tooltip-heading"><strong>{label}</strong><button type="button" onClick={() => { setPinned(false); setVisible(false); }} aria-label={`Close ${label} explanation`}><X size={12} /></button></span>
          {definition}
        </span>,
        document.body,
      )}
    </span>
  );
}