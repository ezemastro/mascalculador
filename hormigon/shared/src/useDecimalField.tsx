import { useState, useEffect, useRef } from "react";

function sanitizeDecimal(val: string): string {
  return val.replace(/,/g, ".");
}

export function DecimalInput({
  value,
  onChange,
  className,
  decimals,
}: {
  value: number;
  onChange: (n: number) => void;
  className?: string;
  decimals?: number;
}) {
  const format = (v: number): string =>
    decimals === undefined ? String(v) : v.toFixed(decimals);
  const [text, setText] = useState(() => format(value));
  const internalRef = useRef(false);

  // Sync text ONLY when value changes from outside (not from user typing)
  useEffect(() => {
    if (internalRef.current) {
      internalRef.current = false;
      return;
    }
    setText(decimals === undefined ? String(value) : value.toFixed(decimals));
  }, [value, decimals]);

  return (
    <input
      type="text"
      value={text}
      onChange={(e) => {
        const raw = e.target.value;
        setText(raw);
        const num = parseFloat(sanitizeDecimal(raw));
        if (!isNaN(num)) {
          internalRef.current = true;
          onChange(num);
        }
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          // Enter commits the edited value (already synced via onChange) and
          // exits the field. It must NOT submit the surrounding form.
          e.preventDefault();
          e.currentTarget.blur();
        }
      }}
      onBlur={() => {
        internalRef.current = false;
        setText(format(value));
      }}
      className={className}
    />
  );
}
