import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { chapterIllustration } from '../app/illustrations.mjs';
import { chapterSceneSourceFor } from '../app/generated-chapter-scene-sources.mjs';
import { corpusBookMeta, corpusBookUrl } from './corpus-path.mjs';
import { readAuthenticatedReleaseProfile, resolveChapterSceneSourceMode } from './release-profile.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (file) => readFile(path.join(root, file), 'utf8');
const data = JSON.parse(await read('app/afterword/vesuvius/letters-data.json'));
const component = await read('app/afterword/vesuvius/VesuviusAfterword.tsx');
const reader = await read('app/page.tsx');
const css = await read('app/globals.css');
const generatedCss = await read('app/generated-image-sources.css');
const catalogue = await read('app/catalogue/page.tsx');
const edition = await read('app/edition/page.tsx');
const artworkManifest = JSON.parse(await read('assets-source/chapter-artwork-manifest.json'));
const chapterSceneCampaign = JSON.parse(await read('assets-source/chapter-scenes-provenance.json'));
const manifest = JSON.parse(await read('public/corpus/manifest.json'));
const provenance = JSON.parse(await read('public/provenance.json'));
const releaseProfile = readAuthenticatedReleaseProfile(root);
const chapterSceneSourceMode = resolveChapterSceneSourceMode(root, chapterSceneCampaign.records, releaseProfile);

assert.equal(manifest.totalBooks, 37);
assert.equal(manifest.totalChapters, 1065);
assert.match(data.editorialBoundary, /not part of Naturalis Historia/);
assert.deepEqual(data.letters.map((letter) => letter.id), ['6.16', '6.20']);
assert.deepEqual(data.letters.map((letter) => letter.sectionCount), [22, 20]);
assert.ok(data.letters.every((letter) => letter.folios.length === 6));

for (const letter of data.letters) {
  assert.equal(letter.folios[0].sectionStart, 1);
  assert.equal(letter.folios.at(-1).sectionEnd, letter.sectionCount);
  letter.folios.forEach((folio, index) => {
    if (index) assert.equal(folio.sectionStart, letter.folios[index - 1].sectionEnd + 1);
    assert.ok(folio.latin.length > 250 && folio.english.length > 500, `${letter.id}.${folio.number} is unexpectedly short`);
  });
}

assert.match(data.letters[0].folios[1].latin, /Nonum Kal\. Septembres/);
assert.match(data.letters[0].folios[2].latin, /Fortes[^\n]+fortuna iuvat/);
assert.match(data.letters[0].folios[5].english, /a letter is one thing, a history another/);
assert.match(data.letters[1].folios[0].latin, /duodevicensimum annum/);
assert.match(data.letters[1].folios[3].english, /shrieks of women, the screams of children/);
assert.equal(data.letters[1].folios[2].panel, 'ash', 'VI.20 folio 3 must not reuse the VI.16 Rectina scene');

assert.equal(data.latinSource.sha256, '313c67a08efae2c33d95cdb52004be5a0b6b5c2d8a58ecfd08dffdfc1465f257');
assert.equal(data.englishSource.sha256, '38246747bde7ef4da17603bee74b5344cc1502f8e41d6515fe72651ca0e8fa9a');
const atlas = await readFile(path.join(root, 'assets-source', 'plates', 'pliny-younger-vesuvius-letters-atlas.jpg'));
assert.equal(createHash('sha256').update(atlas).digest('hex').length, 64);

