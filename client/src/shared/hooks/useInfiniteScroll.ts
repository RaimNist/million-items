import { useEffect, useRef } from 'react';

interface UseInfiniteScrollParams {
  hasMore: boolean;
  isLoading: boolean;
  onLoadMore: () => void;
}

export const useInfiniteScroll = ({
  hasMore,
  isLoading,
  onLoadMore,
}: UseInfiniteScrollParams) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const scrollContainer = scrollContainerRef.current;
    const loadMoreElement = loadMoreRef.current;

    if (!scrollContainer || !loadMoreElement || !hasMore || isLoading) {
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          onLoadMore();
        }
      },
      {
        root: scrollContainer,
        rootMargin: '0px 0px 120px 0px',
        threshold: 0,
      },
    );

    observer.observe(loadMoreElement);

    return () => {
      observer.disconnect();
    };
  }, [hasMore, isLoading, onLoadMore]);

  return {
    scrollContainerRef,
    loadMoreRef,
  };
};