# PDF fonts

PDF export uses pdf-lib, whose built-in fonts are WinAnsi-encoded and **cannot
render Bangla**. DOCX export is unaffected — it is natively Unicode.

To export Bangla question papers as PDF, drop a TrueType font here:

```
public/fonts/NotoSansBengali-Regular.ttf
```

`src/lib/export/fonts.ts` also accepts `NotoSans-Regular.ttf` or
`SolaimanLipi.ttf`. When one is present it is embedded (subset) and used for the
whole document.

When no font is present the exporter falls back to Helvetica, substitutes
characters it cannot encode, and sets the response header
`X-Export-Degraded: unicode-font-missing` so the caller knows the output was
degraded rather than silently producing a page of question marks.

Noto Sans Bengali is available under the SIL Open Font License from
Google Fonts. The font file is deliberately **not** committed to this repository.
