
import * as React from "react"
import { cva } from "class-variance-authority";

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 h-[26px] rounded-full border px-2.5 text-[12px] font-semibold whitespace-nowrap transition-colors focus:outline-none focus-visible:shadow-focus",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-teal-50 text-teal-800",
        secondary:
          "border-transparent bg-slate-100 text-slate-600",
        destructive:
          "border-transparent bg-danger-50 text-danger-600",
        outline: "bg-white text-teal-800 border-teal-200",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant,
  ...props
}) {
  return (<div className={cn(badgeVariants({ variant }), className)} {...props} />);
}

export { Badge, badgeVariants }
