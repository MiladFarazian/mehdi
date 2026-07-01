'use client';

// Small merchant logo (Plaid enrichment). Falls back to a placeholder chip and
// hides itself if the image fails to load.
export function Logo({ url, size = 22 }: { url?: string | null; size?: number }) {
  if (!url) {
    return <span className="logo-ph" style={{ width: size, height: size, flex: `0 0 ${size}px` }} />;
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt=""
      width={size}
      height={size}
      className="logo-img"
      style={{ flex: `0 0 ${size}px` }}
      onError={(e) => {
        (e.currentTarget as HTMLImageElement).style.visibility = 'hidden';
      }}
    />
  );
}
