import type { TextareaHTMLAttributes } from "react";

type TextAreaProps = TextareaHTMLAttributes<HTMLTextAreaElement>;

export default function TextArea({ className = "", ...props }: TextAreaProps) {
  return (
    <textarea
      className={[
        "w-full px-4 py-2 text-black border border-black/20 rounded-lg focus:outline-none focus:border-mainYellow resize-none",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      {...props}
    />
  );
}
