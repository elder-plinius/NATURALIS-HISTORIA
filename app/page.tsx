'use client';

import type { AnimationEvent, CSSProperties, FormEvent } from 'react';
import { Fragment, memo, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

import { chapterIllustration } from './illustrations.mjs';
import { InkInline, InkParagraphs } from './InkDiffusionText';
import { requiredShardIds, searchPositionalIndex } from './search-index.mjs';
import { findSearchRanges, normalizeSearchText, searchIsReady } from './search.mjs';

type Language = 'la' | 'en';
type TranslationMode = 'auto' | Language;
type DiffusionState = 'latin' | 'diffusing' | 'english';
type ReaderPhase = 'idle' | 'loading' | 'turning';
type TurnDirection = 'forward' | 'backward';
type HistoryMode = 'push' | 'replace' | 'none';

type ManifestBook = {
  number: number;
  roman: string;
  title: string;
  chapterCount: number;
  file: string;
  sha256: string;
  byteLength: number;
  latinChapterStart?: number;
  latinChapterEnd?: number;
  latinChapterCount?: number;
  mayhoffSectionMarkerCount: number;
  englishChapterCount?: number;
  englishChapterMax?: number;
};

type Manifest = {
  title: string;
  author: string;
  totalBooks: number;
  totalChapters: number;
  totalLatinWords: number;
  totalEnglishWords: number;
  totalEnglishEndmatterWords: number;
  latinEdition: string;
  englishEdition: string;
  readingTextPolicy?: string;
  searchIndex?: {
    version: number;
    revision: string;
    catalog: string;
    shardTemplate: string;
    shardCount: number;
    hash: string;
  };
  books: ManifestBook[];
};

type Chapter = {
  id: string;
  label: string;
  title: string;
  latinTitle: string;
  latin: string;
  english: string;
  latinWords: number;
  englishWords: number;
  chapterStart: string | number;
  chapterEnd: string | number;
  mayhoffSections: string[];
  englishChapters: Array<{
    number: number;
    title: string;
  }>;
};

type BookData = {
  number: number;
  roman: string;
  title: string;
  chapters: Chapter[];
  englishEndmatter: string[];
};

type Location = {
  ordinal: number;
  bookNumber: number;
  chapterIndex: number;
};

type Theme = {
  motto: string;
  latinMotto: string;
};

type SearchResult = {
  key: string;
  ordinal: number;
  bookNumber: number;
  roman: string;
  chapterIndex: number;
  chapterId: string;
  title: string;
  field: Language;
  excerpt: string;
  wordPosition?: number;
  score: number;
  englishChapterNumber?: number;
};

type SearchCatalog = {
  v: number;
  r: string;
  s: number;
  d: Array<[number, string, number, string, string, string, Array<[number, string]>]>;
  f: Array<[number, number, number, number]>;
};

type SearchShard = {
  v: number;
  r: string;
  id: number;
  t: Record<string, number[][]>;
};

const LATIN_DWELL_MS = 520;
const DIFFUSION_FAILSAFE_MS = 1600;
const CORPUS_FETCH_TIMEOUT_MS = 9000;
const LAST_LOCATION_KEY = 'naturalis-historia:last-location';
const STALE_CORPUS_REFRESH_KEY = 'naturalis-historia:stale-corpus-refresh';

const bookCache = new Map<number, BookData>();
const bookInflight = new Map<number, Promise<BookData>>();
const searchCatalogCache = new Map<string, SearchCatalog>();
const searchCatalogInflight = new Map<string, Promise<SearchCatalog>>();
const searchShardCache = new Map<string, SearchShard>();
const searchShardInflight = new Map<string, Promise<SearchShard>>();

class ArchiveAssetError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
    this.name = 'ArchiveAssetError';
  }
}

async function sha256Hex(bytes: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function fetchJson<T>(url: string, expectedSha256?: string): Promise<T> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), CORPUS_FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) throw new ArchiveAssetError(`The archive returned ${response.status}.`, response.status);
    const bytes = await response.arrayBuffer();
    if (expectedSha256 && await sha256Hex(bytes) !== expectedSha256) {
      throw new ArchiveAssetError('The archive leaf did not match this corpus release.');
    }
    return JSON.parse(new TextDecoder().decode(bytes)) as T;
  } catch (cause) {
    if (cause instanceof DOMException && cause.name === 'AbortError') {
      throw new Error('The archive took too long to answer. Please try this leaf again.');
    }
    throw cause;
  } finally {
    window.clearTimeout(timeout);
  }
}

function recoverStaleCorpus(cause: unknown): boolean {
  if (!(cause instanceof ArchiveAssetError) || (cause.status !== undefined && cause.status !== 404)) return false;
  const now = Date.now();
  try {
    const lastRefresh = Number(window.sessionStorage.getItem(STALE_CORPUS_REFRESH_KEY));
    if (Number.isFinite(lastRefresh) && now - lastRefresh < 30_000) return false;
    window.sessionStorage.setItem(STALE_CORPUS_REFRESH_KEY, String(now));
  } catch {
    // Without a session marker, automatic reload could loop indefinitely.
    return false;
  }
  window.location.reload();
  return true;
}

function loadBook(meta: ManifestBook): Promise<BookData> {
  const cached = bookCache.get(meta.number);
  if (cached) return Promise.resolve(cached);
  const pending = bookInflight.get(meta.number);
  if (pending) return pending;

  const request = fetchJson<BookData>(meta.file, meta.sha256)
    .then((book) => {
      if (book.number !== meta.number || !Array.isArray(book.chapters)) {
        throw new Error(`Book ${meta.roman} did not match its catalogue record.`);
      }
      bookCache.set(meta.number, book);
      bookInflight.delete(meta.number);
      return book;
    })
    .catch((error) => {
      bookInflight.delete(meta.number);
      throw error;
    });

  bookInflight.set(meta.number, request);
  return request;
}

function loadSearchCatalog(index: NonNullable<Manifest['searchIndex']>): Promise<SearchCatalog> {
  const cached = searchCatalogCache.get(index.revision);
  if (cached) return Promise.resolve(cached);
  const pending = searchCatalogInflight.get(index.revision);
  if (pending) return pending;
  const request = fetchJson<SearchCatalog>(index.catalog)
    .then((catalog) => {
      if (catalog.v !== index.version || catalog.r !== index.revision || catalog.s !== index.shardCount) {
        throw new Error('The concordance catalogue did not match this corpus release.');
      }
      searchCatalogCache.set(index.revision, catalog);
      searchCatalogInflight.delete(index.revision);
      return catalog;
    })
    .catch((error) => {
      searchCatalogInflight.delete(index.revision);
      throw error;
    });
  searchCatalogInflight.set(index.revision, request);
  return request;
}

function loadSearchShard(index: NonNullable<Manifest['searchIndex']>, shardId: number): Promise<SearchShard> {
  const key = `${index.revision}:${shardId}`;
  const cached = searchShardCache.get(key);
  if (cached) {
    searchShardCache.delete(key);
    searchShardCache.set(key, cached);
    return Promise.resolve(cached);
  }
  const pending = searchShardInflight.get(key);
  if (pending) return pending;
  const url = index.shardTemplate.replace('{id}', String(shardId).padStart(2, '0'));
  const request = fetchJson<SearchShard>(url)
    .then((shard) => {
      if (shard.v !== index.version || shard.r !== index.revision || shard.id !== shardId) {
        throw new Error('A concordance leaf did not match this corpus release.');
      }
      searchShardCache.set(key, shard);
      while (searchShardCache.size > 8) searchShardCache.delete(searchShardCache.keys().next().value as string);
      searchShardInflight.delete(key);
      return shard;
    })
    .catch((error) => {
      searchShardInflight.delete(key);
      throw error;
    });
  searchShardInflight.set(key, request);
  return request;
}

function abortable<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  if (signal.aborted) return Promise.reject(new DOMException('Aborted', 'AbortError'));
  return new Promise<T>((resolve, reject) => {
    const onAbort = () => reject(new DOMException('Aborted', 'AbortError'));
    signal.addEventListener('abort', onAbort, { once: true });
    promise.then(
      (value) => {
        signal.removeEventListener('abort', onAbort);
        resolve(value);
      },
      (cause) => {
        signal.removeEventListener('abort', onAbort);
        reject(cause);
      },
    );
  });
}

function isAbortError(cause: unknown): boolean {
  return cause instanceof DOMException && cause.name === 'AbortError';
}

const themes: Record<string, Theme> = {
  dedication: {
    motto: 'The whole world in thirty-seven books',
    latinMotto: 'Mundus universus libris XXXVII',
  },
  cosmos: {
    motto: 'Nature is nowhere greater than in the whole',
    latinMotto: 'Natura nulla parte maior quam tota',
  },
  geography: {
    motto: 'Every shore enters the record',
    latinMotto: 'Omne litus in memoriam venit',
  },
  humanity: {
    motto: 'The human creature, fragile and ingenious',
    latinMotto: 'Homo fragilis atque ingeniosus',
  },
  terrestrial: {
    motto: 'Nature speaks in signs',
    latinMotto: 'Natura signis loquitur',
  },
  marine: {
    motto: 'The sea keeps its own medicine',
    latinMotto: 'Mare medicinam suam servat',
  },
  flight: {
    motto: 'The smallest wings bear mysteries',
    latinMotto: 'Minimae alae mysteria ferunt',
  },
  botany: {
    motto: 'The forest is a gift to humankind',
    latinMotto: 'Silvae munus homini',
  },
  minerals: {
    motto: 'Earth becomes colour, image, and monument',
    latinMotto: 'Terra fit color imago monumentum',
  },
};

