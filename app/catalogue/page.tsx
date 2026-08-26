import Link from 'next/link';

import manifest from '../../public/corpus/manifest.json';
import { pageMetadata } from '../site-metadata';

export const metadata = pageMetadata(
  'Catalogue of All XXXVII Books',
  'A readable catalogue of all thirty-seven books in Pliny the Elder’s Naturalis Historia.',
  '/catalogue',
);

export default function CataloguePage() {
  return (
    <main className="editorial-page">
      <article className="editorial-leaf catalogue-leaf">
        <nav className="editorial-nav" aria-label="Catalogue navigation"><Link href="/">← Return to the codex</Link><Link href="/edition">Edition & sources</Link><Link href="/privacy">Privacy</Link></nav>
        <header className="editorial-masthead">
          <p>INDEX LIBRORVM · I–XXXVII</p>
          <h1>The complete work</h1>
          <span>{manifest.totalChapters.toLocaleString('en-US')} bilingual reading units · {manifest.totalLatinWords.toLocaleString('en-US')} Latin words · {manifest.totalEnglishWords.toLocaleString('en-US')} English words</span>
        </header>
        <ol className="catalogue-grid">
          {manifest.books.map((book) => (
            <li key={book.number}>
              <a href={`/read/${book.number}/${book.number === 1 ? 'praef' : '1'}.html`}>
                <b>{book.roman}</b>
                <span><strong>{book.title}</strong><small>{book.chapterCount} bilingual {book.chapterCount === 1 ? 'leaf' : 'leaves'} · open the first leaf</small></span>
              </a>
            </li>
          ))}
        </ol>
        <aside className="catalogue-afterword">
          <div><span>AFTER THE COMPLETE WORK · SEPARATE TESTIMONY</span><h2>Two Letters from Vesuvius</h2><p>Pliny the Younger’s <i>Epistulae</i> VI.16 and VI.20 in Latin and English—presented after, and explicitly outside, his uncle’s thirty-seven books.</p></div>
          <Link href="/afterword/vesuvius">Open the afterword →</Link>
        </aside>
        <footer className="editorial-colophon"><span>Pliny’s world, without an omitted book.</span><Link href="/">Begin reading →</Link></footer>
      </article>
    </main>
  );
}
