import { useEffect, useRef } from "react";

interface ScrollRevealOptions {
  /** Stagger children elements with this CSS selector */
  staggerChildren?: string;
  /** Delay between each staggered child in ms */
  staggerDelay?: number;
  /** IntersectionObserver threshold */
  threshold?: number;
}

export function useScrollReveal<T extends HTMLElement = HTMLDivElement>(
  options: ScrollRevealOptions = {}
) {
  const { staggerChildren, staggerDelay = 100, threshold = 0.12 } = options;
  const ref = useRef<T>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const easing = "cubic-bezier(0.16, 1, 0.3, 1)";

    if (staggerChildren) {
      // Hide the container subtly, then reveal children one-by-one
      const children = el.querySelectorAll(staggerChildren);
      children.forEach((child) => {
        const c = child as HTMLElement;
        c.style.opacity = "0";
        c.style.transform = "translateY(24px)";
        c.style.filter = "blur(4px)";
        c.style.transition = `opacity 0.6s ${easing}, transform 0.6s ${easing}, filter 0.6s ${easing}`;
      });

      const observer = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) {
            children.forEach((child, i) => {
              const c = child as HTMLElement;
              setTimeout(() => {
                c.style.opacity = "1";
                c.style.transform = "translateY(0)";
                c.style.filter = "blur(0)";
              }, i * staggerDelay);
            });
            observer.disconnect();
          }
        },
        { threshold }
      );
      observer.observe(el);
      return () => observer.disconnect();
    } else {
      el.style.opacity = "0";
      el.style.transform = "translateY(20px)";
      el.style.filter = "blur(4px)";
      el.style.transition = `opacity 0.7s ${easing}, transform 0.7s ${easing}, filter 0.7s ${easing}`;

      const observer = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) {
            el.style.opacity = "1";
            el.style.transform = "translateY(0)";
            el.style.filter = "blur(0)";
            observer.disconnect();
          }
        },
        { threshold }
      );

      observer.observe(el);
      return () => observer.disconnect();
    }
  }, [staggerChildren, staggerDelay, threshold]);

  return ref;
}
