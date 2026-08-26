import { pageMetadata } from '../../site-metadata';
import lettersData from './letters-data.json';
import VesuviusAfterword from './VesuviusAfterword';
import type { LettersData } from './VesuviusAfterword';

export const metadata = pageMetadata(
  'Afterword — Two Letters from Vesuvius',
  'Pliny the Younger’s two letters to Tacitus about the eruption of Vesuvius, presented in Latin and English after the complete Naturalis Historia.',
  '/afterword/vesuvius',
);

export default function VesuviusAfterwordPage() {
  return <VesuviusAfterword data={lettersData as LettersData} />;
}
