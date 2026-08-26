import Link from 'next/link';

import policy from '../../edition-policy.json';
import { pageMetadata } from '../site-metadata';

export const metadata = pageMetadata(
  'Privacy',
  'A plain-language account of local reading state, search, accessibility, and hosting for The Living Codex.',
  '/privacy',
);

export default function PrivacyPage() {
  return (
    <main className="editorial-page">
      <article className="editorial-leaf editorial-leaf-compact">
        <nav className="editorial-nav" aria-label="Privacy navigation"><Link href="/">← Return to the codex</Link><Link href="/edition">Edition & sources</Link></nav>
        <header className="editorial-masthead">
          <p>DE MEMORIA · ACCESSV · PRIVATO</p>
          <h1>Privacy</h1>
          <span>A reader should not become a surveillance instrument.</span>
        </header>
        <section className="editorial-prose">
          <h2>What this edition does not ask for</h2>
          <p>This edition creates no app-owned account or profile and has no advertising, comments, payments, or first-party behavioral analytics.</p>
          <h2>Reading position</h2>
          <p>The reader stores only your last book and chapter in your browser’s local storage so you can continue where you left off. That preference stays on the device and can be removed by clearing this site’s data.</p>
          <h2>Search</h2>
          <p>Corpus search runs in your browser against static, content-hashed concordance leaves. Raw search text is not sent to an application search server. The browser fetches static index shards selected from the search terms, so ordinary hosting logs may record those shard URLs; the thirty-seven book files are not downloaded merely to search.</p>
          <h2>Accessibility</h2>
          <p>The active reading language is exposed as semantic text even while the visible ink changes form. Keyboard navigation, focus indicators, reduced-motion behavior, and labelled controls remain part of the reader without requiring an account, microphone, or speech service.</p>
          <h2>Site delivery</h2>
          <p>Requests necessarily pass through the hosting service to deliver and secure the site, and infrastructure may process ordinary request and diagnostic metadata. The edition owner has not added advertising or cross-site profiling. Edition {policy.version} is configured as a public release candidate; a deployment receipt is separate evidence that it has actually been published.</p>
          <p>External links to Perseus, Project Gutenberg, Dickinson College, Pompeii Archaeological Park, Creative Commons, and GitHub leave this edition and are governed by those services’ policies.</p>
        </section>
        <footer className="editorial-colophon"><span>Last updated · 24 August 2026</span><Link href="/">Open the living codex →</Link></footer>
      </article>
    </main>
  );
}
