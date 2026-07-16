import { Moon, Sun, Monitor, Check } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/contexts/ThemeContext";
import { cn } from "@/lib/utils";

interface ThemeToggleProps {
  className?: string;
}

/**
 * Three-way theme toggle: Light / Dark / System.
 * Trigger shows the resolved icon; menu lets the user pick an explicit mode.
 */
export default function ThemeToggle({ className }: ThemeToggleProps) {
  const { theme, resolved, setTheme } = useTheme();

  const options = [
    { value: "light" as const, label: "Light", icon: Sun },
    { value: "dark" as const, label: "Dark", icon: Moon },
    { value: "system" as const, label: "System", icon: Monitor },
  ];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn("h-9 w-9", className)}
          aria-label="Change theme"
        >
          {resolved === "dark" ? (
            <Sun className="h-4 w-4" />
          ) : (
            <Moon className="h-4 w-4" />
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40">
        <DropdownMenuLabel className="text-fs-xs text-muted-foreground">
          Appearance
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {options.map((opt) => {
          const Icon = opt.icon;
          const active = theme === opt.value;
          return (
            <DropdownMenuItem
              key={opt.value}
              onClick={() => setTheme(opt.value)}
              className="cursor-pointer gap-2"
            >
              <Icon className="h-4 w-4" />
              <span className="flex-1">{opt.label}</span>
              {active && <Check className="h-3.5 w-3.5 text-primary" />}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
