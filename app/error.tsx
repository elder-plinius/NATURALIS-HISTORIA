'use client';

import { useEffect } from 'react';
import Link from 'next/link';

export default function ErrorBoundary({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error(error); }, [error]);
  return (
    <main className="editorial-page"><article className="editorial-leaf editorial-leaf-compact"><header className="editorial-masthead"><p>FOLIVM LAESVM</p><h1>This leaf could not be opened.</h1><span>The source corpus is unchanged. Retry the reader or return to its beginning.</span></header><div className="recovery-actions"><button type="button" onClick={reset}>Retry this leaf</button><Link href="/">Return to the codex</Link></div></article></main>
  );
}
