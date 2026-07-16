import logoLight from "@/assets/taskhive-logo-light.png";
import logoDark from "@/assets/taskhive-logo-dark.png";
import { useTheme } from "@/contexts/ThemeContext";
import { usePwaBranding } from "@/hooks/usePwaBranding";

interface LogoProps {
  size?: number;
  className?: string;
}

const Logo = ({ size = 32, className = "" }: LogoProps) => {
  const { resolved } = useTheme();
  const { logoUrl, logoLightUrl, logoDarkUrl, siteName } = usePwaBranding();
  const dynamic = resolved === "dark"
    ? (logoLightUrl || logoUrl)
    : (logoDarkUrl || logoUrl);
  const src = dynamic || (resolved === "dark" ? logoLight : logoDark);

  return (
    <img
      src={src}
      alt={siteName || "TaskHive"}
      width={size}
      height={size}
      className={className}
    />
  );
};

export default Logo;
