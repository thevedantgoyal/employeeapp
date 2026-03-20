import { useRef, useState, useCallback } from "react";

/**
 * Option C: Horizontal scroll with fade edges. No scrollbar. Use for filter pills app-wide.
 * - paddingHorizontal: 16px, gap: 8px
 * - Right fade gradient always visible
 * - Left fade gradient visible only when scrolled right (scrollOffset > 0)
 */
export function ScrollablePillRow({ children }: { children: React.ReactNode }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showLeftFade, setShowLeftFade] = useState(false);

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    setShowLeftFade(!!(el && el.scrollLeft > 0));
  }, []);

  return (
    <div className="relative px-4">
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="overflow-x-auto scrollbar-hide -mx-4 px-4"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
      >
        <div className="flex gap-2 min-w-max">
          {children}
        </div>
      </div>
      {/* Right fade — more content to the right */}
      <div
        className="absolute right-0 top-0 bottom-0 w-12 bg-gradient-to-r from-transparent to-background pointer-events-none"
        aria-hidden
      />
      {/* Left fade — only when scrolled right */}
      {showLeftFade && (
        <div
          className="absolute left-0 top-0 bottom-0 w-12 bg-gradient-to-r from-background to-transparent pointer-events-none"
          aria-hidden
        />
      )}
    </div>
  );
}
