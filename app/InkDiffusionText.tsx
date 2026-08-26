import { type CSSProperties, type HTMLAttributes, type ReactNode } from 'react';

type InkStyle = CSSProperties & {
  '--ink-blur': string;
  '--ink-delay': string;
  '--ink-duration': string;
  '--ink-ghost-x': string;
  '--ink-ghost-y': string;
  '--ink-x': string;
  '--ink-y': string;
};

type ParagraphProps = Omit<HTMLAttributes<HTMLParagraphElement>, 'children'>;

function stableHash(value: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function signedUnit(value: number, shift: number, magnitude: number): number {
  const normalized = ((value >>> shift) & 0xff) / 255;
  return (normalized * 2 - 1) * magnitude;
}

function inkStyle(seed: string, wordIndex: number, word: string): InkStyle {
  const hash = stableHash(`${seed}\0${wordIndex}\0${word}`);
  const secondary = stableHash(`${hash}\0ink`);
  const x = signedUnit(hash, 8, 3.8);
  const y = signedUnit(hash, 16, 4.8) - 0.8;
  return {
    '--ink-blur': `${(1.15 + (secondary & 0xff) / 150).toFixed(2)}px`,
    '--ink-delay': `${18 + (hash % 258)}ms`,
    '--ink-duration': `${720 + ((hash >>> 9) % 170)}ms`,
    '--ink-ghost-x': `${(-x * 0.72).toFixed(2)}px`,
    '--ink-ghost-y': `${(-y * 0.58).toFixed(2)}px`,
    '--ink-x': `${x.toFixed(2)}px`,
    '--ink-y': `${y.toFixed(2)}px`,
  };
}

function countWords(paragraphs: string[]): number {
  return paragraphs.reduce((total, paragraph) => total + (paragraph.match(/\S+/gu)?.length ?? 0), 0);
}

function animatedWordIndices(seed: string, totalWords: number, maximum: number): Set<number> | null {
  if (totalWords <= maximum) return null;
  const target = Math.max(1, Math.min(totalWords, maximum));
  const indices = new Set<number>([0]);
  for (let island = 1; island < target; island += 1) {
    const start = Math.floor((island * totalWords) / target);
    const end = Math.max(start + 1, Math.floor(((island + 1) * totalWords) / target));
    indices.add(start + (stableHash(`${seed}\0island\0${island}`) % (end - start)));
  }
  return indices;
}

export function InkParagraphs({
  paragraphs,
  seed,
  maxAnimatedWords = 360,
  paragraphProps,
}: {
  paragraphs: string[];
  seed: string;
  maxAnimatedWords?: number;
  paragraphProps?: (paragraph: string, index: number) => ParagraphProps;
}) {
  const totalWords = countWords(paragraphs);
  const animatedIndices = animatedWordIndices(seed, totalWords, maxAnimatedWords);
  let wordIndex = 0;

  return paragraphs.map((paragraph, paragraphIndex) => {
    const props = paragraphProps?.(paragraph, paragraphIndex) ?? {};
    const children: ReactNode[] = [];
    let untouchedText = '';
    const flushUntouchedText = () => {
      if (!untouchedText) return;
      children.push(untouchedText);
      untouchedText = '';
    };

    paragraph.split(/(\s+)/u).forEach((token, tokenIndex) => {
      if (!token || /^\s+$/u.test(token)) {
        untouchedText += token;
        return;
      }
      const currentWord = wordIndex++;
      if (animatedIndices && !animatedIndices.has(currentWord)) {
        untouchedText += token;
        return;
      }
      flushUntouchedText();
      children.push(
        <span className="ink-unit passage-ink-unit" style={inkStyle(seed, currentWord, token)} key={`${tokenIndex}-${currentWord}`}>
          {token}
        </span>
      );
    });
    flushUntouchedText();
    return <p {...props} key={`${seed}-${paragraphIndex}`}>{children}</p>;
  });
}

export function InkInline({ text, seed }: { text: string; seed: string }) {
  let wordIndex = 0;
  return text.split(/(\s+)/u).map((token, tokenIndex) => {
    if (!token || /^\s+$/u.test(token)) return token;
    const currentWord = wordIndex++;
    return (
      <span className="ink-unit morph-word" style={inkStyle(seed, currentWord, token)} key={`${tokenIndex}-${currentWord}`}>
        {token}
      </span>
    );
  });
}