function themeForBook(bookNumber: number): Theme {
  if (bookNumber === 1) return themes.dedication;
  if (bookNumber === 2) return themes.cosmos;
  if (bookNumber <= 6) return themes.geography;
  if (bookNumber === 7 || (bookNumber >= 28 && bookNumber <= 30)) return themes.humanity;
  if (bookNumber === 8) return themes.terrestrial;
  if (bookNumber === 9 || bookNumber === 31 || bookNumber === 32) return themes.marine;
  if (bookNumber === 10 || bookNumber === 11) return themes.flight;
  if (bookNumber >= 12 && bookNumber <= 27) return themes.botany;
  return themes.minerals;
}

function offsetsFor(manifest: Manifest): number[] {
  const offsets: number[] = [];
  let total = 0;
  manifest.books.forEach((book) => {
    offsets.push(total);
    total += book.chapterCount;
  });
  return offsets;
}

function resolveOrdinal(manifest: Manifest, offsets: number[], requested: number): Location {
  const ordinal = Math.max(0, Math.min(manifest.totalChapters - 1, requested));
  let index = manifest.books.length - 1;
  for (let candidate = 0; candidate < manifest.books.length; candidate += 1) {
    if (ordinal < offsets[candidate] + manifest.books[candidate].chapterCount) {
      index = candidate;
      break;
    }
  }
  return {
    ordinal,
    bookNumber: manifest.books[index].number,
    chapterIndex: ordinal - offsets[index],
  };
}

function paragraphize(text: string): string[] {
  const paragraphs = text.split(/\n\s*\n/).map((paragraph) => paragraph.trim()).filter(Boolean);
  if (paragraphs.length <= 240) return paragraphs;

  // Book I's Latin index contains thousands of one-line entries. Preserve
  // every line while grouping them into a small number of paintable blocks.
  const grouped = paragraphs.slice(0, 12);
  for (let index = 12; index < paragraphs.length; index += 28) {
    grouped.push(paragraphs.slice(index, index + 28).join('\n'));
  }
  return grouped;
}

function compactNumber(value: number): string {
  return new Intl.NumberFormat('en-US').format(value);
}

function randomOrdinalExcluding(total: number, excluded: number): number {
  if (total <= 1) return 0;
  const optionCount = total - 1;
  const uint32Range = 0x1_0000_0000;
  const rejectionLimit = uint32Range - (uint32Range % optionCount);
  const draw = new Uint32Array(1);
  do crypto.getRandomValues(draw);
  while (draw[0] >= rejectionLimit);
  const candidate = draw[0] % optionCount;
  return candidate >= excluded ? candidate + 1 : candidate;
}

function coverageLabel(book: ManifestBook): string {
  if (book.number === 1) return 'Complete dedication and index';
  const chapterCount = book.latinChapterCount ?? book.chapterCount;
  const englishCount = book.englishChapterCount;
  return `${chapterCount} Perseus TEI chapters · ${book.mayhoffSectionMarkerCount} encoded Mayhoff section markers${englishCount ? ` · ${englishCount} Bostock–Riley chapters` : ''}`;
}

function MorphText({
  latin,
  english,
  state,
  className = '',
}: {
  latin: string;
  english: string;
  state: DiffusionState;
  className?: string;
}) {
  const accessibleText = state === 'latin' ? latin : english;
  const accessibleLanguage = state === 'latin' ? 'la' : 'en';
  const seed = `display:${latin.length}:${english.length}:${latin.slice(0, 48)}:${english.slice(0, 48)}`;
  return (
    <span className={`morph-text ${className} is-${state}`}>
      <span className="sr-only" lang={accessibleLanguage}>{accessibleText}</span>
      <span className="morph-layer morph-latin" lang="la" aria-hidden="true"><InkInline text={latin} seed={`${seed}:la`} /></span>
      <span className="morph-layer morph-english" lang="en" aria-hidden="true"><InkInline text={english} seed={`${seed}:en`} /></span>
    </span>
  );
}

const PassageCopy = memo(function PassageCopy({
  text,
  language,
}: {
  text: string;
  language: Language;
}) {
  const paragraphs = paragraphize(text);
  const seed = `passage:${language}:${text.length}:${text.slice(0, 96)}:${text.slice(-48)}`;
  return <InkParagraphs paragraphs={paragraphs} seed={seed} />;
});

const Passage = memo(function Passage({
  chapter,
  state,
  onDiffusionEnd,
}: {
  chapter: Chapter;
  state: DiffusionState;
  onDiffusionEnd: () => void;
}) {
  const handleAnimationEnd = (event: AnimationEvent<HTMLDivElement>) => {
    if (state === 'diffusing' && event.animationName === 'passage-gather') onDiffusionEnd();
  };

  return (
    <div className={`passage-morph is-${state}`}>
      <div className="passage-layer passage-latin" lang="la" aria-hidden={state !== 'latin'}>
        <span className="sr-only">Mayhoff Latin reading text</span>
        <PassageCopy text={chapter.latin} language="la" />
      </div>
      <div
        className="passage-layer passage-english"
        lang="en"
        aria-hidden={state === 'latin'}
        onAnimationEnd={handleAnimationEnd}
      >
        <span className="sr-only">English translation</span>
        <PassageCopy text={chapter.english} language="en" />
      </div>
    </div>
  );
});

function Highlight({ text, query }: { text: string; query: string }) {
  const matches = findSearchRanges(text, query);
  if (!matches.length) return text;
  const lastMatch = matches[matches.length - 1] as { index: number; length: number };
  return (
    <>
      {matches.map((match: { index: number; length: number }, index: number) => {
        const previous = matches[index - 1] as { index: number; length: number } | undefined;
        const before = text.slice(previous ? previous.index + previous.length : 0, match.index);
        const marked = text.slice(match.index, match.index + match.length);
        return <Fragment key={`${match.index}:${match.length}:${index}`}>{before}<mark>{marked}</mark></Fragment>;
      })}
      {text.slice(lastMatch.index + lastMatch.length)}
    </>
  );
}

