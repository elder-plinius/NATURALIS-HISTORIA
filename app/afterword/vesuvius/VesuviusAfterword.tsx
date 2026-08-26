'use client';

import Link from 'next/link';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react';

import { InkParagraphs } from '../../InkDiffusionText';
import { VESUVIUS_FOLIO_SOURCES } from './generated-folio-sources.mjs';

type Folio = {
  number: number;
  sectionStart: number;
  sectionEnd: number;
  editorialTitle: string;
  artworkId: string;
  imageAlt: string;
  imageCaption: string;
  latin: string;
  english: string;
};

type Letter = {
  id: string;
  canonicalReference: string;
  ctsUrn: string;
  editorialTitle: string;
  summary: string;
  latinHeading: string;
  sectionCount: number;
  folios: Folio[];
};

export type LettersData = {
  title: string;
  editorialBoundary: string;
  dateNote: string;
  latinSource: {
    edition: string;
    url: string;
    license: string;
    licenseUrl: string;
    modifications: string[];
  };
  englishSource: {
    translator: string;
    reviser: string;
    source: string;
    url: string;
    rightsBasis: string;
    modifications: string[];
  };
  letters: Letter[];
};

type LanguageMode = 'auto' | 'la' | 'en';
type DiffusionPhase = 'latin' | 'diffusing' | 'english';

function paragraphs(text: string, language: 'la' | 'en') {
  const blocks = text.split(/\n{2,}/).map((paragraph) => paragraph.trim()).filter(Boolean);
  const seed = `afterword:${language}:${text.length}:${text.slice(0, 72)}:${text.slice(-36)}`;
  return <InkParagraphs paragraphs={blocks} seed={seed} maxAnimatedWords={260} paragraphProps={() => ({ lang: language })} />;
}

function clampLeaf(value: number, maximum: number) {
  return Number.isFinite(value) ? Math.min(maximum, Math.max(0, Math.round(value))) : 0;
}

