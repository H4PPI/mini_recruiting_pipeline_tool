import type { ButtonHTMLAttributes, ReactNode } from "react";

type ButtonVariant = "primary" | "secondary" | "ghost" | "link" | "icon";
type ButtonSize = "sm" | "md";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "bg-mainYellow text-black hover:bg-yellow-500 disabled:hover:bg-mainYellow",
  secondary:
    "border border-black/20 text-black hover:bg-black/5 disabled:hover:bg-transparent",
  ghost: "text-black/60 hover:text-black disabled:hover:text-black/60",
  link: "text-mainYellow hover:underline",
  icon: "text-black/40 hover:text-red-600",
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: "px-3 py-2 text-sm rounded",
  md: "px-4 py-2 rounded-lg",
};

export default function Button({
  children,
  variant = "primary",
  size = "md",
  fullWidth = false,
  className = "",
  type = "button",
  ...props
}: ButtonProps) {
  const widthClass = fullWidth ? "w-full" : "";
  const baseClass =
    variant === "link" || variant === "icon"
      ? "font-semibold transition-colors disabled:opacity-50"
      : "font-semibold transition-colors disabled:opacity-50";

  return (
    <button
      type={type}
      className={[
        baseClass,
        variantClasses[variant],
        variant === "link" || variant === "icon" ? "" : sizeClasses[size],
        widthClass,
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
