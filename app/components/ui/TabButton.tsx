import type { ButtonHTMLAttributes, ReactNode } from "react";

interface TabButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  active: boolean;
  children: ReactNode;
}

export default function TabButton({
  active,
  children,
  className = "",
  type = "button",
  ...props
}: TabButtonProps) {
  return (
    <button
      type={type}
      className={[
        "px-4 py-2 font-semibold transition-colors",
        active
          ? "border-b-2 border-mainYellow text-black"
          : "text-black/60 hover:text-black",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      {...props}
    >
      {children}
    </button>
  );
}
