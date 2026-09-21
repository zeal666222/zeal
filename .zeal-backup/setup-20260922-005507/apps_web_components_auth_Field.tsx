"use client";

import { forwardRef, useState, type InputHTMLAttributes } from "react";
import { Eye, EyeOff, type LucideIcon } from "lucide-react";

interface FieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  icon?: LucideIcon;
  error?: string | null;
  hint?: string | null;
  showToggle?: boolean;
}

export const Field = forwardRef<HTMLInputElement, FieldProps>(function Field(
  { label, icon: Icon, error, hint, showToggle, type = "text", id, className, ...rest },
  ref,
) {
  const [reveal, setReveal] = useState(false);
  const inputId = id ?? `field-${label.toLowerCase().replace(/\s+/g, "-")}`;
  const describedBy = error
    ? `${inputId}-err`
    : hint
      ? `${inputId}-hint`
      : undefined;

  return (
    <div>
      <label
        htmlFor={inputId}
        className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2"
      >
        {label}
      </label>

      <div className="relative group">
        {Icon && (
          <Icon
            size={17}
            className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600 group-focus-within:text-purple-400 transition-colors pointer-events-none"
          />
        )}
        <input
          ref={ref}
          id={inputId}
          type={showToggle ? (reveal ? "text" : "password") : type}
          aria-invalid={Boolean(error)}
          aria-describedby={describedBy}
          className={[
            "w-full py-3.5 bg-slate-900/60 border rounded-2xl text-sm text-white",
            "placeholder:text-slate-600 outline-none transition-colors",
            "focus:bg-slate-900/90",
            Icon ? "pl-12" : "pl-4",
            showToggle ? "pr-12" : "pr-4",
            error
              ? "border-rose-500/40 focus:border-rose-500"
              : "border-white/5 focus:border-purple-500",
            className ?? "",
          ].join(" ")}
          {...rest}
        />
        {showToggle && (
          <button
            type="button"
            tabIndex={-1}
            aria-label={reveal ? "Hide password" : "Show password"}
            onClick={() => setReveal((v) => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-slate-600 hover:text-slate-300 hover:bg-white/5 transition-colors"
          >
            {reveal ? <EyeOff size={15} /> : <Eye size={15} />}
          </button>
        )}
      </div>

      {error ? (
        <p
          id={`${inputId}-err`}
          className="text-[10px] text-rose-400 mt-1.5 font-medium"
          role="alert"
        >
          {error}
        </p>
      ) : hint ? (
        <p id={`${inputId}-hint`} className="text-[10px] text-slate-500 mt-1.5">
          {hint}
        </p>
      ) : null}
    </div>
  );
});
