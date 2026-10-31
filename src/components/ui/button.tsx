import { Slot } from "radix-ui";
import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

// shadcn/ui Button, restyled to the brand: square, outlined or solid, small tracked capitals
// (Arabic is never uppercased or letter-spaced).
export const buttonVariants = cva(
  "inline-flex min-h-11 items-center justify-center gap-2.5 whitespace-nowrap border text-[0.8125rem] font-medium tracking-[0.09em] uppercase transition-colors duration-300 ease-out-soft disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0 rtl:tracking-normal rtl:normal-case",
  {
    variants: {
      variant: {
        primary: "border-espresso bg-espresso text-ivory hover:border-walnut-deep hover:bg-walnut-deep",
        accent: "border-walnut bg-walnut text-ivory hover:border-walnut-deep hover:bg-walnut-deep",
        light: "border-ivory bg-ivory text-espresso hover:border-sand hover:bg-sand",
        outline: "border-espresso text-espresso hover:bg-espresso hover:text-ivory",
        outlineLight: "border-ivory/40 text-ivory hover:border-ivory hover:bg-ivory hover:text-espresso",
        link: "min-h-0 border-0 px-0 normal-case tracking-wide text-charcoal underline decoration-walnut/50 underline-offset-[6px] hover:decoration-walnut",
      },
      size: {
        md: "px-6 py-3",
        lg: "px-8 py-4",
        icon: "size-11",
      },
    },
    compoundVariants: [{ variant: "link", className: "px-0 py-0" }],
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: ComponentProps<"button"> & VariantProps<typeof buttonVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : "button";
  return <Comp className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}
