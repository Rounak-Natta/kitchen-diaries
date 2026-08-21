// components/shared/pagination.tsx
"use client";

import { memo, useCallback } from "react";
import { ChevronLeft, ChevronRight, MoreHorizontal } from "lucide-react";

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  siblingsCount?: number; // number of visible pages on each side of current
}

const DOTS = "dots";

export const Pagination = memo(({ currentPage, totalPages, onPageChange, siblingsCount = 1 }: PaginationProps) => {
  const generatePagination = useCallback((): (number | "dots")[] => {
    const totalPageNumbers = siblingsCount * 2 + 3; // first + last + current + 2*siblings
    if (totalPages <= totalPageNumbers) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }

    const leftSiblingIndex = Math.max(currentPage - siblingsCount, 1);
    const rightSiblingIndex = Math.min(currentPage + siblingsCount, totalPages);

    const shouldShowLeftDots = leftSiblingIndex > 2;
    const shouldShowRightDots = rightSiblingIndex < totalPages - 1;

    if (!shouldShowLeftDots && shouldShowRightDots) {
      const leftItems = 3 + 2 * siblingsCount;
      return [...Array.from({ length: leftItems }, (_, i) => i + 1), DOTS, totalPages];
    }

    if (shouldShowLeftDots && !shouldShowRightDots) {
      const rightItems = 3 + 2 * siblingsCount;
      return [1, DOTS, ...Array.from({ length: rightItems }, (_, i) => totalPages - rightItems + i + 1)];
    }

    if (shouldShowLeftDots && shouldShowRightDots) {
      const middleRange = Array.from({ length: rightSiblingIndex - leftSiblingIndex + 1 }, (_, i) => leftSiblingIndex + i);
      return [1, DOTS, ...middleRange, DOTS, totalPages];
    }

    return [];
  }, [currentPage, totalPages, siblingsCount]);

  const pages = generatePagination();

  const handlePrevious = useCallback(() => {
    if (currentPage > 1) onPageChange(currentPage - 1);
  }, [currentPage, onPageChange]);

  const handleNext = useCallback(() => {
    if (currentPage < totalPages) onPageChange(currentPage + 1);
  }, [currentPage, totalPages, onPageChange]);

  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-center gap-1 py-4">
      <button
        onClick={handlePrevious}
        disabled={currentPage === 1}
        className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-background text-muted-foreground transition hover:bg-muted disabled:opacity-40 disabled:hover:bg-background"
        aria-label="Previous page"
      >
        <ChevronLeft size={16} />
      </button>

      {pages.map((page, idx) =>
        page === DOTS ? (
          <span key={`dots-${idx}`} className="flex h-8 w-8 items-center justify-center text-muted-foreground">
            <MoreHorizontal size={16} />
          </span>
        ) : (
          <button
            key={page}
            onClick={() => onPageChange(page as number)}
            className={`h-8 w-8 rounded-lg text-sm font-medium transition ${
              currentPage === page
                ? "bg-primary text-white"
                : "border border-border bg-background text-foreground hover:bg-muted"
            }`}
          >
            {page}
          </button>
        )
      )}

      <button
        onClick={handleNext}
        disabled={currentPage === totalPages}
        className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-background text-muted-foreground transition hover:bg-muted disabled:opacity-40 disabled:hover:bg-background"
        aria-label="Next page"
      >
        <ChevronRight size={16} />
      </button>
    </div>
  );
});

Pagination.displayName = "Pagination";