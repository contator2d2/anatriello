import { useState, useEffect } from 'react';
import { useOfflineSync } from '@/hooks/use-offline-sync';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';

interface LocalImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src: string | undefined;
}

export function LocalImage({ src, className, ...props }: LocalImageProps) {
  const [resolvedUrl, setResolvedUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { getLocalFileUrl } = useOfflineSync();

  useEffect(() => {
    let isMounted = true;
    
    async function resolve() {
      if (!src) {
        setResolvedUrl(null);
        setIsLoading(false);
        return;
      }

      if (src.startsWith('local-file://')) {
        const localId = src.replace('local-file://', '');
        const url = await getLocalFileUrl(localId);
        if (isMounted) {
          setResolvedUrl(url);
          setIsLoading(false);
        }
      } else {
        if (isMounted) {
          setResolvedUrl(src);
          setIsLoading(false);
        }
      }
    }

    resolve();

    return () => {
      isMounted = false;
    };
  }, [src, getLocalFileUrl]);

  if (isLoading) {
    return <Skeleton className={cn("w-full h-full", className)} />;
  }

  if (!resolvedUrl) return null;

  return (
    <img
      src={resolvedUrl}
      className={className}
      {...props}
    />
  );
}
