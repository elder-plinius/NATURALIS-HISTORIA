#!/usr/bin/env python3
"""Build the complete bilingual Naturalis Historia reader corpus.

Inputs are reproducible source downloads documented in corpus-source/README.md.
Outputs are compact, lazy-loadable JSON files in public/corpus/.
"""

from __future__ import annotations

import hashlib
import json
import re
from pathlib import Path
from typing import Any

from bs4 import BeautifulSoup, Tag
from defusedxml import ElementTree as ET


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "corpus-source"
LATIN_SOURCE = SOURCE / "phi0978.phi001.perseus-lat2.xml"
LATIN_AUTHORITY_SOURCE = SOURCE / "phi0978.phi001.perseus-lat1.xml"
ENGLISH_SOURCES = [SOURCE / "gutenberg" / f"volume-{index}.html" for index in range(1, 7)]
CORRECTIONS_SOURCE = SOURCE / "corrections.json"
OUTPUT = ROOT / "public" / "corpus"

TEI_NS = "{http://www.tei-c.org/ns/1.0}"
SKIP_TEI = {"note", "pb", "milestone", "del", "app", "rdg"}

GUTENBERG_IDS = [57493, 60230, 59131, 61113, 60688, 62704]
GUTENBERG_URLS = [
    f"https://www.gutenberg.org/cache/epub/{ebook}/pg{ebook}-images.html"
    for ebook in GUTENBERG_IDS
]
PERSEUS_RELEASE = "0.0.28400408640"
PERSEUS_COMMIT = "53d95ef61007fcafa4b6c4b43399acd2d114c9e2"
LATIN_EXPECTED_SHA256 = "e8ad7ddbb99847f3f1985f2fd0ef93a359ff974d97a14b3915e6998768b7b737"
LATIN_AUTHORITY_EXPECTED_SHA256 = "b3d92c7ffa18a2532b7c171307a0fb403a2674d1db51cd1303ce5cc2c6dcf64c"
ENGLISH_EXPECTED_SHA256 = {
    57493: "465c1c740688bab0dd8847360985fc09ad1ffbbf6bafe90b4cf3476bd45adbbe",
    60230: "e65742cda9a0cdbfd17c7970d4a77d9c07536d5e0c9c164ced4b7bfe12ceae1c",
    59131: "a1bbbe5eb9718dd21aafdaa85af1c1b3cbdd4ab18ec2903ceb62137d103dee07",
    61113: "97c6dca65fc78dfe0ebdc9b5d05d738cea32f7143c9104894abe20ae5956df66",
    60688: "430d0031664e36eacc0f5344ae80207e998f9fe9689d5dbdcbe5049cf0726b81",
    62704: "0a09c84a438ae13376e5aa944bc5f04739fdc6fca0a2381f9e3eda9a8bbd58e0",
}
LATIN_URL = (
    f"https://raw.githubusercontent.com/PerseusDL/canonical-latinLit/{PERSEUS_COMMIT}/"
    "data/phi0978/phi001/phi0978.phi001.perseus-lat2.xml"
)
LATIN_AUTHORITY_URL = (
    f"https://raw.githubusercontent.com/PerseusDL/canonical-latinLit/{PERSEUS_COMMIT}/"
    "data/phi0978/phi001/phi0978.phi001.perseus-lat1.xml"
)

# Mayhoff's TEI contains a handful of verified print-line splits and malformed
# apparatus fragments outside the elements that should have contained them.
# Every intervention stays in this exact, auditable ledger; ambiguous plain
# ``word- word`` sequences remain untouched.
LATIN_READING_TEXT_CORRECTIONS = {
    "nomenclaturam,§20? quis": "nomenclaturam, quis",
    "monitus,§24? oraculorum": "monitus, oraculorum",
    (
        "Aeminium aeminium (B)H coll. §115.emen- d. min- F2G. "
        "enumen- a. eumen- rov, oppida"
    ): "Aeminium, oppida",
    "pb n=323 ": "",
    "prupb n=432> nae": "prunae",
    "crapulana pice, ac resina condire musta volgare ei est provinciisque finitimis. § 117: cfr. Pl. supra 75. — nonnusquam": (
        "crapulana pice, ac resina condire musta volgare ei est provinciisque finitimis. nonnusquam"
    ),
    "fugi- § 122: Th. VI 8,5; CVI 18,4. — tivis": "fugitivis",
    "quod vocatur § quib; Q. § elaterium": "quod vocatur elaterium",
    "§27 Est ergo": "Est ergo",
    "cadmean, 32, celebri": "cadmean, celebri",
    "reli- 5 gionis": "religionis",
    "ven- 10 tosus": "ventosus",
    "ap- 31 pellant": "appellant",
    "vo- 23 cetur": "vocetur",
    "si- 5 dere": "sidere",
    "ter- 180 tium": "tertium",
    "aqua- 15 rum": "aquarum",
    "sim- 199 plex": "simplex",
    "simi- 10 lis": "similis",
    "pin- 5 gue": "pingue",
    "im- 5 brem": "imbrem",
    "co- 302 lumnis": "columnis",
    "adver- 5 satur": "adversatur",
    "pecti- 5 num": "pectinum",
    "coclea- 5 rum": "coclearum",
    "adgnascentium- queiis": "adgnascentiumque iis",
}
latin_correction_counts: dict[str, int] = {}


