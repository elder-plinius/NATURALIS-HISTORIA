import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const supportedProfiles = new Set(['comprehensive-source', 'public-repo']);

export const readAuthenticatedReleaseProfile = (root) => {
  const profilePath = path.join(root, 'RELEASE-PROFILE.json');
  const manifestPath = path.join(root, 'RELEASE-MANIFEST.sha256');
  const profileExists = fs.existsSync(profilePath);
  const manifestExists = fs.existsSync(manifestPath);
  if (!profileExists && !manifestExists) return null;
  if (!profileExists || !manifestExists) {
    throw new Error('Release profile metadata is incomplete; RELEASE-PROFILE.json and RELEASE-MANIFEST.sha256 must travel together.');
  }
  const bytes = fs.readFileSync(profilePath);
  const digest = crypto.createHash('sha256').update(bytes).digest('hex');
  const expectedLine = `${digest}  RELEASE-PROFILE.json`;
  const manifestLines = fs.readFileSync(manifestPath, 'utf8').trim().split(/\r?\n/u);
  if (manifestLines.filter((line) => line === expectedLine).length !== 1) {
    throw new Error('RELEASE-PROFILE.json is not authenticated by RELEASE-MANIFEST.sha256.');
  }
  const profile = JSON.parse(bytes.toString('utf8'));
  if (profile.schemaVersion !== 1 || !supportedProfiles.has(profile.profile)) {
    throw new Error(`Unsupported release profile metadata: ${profile.profile}`);
  }
  return profile;
};

export const resolveChapterSceneSourceMode = (root, records, profile = readAuthenticatedReleaseProfile(root)) => {
  const sourcePaths = Object.values(records ?? {}).map((record) => {
    if (typeof record.sourceArtifact !== 'string' || !record.sourceArtifact.startsWith('assets-source/chapter-scenes-v1/')) {
      throw new Error(`Invalid chapter-scene source artifact in provenance: ${record.sourceArtifact}`);
    }
    return path.join(root, record.sourceArtifact);
  });
  const present = sourcePaths.filter((sourcePath) => fs.existsSync(sourcePath)).length;
  if (present === sourcePaths.length) return 'masters';
  if (present === 0 && profile?.profile === 'public-repo') return 'prebuilt-public';
  throw new Error(`Chapter-scene source snapshot is partial: ${present}/${sourcePaths.length} preservation masters are present.`);
};
