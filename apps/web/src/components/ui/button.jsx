
import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva } from "class-variance-authority";

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap text-[14px] font-semibold border border-transparent transition focus-visible:outline-none focus-visible:shadow-focus disabled:pointer-events-none disabled:opacity-55 active:translate-y-px [&_svg]:pointer-events-none [&_svg]:size-[18px] [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "text-white shadow-nav bg-[linear-gradient(135deg,#067B7F_0%,#12A4A5_100%)] hover:brightness-105",
        destructive:
          "bg-danger-500 text-white hover:brightness-95",
        outline:
          "bg-white text-teal-800 border-teal-300 hover:bg-teal-50",
        secondary:
          "bg-white text-slate-700 border-slate-200 hover:border-teal-300 hover:text-teal-800",
        ghost: "text-teal-800 hover:bg-teal-50",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 rounded-xl",
        sm: "h-[34px] rounded-[10px] px-3 text-[13px] [&_svg]:size-4",
        lg: "h-12 rounded-xl px-5 text-[15px]",
        icon: "h-10 w-10 rounded-xl",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

const Button = React.forwardRef(({ className, variant, size, asChild = false, ...props }, ref) => {
  const Comp = asChild ? Slot : "button"
  return (
    <Comp
      className={cn(buttonVariants({ variant, size, className }))}
      ref={ref}
      {...props} />
  );
})
Button.displayName = "Button"

export { Button, buttonVariants }
