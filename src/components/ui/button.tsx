import { Slot } from "radix-ui";
import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

// shadcn/ui Button, restyled to the brand.
export const buttonVariants = cva(
  "inline-flex min-h-11 items-center justify-center gap-2.5 whitespace-nowrap text-sm font-medium tracking-wide transition-colors duration-300 ease-out-soft disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary: "bg-charcoal text-ivory hover:bg-walnut-deep",
        accent: "bg-walnut text-ivory hover:bg-walnut-deep",
        outline:
          "border border-charcoal/30 text-charcoal hover:border-charcoal hover:bg-charcoal hover:text-ivory",
        outlineLight:
          "border border-ivory/40 text-ivory hover:border-ivory hover:bg-ivory hover:text-charcoal",
        link: "min-h-0 px-0 text-charcoal underline decoration-walnut/50 underline-offset-[6px] hover:decoration-walnut",
      },
      size: {
        md: "px-6 py-3",
        lg: "px-8 py-4 text-[0.9375rem]",
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
