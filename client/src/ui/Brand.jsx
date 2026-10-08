import { useState } from 'react';

// App name and logo in one place. The logo is client/public/logo.png; until that file
// exists, a drawn leaf-and-bag mark stands in.
export const APP_NAME = 'Product Copy Studio';

function FallbackMark({ size }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden="true">
      <rect x="4" y="11" width="26" height="25" rx="5" fill="var(--accent)" />
      <path d="M11 13v-3a6 6 0 0 1 12 0v3" fill="none" stroke="var(--accent)" strokeWidth="2.6" strokeLinecap="round" />
      <path d="M17 31c-4-4-3-10 3-12 4-1 7-3 8-6 3 7 0 16-8 18Z" fill="var(--leaf-light)" />
      <path d="M17 31c2-5 5-8 9-11" stroke="var(--accent)" strokeWidth="1.6" fill="none" strokeLinecap="round" />
    </svg>
  );
}

export function Logo({ size = 34, showName = true, light = false, href = '#/' }) {
  const [missing, setMissing] = useState(false);
  const mark = missing
    ? <FallbackMark size={size} />
    : <img src="/logo.png" alt="" width={size} height={size} onError={() => setMissing(true)} className="logo-img" />;
  const content = <>{mark}{showName && <span className="logo-name">{APP_NAME}</span>}</>;
  const className = `logo ${light ? 'light' : ''}`;
  return href ? <a href={href} className={className} aria-label={APP_NAME}>{content}</a> : <span className={className}>{content}</span>;
}
