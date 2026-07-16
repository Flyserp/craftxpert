import { useTheme } from "next-themes";
import { Toaster as Sonner, toast } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg",
          description: "group-[.toast]:text-muted-foreground",
          actionButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
          success:
            "group-[.toaster]:!border-l-4 group-[.toaster]:!border-l-[hsl(var(--success))] [&_[data-icon]]:!text-[hsl(var(--success))]",
          error:
            "group-[.toaster]:!border-l-4 group-[.toaster]:!border-l-[hsl(var(--destructive))] [&_[data-icon]]:!text-[hsl(var(--destructive))]",
          warning:
            "group-[.toaster]:!border-l-4 group-[.toaster]:!border-l-[hsl(var(--warning))] [&_[data-icon]]:!text-[hsl(var(--warning))]",
          info:
            "group-[.toaster]:!border-l-4 group-[.toaster]:!border-l-[hsl(var(--info))] [&_[data-icon]]:!text-[hsl(var(--info))]",
        },
      }}
      {...props}
    />
  );
};

export { Toaster, toast };