def local_name(tag: str) -> str:
    return tag.rsplit("}", 1)[-1]


def normalize_space(value: str) -> str:
    value = value.replace("\u00ad", "").replace("\ufeff", "")
    value = re.sub(r"\s+", " ", value).strip()
    value = re.sub(r"\s+([,.;:!?])", r"\1", value)
    # Gutenberg drop caps are sometimes represented as "T HE".
    value = re.sub(r"^([A-Z])\s+([A-Z]{2,})\b", r"\1\2", value)
    value = re.sub(r"^T\s+his\b", "This", value)
    return value


def clean_latin_reading_text(value: str) -> str:
    """Normalize the edited base text without silently rewriting its wording."""
    value = normalize_space(value)
    for source, replacement in LATIN_READING_TEXT_CORRECTIONS.items():
        occurrences = value.count(source)
        if occurrences:
            latin_correction_counts[source] = latin_correction_counts.get(source, 0) + occurrences
            value = value.replace(source, replacement)
    value = re.sub(r"\s+([,.;:!?])", r"\1", value)
    return normalize_space(value)


def flatten_tei(element: Any) -> str:
    """Return reading text while omitting critical apparatus and page markers."""
    pieces: list[str] = []
    if element.text:
        pieces.append(element.text)
    for child in element:
        if local_name(child.tag) not in SKIP_TEI:
            pieces.append(flatten_tei(child))
        if child.tail:
            pieces.append(child.tail)
    return normalize_space("".join(pieces))


def extract_tei_blocks(element: Any) -> list[str]:
    """Collect prose and standalone verse blocks once, in document order."""
    blocks: list[str] = []
    for child in element:
        name = local_name(child.tag)
        if name in SKIP_TEI:
            continue
        if name in {"p", "quote"}:
            text = clean_latin_reading_text(flatten_tei(child))
            if text:
                blocks.append(text)
        else:
            blocks.extend(extract_tei_blocks(child))
    return blocks


def extract_tei_section_markers(element: Any) -> list[str]:
    """Collect Mayhoff's nested section markers without entering apparatus."""
    markers: list[str] = []
    for child in element:
        name = local_name(child.tag)
        if name == "milestone" and child.attrib.get("unit") == "section":
            marker = child.attrib.get("n")
            if marker:
                markers.append(marker)
            continue
        if name in SKIP_TEI:
            continue
        markers.extend(extract_tei_section_markers(child))
    return markers


def parse_latin() -> dict[int, dict[str, dict[str, Any]]]:
    latin_correction_counts.clear()
    tree = ET.parse(LATIN_SOURCE)
    root = tree.getroot()
    edition = root.find(f".//{TEI_NS}div[@type='edition']")
    if edition is None:
        raise RuntimeError("Latin TEI has no edition division")

    books: dict[int, dict[str, dict[str, Any]]] = {}
    for book in edition.findall(f"{TEI_NS}div[@subtype='book']"):
        book_number = int(book.attrib["n"])
        chapters: dict[str, dict[str, Any]] = {}
        for chapter in book.findall(f"{TEI_NS}div[@subtype='chapter']"):
            chapter_id = chapter.attrib["n"]
            heads = [flatten_tei(head) for head in chapter.findall(f"{TEI_NS}head")]
            paragraphs = extract_tei_blocks(chapter)
            if not paragraphs:
                fallback = clean_latin_reading_text(flatten_tei(chapter))
                if fallback:
                    paragraphs = [fallback]
            chapters[chapter_id] = {
                "title": normalize_space(" ".join(heads)),
                "text": "\n\n".join(paragraphs),
                "mayhoffSections": extract_tei_section_markers(chapter),
            }
        books[book_number] = chapters

    missed_corrections = [
        source
        for source in LATIN_READING_TEXT_CORRECTIONS
        if latin_correction_counts.get(source) != 1
    ]
    if missed_corrections:
        details = ", ".join(
            f"{source!r}={latin_correction_counts.get(source, 0)}"
            for source in missed_corrections
        )
        raise RuntimeError(f"Latin reading-text correction ledger drifted: {details}")

    if sorted(books) != list(range(1, 38)):
        raise RuntimeError(f"Expected Latin books 1-37, found {sorted(books)}")
    return books


def roman_to_int(value: str) -> int:
    values = {"I": 1, "V": 5, "X": 10, "L": 50, "C": 100, "D": 500, "M": 1000}
    total = 0
    previous = 0
    for letter in reversed(value):
        current = values[letter]
        total += -current if current < previous else current
        previous = max(previous, current)
    return total


