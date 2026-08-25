import type { ReactNode } from "react";

interface FieldProps {
  label: string;
  required?: boolean;
  children: ReactNode;
  className?: string;
}

export default function Field({
  label,
  required = false,
  children,
  className = "",
}: FieldProps) {
  return (
    <div className={className}>
      <label className="block text-sm font-semibold text-black mb-2">
        {label}
        {required && " *"}
      </label>
      {children}
    </div>
  );
}
