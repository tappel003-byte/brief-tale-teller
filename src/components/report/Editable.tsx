import { useEffect, useRef } from "react";

interface Props {
  value: string;
  placeholder?: string;
  onChange: (next: string) => void;
  multiline?: boolean;
  inline?: boolean;
  className?: string;
}

/**
 * Lightweight contenteditable wrapper. Keeps caret stable by only syncing
 * external value when it differs from the live text content.
 *
 * Multiline edits use <div>; inline/block defaults to <span>/<div>.
 */
export function Editable({
  value,
  placeholder,
  onChange,
  multiline,
  inline,
  className,
}: Props) {
  const ref = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const current = multiline ? (el.innerText ?? "") : (el.textContent ?? "");
    if (current !== value) {
      if (multiline) el.innerText = value;
      else el.textContent = value;
    }
  }, [value, multiline]);

  const handleInput = () => {
    const el = ref.current;
    if (!el) return;
    const next = multiline ? el.innerText : el.textContent ?? "";
    onChange(next);
  };

  const commonProps = {
    ref: ref as React.RefObject<HTMLDivElement>,
    contentEditable: true,
    suppressContentEditableWarning: true,
    spellCheck: true,
    "data-placeholder": placeholder,
    onInput: handleInput,
    onBlur: handleInput,
    onPaste: (e: React.ClipboardEvent) => {
      if (!multiline) {
        // Strip newlines on inline fields.
        const text = e.clipboardData.getData("text/plain").replace(/\s+/g, " ");
        e.preventDefault();
        document.execCommand("insertText", false, text);
      }
    },
    className: className,
  };

  if (inline) {
    return <span {...commonProps} />;
  }
  return <div {...commonProps} style={{ whiteSpace: multiline ? "pre-wrap" : undefined }} />;
}