def int_to_roman(value: int) -> str:
    pairs = [
        (1000, "M"), (900, "CM"), (500, "D"), (400, "CD"),
        (100, "C"), (90, "XC"), (50, "L"), (40, "XL"),
        (10, "X"), (9, "IX"), (5, "V"), (4, "IV"), (1, "I"),
    ]
    result: list[str] = []
    remaining = value
    for number, numeral in pairs:
        while remaining >= number:
            result.append(numeral)
            remaining -= number
    return "".join(result)


BOOK_ID = re.compile(r"^BOOK_([IVXLCDM]+)(?:_|$)")
CHAPTER_ID = re.compile(r"^BOOK_([IVXLCDM]+)_CHAP_(\d+)(?:_|$)")

# Gutenberg preserves several omitted or erroneous nineteenth-century printed
# cross-reference numbers. These topic boundaries are unambiguous from the
# adjacent Bostock-Riley heading and the matching Latin chapter division, so
# restore them before forming bilingual units. Keeping this map explicit makes
# every editorial intervention inspectable instead of silently trusting bad
# markers.
ENGLISH_CHAPTER_OVERRIDES = {
    (7, 2): 2,  # Wonderful nations and cannibal peoples
    (7, 46): 45,  # The misfortunes of Augustus
    (8, 52): 34,  # Other animals which change colour
    (8, 68): 43,  # The ass (printed as 45)
    (8, 73): 48,  # Wool (printed as 43)
    (10, 60): 43,  # The talking raven (printed as 48)
    (11, 6): 7,  # Commosis, pissoceros, and propolis (printed as 5)
    (12, 51): 24,  # Cypros
    (18, 62): 26,  # Monthly agricultural operations
    (20, 24): 7,  # Wild or goat lettuce
    (21, 106): 32,  # Corchorus
    (23, 81): 9,  # Myrtle
    (24, 43): 10,  # Blood-red shrub, siler, and privet
    (27, 108): 13,  # Solanum or strychnon
}

# Two introductory paragraphs carry a repeated "(2)" that belongs to the
# running prose, not to a new Mayhoff section. The next Hardouin heading marks
# the real section 2 in both books.
IGNORED_INLINE_MARKERS = {
    (4, 1, 2),
    (14, 1, 2),
}


def clean_chapter_title(raw: str) -> str:
    raw = normalize_space(raw)
    raw = re.sub(r"^CHAP\.?\s*\d+\.?\s*", "", raw, flags=re.IGNORECASE)
    raw = re.sub(r"^\([^)]*\)\.?\s*", "", raw)
    raw = raw.lstrip("—–- ")
    return raw.rstrip(". ") or "Untitled chapter"


def clean_book_title(raw: str, roman: str) -> str:
    raw = normalize_space(raw)
    raw = re.sub(rf"^BOOK\s+{re.escape(roman)}\.?\s*", "", raw, flags=re.IGNORECASE)
    return raw.strip("—–- .") or "Dedication and table of contents"


def extract_blocks_until_heading(heading: Tag) -> str:
    blocks: list[str] = []
    for tag in heading.find_all_next(True):
        if tag is not heading and tag.name in {"h2", "h3"}:
            break
        if tag.name == "p":
            if tag.find_parent("tr") is not None:
                continue
            text = normalize_space(tag.get_text(" ", strip=True))
            if text:
                blocks.append(text)
        elif tag.name == "div" and "poetry-container" in tag.get("class", []):
            lines = [
                normalize_space(line.get_text(" ", strip=True))
                for line in tag.select(".stanza > div")
            ]
            text = " / ".join(line for line in lines if line)
            if text:
                blocks.append(text)
        elif tag.name == "tr":
            cells = [normalize_space(cell.get_text(" ", strip=True)) for cell in tag.find_all(["th", "td"], recursive=False)]
            text = " — ".join(cell for cell in cells if cell)
            if text:
                blocks.append(text)
    return "\n\n".join(blocks)


LATIN_CHAPTER_MARKER = re.compile(r"\((\d+)\.?\)\.?")