assert.match(component, /AFTERWORD · NOT PART OF/);
assert.match(component, /history\.pushState/);
assert.match(component, /addEventListener\('popstate'/);
assert.match(component, /setDiffusionPhase\('diffusing'\), 480/);
assert.match(component, /prefersReducedMotion \? 520 : 1780/);
assert.match(component, /diffusionPhase === 'latin' \? 'la' : 'en'/);
assert.match(component, /<InkParagraphs[\s\S]*maxAnimatedWords=\{260\}/);
assert.match(component, /languageMode !== 'en' \|\| diffusionPhase !== 'diffusing'/);
assert.match(component, /setDiffusionPhase\(\(current\) => prefersReducedMotion \|\| current === 'english' \? 'english' : 'diffusing'\)/);
assert.match(component, /setLeafFromLocation[\s\S]*languageMode !== 'en'\) setDiffusionPhase\('latin'\)/);
assert.match(component, /history\.pushState[\s\S]*languageMode !== 'en'\) setDiffusionPhase\('latin'\)[\s\S]*setLeaf\(bounded\)/);
assert.doesNotMatch(component, /···/);
assert.doesNotMatch(component, /useNarrator|narrat(?:e|ion|or)/i);
assert.match(component, /requestFullscreen/);
assert.match(component, /useLayoutEffect\(\(\) => \{[\s\S]*passageRef\.current\.scrollTop = 0/);
assert.match(component, /className=\{`afterword-passage[\s\S]*role="region"[\s\S]*tabIndex=\{0\}/);
assert.match(component, /className="afterword-language-controls" role="group"/);
assert.doesNotMatch(component, /event\.key === 'Home'|event\.key === 'End'/);
assert.doesNotMatch(component, /THE ELDER’S XXXVII BOOKS REMAIN COMPLETE AND SEPARATE/);
assert.match(component, /if \(bounded === leaf\) return;\s*setHasTurnedLeaf\(true\)/);
assert.match(component, /aria-keyshortcuts="ArrowLeft"/);
assert.match(component, /aria-keyshortcuts="ArrowRight"/);
assert.match(component, /className=\{hasTurnedLeaf \? 'is-dismissed' : ''\} aria-hidden=\{hasTurnedLeaf\}>Use ← → to turn leaves/);
assert.match(css, /\.afterword-footer \.is-dismissed \{ visibility: hidden; \}/);
assert.match(css, /\.afterword-passage:focus-visible/);
assert.doesNotMatch(css, /\.afterword-narrator/);
assert.match(component, /Dickinson VI\.16/);
assert.match(component, /different textual tradition/);
assert.match(component, /Earth, sea, and cloud at Misenum/);
assert.match(css, /\.afterword-plate-image\.panel-observer[\s\S]*\.afterword-plate-image\.panel-tablets/);
assert.match(css, /\.afterword-quadrants \.afterword-plate-image \{ aspect-ratio: 3 \/ 2;/);
assert.doesNotMatch(css, /background-size:\s*200% 200%/);
assert.match(generatedCss, /--afterword-image-set-desktop:/);
for (const panel of ['observer', 'fleet', 'appeal', 'ash']) {
  assert.match(generatedCss, new RegExp(`--afterword-panel-${panel}-fallback:`));
  assert.match(generatedCss, new RegExp(`--afterword-panel-${panel}-image-set:`));
}
assert.doesNotMatch(`${reader}\n${css}`, /Vesuvius Vigil|vesuvius-vigil|vigilOpen|--vigil-image/);
assert.match(reader, /href="\/afterword\/vesuvius"/);
assert.match(catalogue, /After the complete work|AFTER THE COMPLETE WORK/);
assert.match(edition, /not a thirty-eighth book/);
assert.match(edition, /different textual tradition/);
assert.match(edition, /Miscnum[\s\S]*Misenum/);

const afterwordAsset = provenance.assets.find((asset) => asset.logicalId === 'plate:pliny-younger-vesuvius-letters-atlas');
assert.ok(afterwordAsset, 'Vesuvius afterword atlas is missing from provenance');
assert.deepEqual(Object.keys(afterwordAsset.editorialCrops ?? {}).sort(), ['appeal', 'ash', 'fleet', 'observer']);
for (const record of Object.values(afterwordAsset.editorialCrops)) {
  assert.equal(record.crop.width, 768);
  assert.equal(record.crop.height, 512);
  assert.equal(record.derivatives.length, 3);
  for (const derivative of record.derivatives) await access(path.join(root, 'public', derivative.replace(/^\//, '')));
}

const corpusRoot = new URL('../public/corpus/', import.meta.url);
const bookTwo = JSON.parse(await readFile(corpusBookUrl(corpusBookMeta(manifest, 2), corpusRoot), 'utf8'));
const chapter = bookTwo.chapters.find((item) => item.id === '107');
assert.ok(chapter, 'Book II.107 is missing');
const illustration = chapterIllustration({
  bookNumber: 2,
  bookRoman: 'II',
  chapterId: chapter.id,
  chapterTitle: chapter.title,
  chapterLatinTitle: chapter.latinTitle,
  englishSubheadings: chapter.englishChapters,
  ordinal: 107,
});
const chapterKey = '2:107';
const assignment = artworkManifest.assignments[chapterKey];
assert.ok(assignment, `Certified artwork assignment is missing for ${chapterKey}`);
assert.equal(assignment.kind, 'chapter-scene');
assert.equal(assignment.artworkId, `chapter-scene:${chapterKey}`);

const chapterScene = chapterSceneSourceFor(2, chapter.id);
assert.ok(chapterScene, `Generated chapter-scene source is missing for ${chapterKey}`);
assert.equal(chapterScene.sourceArtifact, assignment.sourceArtifact);
assert.equal(chapterScene.sourceSha256, assignment.sourceSha256);

const chapterSceneAsset = provenance.assets.find((asset) => asset.logicalId === assignment.artworkId);
assert.ok(chapterSceneAsset, `Chapter-scene provenance is missing for ${chapterKey}`);
assert.equal(chapterSceneAsset.chapterKey, chapterKey);
assert.equal(chapterSceneAsset.masterArtifact, assignment.sourceArtifact);
assert.equal(chapterSceneAsset.sourceSha256, assignment.sourceSha256);
assert.equal(chapterSceneAsset.role, 'one-to-one modern editorial chapter illustration');
assert.deepEqual(chapterSceneAsset.sourceDimensions, { width: 1536, height: 1024 });
assert.equal(chapterSceneAsset.pipelineRevision, chapterScene.pipelineRevision);
assert.deepEqual(chapterSceneAsset.derivatives, chapterScene.derivatives);
assert.equal(new Set(chapterScene.derivatives).size, 4);

if (chapterSceneSourceMode === 'masters') {
  const chapterSceneMaster = await readFile(path.join(root, assignment.sourceArtifact));
  assert.equal(createHash('sha256').update(chapterSceneMaster).digest('hex'), assignment.sourceSha256);
} else {
  assert.equal(releaseProfile?.profile, 'public-repo');
  const campaignRecord = chapterSceneCampaign.records[chapterKey];
  assert.equal(campaignRecord?.sourceArtifact, assignment.sourceArtifact);
  assert.equal(campaignRecord?.sourceSha256, assignment.sourceSha256);
  const expectedNameHash = createHash('sha256')
    .update(`${assignment.sourceSha256}:${chapterScene.pipelineRevision}`)
    .digest('hex')
    .slice(0, 8);
  assert.deepEqual(
    chapterScene.derivatives.map((derivative) => path.basename(derivative)).sort(),
    [
      `chapter-b02-c107.${expectedNameHash}.w1024.avif`,
      `chapter-b02-c107.${expectedNameHash}.w1024.jpg`,
      `chapter-b02-c107.${expectedNameHash}.w1024.webp`,
      `chapter-b02-c107.${expectedNameHash}.w1536.avif`,
    ].sort(),
  );
}
for (const derivative of chapterScene.derivatives) {
  await access(path.join(root, 'public', derivative.replace(/^\//, '')));
}
assert.equal(illustration.subject, 'chapter-scene-2-107');
assert.equal(illustration.matchSource, 'chapter-scene');
assert.equal(illustration.continuityKey, assignment.artworkId);
assert.equal(illustration.originalChapterScene, true);
assert.equal(illustration.mainCell, null);
assert.equal(illustration.images[0], chapterScene.logicalPath);
assert.equal(illustration.panels[0].source.asset, assignment.artworkId);
assert.equal(illustration.panels[0].source.masterImage, chapterScene.logicalPath);
assert.equal(illustration.panels[0].source.desktopImage, chapterScene.desktop.fallback);
assert.match(illustration.englishCaption, new RegExp(`^${assignment.title}`));

console.log(`Verified two complete Pliny the Younger letters in 12 folios, strict work boundary, source receipts, history-safe navigation, smooth bilingual diffusion, and certified one-to-one Book II imagery against ${chapterSceneSourceMode === 'prebuilt-public' ? 'authenticated prebuilt provenance' : 'the preservation master'}`);
