# Design — Idioma pt-BR no Polaris/Octane

Data: 2026-11-17 · Escopo aprovado (timeout do clarify, seguindo recomendação): telas + textos do jogo + catálogo agora; tooltips de furnis por ondas.

## Intent
Hotel em português do Brasil com opção de idioma no seletor da tela de login (pt-BR incluso) e textos de itens traduzidos.

## Arquitetura existente (nada de framework novo)
- Cliente Octane já tem LocalizationManager + seletor de idioma (LOGIN_LOCALES em `Octane/src/components/login/LoginView.tsx`, TEXT_TRANSLATION_LOCALES em `Octane/src/hooks/translation/useTranslation.ts`).
- O código JÁ mapeia `pt` → `file: 'br'` (LoginView.tsx:111 e useTranslation.ts:90) — faltam o arquivo e a entrada nas listas.
- Textos de UI: `Octane/public/configuration/UITexts_<file>.jsonc.example` (3.180 keys no EN) — carregados como override por cima do ExternalTexts base.
- Textos in-game por idioma: `external.texts.translation.url` (config) → o cliente busca `ExternalTexts_<file>.json` e aplica como overrideDefinitions (merge; keys não traduzidas continuam do base).
- Itens: ProductData.json (16.532 produtos do catálogo) e FurnitureData.json (36.670 nomes únicos) são arquivos vendored servidos em /gameassets/gamedata/.

## Decisões
1. **UI/telas**: criar `UITexts_br.jsonc.example` (3.180 keys, pt-BR) + adicionar pt-BR às duas listas de locales + flag. Rebuild do cliente.
2. **Textos do jogo**: `assets/gamedata/text_translate/ExternalTexts_br.json` (override parcial, keys visíveis traduzidas) + `external.texts.translation.url` = `${gamedata.url}/text_translate/ExternalTexts_%locale%.json` no ui-config template.
3. **Itens (catálogo)**: tradução IN-PLACE dos `name`/`description` no ProductData.json vendored — pt-BR global (hotel brasileiro).
4. **Itens (tooltips de furni)**: FurnitureData names por ondas em sessões futuras (36.670 uniques).

## Non-goals
- Não criar framework de i18n novo (usar o existente).
- Não traduzir textos de eventos/quests do long tail agora (ficam em inglês até ondas futuras).
- Não tocar no emulador (textos server-side de comandos já têm keys em ExternalTexts).

## O que fica para o builder
- flagPt para o seletor (imagem 16x16 ou emoji fallback).
- Ordem do pt-BR na lista do seletor (depois de en).
- Validação: GET /configuration/UITexts_br.jsonc.example 200; cliente em pt-BR após escolher idioma; catálogo com nomes pt-BR.
