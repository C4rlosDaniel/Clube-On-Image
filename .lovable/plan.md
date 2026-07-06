# Atualização — Faixa de Notícias, Atribuições e Apresentações

## 1. Componente reutilizável "SuccessNeon"
Novo `src/components/SuccessNeon.tsx`:
- Toast fixo no canto superior direito, verde neon com borda branca, cantos arredondados, glow, ícone `CheckCircle2`.
- Anima entrada (slide+fade) e saída após 4s.
- Suporta `action` opcional (usado para o botão "Desfazer" da faixa).
- Exposto via helper `showSuccess(text, { undo })` que monta em um portal (`#ccp-success-root` injetado no `__root.tsx`).

## 2. Configuração global da faixa (`app_settings`)
Migração adiciona colunas na tabela existente `public.app_settings`:
- `ticker_height_px int` (default 96, min ~44, máx equivalente a 5cm em 1080p ≈ 189px)
- `ticker_font_family text` (default "Roboto")
- `ticker_font_min int` (default 12), `ticker_font_max int` (default 24)
- `ticker_bg_color text`, `ticker_bg_opacity numeric` (default 0.95)

Store (`src/lib/store.ts`): estende `AppSettings`, adiciona `updateTickerSettings(patch)` e realtime como já existe.

## 3. Faixa de Notícias (`src/routes/app.news.tsx`)
- **Editor rich text**: usa `RichTextEditor` já existente + toolbar extra:
  - 8 famílias: Arial, Times New Roman, Roboto, Verdana, Georgia, Calibri, Tahoma, Courier New.
  - Bold (Ctrl+B/N), Italic (Ctrl+I), Underline (Ctrl+U/S) via `document.execCommand` aplicado à seleção.
  - Color picker para seleção.
  - "Pincel de formatação": captura estilos computados da seleção atual e aplica na próxima seleção.
  - Contador `xxx/150` (limite duro; conta texto sem HTML).
- **Fundo da caixa da mensagem**: mesmos controles de cor+opacidade da etiqueta.
- **Configurações globais** (painel dedicado no topo, salvam em `app_settings`):
  - Slider de altura da faixa (px, 44–189).
  - Família de fonte global.
  - Cor/opacidade de fundo global.
- **Preview dinâmico**: painel 16:9 responsivo com imagem placeholder + `TickerBar` recebendo props/settings ao vivo.
- **Mockup estático**: `src/assets/mockup-proporcao.png` (gerado), mostra 1920x1080 com/sem faixa; exibido nesta aba e em Apresentações.
- **Salvar com delay 6s**: botão dispara spinner inline não-bloqueante; após 6s persiste e chama `showSuccess("Mensagem Salva Com Sucesso", { undo })`. Undo restaura snapshot da mensagem/ticker settings anteriores (disponível durante os 4s do toast).

## 4. Atribuições (`src/routes/app.terminals.tsx`)
- Troca de apresentação: mantém o delay atual, mas usa novo spinner (`RefreshCw` girando) e duração proporcional entre 2000–4000ms baseada no nº de mídias da nova apresentação.
- Ao concluir: `showSuccess("Terminal Atualizado Com Sucesso")`.

## 5. Apresentações (`src/routes/app.presentations.tsx`)
- Substitui toasts atuais de sucesso por `showSuccess("Apresentação Salva Com Sucesso")`.
- Adiciona o mockup estático de proporção no topo.
- Toggle "Mostrar guias de proporção" no editor da apresentação: sobrepõe grade + zona segura (com/sem faixa) usando a altura global da faixa.

## 6. Renderização da faixa (não sobreposição + letterbox)
`src/components/TickerBar.tsx`:
- Passa a receber altura/fundo/fonte a partir de `app_settings`.
- Continua sendo um overlay absoluto (para permitir preview), mas ganha modo `reserveSpace`.

`src/routes/terminal.$id.tsx` e `src/routes/app.preview.tsx`:
- Substituem layout atual por container flex vertical:
  - `<PresentationPlayer />` com `style={{ height: 'calc(100% - tickerH)' }}` quando ticker ativo, senão 100%.
  - `<TickerBar />` ocupando exatamente `tickerH`.
- `PresentationPlayer`/media usa `object-fit: contain` (letterbox) — verificar que já é o caso; ajustar se necessário.

## 7. Regra dos 0,2cm e cálculo automático de fonte máx
Em `TickerBar` texto e etiqueta usam `padding` de ~7.5px (0.2cm ≈ 7.56px @96dpi). Tamanho de fonte é `clamp(12px, calc(tickerH * 0.35), 24px)` — assim respeita altura disponível menos padding e nunca ultrapassa 24px.

## Detalhes técnicos

- Migração SQL única adicionando colunas com defaults; sem novas policies (tabela já tem "open all").
- Estado do "pincel" mantido em ref local do editor.
- Undo: guarda snapshot do objeto anterior; se undo clicado, chama `updateTickerMessage`/reverte create com `deleteTickerMessage`.
- `showSuccess` implementa fila simples caso múltiplas confirmações rápidas.
- Sem alterações de RLS, storage ou auth.

## Arquivos afetados
- criar: `src/components/SuccessNeon.tsx`, `src/assets/mockup-proporcao.png`, migração SQL.
- editar: `src/lib/store.ts`, `src/routes/app.news.tsx`, `src/routes/app.terminals.tsx`, `src/routes/app.presentations.tsx`, `src/routes/terminal.$id.tsx`, `src/routes/app.preview.tsx`, `src/components/TickerBar.tsx`, `src/components/RichTextEditor.tsx`, `src/routes/__root.tsx`, `src/styles.css`.
