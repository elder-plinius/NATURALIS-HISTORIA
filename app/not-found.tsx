import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="editorial-page"><article className="editorial-leaf editorial-leaf-compact"><header className="editorial-masthead"><p>FOLIVM NON INVENTVM</p><h1>This leaf is not in the codex.</h1><span>The complete work remains intact; the requested path does not.</span></header><footer className="editorial-colophon"><span>Return to the verified reading corpus.</span><Link href="/">Open the living codex →</Link></footer></article></main>
  );
}