def parse_english() -> tuple[
    dict[int, str],
    dict[int, dict[str, dict[str, Any]]],
    dict[int, dict[str, int]],
    dict[int, list[str]],
]:
    """Parse Bostock-Riley by its parenthetical Latin chapter numbers.

    Gutenberg's H3 chapter divisions follow Hardouin and do not always match
    the chapter divisions encoded in the Mayhoff/Perseus TEI. The translation
    also prints that alternate sequence as parenthetical markers in headings
    and paragraphs. Those markers are the stable bilingual join. The explicit
    correction ledger restores the few boundaries whose markers are omitted or
    erroneous in the printed edition.
    """
    book_titles: dict[int, str] = {}
    books: dict[int, dict[str, dict[str, Any]]] = {}
    english_chapter_numbers: dict[int, set[int]] = {}
    english_endmatter: dict[int, list[str]] = {}
    used_overrides: set[tuple[int, int]] = set()
    used_ignored_markers: set[tuple[int, int, int]] = set()

    for source in ENGLISH_SOURCES:
        soup = BeautifulSoup(source.read_text(encoding="utf-8"), "html.parser")
        for selector in (
            "script", "style", "a.fnanchor", "span.pagenum", "div.footnote",
            "div.transnote", "div.pg-boilerplate", "div#pg-footer",
        ):
            for node in soup.select(selector):
                node.decompose()

        for chapter_heading in soup.find_all("h3"):
            chapter_match = CHAPTER_ID.match(chapter_heading.get("id", ""))
            if chapter_match:
                chapter_book = roman_to_int(chapter_match.group(1))
                english_chapter_numbers.setdefault(chapter_book, set()).add(int(chapter_match.group(2)))

        headings = soup.find_all("h2")
        for heading in headings:
            heading_id = heading.get("id", "")
            match = BOOK_ID.match(heading_id)
            if not match:
                continue
            roman = match.group(1)
            book_number = roman_to_int(roman)

            book_titles[book_number] = clean_book_title(heading.get_text(" ", strip=True), roman)
            if book_number == 1:
                books.setdefault(1, {})["praef"] = {
                    "title": "Dedication and table of contents",
                    "text": extract_blocks_until_heading(heading),
                }
                continue

            sections: dict[str, dict[str, Any]] = {}
            current_section = "1"
            current_title = f"Book {roman}"
            seen_chapter_heading = False
            awaiting_heading_title = False
            current_hardouin_number: int | None = None
            pending_english_chapter: dict[str, Any] | None = None
            source_parts: list[str] = []
            endmatter_parts: list[str] = []
            collecting_endmatter = False

            def ensure_section(section_id: str) -> dict[str, Any]:
                return sections.setdefault(
                    section_id,
                    {"title": current_title, "parts": [], "englishChapters": []},
                )

            for tag in heading.find_all_next(True):
                if tag is not heading and tag.name == "h2":
                    break

                if tag.name == "h3":
                    if pending_english_chapter is not None:
                        pending_section = pending_english_chapter["section"] or current_section
                        ensure_section(pending_section)["englishChapters"].append(
                            pending_english_chapter["heading"]
                        )
                        pending_english_chapter = None
                    seen_chapter_heading = True
                    raw_title = normalize_space(tag.get_text(" ", strip=True))
                    next_title = clean_chapter_title(raw_title)
                    chapter_match = CHAPTER_ID.match(tag.get("id", ""))
                    hardouin_number = int(chapter_match.group(2)) if chapter_match else None
                    current_hardouin_number = hardouin_number
                    forced_section = ENGLISH_CHAPTER_OVERRIDES.get((book_number, hardouin_number))
                    marker = LATIN_CHAPTER_MARKER.search(raw_title)
                    heading_section_locked = False
                    if forced_section is not None:
                        used_overrides.add((book_number, hardouin_number))
                        current_section = str(forced_section)
                        current_title = next_title
                        section = ensure_section(current_section)
                        section["title"] = next_title
                        awaiting_heading_title = False
                        heading_section_locked = True
                    elif marker:
                        current_section = marker.group(1)
                        current_title = next_title
                        section = ensure_section(current_section)
                        section["title"] = next_title
                        awaiting_heading_title = False
                        heading_section_locked = True
                    elif awaiting_heading_title:
                        current_title = next_title
                        section = ensure_section(current_section)
                        section["title"] = next_title
                        awaiting_heading_title = False
                        heading_section_locked = True
                    else:
                        # Later Hardouin subheads often live inside the same
                        # Latin chapter. Retain them as context for the next
                        # printed chapter marker without overwriting the title
                        # of the unit already being accumulated.
                        current_title = next_title
                    if hardouin_number is not None:
                        pending_english_chapter = {
                            "heading": {
                                "number": hardouin_number,
                                "title": next_title,
                            },
                            "section": current_section if heading_section_locked else None,
                        }
                    continue

                if not seen_chapter_heading:
                    continue

                block_text = ""
                if tag.name == "p" and tag.find_parent("tr") is None:
                    block_text = normalize_space(tag.get_text(" ", strip=True))
                elif tag.name == "div" and "poetry-container" in tag.get("class", []):
                    lines = [
                        normalize_space(line.get_text(" ", strip=True))
                        for line in tag.select(".stanza > div")
                    ]
                    block_text = " / ".join(line for line in lines if line)
                elif tag.name == "tr":
                    cells = [
                        normalize_space(cell.get_text(" ", strip=True))
                        for cell in tag.find_all(["th", "td"], recursive=False)
                    ]
                    block_text = " — ".join(cell for cell in cells if cell)

                if not block_text:
                    continue

                if tag.name == "p":
                    endmatter_heading = normalize_space(
                        " ".join(node.get_text(" ", strip=True) for node in tag.select(".smcap"))
                    ).casefold()
                    if endmatter_heading.startswith(("summary", "roman authors quoted", "foreign authors quoted")):
                        collecting_endmatter = True
                if collecting_endmatter:
                    endmatter_parts.append(block_text)
                    continue

                def replace_inline_marker(match: re.Match[str]) -> str:
                    marker_key = (
                        book_number,
                        current_hardouin_number,
                        int(match.group(1)),
                    )
                    if marker_key in IGNORED_INLINE_MARKERS:
                        used_ignored_markers.add(marker_key)
                        return ""
                    return match.group(0)

                block_text = LATIN_CHAPTER_MARKER.sub(replace_inline_marker, block_text)
                pieces = LATIN_CHAPTER_MARKER.split(block_text)
                leading = normalize_space(pieces[0])
                if pending_english_chapter is not None:
                    pending_section = pending_english_chapter["section"]
                    if pending_section is None:
                        pending_section = pieces[1] if not leading and len(pieces) > 1 else current_section
                    ensure_section(pending_section)["englishChapters"].append(
                        pending_english_chapter["heading"]
                    )
                    pending_english_chapter = None
                if leading:
                    ensure_section(current_section)["parts"].append(leading)
                    source_parts.append(leading)
                for index in range(1, len(pieces), 2):
                    current_section = pieces[index]
                    section = ensure_section(current_section)
                    awaiting_heading_title = True
                    trailing = normalize_space(pieces[index + 1]) if index + 1 < len(pieces) else ""
                    if trailing:
                        section["parts"].append(trailing)
                        source_parts.append(trailing)

            if pending_english_chapter is not None:
                pending_section = pending_english_chapter["section"] or current_section
                ensure_section(pending_section)["englishChapters"].append(
                    pending_english_chapter["heading"]
                )

            ordered_section_ids = sorted(sections, key=chapter_sort_key)
            rebuilt_parts = [
                part
                for section_id in ordered_section_ids
                for part in sections[section_id]["parts"]
            ]
            if rebuilt_parts != source_parts:
                raise RuntimeError(
                    f"Book {book_number} English markers reorder source prose; "
                    "add an explicit ENGLISH_CHAPTER_OVERRIDES correction"
                )

            books[book_number] = {
                section_id: {
                    "title": section["title"],
                    "text": "\n\n".join(section["parts"]),
                    "englishChapters": section["englishChapters"],
                }
                for section_id, section in sections.items()
            }
            english_endmatter[book_number] = endmatter_parts

    if sorted(books) != list(range(1, 38)):
        raise RuntimeError(f"Expected English books 1-37, found {sorted(books)}")
    if used_overrides != set(ENGLISH_CHAPTER_OVERRIDES):
        raise RuntimeError(
            "English chapter override ledger drifted: "
            f"missing={sorted(set(ENGLISH_CHAPTER_OVERRIDES) - used_overrides)}, "
            f"unexpected={sorted(used_overrides - set(ENGLISH_CHAPTER_OVERRIDES))}"
        )
    if used_ignored_markers != IGNORED_INLINE_MARKERS:
        raise RuntimeError(
            "Ignored inline marker ledger drifted: "
            f"missing={sorted(IGNORED_INLINE_MARKERS - used_ignored_markers)}, "
            f"unexpected={sorted(used_ignored_markers - IGNORED_INLINE_MARKERS)}"
        )
    chapter_stats = {
        book_number: {"count": len(numbers), "max": max(numbers)}
        for book_number, numbers in english_chapter_numbers.items()
        if numbers
    }
    return book_titles, books, chapter_stats, english_endmatter


