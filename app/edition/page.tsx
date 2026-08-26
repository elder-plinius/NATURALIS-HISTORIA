import Link from 'next/link';

import policy from '../../edition-policy.json';
import { pageMetadata } from '../site-metadata';

export const metadata = pageMetadata(
  'Edition & Sources',
  'Editorial method, source provenance, rights, historical content notice, and correction policy for The Living Codex.',
  '/edition',
);

export default function EditionPage() {
  return (
    <main className="editorial-page">
      <article className="editorial-leaf">
        <nav className="editorial-nav" aria-label="Edition navigation"><Link href="/">← Return to the codex</Link><Link href="/catalogue">All XXXVII books</Link><Link href="/privacy">Privacy</Link></nav>
        <header className="editorial-masthead">
          <p>DE EDITIONE · FONTIBVS · FIDE</p>
          <h1>About this edition</h1>
          <span>The source remains visible beneath the enchantment.</span>
        </header>

        <section className="editorial-prose">
          <p><em>Natural History: The Living Codex</em> is a modern bilingual reading edition of Pliny the Elder’s <em>Naturalis Historia</em>. It is not a manuscript facsimile, a critical edition, or a new translation.</p>
          <p>The Latin reading text is drawn from Karl Friedrich Theodor Mayhoff’s 1906 Teubner edition as encoded by the Perseus Digital Library. The facing English is John Bostock and H. T. Riley’s 1855–57 translation, digitized and proofread in six Project Gutenberg volumes. The translation retains its nineteenth-century diction.</p>
          <p>The reader contains all thirty-seven books in 1,065 bilingual reading units: one Book I dedication-and-index unit and 1,064 numbered Perseus TEI chapter divisions. Smaller Mayhoff section markers remain metadata rather than separate pages. Bostock and Riley’s finer chapter headings remain visible and searchable where several fall within one Latin unit.</p>
          <p>For readability, the build removes Latin critical apparatus, English scholarly footnotes, and page furniture. The reading text is derived from a pinned Perseus transcription and the historical translation, with source order retained and every intervention exposed in a <a href="/corpus/corrections.json">reviewable correction ledger</a>: eight confirmed Latin corrections, twenty-six extraction repairs, and all twenty-seven Gutenberg Volume I Appendix entries (twenty-five applied to reader prose and two documented as excluded material). It does not silently modernize either source. Bostock and Riley is aligned at chapter level and is not a new line-by-line translation of the displayed Mayhoff text. Immutable source URLs, commits, and SHA-256 receipts are published in the <a href="/corpus/manifest.json">corpus manifest</a>.</p>
          <p>Every illustration, Latin plate caption, and page composition is a modern editorial addition. After Book XXXVII, a clearly separated <Link href="/afterword/vesuvius">Vesuvius afterword</Link> presents Pliny the Younger’s <em>Epistulae</em> VI.16 and VI.20. Those later letters are testimony about the Elder and the eruption—not part of <em>Naturalis Historia</em>, not a thirty-eighth book, and not included in the corpus count or search index.</p>
        </section>

        <section className="editorial-panel" id="rights">
          <p className="editorial-kicker">RIGHTS & ATTRIBUTION</p>
          <h2>A mixed-rights scholarly object</h2>
          <p>Latin digital text: Pliny the Elder, <em>Naturalis Historia</em>, ed. Karl Friedrich Theodor Mayhoff (Teubner, 1906), through the Perseus Digital Library electronic edition. The Perseus <a href="https://github.com/PerseusDL/canonical-latinLit" target="_blank" rel="noreferrer">canonical-latinLit source</a> is licensed under <a href="https://creativecommons.org/licenses/by-sa/4.0/" target="_blank" rel="noreferrer">CC BY-SA 4.0</a>; extraction and alignment modifications to that data are distributed on the same basis.</p>
          <p>English translation: John Bostock and H. T. Riley, <em>The Natural History of Pliny</em> (1855–57), from Project Gutenberg ebooks 57493, 60230, 59131, 61113, 60688, and 62704. Their source records identify the works as public domain in the United States; status may differ elsewhere.</p>
          <p>Afterword Latin: Pliny the Younger, <em>Epistulae</em> VI.16 and VI.20, from the Perseus <a href="https://github.com/PerseusDL/canonical-latinLit" target="_blank" rel="noreferrer">canonical-latinLit source</a>, CC BY-SA 4.0. Afterword English: William Melmoth’s translation, revised by F. C. T. Bosanquet, from <a href="https://www.gutenberg.org/ebooks/2811" target="_blank" rel="noreferrer">Project Gutenberg ebook 2811</a>; Gutenberg identifies it as public domain in the United States. The historical English reflects a different textual tradition and is not a fresh line-by-line translation of the displayed Perseus Latin. Line wrapping and footnote markers are omitted, one obvious Gutenberg transcription error—<em>Miscnum</em>—is disclosed and normalized to <em>Misenum</em>, and sections are grouped into six editorial folios per letter.</p>
          <p>The <a href="/provenance.json">machine-readable provenance ledger</a> publishes source hashes and derivative paths for 1,065 independently generated chapter scenes, the dedication plate, the Vesuvius afterword plate, and the social card. All 1,068 media records have source-bound creator/tool provenance and AGPL-3.0 clearance. The public repository retains the responsive delivery files and audit receipts; the multi-gigabyte chapter-scene PNG preservation masters are excluded from Git and can be preserved in separately checksummed source-asset archives.</p>
        </section>

        <section className="editorial-warning" id="content-notice">
          <p className="editorial-kicker">HISTORICAL CONTENT NOTICE</p>
          <h2>Read as history, never as instruction.</h2>
          <p>Pliny’s ancient text and the nineteenth-century translation preserve claims and language from their own periods. Some passages contain obsolete or offensive descriptions of peoples, bodies, disability, sex, and belief, along with graphic accounts of illness, violence, animal killing, and bodily substances.</p>
          <p>Books on remedies describe toxic materials, magic, and medical practices that are unsafe by modern standards. This material is presented for historical and scholarly reading only. <strong>It is not medical advice: do not ingest, apply, or attempt any remedy described here.</strong></p>
        </section>

        <section className="editorial-prose" id="corrections">
          <h2>Corrections & versioning</h2>
          <p>When reporting a problem to the edition owner, include the reader URL, book, TEI chapter, language, a short quotation, and—when possible—the source supporting the correction. Please distinguish a historical source reading from a transcription, extraction, alignment, caption, or illustration-routing error.</p>
          <p>Verified repairs enter the reviewable correction ledger rather than silently rewriting the sources. Release edition {policy.version}, dated 26 August 2026.</p>
        </section>

        <footer className="editorial-colophon"><span>XXXVII books · 1,065 bilingual leaves</span><Link href="/">Open the living codex →</Link></footer>
      </article>
    </main>
  );
}
