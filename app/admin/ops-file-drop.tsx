"use client";

import { useEffect, useImperativeHandle, useRef, useState, type Ref } from "react";
import { Upload } from "lucide-react";

/**
 * The one way to choose a file in the staff app: a dashed drop area that
 * names what to choose, then names what was chosen. The native input stays
 * underneath for the keyboard, screen readers and form posts.
 *
 * Pages that hold the file themselves pass `chosen`; a plain form leaves it
 * out and the area remembers the choice until the form is reset.
 */
export function OpsFileDrop({
  prompt,
  hint,
  chosen,
  onFiles,
  inputRef,
  name,
  accept,
  multiple = false,
  required = false,
  disabled = false,
}: {
  prompt: string;
  hint?: string;
  chosen?: string | null;
  onFiles?: (files: File[]) => void;
  inputRef?: Ref<HTMLInputElement>;
  name?: string;
  accept?: string;
  multiple?: boolean;
  required?: boolean;
  disabled?: boolean;
}) {
  const [picked, setPicked] = useState<string | null>(null);
  const own = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const form = own.current?.form;
    if (!form) return;
    const clear = () => setPicked(null);
    form.addEventListener("reset", clear);
    return () => form.removeEventListener("reset", clear);
  }, []);

  // Callers that read the files on submit get the same input.
  useImperativeHandle(inputRef, () => own.current as HTMLInputElement);

  const label = chosen === undefined ? picked : chosen;
  return (
    <label className="ops-file-drop" data-disabled={disabled || undefined} data-chosen={label ? "" : undefined}>
      <input
        ref={own}
        className="sr-only"
        type="file"
        name={name}
        accept={accept}
        multiple={multiple}
        required={required}
        disabled={disabled}
        onChange={(event) => {
          const files = Array.from(event.target.files ?? []);
          setPicked(files.length === 0 ? null : files.length === 1 ? files[0].name : `${files.length} files chosen`);
          onFiles?.(files);
        }}
      />
      <Upload size={16} strokeWidth={1.75} aria-hidden="true"/>
      <strong>{label || prompt}</strong>
      {hint ? <span>{hint}</span> : null}
    </label>
  );
}
