import { chapterSceneSourceFor } from './generated-chapter-scene-sources.mjs';

// These two supplementary plates remain active outside chapter routing: the
// dedication and the Vesuvius afterword. Every one of the 1,065 reading routes
// uses its own lean chapter-scene delivery entry below.
export const PLATE_IMAGE_PATHS = [
  '/assets/dedication-pliny-vespasian.jpg',
  '/assets/pliny-younger-vesuvius-letters-atlas.jpg',
];

function familyForBook(bookNumber) {
  if (bookNumber === 1) return 'dedication';
  if (bookNumber === 2) return 'cosmos';
  if (bookNumber <= 6) return 'geography';
  if (bookNumber === 7 || (bookNumber >= 28 && bookNumber <= 30)) return 'humanity';
  if (bookNumber === 8) return 'terrestrial';
  if (bookNumber === 9 || bookNumber === 31 || bookNumber === 32) return 'marine';
  if (bookNumber === 10 || bookNumber === 11) return 'flight';
  if (bookNumber >= 12 && bookNumber <= 27) return 'botany';
  return 'minerals';
}

/**
 * Resolve the single, independently generated illustration for a corpus leaf.
 * Extra caller fields are intentionally accepted and ignored so the public
 * function remains compatible with the reader and build scripts.
 *
 * @param {{
 *   bookNumber: number,
 *   bookRoman: string,
 *   chapterId: string,
 *   chapterTitle: string,
 *   chapterLatinTitle?: string,
 *   englishSubheadings?: Array<string | { title?: string }>,
 *   ordinal?: number,
 *   ignoreCertifiedAtlasOverride?: boolean,
 * }} chapter
 */
export function chapterIllustration({
  bookNumber,
  bookRoman,
  chapterId,
  chapterTitle,
}) {
  const chapterScene = chapterSceneSourceFor(bookNumber, chapterId);
  if (!chapterScene) {
    throw new Error(`Missing standalone chapter scene for ${bookNumber}:${chapterId}`);
  }

  const family = familyForBook(bookNumber);
  const plateNumber = `${bookRoman}.${String(chapterId).toUpperCase()}`;
  const logicalPath = chapterScene.logicalPath;
  const style = {
    '--plate-main-image': `url("${chapterScene.desktop.fallback}")`,
    '--plate-main-image-set': chapterScene.desktop.imageSet,
    '--plate-main-image-set-mobile': chapterScene.mobile.imageSet,
    '--plate-main-x': '50%',
    '--plate-main-y': '50%',
    '--plate-main-size': '100%',
    '--plate-main-x-offset': '0%',
    '--plate-main-y-offset': '0%',
    '--plate-mark-x': '76%',
    '--plate-mark-y': '72%',
    '--plate-mark-rotation': '0deg',
  };
  const studyKey = `${logicalPath}|50,50`;
  const panelKey = `${logicalPath}|hero|1|50,50`;
  const renderedKey = `${logicalPath}|hero|1|50%|50%|100%|0%|0%`;
  const accessibleLabel = `${chapterTitle}, panel I: complete modern editorial illustration made for this chapter.`;

  return {
    family,
    subject: `chapter-scene-${bookNumber}-${chapterId}`,
    matchSource: 'chapter-scene',
    semanticMatch: true,
    routeConfidence: 'high',
    continuityKey: `chapter-scene:${bookNumber}:${chapterId}`,
    continuityGroup: null,
    instanceKey: `${bookNumber}|${chapterId}|${renderedKey}`,
    studyKey,
    panelKey,
    renderedKey,
    visualSignature: panelKey,
    layout: 'hero',
    mark: 'none',
    style,
    focus: [50, 50],
    mainCell: null,
    detailCells: null,
    panelCount: 1,
    panels: [{
      label: 'I',
      field: 'main',
      focus: [50, 50],
      cell: null,
      cellLabel: null,
      accessibleLabel,
      source: {
        asset: `chapter-scene:${bookNumber}:${chapterId}`,
        masterImage: logicalPath,
        desktopImage: chapterScene.desktop.fallback,
        mobileImage: chapterScene.mobile.fallback,
        viewerKind: 'chapter-scene',
        viewerImage: chapterScene.desktop.fallback,
        viewerPreferredImage: chapterScene.desktop.preload,
        viewerImageSet: chapterScene.desktop.imageSet,
      },
    }],
    campaign: false,
    originalChapterScene: true,
    compositionKey: renderedKey,
    images: [logicalPath],
    preload: { desktop: chapterScene.desktop.preload, mobile: chapterScene.mobile.preload },
    alt: `${chapterTitle}. Complete modern editorial illustration created specifically for this chapter.`,
    latinCaption: `AD CAPVT ${plateNumber} · TABVLA PROPRIA`,
    englishCaption: `${chapterTitle} · EDITORIAL PLATE ${plateNumber}`,
  };
}
