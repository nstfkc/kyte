import type { ButtonHTMLAttributes, ReactElement, ReactNode } from "react";

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Visual style of the button. */
  variant?: "primary" | "secondary";
  /** Button label / content. */
  children: ReactNode;
}

export function Button({
  variant = "primary",
  children,
  ...rest
}: ButtonProps): ReactElement {
  return (
    <button
      data-variant={variant}
      aria-label={typeof children === "string" ? children : undefined}
      {...rest}
    >
      {children}
    </button>
  );
}