def word_count(text: str) -> int:
    return len(re.findall(r"[^\W\d_]+(?:['’][^\W\d_]+)?", text, flags=re.UNICODE))


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def require_source_hash(path: Path, expected: str) -> None:
    actual = sha256(path)
    if actual != expected:
        raise RuntimeError(
            f"Source receipt drifted for {path}: expected {expected}, got {actual}"
        )


def apply_scoped_corrections(
    text: str,
    entries: list[dict[str, Any]],
    *,
    book: int,
    unit: str,
) -> tuple[str, list[str]]:
    applied: list[str] = []
    for entry in entries:
        if entry.get("scope", "reader") != "reader":
            continue
        if entry["book"] != book or entry["unit"] != unit:
            continue
        before = entry["before"]
        expected_count = entry["expectedCount"]
        count = text.count(before)
        if count != expected_count:
            raise RuntimeError(
                f"{entry['id']} drifted in {book}.{unit}: "
                f"expected {expected_count}, found {count}"
            )
        text = text.replace(before, entry["after"])
        applied.append(entry["id"])
    return text, applied


def validate_correction_ledger(corrections: dict[str, Any]) -> None:
    if corrections.get("schemaVersion") != 1:
        raise RuntimeError("Unsupported correction-ledger schema")
    groups = [
        corrections.get("latinConfirmed"),
        corrections.get("gutenbergVolume1AppendixForRead"),
        corrections.get("gutenbergVolume1AppendixSupplemental"),
    ]
    if not all(isinstance(group, list) for group in groups):
        raise RuntimeError("Correction-ledger groups must be arrays")
    entries = [entry for group in groups for entry in group]
    ids = [entry.get("id") for entry in entries]
    if any(not isinstance(entry_id, str) or not entry_id for entry_id in ids):
        raise RuntimeError("Every correction-ledger entry needs a stable ID")
    if len(ids) != len(set(ids)):
        raise RuntimeError("Correction-ledger IDs must be globally unique")
    for entry in corrections["latinConfirmed"] + corrections["gutenbergVolume1AppendixForRead"]:
        for field in ("book", "before", "after", "expectedCount"):
            if field not in entry:
                raise RuntimeError(f"{entry['id']} is missing {field}")
        if entry["before"] == entry["after"] or entry["expectedCount"] != 1:
            raise RuntimeError(f"{entry['id']} has an invalid replacement contract")
        if entry.get("route") is not None and not re.fullmatch(r"/read/\d+/(?:\d+|praef)", entry["route"]):
            raise RuntimeError(f"{entry['id']} has an invalid reader route")
    allowed_scopes = {"reader", "excluded-editorial-numbering-note", "excluded-translation-footnote"}
    for entry in corrections["gutenbergVolume1AppendixForRead"]:
        if entry.get("scope") not in allowed_scopes:
            raise RuntimeError(f"{entry['id']} has an unsupported scope")
    if len(corrections["gutenbergVolume1AppendixSupplemental"]) != 1:
        raise RuntimeError("The Gutenberg Appendix supplemental note is missing")


