# ICD-10 / HCPCS raw data from CMS (free access, no AMA license needed)

Built in response to Lupita's Oct 3, 2026 email: while the CPT contract with
AMA is still pending, use CMS's free public ICD-10 and HCPCS data to start
the database, and scope out how the raw data could drive the "pop"
(pop-up) instructions feature.

**All three parsers below have been run against your real files** (the ones
you sent: `HCPC2026_OCT_ANWEB_09232026.zip`, `2027-icd-10-table-and-index.zip`,
`2027-code-descriptions-in-tabular-order.zip`) and verified end to end —
not just checked for syntax. Real counts:

- **ICD-10-CM flat file** → 74,879 codes
- **ICD-10-CM Tabular XML** → 47,025 codes with chapter/section context, 651
  chapter/section-level notes
- **HCPCS quarterly file** → 8,770 procedure records (modifiers excluded —
  see below)

## What each source contains, and which one matters for "pop" instructions

**ICD-10-CM** has two files in your zips:

| File | Contains | Use for |
|---|---|---|
| `icd10cm_codes_2027.txt` (flat) | code + description, nothing else | A quick, complete code/description lookup |
| `icd10cm_tabular_2027.xml` | Every code nested under its chapter and section, **plus CMS's own Includes / Excludes1 / Excludes2 / "Use additional code" / "Code first" / inclusion-term notes** | **This is the one that matters for "pop" instructions** — real instructional content coders rely on, free/public, no AMA licensing involved |

**HCPCS Level II** (`HCPC2026_OCT_ANWEB_09232026.txt`) is a fixed-width file,
confirmed against its own record-layout doc (`HCPC2026_recordlayout.txt`,
also in your zip). One real wrinkle found while verifying: this file bundles
HCPCS **modifiers** (2-character codes like `AB`, `AC`) in with the 5-character
procedure codes, flagged by a "Record Identification Code" column. Since
this app already has a separate Modifier Search feature with curated real
modifier data, the parser deliberately **skips the modifier rows** here, so
they don't end up duplicated with worse descriptions. HCPCS is flatter than
ICD-10 either way — good for code/description lookup, no includes/excludes-
style notes, so thinner material for pop-ups than ICD-10 is.

## Scoping the "pop instructions" idea

The ICD-10 Tabular XML's nested notes map directly onto two levels of pop-up:

- **Per-code pop-up** — when a user is looking at a specific code (e.g.
  `E11.9`), show its `Includes` / `Excludes1` / `Excludes2` / "Use additional
  code" / "Code first" notes, pulled from `Icd10TabularEntry`.
- **Per-section pop-up** — when a user opens a whole section (e.g. "Diabetes
  mellitus (E08-E13)"), show the broader notes CMS attaches at the
  chapter/section level rather than to one code, pulled from
  `Icd10SectionNote`.

That's genuinely free, official content — no dependency on the AMA contract.
Once that contract comes through, the same pattern (notes attached to codes
and sections) is the natural place to layer in whatever "friendly version"
AMA provides for CPT.

## What this delivery contains

- `prisma/schema-additions.prisma` — three new tables (`Icd10TabularEntry`,
  `Icd10SectionNote`, `HcpcsLevelIIEntry`). **Append this to the bottom of
  your existing `prisma/schema.prisma`** — don't replace the file.
- `prisma/migrations/20261003000000_icd10_hcpcs_raw_data/migration.sql` —
  the matching migration (pure `CREATE TABLE`, doesn't touch anything
  existing).
- `scripts/cms-data/parse-icd10-tabular-xml.ts` — the rich XML parser
  (codes + chapter/section + notes). **Use this one as the primary ICD-10
  import.**
- `scripts/cms-data/parse-icd10-flat.ts` — the simple flat code/description
  parser (optional cross-check; the XML import already covers every code).
- `scripts/cms-data/parse-hcpcs-quarterly.ts` — the HCPCS fixed-width parser,
  with the exact verified column positions baked in.

## Step-by-step

```powershell
# One-time setup
npm install fast-xml-parser --save

# 1. Add the new tables
#    - paste prisma/schema-additions.prisma onto the end of prisma/schema.prisma
#    - copy the migrations folder into your prisma/migrations/
npx prisma migrate deploy
npx prisma generate

# 2. ICD-10 — unzip 2027-icd-10-table-and-index.zip, then point at the
#    "Table and Index" folder inside it (that's where icd10cm_tabular_2027.xml lives):
npx tsx scripts/cms-data/parse-icd10-tabular-xml.ts --dir "./cms-raw/Table and Index" --year 2027 --dry-run
npx tsx scripts/cms-data/parse-icd10-tabular-xml.ts --dir "./cms-raw/Table and Index" --year 2027

# 3. HCPCS — unzip HCPC2026_OCT_ANWEB_09232026.zip, then:
npx tsx scripts/cms-data/parse-hcpcs-quarterly.ts --file "./cms-raw/HCPC2026_OCT_ANWEB_09232026.txt" --quarter 2026Q4 --dry-run
npx tsx scripts/cms-data/parse-hcpcs-quarterly.ts --file "./cms-raw/HCPC2026_OCT_ANWEB_09232026.txt" --quarter 2026Q4
```

No existing table or data is touched by any of this — it's additive only.
Still worth running each `--dry-run` once on your machine before the real
import, as a final check before anything hits the live database.

## Not included yet (next step once this is confirmed working)

Wiring these tables into the actual UI (e.g. the pop-up component itself,
and which pages trigger it) isn't part of this delivery — this is the data
layer only. Once you've run the real import and confirmed the data looks
right in the database, the next piece is building the pop-up UI that reads
from `Icd10TabularEntry` / `Icd10SectionNote`.