export default function Home() {
  const router = useRouter();
  const [manifest, setManifest] = useState<Manifest | null>(null);
  const [activeBook, setActiveBook] = useState<BookData | null>(null);
  const [activeLocation, setActiveLocation] = useState<Location | null>(null);
  const [committedOrdinal, setCommittedOrdinal] = useState(0);
  const [desiredOrdinal, setDesiredOrdinal] = useState(0);
  const [phase, setPhase] = useState<ReaderPhase>('loading');
  const [turnDirection, setTurnDirection] = useState<TurnDirection>('forward');
  const [translationMode, setTranslationMode] = useState<TranslationMode>('auto');
  const [diffusionState, setDiffusionState] = useState<DiffusionState>('latin');
  const [indexOpen, setIndexOpen] = useState(false);
  const [indexBookNumber, setIndexBookNumber] = useState(1);
  const [indexBook, setIndexBook] = useState<BookData | null>(null);
  const [indexLoading, setIndexLoading] = useState(false);
  const [indexError, setIndexError] = useState('');
  const [indexRetryNonce, setIndexRetryNonce] = useState(0);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchProgress, setSearchProgress] = useState(0);
  const [searchMatchCount, setSearchMatchCount] = useState(0);
  const [searchFailures, setSearchFailures] = useState(0);
  const [searchLeafTotal, setSearchLeafTotal] = useState(0);
  const [searchError, setSearchError] = useState('');
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState('');
  const [shareNotice, setShareNotice] = useState('');
  const [focusMode, setFocusMode] = useState(false);
  const [mobilePlateOpen, setMobilePlateOpen] = useState(false);
  const [coverOpen, setCoverOpen] = useState(false);
  const [hasSavedLocation, setHasSavedLocation] = useState(false);
  const [plateViewerOpen, setPlateViewerOpen] = useState(false);
  const [randomPagePending, setRandomPagePending] = useState(false);

  const manifestRef = useRef<Manifest | null>(null);
  const offsetsRef = useRef<number[]>([]);
  const activeLocationRef = useRef<Location | null>(null);
  const committedRef = useRef(0);
  const desiredRef = useRef(0);
  const busyRef = useRef(false);
  const navigationHistoryModeRef = useRef<HistoryMode>('replace');
  const navigationVersionRef = useRef(0);
  const navigationAbortRef = useRef<AbortController | null>(null);
  const popGenerationRef = useRef(0);
  const popAbortRef = useRef<AbortController | null>(null);
  const transitionTargetRef = useRef<{ location: Location; book: BookData; token: number; version: number; historyMode: HistoryMode } | null>(null);
  const transitionTokenRef = useRef(0);
  const turnTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const turnPlatePreloadRef = useRef<HTMLLinkElement | null>(null);
  const pumpRef = useRef<() => void>(() => undefined);
  const readerShellRef = useRef<HTMLElement | null>(null);
  const passageScrollRef = useRef<HTMLDivElement | null>(null);
  const passageProgressRef = useRef<HTMLSpanElement | null>(null);
  const pendingScrollProgressRef = useRef<number | null>(null);
  const bookStageRef = useRef<HTMLElement | null>(null);
  const platePageRef = useRef<HTMLElement | null>(null);
  const documentScrollRef = useRef(0);
  const searchGenerationRef = useRef(0);
  const searchAbortRef = useRef<AbortController | null>(null);
  const translationModeRef = useRef<TranslationMode>('auto');
  const focusModeRef = useRef(false);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const coverDialogRef = useRef<HTMLElement | null>(null);
  const coverPrimaryRef = useRef<HTMLButtonElement | null>(null);
  const indexDialogRef = useRef<HTMLElement | null>(null);
  const indexCloseRef = useRef<HTMLButtonElement | null>(null);
  const indexSelectedBookRef = useRef<HTMLButtonElement | null>(null);
  const searchDialogRef = useRef<HTMLElement | null>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const plateViewerDialogRef = useRef<HTMLDialogElement | null>(null);
  const plateViewerTriggerRef = useRef<HTMLButtonElement | null>(null);
  const pendingSearchLandingRef = useRef<{ ordinal: number; field: Language; wordPosition: number } | null>(null);
  const searchLandingTimerRef = useRef<number | null>(null);
  const randomPageTimerRef = useRef<number | null>(null);

  const schedulePump = useCallback(() => {
    queueMicrotask(() => pumpRef.current());
  }, []);

  const closePlateViewer = useCallback(() => {
    const dialog = plateViewerDialogRef.current;
    if (dialog?.open) dialog.close();
    else setPlateViewerOpen(false);
  }, []);

  const updatePassageProgress = useCallback((scroll = passageScrollRef.current) => {
    const meter = passageProgressRef.current;
    if (!scroll || !meter) return;
    const scrollable = Math.max(0, scroll.scrollHeight - scroll.clientHeight);
    const progress = scrollable > 0 ? scroll.scrollTop / scrollable : 1;
    meter.style.setProperty('--passage-progress', `${Math.max(0, Math.min(1, progress)) * 100}%`);
  }, []);

  const capturePassageProgress = useCallback(() => {
    const scroll = passageScrollRef.current;
    if (!scroll) return;
    const scrollable = Math.max(0, scroll.scrollHeight - scroll.clientHeight);
    pendingScrollProgressRef.current = scrollable > 0 ? scroll.scrollTop / scrollable : 0;
  }, []);

  const toggleFocusMode = useCallback(async () => {
    capturePassageProgress();
    if (focusMode) {
      focusModeRef.current = false;
      setFocusMode(false);
      if (document.fullscreenElement) await document.exitFullscreen().catch(() => undefined);
      window.requestAnimationFrame(() => window.scrollTo({ top: documentScrollRef.current, behavior: 'auto' }));
      return;
    }

    documentScrollRef.current = window.scrollY;
    setMobilePlateOpen(false);
    focusModeRef.current = true;
    setFocusMode(true);
    if (document.fullscreenEnabled && window.matchMedia('(min-width: 901px)').matches) {
      try {
        await readerShellRef.current?.requestFullscreen({ navigationUI: 'hide' });
      } catch {
        // Embedded browsers still receive the viewport-filling CSS reader.
      }
    }
    window.requestAnimationFrame(() => passageScrollRef.current?.focus({ preventScroll: true }));
  }, [capturePassageProgress, focusMode]);

  const toggleMobilePlate = useCallback(() => {
    setMobilePlateOpen((open) => {
      const next = !open;
      if (!focusMode) {
        window.setTimeout(() => {
          (next ? platePageRef.current : bookStageRef.current)?.scrollIntoView({
            block: 'start',
            behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
          });
        }, 30);
      }
      return next;
    });
  }, [focusMode]);

  const finishTurn = useCallback(() => {
    const target = transitionTargetRef.current;
    if (!target) return;
    if (turnTimerRef.current) clearTimeout(turnTimerRef.current);
    if (target.version !== navigationVersionRef.current || target.location.ordinal !== desiredRef.current) {
      transitionTargetRef.current = null;
      busyRef.current = false;
      setPhase('idle');
      schedulePump();
      return;
    }
    transitionTargetRef.current = null;
    pendingScrollProgressRef.current = null;
    setDiffusionState(translationModeRef.current === 'en' ? 'english' : 'latin');
    setActiveBook(target.book);
    setActiveLocation(target.location);
    activeLocationRef.current = target.location;
    setCommittedOrdinal(target.location.ordinal);
    committedRef.current = target.location.ordinal;
    setMobilePlateOpen(false);
    busyRef.current = false;
    setPhase('idle');
    if (passageScrollRef.current) passageScrollRef.current.scrollTop = 0;
    if (!focusModeRef.current && window.matchMedia('(max-width: 900px)').matches) {
      window.requestAnimationFrame(() => {
        bookStageRef.current?.scrollIntoView({
          block: 'start',
          behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
        });
      });
    }

    const chapter = target.book.chapters[target.location.chapterIndex];
    const url = new URL(window.location.href);
    url.searchParams.set('book', String(target.location.bookNumber));
    url.searchParams.set('section', chapter.id);
    const state = { nhOrdinal: target.location.ordinal, book: target.location.bookNumber, section: chapter.id };
    if (target.historyMode === 'push') window.history.pushState(state, '', `${url.pathname}${url.search}`);
    else if (target.historyMode === 'replace') window.history.replaceState(state, '', `${url.pathname}${url.search}`);
    try {
      window.localStorage.setItem(LAST_LOCATION_KEY, JSON.stringify({ book: target.location.bookNumber, section: chapter.id }));
    } catch {
      // Reading preferences remain optional and device-local.
    }
    schedulePump();
  }, [schedulePump]);

  const pumpNavigation = useCallback(() => {
    const currentManifest = manifestRef.current;
    if (!currentManifest || busyRef.current || desiredRef.current === committedRef.current) return;
    const offsets = offsetsRef.current;
    const targetOrdinal = desiredRef.current;
    const version = navigationVersionRef.current;
    const historyMode = navigationHistoryModeRef.current;
    const targetLocation = resolveOrdinal(currentManifest, offsets, targetOrdinal);
    const meta = currentManifest.books[targetLocation.bookNumber - 1];

    busyRef.current = true;
    setPhase('loading');
    const controller = new AbortController();
    navigationAbortRef.current = controller;
    abortable(loadBook(meta), controller.signal)
      .then(async (book) => {
        if (navigationAbortRef.current === controller) navigationAbortRef.current = null;
        if (desiredRef.current !== targetOrdinal || navigationVersionRef.current !== version) {
          busyRef.current = false;
          setPhase('idle');
          schedulePump();
          return;
        }
        if (desiredRef.current !== targetOrdinal || navigationVersionRef.current !== version) {
          busyRef.current = false;
          setPhase('idle');
          schedulePump();
          return;
        }
        const token = ++transitionTokenRef.current;
        const targetChapter = book.chapters[targetLocation.chapterIndex];
        const targetIllustration = chapterIllustration({
          bookNumber: book.number,
          bookRoman: book.roman,
          chapterId: targetChapter.id,
          chapterTitle: targetChapter.title,
        });
        const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
        if (!connection?.saveData) {
          turnPlatePreloadRef.current?.remove();
          const preload = document.createElement('link');
          preload.rel = 'preload';
          preload.as = 'image';
          preload.type = 'image/avif';
          preload.fetchPriority = 'high';
          const needsNative = !window.matchMedia('(max-width: 620px)').matches || window.devicePixelRatio > 1.4;
          preload.href = needsNative ? targetIllustration.preload.desktop : targetIllustration.preload.mobile;
          document.head.appendChild(preload);
          turnPlatePreloadRef.current = preload;
        }
        transitionTargetRef.current = { location: targetLocation, book, token, version, historyMode };
        setTurnDirection(targetOrdinal > committedRef.current ? 'forward' : 'backward');
        setPhase('turning');
        const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        const turnDuration = prefersReducedMotion
          ? 40
          : window.matchMedia('(max-width: 900px)').matches
            ? 520
            : 980;
        turnTimerRef.current = setTimeout(() => {
          if (transitionTargetRef.current?.token === token) finishTurn();
        }, turnDuration);
      })
      .catch((cause: unknown) => {
        if (navigationAbortRef.current === controller) navigationAbortRef.current = null;
        busyRef.current = false;
        setPhase('idle');
        if (isAbortError(cause) || desiredRef.current !== targetOrdinal || navigationVersionRef.current !== version) {
          schedulePump();
          return;
        }
        if (recoverStaleCorpus(cause)) return;
        setError(cause instanceof Error ? cause.message : 'The requested leaf could not be opened.');
      });
  }, [finishTurn, schedulePump]);

  useEffect(() => {
    pumpRef.current = pumpNavigation;
  }, [pumpNavigation]);

  useEffect(() => () => {
    turnPlatePreloadRef.current?.remove();
  }, []);

  useEffect(() => {
    translationModeRef.current = translationMode;
  }, [translationMode]);

  useEffect(() => {
    focusModeRef.current = focusMode;
  }, [focusMode]);

  useEffect(() => {
    if (!plateViewerOpen) return;
    const dialog = plateViewerDialogRef.current;
    if (!dialog) return;
    const previousOverflow = document.body.style.overflow;
    const finishClose = () => {
      setPlateViewerOpen(false);
      window.requestAnimationFrame(() => plateViewerTriggerRef.current?.focus({ preventScroll: true }));
    };
    const cancel = (event: Event) => {
      event.preventDefault();
      dialog.close();
    };
    dialog.addEventListener('close', finishClose);
    dialog.addEventListener('cancel', cancel);
    document.body.style.overflow = 'hidden';
    if (!dialog.open) dialog.showModal();
    window.requestAnimationFrame(() => dialog.querySelector<HTMLButtonElement>('.plate-viewer-close')?.focus());
    return () => {
      dialog.removeEventListener('close', finishClose);
      dialog.removeEventListener('cancel', cancel);
      document.body.style.overflow = previousOverflow;
    };
  }, [plateViewerOpen]);

  useEffect(() => {
    plateViewerTriggerRef.current = null;
    const dialog = plateViewerDialogRef.current;
    if (dialog?.open) dialog.close();
    else setPlateViewerOpen(false);
  }, [committedOrdinal]);

  const requestOrdinal = useCallback((ordinal: number, historyMode: HistoryMode = 'push') => {
    const currentManifest = manifestRef.current;
    if (!currentManifest) return;
    const clamped = Math.max(0, Math.min(currentManifest.totalChapters - 1, ordinal));
    if (clamped === desiredRef.current && clamped === committedRef.current) return;
    navigationVersionRef.current += 1;
    navigationHistoryModeRef.current = historyMode;
    navigationAbortRef.current?.abort();
    navigationAbortRef.current = null;
    if (transitionTargetRef.current) {
      if (turnTimerRef.current) clearTimeout(turnTimerRef.current);
      transitionTargetRef.current = null;
      busyRef.current = false;
      setPhase('idle');
    }
    desiredRef.current = clamped;
    setDesiredOrdinal(clamped);
    setError('');
    schedulePump();
  }, [schedulePump]);

  const openRandomPage = useCallback(() => {
    const currentManifest = manifestRef.current;
    if (!currentManifest || currentManifest.totalChapters <= 1 || phase !== 'idle' || randomPageTimerRef.current !== null) return;
    const targetOrdinal = randomOrdinalExcluding(currentManifest.totalChapters, committedRef.current);
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    setRandomPagePending(true);
    randomPageTimerRef.current = window.setTimeout(() => {
      randomPageTimerRef.current = null;
      setRandomPagePending(false);
    }, prefersReducedMotion ? 180 : 1180);
    requestOrdinal(targetOrdinal);
  }, [phase, requestOrdinal]);

  useEffect(() => () => {
    if (randomPageTimerRef.current !== null) window.clearTimeout(randomPageTimerRef.current);
  }, []);

  const dismissCover = useCallback(() => {
    setCoverOpen(false);
    const location = activeLocationRef.current;
    if (!location || !activeBook || activeBook.number !== location.bookNumber) return;
    const visibleChapter = activeBook.chapters[location.chapterIndex];
    const url = new URL(window.location.href);
    url.searchParams.set('book', String(location.bookNumber));
    url.searchParams.set('section', visibleChapter.id);
    window.history.replaceState({ nhOrdinal: location.ordinal, book: location.bookNumber, section: visibleChapter.id }, '', `${url.pathname}${url.search}`);
    try {
      window.localStorage.setItem(LAST_LOCATION_KEY, JSON.stringify({ book: location.bookNumber, section: visibleChapter.id }));
      setHasSavedLocation(true);
    } catch {
      // Reading preferences remain optional and device-local.
    }
  }, [activeBook]);

  useEffect(() => {
    let live = true;
    fetchJson<Manifest>('/corpus/manifest.json')
      .then(async (catalogue) => {
        if (!live) return;
        const offsets = offsetsFor(catalogue);
        manifestRef.current = catalogue;
        offsetsRef.current = offsets;
        setManifest(catalogue);

        const params = new URLSearchParams(window.location.search);
        const hasDeepLink = params.has('book') || params.has('section');
        let savedLocation: { book: number; section: string } | null = null;
        if (!hasDeepLink) {
          try {
            const saved = window.localStorage.getItem(LAST_LOCATION_KEY);
            if (saved) {
              const parsed = JSON.parse(saved) as { book?: unknown; section?: unknown };
              if (Number.isInteger(parsed.book) && typeof parsed.section === 'string') {
                savedLocation = { book: Number(parsed.book), section: parsed.section };
              }
            }
          } catch {
            // A private or locked-down browser may decline local preferences.
          }
        }
        const requestedBookParam = params.get('book');
        const parsedBook = requestedBookParam === null ? Number.NaN : Number(requestedBookParam);
        const requestedBook = Number.isInteger(parsedBook)
          ? Math.max(1, Math.min(catalogue.totalBooks, parsedBook))
          : savedLocation
            ? Math.max(1, Math.min(catalogue.totalBooks, savedLocation.book))
            : 2;
        const meta = catalogue.books[requestedBook - 1];
        const book = await loadBook(meta);
        if (!live) return;
        const requestedSection = params.get('section') ?? savedLocation?.section;
        const chapterIndex = Math.max(0, requestedSection
          ? book.chapters.findIndex((chapter) => chapter.id === requestedSection)
          : 0);
        const location = {
          ordinal: offsets[requestedBook - 1] + chapterIndex,
          bookNumber: requestedBook,
          chapterIndex,
        };
        setDiffusionState('latin');
        setActiveBook(book);
        setActiveLocation(location);
        activeLocationRef.current = location;
        setCommittedOrdinal(location.ordinal);
        committedRef.current = location.ordinal;
        setDesiredOrdinal(location.ordinal);
        desiredRef.current = location.ordinal;
        setIndexBookNumber(requestedBook);
        setIndexBook(book);
        setHasSavedLocation(Boolean(savedLocation));
        setCoverOpen(!hasDeepLink && !savedLocation);
        setPhase('idle');
        try {
          window.sessionStorage.removeItem(STALE_CORPUS_REFRESH_KEY);
        } catch {
          // Reading remains available when session storage is unavailable.
        }
        const canonicalUrl = new URL(window.location.href);
        canonicalUrl.searchParams.set('book', String(location.bookNumber));
        canonicalUrl.searchParams.set('section', book.chapters[chapterIndex].id);
        window.history.replaceState(
          { nhOrdinal: location.ordinal, book: location.bookNumber, section: book.chapters[chapterIndex].id },
          '',
          `${canonicalUrl.pathname}${canonicalUrl.search}`,
        );
      })
      .catch((cause: unknown) => {
        if (!live) return;
        setPhase('idle');
        if (recoverStaleCorpus(cause)) return;
        setError(cause instanceof Error ? cause.message : 'The complete catalogue could not be opened.');
      });
    return () => {
      live = false;
      if (turnTimerRef.current) clearTimeout(turnTimerRef.current);
      navigationAbortRef.current?.abort();
      popAbortRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    const syncFullscreen = () => {
      if (document.fullscreenElement) return;
      focusModeRef.current = false;
      setFocusMode(false);
      window.requestAnimationFrame(() => window.scrollTo({ top: documentScrollRef.current, behavior: 'auto' }));
    };
    document.addEventListener('fullscreenchange', syncFullscreen);
    return () => document.removeEventListener('fullscreenchange', syncFullscreen);
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle('reader-focus', focusMode);
    return () => document.documentElement.classList.remove('reader-focus');
  }, [focusMode]);

  useEffect(() => {
    if (!activeLocation || translationMode !== 'auto' || diffusionState !== 'latin') return;
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const timer = setTimeout(() => {
      capturePassageProgress();
      setDiffusionState(prefersReducedMotion ? 'english' : 'diffusing');
    }, LATIN_DWELL_MS);
    return () => clearTimeout(timer);
  }, [activeLocation, capturePassageProgress, diffusionState, translationMode]);

  const finishDiffusion = useCallback(() => {
    if (translationMode === 'la') return;
    setDiffusionState((current) => current === 'diffusing' ? 'english' : current);
  }, [translationMode]);

  useLayoutEffect(() => {
    const progress = pendingScrollProgressRef.current;
    const scroll = passageScrollRef.current;
    if (diffusionState === 'diffusing' || !scroll) return;
    if (progress !== null) {
      scroll.scrollTop = progress * Math.max(0, scroll.scrollHeight - scroll.clientHeight);
      pendingScrollProgressRef.current = null;
    }
    updatePassageProgress(scroll);

    const landing = pendingSearchLandingRef.current;
    const visibleLanguage: Language = diffusionState === 'latin' ? 'la' : 'en';
    if (!landing || landing.ordinal !== activeLocation?.ordinal || landing.field !== visibleLanguage) return;
    const layerClass = landing.field === 'la' ? 'latin' : 'english';
    const paragraphs = [...scroll.querySelectorAll<HTMLElement>(`.passage-${layerClass} p`)];
    let wordsBefore = 0;
    const target = paragraphs.find((paragraph) => {
      const wordCount = normalizeSearchText(paragraph.textContent ?? '').match(/[\p{L}\p{N}]+/gu)?.length ?? 0;
      if (landing.wordPosition < wordsBefore + wordCount) return true;
      wordsBefore += wordCount;
      return false;
    }) ?? paragraphs[0];
    if (target) {
      scroll.scrollTop = Math.max(0, target.offsetTop - 18);
      target.classList.add('is-search-landing');
      if (searchLandingTimerRef.current) window.clearTimeout(searchLandingTimerRef.current);
      searchLandingTimerRef.current = window.setTimeout(() => {
        target.classList.remove('is-search-landing');
        searchLandingTimerRef.current = null;
      }, 2600);
      updatePassageProgress(scroll);
    }
    pendingSearchLandingRef.current = null;
  }, [activeLocation, diffusionState, focusMode, updatePassageProgress]);

  useEffect(() => () => {
    if (searchLandingTimerRef.current) window.clearTimeout(searchLandingTimerRef.current);
  }, []);

  useEffect(() => {
    if (translationMode === 'la' || diffusionState !== 'diffusing') return;
    const fallback = setTimeout(finishDiffusion, DIFFUSION_FAILSAFE_MS);
    return () => clearTimeout(fallback);
  }, [diffusionState, finishDiffusion, translationMode]);

  useEffect(() => {
    if (!activeBook || !activeLocation || !manifest) return;
    const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
    if (connection?.saveData) return;
    const nearStart = activeLocation.chapterIndex <= 1;
    const nearEnd = activeLocation.chapterIndex >= activeBook.chapters.length - 2;
    const neighbor = nearEnd
      ? manifest.books[activeBook.number]
      : nearStart
        ? manifest.books[activeBook.number - 2]
        : undefined;
    if (neighbor) {
      const idle = window.requestIdleCallback ?? ((callback: IdleRequestCallback) => window.setTimeout(callback, 500));
      idle(() => void loadBook(neighbor).catch(() => undefined));
    }
  }, [activeBook, activeLocation, manifest]);

  useEffect(() => {
    const onPopState = (event: PopStateEvent) => {
      const catalogue = manifestRef.current;
      if (!catalogue) return;
      setCoverOpen(false);
      setIndexOpen(false);
      setSearchOpen(false);
      const stateOrdinal = Number((event.state as { nhOrdinal?: unknown } | null)?.nhOrdinal);
      if (Number.isInteger(stateOrdinal)) {
        popGenerationRef.current += 1;
        popAbortRef.current?.abort();
        popAbortRef.current = null;
        requestOrdinal(stateOrdinal, 'none');
        return;
      }
      const generation = ++popGenerationRef.current;
      popAbortRef.current?.abort();
      const controller = new AbortController();
      popAbortRef.current = controller;
      const params = new URLSearchParams(window.location.search);
      const parsedBook = Number(params.get('book'));
      const bookNumber = Number.isInteger(parsedBook)
        ? Math.max(1, Math.min(catalogue.totalBooks, parsedBook))
        : 2;
      const meta = catalogue.books[bookNumber - 1];
      const section = params.get('section');
      void abortable(loadBook(meta), controller.signal).then((book) => {
        if (generation !== popGenerationRef.current) return;
        const chapterIndex = Math.max(0, section ? book.chapters.findIndex((chapter) => chapter.id === section) : 0);
        requestOrdinal(offsetsRef.current[bookNumber - 1] + chapterIndex, 'none');
      }).catch((cause: unknown) => {
        if (isAbortError(cause) || generation !== popGenerationRef.current) return;
        setError(cause instanceof Error ? cause.message : 'That history entry could not be opened.');
      });
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [requestOrdinal]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.isComposing || event.repeat) return;
      if ((event.metaKey || event.ctrlKey) && event.key.toLocaleLowerCase() === 'k') {
        event.preventDefault();
        setCoverOpen(false);
        setIndexOpen(false);
        setSearchOpen(true);
        return;
      }
      if (coverOpen) {
        if (event.key === 'Escape') dismissCover();
        return;
      }
      if ((indexOpen || searchOpen) && event.key === 'Escape') {
        setIndexOpen(false);
        setSearchOpen(false);
        return;
      }
      if (focusMode && event.key === 'Escape') {
        void toggleFocusMode();
        return;
      }
      const target = event.target as HTMLElement | null;
      if (target?.isContentEditable || target?.closest('button, a, input, textarea, select, summary, [role="button"], [role="link"], [contenteditable="true"]')) return;
      if (!indexOpen && !searchOpen && event.altKey && event.shiftKey && event.key.toLocaleLowerCase() === 'f') {
        event.preventDefault();
        void toggleFocusMode();
        return;
      }
      if (indexOpen || searchOpen || event.altKey || event.ctrlKey || event.metaKey) return;
      if (event.shiftKey) return;
      if (target && target !== document.body && !target.closest('.reader-shell, .book-stage, .passage-scroll')) return;
      if (event.key === 'ArrowRight') {
        event.preventDefault();
        if (desiredRef.current >= (manifestRef.current?.totalChapters ?? 1) - 1) router.push('/afterword/vesuvius');
        else requestOrdinal(desiredRef.current + 1);
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault();
        requestOrdinal(desiredRef.current - 1);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [coverOpen, dismissCover, focusMode, indexOpen, requestOrdinal, router, searchOpen, toggleFocusMode]);

  useEffect(() => {
    if (searchOpen) window.setTimeout(() => searchInputRef.current?.focus(), 30);
  }, [searchOpen]);

  useEffect(() => {
    const dialog = coverOpen
      ? coverDialogRef.current
      : indexOpen
        ? indexDialogRef.current
        : searchOpen
          ? searchDialogRef.current
          : null;
    if (!dialog) {
      document.body.classList.remove('modal-open');
      const previous = previousFocusRef.current;
      previousFocusRef.current = null;
      previous?.focus({ preventScroll: true });
      return;
    }

    document.body.classList.add('modal-open');
    if (!previousFocusRef.current) previousFocusRef.current = document.activeElement as HTMLElement | null;
    const preferred = coverOpen ? coverPrimaryRef.current : indexOpen ? indexCloseRef.current : searchInputRef.current;
    window.setTimeout(() => preferred?.focus({ preventScroll: true }), 0);

    const trapFocus = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return;
      const focusable = [...dialog.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), a[href], [tabindex]:not([tabindex="-1"])')]
        .filter((element) => element.getClientRects().length > 0);
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!dialog.contains(document.activeElement)) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      } else if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', trapFocus);
    return () => {
      document.removeEventListener('keydown', trapFocus);
      document.body.classList.remove('modal-open');
    };
  }, [coverOpen, indexOpen, searchOpen]);

  useEffect(() => {
    if (!indexOpen || !manifest) return;
    window.setTimeout(() => indexSelectedBookRef.current?.scrollIntoView({ block: 'center' }), 0);
    const meta = manifest.books[indexBookNumber - 1];
    if (!meta) return;
    let live = true;
    const controller = new AbortController();
    queueMicrotask(() => {
      if (live) {
        setIndexError('');
        setIndexLoading(true);
      }
    });
    abortable(loadBook(meta), controller.signal)
      .then((book) => {
        if (live) setIndexBook(book);
      })
      .catch((cause: unknown) => {
        if (live && !isAbortError(cause)) setIndexError(cause instanceof Error ? cause.message : 'The book index could not be opened.');
      })
      .finally(() => {
        if (live) setIndexLoading(false);
      });
    return () => {
      live = false;
      controller.abort();
    };
  }, [indexBookNumber, indexOpen, indexRetryNonce, manifest]);

  useEffect(() => {
    const trimmed = searchQuery.trim();
    const generation = ++searchGenerationRef.current;
    searchAbortRef.current?.abort();
    const controller = new AbortController();
    searchAbortRef.current = controller;
    if (!searchOpen || !searchIsReady(trimmed) || !manifest) {
      queueMicrotask(() => {
        if (searchGenerationRef.current !== generation) return;
        setSearchResults([]);
        setSearchProgress(0);
        setSearchMatchCount(0);
        setSearchLeafTotal(0);
        setSearchError('');
        setSearching(false);
      });
      return () => {
        controller.abort();
        if (searchAbortRef.current === controller) searchAbortRef.current = null;
      };
    }

    const timer = setTimeout(() => {
      setSearchResults([]);
      setSearchProgress(0);
      setSearchMatchCount(0);
      setSearchFailures(0);
      setSearchLeafTotal(0);
      setSearchError('');
      setSearching(true);
      const searchIndex = manifest.searchIndex;
      void (async () => {
        if (!searchIndex || searchIndex.hash !== 'fnv1a32') throw new Error('This corpus release has no compatible concordance.');
        const catalog = await abortable(loadSearchCatalog(searchIndex), controller.signal);
        const shardIds = requiredShardIds(trimmed, searchIndex.shardCount);
        setSearchLeafTotal(shardIds.length);
        let completed = 0;
        const shards = await Promise.all(shardIds.map(async (shardId) => {
          const shard = await abortable(loadSearchShard(searchIndex, shardId), controller.signal);
          completed += 1;
          if (!controller.signal.aborted && searchGenerationRef.current === generation) setSearchProgress(completed);
          return shard;
        }));
        if (controller.signal.aborted || searchGenerationRef.current !== generation) return;
        const results = searchPositionalIndex(catalog, shards, trimmed) as SearchResult[];
        setSearchMatchCount(results.length);
        setSearchResults(results.slice(0, 80));
        setSearching(false);
      })().catch((cause: unknown) => {
        if (isAbortError(cause) || controller.signal.aborted || searchGenerationRef.current !== generation) return;
        setSearching(false);
        setSearchFailures(1);
        setSearchError(cause instanceof Error ? cause.message : 'The concordance could not be opened.');
      });
    }, 180);

    return () => {
      clearTimeout(timer);
      controller.abort();
      if (searchAbortRef.current === controller) searchAbortRef.current = null;
    };
  }, [manifest, searchOpen, searchQuery]);

  const chapter = activeBook && activeLocation ? activeBook.chapters[activeLocation.chapterIndex] : null;
  const theme = activeBook ? themeForBook(activeBook.number) : themes.dedication;

  const navigateTo = useCallback((bookNumber: number, chapterIndex: number) => {
    const currentManifest = manifestRef.current;
    if (!currentManifest) return;
    requestOrdinal(offsetsRef.current[bookNumber - 1] + chapterIndex);
  }, [requestOrdinal]);

  const enterFromCover = useCallback((bookNumber: number, chapterIndex: number) => {
    const location = activeLocationRef.current;
    if (location?.bookNumber === bookNumber && location.chapterIndex === chapterIndex) dismissCover();
    else {
      setCoverOpen(false);
      navigateTo(bookNumber, chapterIndex);
    }
  }, [dismissCover, navigateTo]);

  const openIndex = () => {
    if (activeLocationRef.current) setIndexBookNumber(activeLocationRef.current.bookNumber);
    setIndexOpen(true);
  };

  const openSearchResult = useCallback((result: SearchResult) => {
    translationModeRef.current = result.field;
    setTranslationMode(result.field);
    setDiffusionState(result.field === 'la' ? 'latin' : 'english');
    pendingSearchLandingRef.current = Number.isInteger(result.wordPosition)
      ? { ordinal: result.ordinal, field: result.field, wordPosition: result.wordPosition as number }
      : null;
    requestOrdinal(result.ordinal);
    setSearchOpen(false);
  }, [requestOrdinal]);

  const onSearchSubmit = (event: FormEvent) => event.preventDefault();

  if (!manifest || !activeBook || !activeLocation || !chapter) {
    return (
      <main className="reader-shell loading-codex" aria-busy="true">
        <div className="ambient-grain" aria-hidden="true" />
        <div className="loading-emblem" aria-hidden="true">✦</div>
        <p>Unbinding the thirty-seven books…</p>
        {error && <button type="button" onClick={() => window.location.reload()}>Retry the archive</button>}
      </main>
    );
  }

  const sourceRange = chapter.chapterStart === chapter.chapterEnd
    ? `${chapter.chapterStart}`
    : `${chapter.chapterStart}–${chapter.chapterEnd}`;
  const activeMeta = manifest.books[activeBook.number - 1];
  const illustration = chapterIllustration({
    bookNumber: activeBook.number,
    bookRoman: activeBook.roman,
    chapterId: chapter.id,
    chapterTitle: chapter.title,
  });
  const mainIllustrationPanel = illustration.panels[0];

  const openPlateViewer = (trigger: HTMLButtonElement) => {
    plateViewerTriggerRef.current = trigger;
    setPlateViewerOpen(true);
  };

  const shareCurrentChapter = async () => {
    const url = new URL(`/read/${activeBook.number}/${encodeURIComponent(chapter.id)}.html`, window.location.origin).href;
    const title = `Naturalis Historia · Book ${activeBook.roman} · ${chapter.label}`;
    if (navigator.share) {
      try {
        await navigator.share({ title, text: chapter.title, url });
        setShareNotice('Chapter shared.');
        return;
      } catch (cause) {
        if (cause instanceof DOMException && cause.name === 'AbortError') return;
        // If the native share sheet fails, retain the stable clipboard path.
      }
    }
    try {
      let copied = false;
      try {
        if (navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(url);
          copied = true;
        }
      } catch {
        // The focused DOM fallback below also works in older secure contexts.
      }
      if (!copied) {
        const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        const field = document.createElement('textarea');
        field.value = url;
        field.style.position = 'fixed';
        field.style.opacity = '0';
        document.body.appendChild(field);
        field.focus();
        field.select();
        copied = document.execCommand('copy');
        field.remove();
        previousFocus?.focus();
      }
      if (!copied) throw new Error('Clipboard copy was unavailable.');
      setShareNotice('Chapter link copied.');
    } catch (cause) {
      if (cause instanceof DOMException && cause.name === 'AbortError') return;
      setShareNotice('Copy unavailable. Please try Share again.');
    }
  };

  return (
    <main
      ref={readerShellRef}
      className={`reader-shell phase-${phase} direction-${turnDirection}${focusMode ? ' is-focus' : ''}${mobilePlateOpen ? ' is-mobile-plate' : ''}`}
      aria-busy={phase !== 'idle'}
    >
      <div className="ambient-grain" aria-hidden="true" />

      <header className="reader-header" inert={coverOpen || indexOpen || searchOpen ? true : undefined}>
        <div className="header-actions">
          <button className="header-action index-action" type="button" onClick={openIndex} aria-label="Open the complete index">☷ <span>Books</span></button>
          <button className="header-action" type="button" onClick={() => setSearchOpen(true)} aria-label="Search the complete work">⌕ <span>Search</span></button>
          <button className="header-action share-action" type="button" onClick={() => void shareCurrentChapter()} aria-label="Share this chapter">↗ <span>Share</span></button>
        </div>
        <div className="title-lockup" aria-label="Naturalis Historia, complete edition">
          <span className="title-flourish">✦</span>
          <div><h1>NATVRALIS HISTORIA</h1></div>
          <span className="title-flourish">✦</span>
          <button className="title-reopen" type="button" onClick={() => setCoverOpen(true)} aria-label="Open the Naturalis Historia introduction" />
        </div>
        <div className="reader-actions">
          <label className="language-mark">
            <select
              value={translationMode}
              onChange={(event) => {
                const mode = event.target.value as TranslationMode;
                translationModeRef.current = mode;
                capturePassageProgress();
                setTranslationMode(mode);
                if (mode === 'en') {
                  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
                  setDiffusionState((current) => prefersReducedMotion || current === 'english' ? 'english' : 'diffusing');
                } else {
                  setDiffusionState('latin');
                }
              }}
              aria-label="Language transition mode"
            >
              <option value="auto">Latin → English</option>
              <option value="la">Latin</option>
              <option value="en">English</option>
            </select>
            <i className={translationMode === 'auto' && diffusionState === 'diffusing' ? 'is-transforming' : ''} aria-hidden="true" />
          </label>
          <button
            className="header-action focus-action"
            type="button"
            onClick={() => void toggleFocusMode()}
            aria-pressed={focusMode}
            aria-keyshortcuts="Alt+Shift+F"
            aria-label={focusMode ? 'Exit focus reading mode' : 'Enter focus reading mode; fullscreen where supported'}
          ><i className="focus-glyph" aria-hidden="true" /><span>{focusMode ? 'Exit focus' : 'Focus'}</span></button>
          <button
            className="header-action mobile-view-toggle"
            type="button"
            onClick={toggleMobilePlate}
            aria-pressed={mobilePlateOpen}
            aria-label={mobilePlateOpen ? 'Show the reading page' : 'Show the illustrated plate'}
            aria-controls="illustrated-plate-page"
          ><span aria-hidden="true">{mobilePlateOpen ? 'Aa' : '✣'}</span><b>{mobilePlateOpen ? 'Text' : 'Plate'}</b></button>
        </div>
      </header>

      <nav className="reader-toolbar" aria-label="Book and chapter" inert={coverOpen || indexOpen || searchOpen ? true : undefined}>
        <label>
          <span>BOOK</span>
          <select value={activeBook.number} onChange={(event) => navigateTo(Number(event.target.value), 0)}>
            {manifest.books.map((book) => <option value={book.number} key={book.number}>{book.roman} · {book.title}</option>)}
          </select>
        </label>
        <span className="toolbar-divider" aria-hidden="true">◇</span>
        <label>
          <span>CHAPTER</span>
          <select value={activeLocation.chapterIndex} onChange={(event) => navigateTo(activeBook.number, Number(event.target.value))}>
            <optgroup label={coverageLabel(activeMeta)}>
              {activeBook.chapters.map((item, index) => <option value={index} key={`${activeBook.number}:${item.id}`}>{item.label} · {item.title}</option>)}
            </optgroup>
          </select>
        </label>
        <div
          className="corpus-progress"
          role="progressbar"
          aria-label="Corpus reading progress"
          aria-valuemin={1}
          aria-valuemax={manifest.totalChapters}
          aria-valuenow={committedOrdinal + 1}
          aria-valuetext={`Reading unit ${committedOrdinal + 1} of ${manifest.totalChapters}`}
        >
          <i aria-hidden="true"><b style={{ width: `${((committedOrdinal + 1) / manifest.totalChapters) * 100}%` }} /></i>
        </div>
      </nav>

      <section className="book-stage" ref={bookStageRef} aria-label={`Book ${activeBook.roman}, ${chapter.title}`} inert={coverOpen || indexOpen || searchOpen ? true : undefined}>
        <div className="book-shadow" aria-hidden="true" />
        <article className="book-spread">
          <section className={`page page-left${chapter.latinWords < 80 && chapter.englishWords < 120 ? ' is-short-passage' : ''}`}>
            <span className="page-fibers" aria-hidden="true" />
            <span className="gold-thread thread-left" aria-hidden="true" />
            <header className="folio-meta">
              <MorphText latin={`LIBER ${activeBook.roman}`} english={`BOOK ${activeBook.roman}`} state={diffusionState} />
              <span aria-hidden="true">✣</span>
              <MorphText latin={chapter.label.toUpperCase()} english={chapter.label.replace('Caput', 'Chapter').replace('Capita', 'Chapters')} state={diffusionState} />
            </header>
            <div className="text-panel">
              <h2 className="chapter-heading">
                <MorphText latin={chapter.latinTitle || chapter.label.toUpperCase()} english={chapter.title} state={diffusionState} />
              </h2>
              <div className="chapter-ornament" aria-hidden="true"><span />✦<span /></div>
              <div className={`passage-frame is-${diffusionState}`}>
                <div
                  className="passage-scroll"
                  ref={passageScrollRef}
                  tabIndex={0}
                  onScroll={(event) => updatePassageProgress(event.currentTarget)}
                  aria-label={diffusionState === 'latin' ? 'Mayhoff Latin reading text' : 'Bostock and Riley English translation'}
                >
                  <Passage chapter={chapter} state={diffusionState} onDiffusionEnd={finishDiffusion} />
                </div>
                <span className="ink-vapor" aria-hidden="true" />
                <span className="passage-progress" ref={passageProgressRef} aria-hidden="true"><i /></span>
              </div>
            </div>
            <span className="folio-number">{activeBook.roman} · {chapter.id.toUpperCase()}</span>
          </section>

          <div className="gutter" aria-hidden="true" />

          <section id="illustrated-plate-page" ref={platePageRef} className={`page page-right${mobilePlateOpen ? ' mobile-plate-is-open' : ''}`}>
            <button
              className="mobile-plate-toggle"
              type="button"
              onClick={toggleMobilePlate}
              aria-expanded={mobilePlateOpen}
              aria-controls="illustrated-plate-content"
            ><span aria-hidden="true">✣</span>{mobilePlateOpen ? 'Close illustrated plate' : 'View illustrated plate'}<i aria-hidden="true">{mobilePlateOpen ? '−' : '+'}</i></button>
            <span className="page-fibers" aria-hidden="true" />
            <span className="gold-thread thread-right" aria-hidden="true" />
            <figure
              id="illustrated-plate-content"
              key={illustration.instanceKey}
              className="illustration-plate"
              data-family={illustration.family}
              data-subject={illustration.subject}
              style={illustration.style as CSSProperties}
              aria-labelledby="illustrated-plate-caption"
            >
              <button
                className="plate-field"
                type="button"
                onClick={(event) => openPlateViewer(event.currentTarget)}
                aria-haspopup="dialog"
                aria-controls="plate-viewer-dialog"
                aria-label={`Enlarge ${mainIllustrationPanel.accessibleLabel}`}
              ><span className="plate-expand-mark" aria-hidden="true">↗</span></button>
              <span className="plate-patina" aria-hidden="true" />
              <figcaption id="illustrated-plate-caption"><MorphText latin={illustration.latinCaption} english={illustration.englishCaption} state={diffusionState} /></figcaption>
            </figure>
            <div className="book-inscription">
              {activeBook.number >= 20 && activeBook.number <= 32 && (
                <p className="historical-notice"><strong>Historical remedies—not medical advice.</strong> This book contains obsolete and potentially dangerous practices. <a href="/edition#content-notice">Read the content notice.</a></p>
              )}
              <details className="folio-apparatus" key={`notes:${illustration.instanceKey}`}>
                <summary><span aria-hidden="true">✣</span><strong>Notes &amp; sources</strong><i aria-hidden="true">+</i></summary>
                <div className="folio-apparatus-body">
                  <p className="inscription-kicker"><MorphText latin={theme.latinMotto} english={theme.motto} state={diffusionState} /></p>
                  <span className="inscription-rule" aria-hidden="true" />
                  <h3>{activeBook.title}</h3>
                  <p className="editorial-disclosure">
                    A modern editorial illustration made specifically for this chapter. Latin derives from the pinned Mayhoff/Perseus transcription; all interventions are disclosed.
                  </p>
                  <dl>
                    <div><dt>Latin</dt><dd>{compactNumber(chapter.latinWords)} words</dd></div>
                    <div><dt>English</dt><dd>{compactNumber(chapter.englishWords)} words</dd></div>
                    <div><dt>TEI chapter</dt><dd>{sourceRange}</dd></div>
                    <div><dt>Mayhoff §§</dt><dd>{chapter.mayhoffSections.length ? chapter.mayhoffSections.join(', ') : 'not encoded'}</dd></div>
                  </dl>
                  <p className="section-note">
                    {activeBook.number === 1
                      ? 'Book I changes between editions rather than word-for-word: the Latin retains the full index, while Bostock and Riley give the dedication with abbreviated book summaries. The diffusion is an editorial transition, not word-level alignment.'
                      : chapter.chapterStart === chapter.chapterEnd
                      ? 'A complete bilingual chapter-level unit. Bostock and Riley is historical facing text, not a line-by-line translation of the displayed Latin; captions are modern editorial aids unless the source supplies a heading.'
                      : `Latin chapters ${sourceRange} are kept together where the historical translation omits an internal chapter marker.`}
                  </p>
                </div>
              </details>
            </div>
          </section>

          {phase === 'turning' && (
            <div
              className={`turning-leaf turn-${turnDirection}`}
              aria-hidden="true"
              onAnimationEnd={finishTurn}
            ><span className="leaf-front" /><span className="leaf-back" /></div>
          )}
        </article>

        <button
          className="page-control previous"
          type="button"
          onClick={() => requestOrdinal(desiredRef.current - 1)}
          disabled={desiredOrdinal <= 0}
          aria-label="Previous chapter"
          aria-keyshortcuts="ArrowLeft"
        ><span aria-hidden="true">‹</span><small>Previous</small></button>
        {desiredOrdinal >= manifest.totalChapters - 1 ? (
          <a className="page-control next afterword-next" href="/afterword/vesuvius" aria-label="Continue to the Vesuvius letters afterword" aria-keyshortcuts="ArrowRight"><small>Afterword</small><span aria-hidden="true">›</span></a>
        ) : (
          <button className="page-control next" type="button" onClick={() => requestOrdinal(desiredRef.current + 1)} aria-label="Next chapter" aria-keyshortcuts="ArrowRight"><small>Next</small><span aria-hidden="true">›</span></button>
        )}
        {phase === 'loading' && <div className="loading-target" role="status"><i /> Fetching the requested leaf…</div>}
      </section>

      <footer className="reader-footer" inert={coverOpen || indexOpen || searchOpen ? true : undefined}>
        <div className="fortuna-random">
          <button
            className={`fortuna-button${randomPagePending ? ' is-casting' : ''}`}
            type="button"
            onClick={openRandomPage}
            disabled={randomPagePending || phase !== 'idle' || manifest.totalChapters <= 1}
            aria-label={`Open a random chapter from all ${compactNumber(manifest.totalChapters)} reading units`}
          >
            <span className="fortuna-seal" aria-hidden="true"><i>✦</i></span>
            <span className="fortuna-copy">
              <small>{randomPagePending ? 'FORTVNA FOLIVM VERTIT' : 'FORTVNA FOLIVM APERIT'}</small>
              <strong>{randomPagePending ? 'Fortune turns the leaf…' : 'Open a page by chance'}</strong>
            </span>
            <span className="fortuna-flourish" aria-hidden="true">❦</span>
          </button>
        </div>
        <nav className="edition-links" aria-label="Edition and site information">
          <a href="/catalogue">Catalogue</a>
          <a href="/edition">Edition</a>
          <a href="/afterword/vesuvius">Vesuvius</a>
          <a href="https://github.com/elder-plinius/NATURALIS-HISTORIA" target="_blank" rel="noreferrer">GitHub</a>
          <a href="/privacy">Privacy</a>
        </nav>
      </footer>

      {error && <div className="error-toast" role="alert" inert={coverOpen || indexOpen || searchOpen ? true : undefined}><span>{error}</span><button type="button" onClick={() => { setError(''); schedulePump(); }}>Retry</button></div>}
      {shareNotice && <div className="share-toast" role="status"><span>{shareNotice}</span><button type="button" onClick={() => setShareNotice('')}>Dismiss</button></div>}

      {coverOpen && (
        <div className="codex-cover-backdrop">
          <section ref={coverDialogRef} className="codex-cover" role="dialog" aria-modal="true" aria-labelledby="cover-title" aria-describedby="cover-description">
            <div className="cover-image" aria-hidden="true"><span className="cover-orbit" /><span className="cover-seal">N·H</span></div>
            <div className="cover-copy">
              <p className="cover-supra">C. PLINII SECVNDI · OPVS INTEGRALE</p>
              <h2 id="cover-title"><span>NATVRALIS</span> HISTORIA</h2>
              <p id="cover-description" className="cover-lede">The whole known world, gathered into thirty-seven books: sky and sea, animals and peoples, healing plants, metals, pigments, memory, marvels.</p>
              <p className="cover-concept">Imagined as a lost Roman codex—copied, repaired, and embellished across centuries. The vellum bears its history; the text remains Pliny’s.</p>
              <p className="cover-motto">ROUGH AS VELLUM · PRECISE AS TYPE · ALIVE AS INK</p>
              <dl className="cover-proof">
                <div><dt>XXXVII</dt><dd>complete books</dd></div>
                <div><dt>{compactNumber(manifest.totalChapters)}</dt><dd>bilingual leaves</dd></div>
                <div><dt>LAT → EN</dt><dd>living ink</dd></div>
              </dl>
              <div className="cover-actions">
                <button ref={coverPrimaryRef} className="cover-enter" type="button" onClick={dismissCover}>{hasSavedLocation ? 'Continue where I left off' : 'Enter at the cosmos'}</button>
                <button type="button" onClick={() => enterFromCover(1, 0)}>Read Pliny’s dedication</button>
                <button type="button" onClick={() => { setCoverOpen(false); setIndexOpen(true); }}>Open all XXXVII books</button>
              </div>
              <p className="cover-sources">Latin: Mayhoff · English: Bostock &amp; Riley, 1855–57 · translation preserves its historical diction</p>
            </div>
          </section>
        </div>
      )}

      {indexOpen && (
        <div className="overlay-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setIndexOpen(false); }}>
          <section ref={indexDialogRef} className="codex-overlay index-overlay" role="dialog" aria-modal="true" aria-labelledby="index-title">
            <header><div><p>PLINII NATVRALIS HISTORIAE</p><h2 id="index-title">The Complete Index</h2></div><button ref={indexCloseRef} type="button" onClick={() => setIndexOpen(false)} aria-label="Close index">×</button></header>
            <div className="index-layout">
              <nav className="book-index" aria-label="Thirty-seven books">
                {manifest.books.map((book) => (
                  <button
                    type="button"
                    key={book.number}
                    ref={indexBookNumber === book.number ? indexSelectedBookRef : undefined}
                    className={indexBookNumber === book.number ? 'is-selected' : ''}
                    aria-current={activeBook.number === book.number ? 'page' : undefined}
                    onClick={() => setIndexBookNumber(book.number)}
                    id={`index-book-${book.number}`}
                    aria-pressed={indexBookNumber === book.number}
                    aria-controls="chapter-index-panel"
                  ><b>{book.roman}</b><span>{book.title}</span><small>{book.number === 1 ? 'complete index' : `${book.latinChapterCount} TEI chapters`}</small></button>
                ))}
              </nav>
              <div
                className="section-index"
                id="chapter-index-panel"
                role="region"
                aria-labelledby={`index-book-${indexBookNumber}`}
                aria-busy={indexLoading}
              >
                <div className="section-index-heading">
                  <div>
                    <p>LIBER {manifest.books[indexBookNumber - 1].roman}</p>
                    <h3>{manifest.books[indexBookNumber - 1].title}</h3>
                    <small>{coverageLabel(manifest.books[indexBookNumber - 1])}</small>
                  </div>
                  <button type="button" onClick={() => { navigateTo(indexBookNumber, 0); setIndexOpen(false); }}>Open book</button>
                </div>
                {indexError ? (
                  <div className="index-loading" role="alert">
                    <p>{indexError}</p>
                    <button type="button" onClick={() => setIndexRetryNonce((value) => value + 1)}>Retry this book</button>
                  </div>
                ) : indexLoading || indexBook?.number !== indexBookNumber ? <p className="index-loading" role="status">Unbinding this book…</p> : (
                  <ol className="section-list">
                    {indexBook.chapters.map((item, index) => (
                      <li key={`${indexBook.number}:${item.id}`}>
                        <button
                          type="button"
                          aria-current={activeBook.number === indexBook.number && activeLocation.chapterIndex === index ? 'page' : undefined}
                          onClick={() => { navigateTo(indexBook.number, index); setIndexOpen(false); }}
                        >
                          <b>{item.label}</b>
                          <span className="section-entry">
                            <span>{item.title}</span>
                            {item.englishChapters.map((heading) => (
                              <small key={heading.number}><i>B&amp;R ch. {heading.number}</i>{heading.title}</small>
                            ))}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ol>
                )}
                {!indexLoading && indexBook?.number === indexBookNumber && indexBook.englishEndmatter.length > 0 && (
                  <details className="book-endmatter">
                    <summary>Bostock–Riley book-end index</summary>
                    <p className="book-endmatter-note">Translation summary and cited-author lists, retained separately from the facing chapter text.</p>
                    {indexBook.englishEndmatter.map((part, index) => <p key={`${indexBook.number}:endmatter:${index}`}>{part}</p>)}
                  </details>
                )}
              </div>
            </div>
          </section>
        </div>
      )}

      {searchOpen && (
        <div className="overlay-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setSearchOpen(false); }}>
          <section ref={searchDialogRef} className="codex-overlay search-overlay" role="dialog" aria-modal="true" aria-labelledby="search-title">
            <header><div><p>IN OMNIBVS XXXVII LIBRIS</p><h2 id="search-title">Search the Complete Work</h2></div><button type="button" onClick={() => setSearchOpen(false)} aria-label="Close search">×</button></header>
            <form onSubmit={onSearchSubmit} role="search">
              <label htmlFor="corpus-search">Every Latin and English chapter title and reading passage</label>
              <div><input id="corpus-search" ref={searchInputRef} value={searchQuery} onChange={(event) => {
                const nextQuery = event.target.value;
                searchAbortRef.current?.abort();
                setSearchResults([]);
                setSearchProgress(0);
                setSearchMatchCount(0);
                setSearchLeafTotal(0);
                setSearchError('');
                setSearching(searchIsReady(nextQuery.trim()));
                setSearchQuery(nextQuery);
              }} placeholder='Try basilisk, elephant memory, or "the elephant"…' autoComplete="off" /><span aria-hidden="true">⌕</span></div>
              <p>Words are combined with AND · use quotation marks for an exact phrase · accents and ligatures are optional</p>
            </form>
            <div className="search-status" role="status" aria-live="polite">
              {!searchIsReady(searchQuery.trim())
                ? 'Enter at least two characters. Nothing is loaded until you ask.'
                : searchError
                  ? searchError
                : searching
                  ? searchLeafTotal
                    ? `Opening ${searchProgress} of ${searchLeafTotal} concordance leaves…`
                    : 'Opening the compact corpus concordance…'
                  : searchLeafTotal
                    ? `${searchMatchCount > 80 ? `Showing the first 80 of ${searchMatchCount} passages` : `${searchMatchCount} passages found`} without downloading the thirty-seven books.`
                    : 'No chapter contains every requested term.'}
            </div>
            <ol className="search-results">
              {searchResults.map((result) => (
                <li key={result.key}>
                  <button type="button" onClick={() => openSearchResult(result)}>
                    <span className="result-meta">LIBER {result.roman} · LATIN CH. {result.chapterId}{result.englishChapterNumber ? ` · B&amp;R CH. ${result.englishChapterNumber}` : ''} · {result.field === 'la' ? 'LATINE' : 'ENGLISH'}</span>
                    <strong><Highlight text={result.title} query={searchQuery.trim()} /></strong>
                    <span className="result-excerpt" lang={result.field}><Highlight text={result.excerpt} query={searchQuery.trim()} /></span>
                  </button>
                </li>
              ))}
            </ol>
            {!searching && searchLeafTotal > 0 && searchProgress === searchLeafTotal && searchFailures === 0 && searchResults.length === 0 && <p className="empty-results">No title or passage contains every requested term in the same language field.</p>}
          </section>
        </div>
      )}

      {plateViewerOpen && (
        <dialog
          id="plate-viewer-dialog"
          ref={plateViewerDialogRef}
          className="plate-viewer"
          aria-modal="true"
          aria-labelledby="plate-viewer-title"
          aria-describedby="plate-viewer-description"
          onMouseDown={(event) => { if (event.target === event.currentTarget) closePlateViewer(); }}
          onKeyDown={(event) => {
            event.stopPropagation();
            if (event.key === 'Escape') {
              event.preventDefault();
              closePlateViewer();
            }
          }}
        >
          <section className="plate-viewer-shell">
            <header className="plate-viewer-header">
              <div>
                <p>CHAPTER ILLUSTRATION</p>
                <h2 id="plate-viewer-title">{illustration.englishCaption}</h2>
              </div>
              <button className="plate-viewer-close" type="button" onClick={closePlateViewer} aria-label="Close full-screen illustration">×</button>
            </header>

            <div className="plate-viewer-media">
              <picture className="plate-viewer-picture">
                {mainIllustrationPanel.source.viewerPreferredImage && <source srcSet={mainIllustrationPanel.source.viewerPreferredImage} type="image/avif" />}
                <img src={mainIllustrationPanel.source.viewerImage} alt={mainIllustrationPanel.accessibleLabel} />
              </picture>
            </div>

            <footer className="plate-viewer-footer">
              <p id="plate-viewer-description">Complete, uncropped modern editorial illustration created specifically for this chapter. <a href="/edition#rights">Image provenance</a>.</p>
            </footer>
          </section>
        </dialog>
      )}

      <p className="sr-only" aria-live="polite">
        {phase === 'idle' ? `Book ${activeBook.roman}, ${chapter.label}, ${chapter.title}` : ''}
      </p>
    </main>
  );
}
