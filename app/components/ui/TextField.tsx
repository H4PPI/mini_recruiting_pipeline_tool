import type { InputHTMLAttributes } from "react";

type TextFieldProps = InputHTMLAttributes<HTMLInputElement>;

export default function TextField({ className = "", ...props }: TextFieldProps) {
  return (
    <input
      className={[
        "w-full text-black px-4 py-2 border border-black/20 rounded-lg focus:outline-none focus:border-mainYellow",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      {...props}
    />
  );
}