def chapter_sort_key(value: str) -> tuple[int, str]:
    return (0, f"{int(value):04d}") if value.isdigit() else (1, value)


def build() -> None:
    require_source_hash(LATIN_SOURCE, LATIN_EXPECTED_SHA256)
    require_source_hash(LATIN_AUTHORITY_SOURCE, LATIN_AUTHORITY_EXPECTED_SHA256)
    for ebook, path in zip(GUTENBERG_IDS, ENGLISH_SOURCES):
        require_source_hash(path, ENGLISH_EXPECTED_SHA256[ebook])

    corrections = json.loads(CORRECTIONS_SOURCE.read_text(encoding="utf-8"))
    validate_correction_ledger(corrections)
    latin_confirmed = corrections["latinConfirmed"]
    english_appendix = corrections["gutenbergVolume1AppendixForRead"]
    expected_latin_correction_ids = {entry["id"] for entry in latin_confirmed}
    expected_english_ids = {
        entry["id"] for entry in english_appendix if entry.get("scope", "reader") == "reader"
    }
    excluded_english = [
        entry for entry in english_appendix if entry.get("scope", "reader") != "reader"
    ]
    if len(latin_confirmed) != 8 or len(english_appendix) != 27:
        raise RuntimeError("The confirmed correction ledger must contain 8 Latin and 27 English entries")
    if len(expected_english_ids) != 25 or len(excluded_english) != 2:
        raise RuntimeError("The Gutenberg Appendix ledger must account for 25 reader and 2 excluded entries")

    latin = parse_latin()
    book_titles, english, english_chapter_stats, english_endmatter = parse_english()
    OUTPUT.mkdir(parents=True, exist_ok=True)

    manifest_books: list[dict[str, Any]] = []
    total_chapters = 0
    total_latin_words = 0
    total_english_words = 0
    total_english_endmatter_words = 0
    mismatches: list[str] = []
    applied_latin_ids: set[str] = set()
    applied_english_ids: set[str] = set()
    emitted_book_names: set[str] = set()
    book_artifacts: list[tuple[str, bytes]] = []

    for book_number in range(1, 38):
        roman = int_to_roman(book_number)
        if book_number == 1:
            book_one_order = sorted(
                latin[1],
                key=lambda section_id: (
                    0 if section_id == "praef" else 1,
                    chapter_sort_key(section_id),
                ),
            )
            latin_combined = "\n\n".join(
                latin[1][section_id]["text"]
                for section_id in book_one_order
                if latin[1][section_id]["text"]
            )
            latin_book = {
                "praef": {
                    "title": "PLINIVS SECVNDVS VESPASIANO CAESARI SVO S.",
                    "text": latin_combined,
                    "mayhoffSections": [
                        marker
                        for section_id in book_one_order
                        for marker in latin[1][section_id].get("mayhoffSections", [])
                    ],
                }
            }
        else:
            latin_book = latin[book_number]

        english_book = english[book_number]
        chapters: list[dict[str, Any]] = []
        if book_number == 1:
            display_groups = [("praef", "praef", "praef")]
        else:
            latin_numeric_ids = sorted(int(section_id) for section_id in latin_book if section_id.isdigit())
            english_numeric_ids = sorted(int(section_id) for section_id in english_book if section_id.isdigit())
            if not latin_numeric_ids or not english_numeric_ids or english_numeric_ids[0] != 1:
                raise RuntimeError(f"Book {book_number} has invalid section sequence")
            if english_numeric_ids != latin_numeric_ids:
                raise RuntimeError(
                    f"Book {book_number} bilingual chapter mismatch: "
                    f"missing English={sorted(set(latin_numeric_ids) - set(english_numeric_ids))}, "
                    f"extra English={sorted(set(english_numeric_ids) - set(latin_numeric_ids))}"
                )
            display_groups = [
                (str(chapter_number), chapter_number, chapter_number)
                for chapter_number in english_numeric_ids
            ]

        covered_latin_ids: list[int] = []
        for chapter_id, section_start, section_end in display_groups:
            english_chapter = english_book[chapter_id]
            if book_number == 1:
                latin_parts = [latin_book["praef"]]
                label = "Praefatio et index"
                section_ids: list[int] = []
            else:
                section_ids = list(range(int(section_start), int(section_end) + 1))
                covered_latin_ids.extend(section_ids)
                latin_parts = [latin_book[str(section_id)] for section_id in section_ids]
                if chapter_id == "1" and "praef" in latin_book:
                    latin_parts.insert(0, latin_book["praef"])
                label = (
                    f"Caput {section_start}"
                    if section_start == section_end
                    else f"Capita {section_start}–{section_end}"
                )

            latin_text = "\n\n".join(part["text"] for part in latin_parts if part["text"])
            latin_text, latin_ids = apply_scoped_corrections(
                latin_text,
                latin_confirmed,
                book=book_number,
                unit=str(chapter_id),
            )
            english_text, english_ids = apply_scoped_corrections(
                english_chapter["text"],
                english_appendix,
                book=book_number,
                unit=str(chapter_id),
            )
            applied_latin_ids.update(latin_ids)
            applied_english_ids.update(english_ids)
            latin_title = " · ".join(
                dict.fromkeys(part["title"] for part in latin_parts if part["title"])
            )
            mayhoff_sections = [
                marker
                for part in latin_parts
                for marker in part.get("mayhoffSections", [])
            ]
            if not latin_text or not english_text:
                mismatches.append(
                    f"Book {book_number}, chapter {chapter_id}: "
                    f"latin={bool(latin_text)}, english={bool(english_text)}"
                )

            latin_words = word_count(latin_text)
            english_words = word_count(english_text)
            total_latin_words += latin_words
            total_english_words += english_words
            chapters.append({
                "id": chapter_id,
                "label": label,
                "title": english_chapter["title"] or latin_title or f"Chapter {chapter_id}",
                "latinTitle": latin_title,
                "latin": latin_text,
                "english": english_text,
                "latinWords": latin_words,
                "englishWords": english_words,
                "chapterStart": section_start,
                "chapterEnd": section_end,
                "mayhoffSections": mayhoff_sections,
                "englishChapters": english_chapter.get("englishChapters", []),
            })

        if book_number != 1:
            expected_latin_chapter_ids = sorted(int(section_id) for section_id in latin_book if section_id.isdigit())
            if covered_latin_ids != expected_latin_chapter_ids:
                raise RuntimeError(
                    f"Book {book_number} coverage mismatch: expected {expected_latin_chapter_ids}, got {covered_latin_ids}"
                )

        book_payload = {
            "number": book_number,
            "roman": roman,
            "title": book_titles.get(book_number, f"Book {roman}"),
            "chapters": chapters,
            "englishEndmatter": english_endmatter.get(book_number, []),
        }
        total_english_endmatter_words += sum(
            word_count(part) for part in book_payload["englishEndmatter"]
        )
        book_bytes = json.dumps(
            book_payload,
            ensure_ascii=False,
            separators=(",", ":"),
        ).encode("utf-8")
        book_sha256 = hashlib.sha256(book_bytes).hexdigest()
        output_name = f"book-{book_number:02d}.{book_sha256[:16]}.json"
        book_artifacts.append((output_name, book_bytes))
        emitted_book_names.add(output_name)
        total_chapters += len(chapters)
        coverage_metadata: dict[str, Any] = {}
        if book_number != 1:
            coverage_metadata.update({
                "latinChapterStart": latin_numeric_ids[0],
                "latinChapterEnd": latin_numeric_ids[-1],
                "latinChapterCount": len(latin_numeric_ids),
            })
        coverage_metadata["mayhoffSectionMarkerCount"] = sum(
            len(chapter["mayhoffSections"]) for chapter in chapters
        )
        english_stats = english_chapter_stats.get(book_number)
        if english_stats:
            emitted_english_chapters = sum(
                len(chapter["englishChapters"])
                for chapter in chapters
            )
            if emitted_english_chapters != english_stats["count"]:
                raise RuntimeError(
                    f"Book {book_number} English heading coverage mismatch: "
                    f"expected {english_stats['count']}, got {emitted_english_chapters}"
                )
            coverage_metadata.update({
                "englishChapterCount": english_stats["count"],
                "englishChapterMax": english_stats["max"],
            })
        manifest_books.append({
            "number": book_number,
            "roman": roman,
            "title": book_payload["title"],
            "chapterCount": len(chapters),
            "file": f"/corpus/{output_name}",
            "sha256": book_sha256,
            "byteLength": len(book_bytes),
            **coverage_metadata,
        })

    if mismatches:
        raise RuntimeError("Chapter alignment gaps:\n" + "\n".join(mismatches))
    if applied_latin_ids != expected_latin_correction_ids:
        raise RuntimeError(
            f"Latin correction coverage drifted: expected {sorted(expected_latin_correction_ids)}, "
            f"applied {sorted(applied_latin_ids)}"
        )
    if applied_english_ids != expected_english_ids:
        raise RuntimeError(
            f"English correction coverage drifted: expected {sorted(expected_english_ids)}, "
            f"applied {sorted(applied_english_ids)}"
        )

    public_corrections = {
        **corrections,
        "latinExtractionRepairs": [
            {
                "id": f"lat-extract-{index:03d}",
                "scope": "extraction-repair",
                "before": before,
                "after": after,
                "expectedCount": 1,
                "note": "Verified reading-text repair applied while extracting the Perseus TEI base text.",
            }
            for index, (before, after) in enumerate(LATIN_READING_TEXT_CORRECTIONS.items(), start=1)
        ],
    }
    corrections_bytes = (json.dumps(public_corrections, ensure_ascii=False, indent=2) + "\n").encode("utf-8")
    corrections_sha256 = hashlib.sha256(corrections_bytes).hexdigest()
    release_material = [book["sha256"] for book in manifest_books] + [
        corrections_sha256,
        LATIN_EXPECTED_SHA256,
        LATIN_AUTHORITY_EXPECTED_SHA256,
        *[ENGLISH_EXPECTED_SHA256[ebook] for ebook in GUTENBERG_IDS],
    ]
    corpus_revision = hashlib.sha256("\n".join(release_material).encode("ascii")).hexdigest()[:16]

    manifest = {
        "title": "Naturalis Historia",
        "author": "Gaius Plinius Secundus",
        "revision": corpus_revision,
        "totalBooks": 37,
        "totalChapters": total_chapters,
        "totalLatinWords": total_latin_words,
        "totalEnglishWords": total_english_words,
        "totalEnglishEndmatterWords": total_english_endmatter_words,
        "latinEdition": "Karl Friedrich Theodor Mayhoff, ed. (Teubner, 1906)",
        "englishEdition": "John Bostock and H. T. Riley, trans. (1855-57)",
        "readingTextPolicy": (
            "Reading text derived from the pinned Perseus transcription and the Bostock-Riley "
            "translation, with a reviewable correction ledger; critical apparatus, translation "
            "footnotes, and page furniture are omitted. Bostock-Riley is aligned at chapter level "
            "and is not a line-by-line translation of the Mayhoff text. Book-end summaries and "
            "author lists are retained separately."
        ),
        "corrections": {
            "file": "/corpus/corrections.json",
            "sha256": corrections_sha256,
            "latinConfirmedCorrections": len(latin_confirmed),
            "latinExtractionRepairs": len(LATIN_READING_TEXT_CORRECTIONS),
            "gutenbergAppendixCorrections": len(english_appendix),
            "gutenbergAppendixAppliedToReader": len(expected_english_ids),
            "gutenbergAppendixExcludedWithReason": len(excluded_english),
        },
        "sources": {
            "latin": {
                "url": LATIN_URL,
                "release": PERSEUS_RELEASE,
                "commit": PERSEUS_COMMIT,
                "sha256": sha256(LATIN_SOURCE),
                "authority": {
                    "url": LATIN_AUTHORITY_URL,
                    "sha256": sha256(LATIN_AUTHORITY_SOURCE),
                    "purpose": "Comparator cited by the eight confirmed transcription corrections",
                },
            },
            "english": [
                {"ebook": ebook, "url": url, "sha256": sha256(path)}
                for ebook, url, path in zip(GUTENBERG_IDS, GUTENBERG_URLS, ENGLISH_SOURCES)
            ],
        },
        "books": manifest_books,
    }
    for output_name, book_bytes in book_artifacts:
        (OUTPUT / output_name).write_bytes(book_bytes)
    (OUTPUT / "corrections.json").write_bytes(corrections_bytes)
    (OUTPUT / "manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    for existing in OUTPUT.glob("book-*.json"):
        if existing.name not in emitted_book_names:
            existing.unlink()

    print(
        f"Latin confirmed: {len(applied_latin_ids)}/{len(expected_latin_correction_ids)} applied\n"
        f"Gutenberg Appendix: {len(english_appendix)}/{len(english_appendix)} accounted for\n"
        f"Gutenberg reader corrections: {len(applied_english_ids)}/{len(expected_english_ids)} applied\n"
        f"Gutenberg excluded corrections: {len(excluded_english)}/{len(excluded_english)} documented"
    )

    print(
        f"Built {manifest['totalBooks']} books / {total_chapters} chapters / "
        f"{total_latin_words:,} Latin words / {total_english_words:,} English words"
    )


if __name__ == "__main__":
    build()
