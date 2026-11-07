import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"
import { Slot } from "radix-ui"

// Roha: pill buttons, 48px tall by default (thumb-sized), gradient primary from the logo blues.
const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-full border border-transparent bg-clip-padding font-medium whitespace-nowrap outline-none select-none transition-[transform,box-shadow,background-color,border-color,color] duration-300 ease-out-soft focus-visible:ring-3 focus-visible:ring-ring/50 active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default:
          "bg-[linear-gradient(100deg,var(--color-sky),var(--color-roha-700)_85%)] text-primary-foreground shadow-[0_10px_24px_-12px_rgb(22_52_114/0.7)] hover:-translate-y-0.5 hover:shadow-[0_16px_30px_-12px_rgb(22_52_114/0.75)]",
        solid: "bg-primary text-primary-foreground hover:bg-roha-800",
        outline: "border-border bg-background text-primary hover:border-ring hover:bg-accent",
        secondary: "bg-secondary text-secondary-foreground hover:bg-roha-200/60",
        inverse: "bg-white text-primary hover:bg-secondary",
        "inverse-outline": "border-white/70 text-white hover:border-white hover:bg-white hover:text-primary",
        ghost: "text-primary hover:bg-accent",
        destructive: "bg-destructive/10 text-destructive hover:bg-destructive/20 focus-visible:ring-destructive/20",
        link: "rounded-none px-0 text-primary underline decoration-ring/50 decoration-[1.5px] underline-offset-4 hover:decoration-ring",
      },
      size: {
        default: "h-12 gap-2.5 px-6 text-[0.9375rem] has-data-[icon=inline-start]:pl-5 has-data-[icon=inline-end]:pr-5",
        sm: "h-10 gap-2 px-4 text-sm",
        lg: "h-14 gap-3 px-8 text-base",
        icon: "size-11",
        "icon-sm": "size-9",
      },
    },
    compoundVariants: [{ variant: "link", className: "h-auto px-0" }],
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot.Root : "button"

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