export default function VesuviusAfterword({ data }: { data: LettersData }) {
  const leaves = useMemo(() => data.letters.flatMap((letter) => letter.folios.map((folio) => ({ letter, folio }))), [data.letters]);
  const lastLeaf = leaves.length + 1;
  const [leaf, setLeaf] = useState(0);
  const [hasTurnedLeaf, setHasTurnedLeaf] = useState(false);
  const [languageMode, setLanguageMode] = useState<LanguageMode>('auto');
  const [diffusionPhase, setDiffusionPhase] = useState<DiffusionPhase>('latin');
  const [fullscreen, setFullscreen] = useState(false);
  const articleRef = useRef<HTMLElement | null>(null);
  const passageRef = useRef<HTMLDivElement | null>(null);

  const content = leaf > 0 && leaf <= leaves.length ? leaves[leaf - 1] : null;
  const activeLanguage: 'la' | 'en' = diffusionPhase === 'latin' ? 'la' : 'en';

  const setLeafFromLocation = useCallback(() => {
    const value = Number(new URL(window.location.href).searchParams.get('leaf') ?? 0);
    if (languageMode !== 'en') setDiffusionPhase('latin');
    setLeaf(clampLeaf(value, lastLeaf));
  }, [languageMode, lastLeaf]);

  useEffect(() => {
    const initialize = window.setTimeout(setLeafFromLocation, 0);
    window.addEventListener('popstate', setLeafFromLocation);
    return () => {
      window.clearTimeout(initialize);
      window.removeEventListener('popstate', setLeafFromLocation);
    };
  }, [setLeafFromLocation]);

  const goTo = useCallback((nextLeaf: number) => {
    const bounded = clampLeaf(nextLeaf, lastLeaf);
    if (bounded === leaf) return;
    setHasTurnedLeaf(true);
    const url = new URL(window.location.href);
    if (bounded === 0) url.searchParams.delete('leaf');
    else url.searchParams.set('leaf', String(bounded));
    window.history.pushState({ afterwordLeaf: bounded }, '', `${url.pathname}${url.search}${url.hash}`);
    if (languageMode !== 'en') setDiffusionPhase('latin');
    setLeaf(bounded);
    window.requestAnimationFrame(() => articleRef.current?.focus({ preventScroll: true }));
  }, [languageMode, lastLeaf, leaf]);

  useLayoutEffect(() => {
    if (passageRef.current) passageRef.current.scrollTop = 0;
  }, [leaf]);

  useEffect(() => {
    if (!content || languageMode !== 'auto') return;
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const diffuse = prefersReducedMotion ? 0 : window.setTimeout(() => setDiffusionPhase('diffusing'), 480);
    const resolve = window.setTimeout(() => setDiffusionPhase('english'), prefersReducedMotion ? 520 : 1780);
    return () => {
      if (diffuse) window.clearTimeout(diffuse);
      window.clearTimeout(resolve);
    };
  }, [content, languageMode]);

  useEffect(() => {
    if (languageMode !== 'en' || diffusionPhase !== 'diffusing') return;
    const resolve = window.setTimeout(() => setDiffusionPhase('english'), 1300);
    return () => window.clearTimeout(resolve);
  }, [diffusionPhase, languageMode]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest('button, a, input, select, textarea, [contenteditable="true"]')) return;
      if (event.key === 'ArrowRight' && leaf < lastLeaf) {
        event.preventDefault();
        goTo(leaf + 1);
      } else if (event.key === 'ArrowLeft' && leaf > 0) {
        event.preventDefault();
        goTo(leaf - 1);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [goTo, lastLeaf, leaf]);

  useEffect(() => {
    const onFullscreen = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', onFullscreen);
    return () => document.removeEventListener('fullscreenchange', onFullscreen);
  }, []);

  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else if (document.fullscreenEnabled) await document.documentElement.requestFullscreen();
    } catch {
      setFullscreen(Boolean(document.fullscreenElement));
    }
  };

  const selectLanguageMode = (mode: LanguageMode) => {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    setLanguageMode(mode);
    if (mode === 'en') {
      setDiffusionPhase((current) => prefersReducedMotion || current === 'english' ? 'english' : 'diffusing');
    } else {
      setDiffusionPhase('latin');
    }
  };

  const renderPlate = (folio: Folio, className = '') => {
    const source = VESUVIUS_FOLIO_SOURCES[folio.artworkId as keyof typeof VESUVIUS_FOLIO_SOURCES];
    if (!source) throw new Error(`Missing Vesuvius folio artwork: ${folio.artworkId}`);
    const style = {
      '--afterword-panel-fallback': `url("${source.desktop.fallback}")`,
      '--afterword-panel-image-set': source.desktop.imageSet,
      '--afterword-panel-image-set-mobile': source.mobile.imageSet,
    } as CSSProperties;
    return (
      <figure className={`afterword-plate ${className}`.trim()}>
        <div className="afterword-plate-image" style={style} role="img" aria-label={folio.imageAlt} />
        <figcaption>{folio.imageCaption}<span>Modern editorial plate</span></figcaption>
      </figure>
    );
  };

  return (
    <main className="afterword-shell">
      <header className="afterword-header">
        <Link href="/?book=37&section=13" className="afterword-return">← Book XXXVII</Link>
        <div className="afterword-lockup"><span>POST XXXVII LIBROS</span><b>PLINII MINORIS EPISTVLAE</b></div>
        <div className="afterword-tools">
          <button type="button" onClick={() => void toggleFullscreen()} aria-pressed={fullscreen}>{fullscreen ? 'Exit full screen' : 'Full screen'}</button>
          <Link href="/catalogue">Catalogue</Link>
        </div>
      </header>

      <article className="afterword-reader" ref={articleRef} tabIndex={-1} aria-label={`Vesuvius afterword, leaf ${leaf + 1} of ${lastLeaf + 1}`}>
        {leaf === 0 && (
          <section className="afterword-opening">
            <div className="afterword-atlas-full" role="img" aria-label="Four modern editorial scenes from the Vesuvius letters: observation, the fleet, Rectina’s appeal, and the ash-dark shore" />
            <div className="afterword-opening-copy">
              <p className="afterword-supra">AFTERWORD · NOT PART OF <i>NATVRALIS HISTORIA</i></p>
              <h1>Two letters<br /><em>from Vesuvius</em></h1>
              <p className="afterword-boundary"><strong>Here ends Pliny the Elder’s complete thirty-seven-book work.</strong> What follows belongs to the later <i>Epistulae</i> of his nephew, Pliny the Younger.</p>
              <p>Writing to Tacitus roughly a generation after the eruption, the Younger gives two complementary accounts: VI.16 follows his uncle’s final voyage toward Stabiae; VI.20 returns to the Younger and his mother at Misenum.</p>
              <button type="button" className="afterword-begin" onClick={() => goTo(1)}>Open Epistula VI.16 <span>→</span></button>
              <small>{data.editorialBoundary}</small>
            </div>
          </section>
        )}

        {content && (
          <section className="afterword-folio">
            <aside className="afterword-visual-column">
              {renderPlate(content.folio)}
              <div className="afterword-letter-map" aria-label={`Position in ${content.letter.canonicalReference}`}>
                <p>{content.letter.canonicalReference}</p>
                <div>{content.letter.folios.map((folio) => <i className={folio.number === content.folio.number ? 'active' : ''} key={folio.number} />)}</div>
                <span>Sections {content.folio.sectionStart}–{content.folio.sectionEnd} of {content.letter.sectionCount}</span>
              </div>
            </aside>

            <div className="afterword-text-column">
              <header className="afterword-folio-title">
                <p>{content.letter.canonicalReference} · FOLIO {content.folio.number} OF VI</p>
                <h1>{content.folio.editorialTitle}</h1>
                <span lang="la">{content.letter.latinHeading}</span>
              </header>

              <div className="afterword-language-controls" role="group" aria-label="Reading language">
                {(['auto', 'la', 'en'] as const).map((mode) => (
                  <button type="button" className={languageMode === mode ? 'active' : ''} aria-pressed={languageMode === mode} onClick={() => selectLanguageMode(mode)} key={mode}>
                    {mode === 'auto' ? 'Latin → English' : mode === 'la' ? 'Latin' : 'English'}
                  </button>
                ))}
                <span aria-live="polite">{diffusionPhase === 'diffusing' ? 'Ink translating…' : activeLanguage === 'la' ? 'Original Latin' : 'Melmoth translation'}</span>
              </div>

              <div
                ref={passageRef}
                className={`afterword-passage phase-${diffusionPhase}`}
                role="region"
                tabIndex={0}
                aria-label={`${activeLanguage === 'la' ? 'Original Latin' : 'Melmoth English translation'} reading passage; scroll for the complete leaf`}
              >
                <div className="afterword-language-stack">
                  <section className="afterword-text-layer latin-layer" aria-hidden={activeLanguage !== 'la'}>{paragraphs(content.folio.latin, 'la')}</section>
                  <section className="afterword-text-layer english-layer" aria-hidden={activeLanguage !== 'en'}>{paragraphs(content.folio.english, 'en')}</section>
                  {diffusionPhase === 'diffusing' && <div className="afterword-ink-drift" aria-hidden="true" />}
                </div>
              </div>

            </div>
          </section>
        )}

        {leaf === lastLeaf && (
          <section className="afterword-closing">
            <div className="afterword-closing-copy">
              <p className="afterword-supra">FINIS TESTIMONII · SOURCES & BOUNDARY</p>
              <h1>Letter is one thing.<br /><em>History another.</em></h1>
              <p>The two accounts remain what the Younger calls them: letters written to a friend, not an extension of his uncle’s encyclopedia. VI.16 combines what he saw at Misenum with reports received immediately afterward; VI.20 recounts his own experience.</p>
              <aside><strong>On the date</strong>{data.dateNote}</aside>
              <div className="afterword-sources">
                <p><b>Latin</b> <a href={data.latinSource.url} target="_blank" rel="noreferrer">Perseus canonical Latin text</a>, {data.latinSource.license}. TEI markup is omitted and sections are grouped into editorial folios.</p>
                <p><b>English</b> <a href={data.englishSource.url} target="_blank" rel="noreferrer">Project Gutenberg 2811</a>, translated by {data.englishSource.translator}, revised by {data.englishSource.reviser}. This historical translation reflects a different textual tradition and is not a fresh exact rendering of the displayed Perseus Latin. Public domain in the United States; status may differ elsewhere.</p>
                <p><b>Study editions</b> <a href="https://dcc.dickinson.edu/pliny-letters/6-16" target="_blank" rel="noreferrer">Dickinson VI.16</a> · <a href="https://dcc.dickinson.edu/pliny-letters/6-20" target="_blank" rel="noreferrer">Dickinson VI.20</a></p>
              </div>
              <Link href="/" className="afterword-begin">Return to <i>Naturalis Historia</i> <span>→</span></Link>
            </div>
            <div className="afterword-quadrants" aria-label="Four Vesuvius editorial plates">
              {renderPlate(data.letters[0].folios[1])}
              {renderPlate(data.letters[0].folios[3])}
              {renderPlate(data.letters[0].folios[4])}
              {renderPlate(data.letters[1].folios[5])}
            </div>
          </section>
        )}

        <nav className="afterword-pagination" aria-label="Afterword leaves">
          <button type="button" onClick={() => goTo(leaf - 1)} disabled={leaf === 0} aria-label="Previous afterword leaf" aria-keyshortcuts="ArrowLeft"><span>‹</span><small>Previous</small></button>
          <div><b>{String(leaf + 1).padStart(2, '0')}</b><span>/</span><small>{String(lastLeaf + 1).padStart(2, '0')}</small></div>
          <button type="button" onClick={() => goTo(leaf + 1)} disabled={leaf === lastLeaf} aria-label="Next afterword leaf" aria-keyshortcuts="ArrowRight"><small>Next</small><span>›</span></button>
        </nav>
      </article>

      <p className="sr-only" aria-live="polite">
        Afterword leaf {leaf + 1} of {lastLeaf + 1}{content ? `, ${content.letter.canonicalReference}, ${content.folio.editorialTitle}` : leaf === 0 ? ', introduction' : ', sources and boundary'}.
      </p>

      <footer className="afterword-footer">
        <span className={hasTurnedLeaf ? 'is-dismissed' : ''} aria-hidden={hasTurnedLeaf}>Use ← → to turn leaves</span>
      </footer>
    </main>
  );
}
