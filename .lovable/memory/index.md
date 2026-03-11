# ParecerTech - Parecer Técnico Generator

## Design System
- Font: IBM Plex Sans + IBM Plex Mono
- Primary: 215 60% 32% (navy blue - institutional)
- Accent: 45 90% 52% (amber)
- Success/Warning/Info semantic colors defined
- Status badges via CSS classes in index.css

## Architecture
- Dashboard → NovoProcesso → RevisaoParecer → ValidacaoParecer → PreviaParecer → ResultadoFinal
- Edge function: analyze-documents (uses Lovable AI gemini-2.5-flash-lite)
- Client-side DOCX generation via `docx` + `file-saver`
- Storage bucket: processos (private)
- No auth - public RLS policies

## Tables
- processos, arquivos, dados_extraidos, pareceres
- Enums: categoria_documento (includes TERMO_DE_REFERENCIA, COTACAO_OU_PROPOSTA, MODELO), status_processo

## Classification Engine Rules
- RRC is NOT ART/RRT (excluded first)
- ART/RRT matched via word boundary regex only
- TR matched via word boundary or "termo de referencia"
- Filename keywords checked before folder path fallback
- Conclusion is neutral/limited when essential categories < 2
