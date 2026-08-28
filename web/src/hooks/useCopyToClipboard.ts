import { useCallback, useEffect, useRef, useState } from "react";

const COPY_FEEDBACK_MS = 2000;

function legacyCopy(text: string): boolean {
  if (typeof document === "undefined") return false;
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  let ok = false;
  try {
    ok = document.execCommand("copy");
  } catch {
    ok = false;
  }
  document.body.removeChild(textarea);
  return ok;
}

/**
 * Copy-to-clipboard with transient `copied` feedback.
 *
 * Falls back to a hidden-textarea execCommand when the async Clipboard API is
 * unavailable or rejects (e.g. non-secure origins). Returns whether the copy
 * succeeded; never throws. The feedback timer is cleared on unmount so no
 * state update fires after the component goes away.
 */
export function useCopyToClipboard(feedbackMs: number = COPY_FEEDBACK_MS) {
  const [copied, setCopied] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current !== null) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, []);

  const copy = useCallback(
    async (text: string): Promise<boolean> => {
      let ok = false;
      if (
        typeof navigator !== "undefined" &&
        navigator.clipboard &&
        typeof navigator.clipboard.writeText === "function"
      ) {
        try {
          await navigator.clipboard.writeText(text);
          ok = true;
        } catch {
          ok = false;
        }
      }
      if (!ok) ok = legacyCopy(text);

      if (ok) {
        setCopied(true);
        if (timeoutRef.current !== null) clearTimeout(timeoutRef.current);
        timeoutRef.current = setTimeout(() => {
          timeoutRef.current = null;
          setCopied(false);
        }, feedbackMs);
      }
      return ok;
    },
    [feedbackMs],
  );

  return { copied, copy };
}
