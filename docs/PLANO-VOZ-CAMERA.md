# Plano — Sistema de Escritório (Voz espacial, Câmera, Compartilhamento de tela)

Objetivo: no hotel, usuários em uma sala conversam por voz/vídeo como num escritório virtual:
áudio espacial por **região** (só se ouve quem está perto / na mesma zona), câmera e tela
compartilhada com quem está na mesma zona.

## Arquitetura (recomendação)

**WebRTC via LiveKit self-hosted** (container extra no EasyPanel):
- LiveKit cuida de SFU, TURN/STUN, reconexão eTokens — não reinventamos WebRTC.
- Alternativa descartada: mesh Peer-to-Peer (só aguenta ~4 pessoas) e mediasoup (muito boilerplate).
- 1 container `polaris-livekit` + 1 container `coturn` (TURN p/ NAT). Portas: 7880 (API interna),
  UDP 50000-60000, TCP 443 via same-host nginx fallback.

**Fluxo de autenticação:**
1. Cliente entra na sala → emulador gera JWT LiveKit (secret compartilhado `LIVEKIT_API_SECRET`)
   com identidade `userId` e metadados `{roomId, zoneId}` → envia pelo WS Octane existente.
2. Cliente conecta ao LiveKit (uma conexão por sala).
3. Emulador re-emite metadados via LiveKit Server API quando o usuário muda de zona.

## 1. Regiões (áudio por proximidade/zona)

- Tabela nova: `room_voice_zones (id, room_id, name, color)` e `room_voice_zone_tiles
  (zone_id, x, y)` (tiles por zona).
- Emulador já recebe posição de cada avatar a cada passo → calcula a zona do avatar
  (lookup do tile em memória) → publicação via WS: `VoiceZoneEvent {users: [{id, zoneId, x, y}]}`.
- Regra de audibilidade no cliente:
  - mesma zona → volume 100%;
  - zonas diferentes → 0% (a menos que "ouvir sala inteira" esteja ligado p/ o admin);
  - sem zona definida na sala → modo proximidade: raio em tiles (ex.: 6) com volume decrescente + pan estéreo pela posição relativa.
- Mic do usuário: sempre publicando quando ligado; quem NÃO deve ouvir simplesmente
  baixa o volume/ignora (economiza o client-side switching e mantém LiveKit simples).

## 2. Configuração de região (editor de tiles)

- Comando/admin no próprio quarto: entrar em "modo zonas" (só rank >= 5 ou dono com permissão).
- Overlay no quarto: clicar/arrastar sobre tiles pinta tiles de uma zona (cores por zona,
  legível como o editor de floorplan). UI nova `VoiceZoneEditor` reaproveitando o
  layout do FloorplanEditor existente.
- Botões: criar zona, renomear, apagar, salvar → HTTP POST ao emulador
  (endpoint housekeeping já existente) → emulador persiste e recarrega zonas da sala.
- Zonas grandes = reuniões: pintar N tiles para a mesma zona faz todos se ouvirem.

## 3. Mute automático ao perder foco (só se estiver sozinho)

- 100% client-side, no Octane:
  - `window.blur` / `visibilitychange hidden` → se (opção ligada) E (nenhum participante
    audível na zona = 0 remotos com track de áudio ativa na minha zona) → desabilita
    track do mic (`track.muted = true` mantém a publicação).
  - `focus` → restaura estado anterior.
  - Widget de teste de proximidade: contador de "ouvintes" visível no HUD.
- Opção em Configurações > Voz: "Silenciar ao trocar de aba quando sozinho" (default ON).

## 4. HUD e ícones

- Ícones: `.octane-icon.icon-camera` (existe), `.icon-mic` (novo,
  `assets/images/toolbar/air/mic.png`), `.icon-screenshare` (novo,
  `assets/images/toolbar/air/screenshare.png`) — classes já adicionadas ao icons.css.
- HUD flutuante no quarto (canto inferior direito, estilo barra de call):
  [fone on/off] [mic on/off] [câmera on/off] [tela on/off] + indicador de zona atual e nº de ouvintes.
- Estados: vermelho riscado = off; pulso verde = falando; borda amarela = compartilhando tela.

## 5. Câmera e tela

- Câmera: `getUserMedia` → publish no LiveKit (video). Quem está na minha zona recebe num
  mini-player flutuante (tile de vídeo) — mesmo padrão do painel de call.
- Tela: `getDisplayMedia` → publish como track `screen`. O painel de visualização abre em
  popup dentro do cliente (não fullscreen) para não travar o jogo.
- Permissões HTTPS: já servimos por HTTPS (EasyPanel) → getUserMedia/getDisplayMedia funcionam.

## Fases de implementação

1. **Fase 1 — Infra**: containers LiveKit + TURN no compose do EasyPanel; endpoint de token
   no emulador; conexão do Octane; HUD com fone/mic funcionando (voz global da sala, sem
   espacialidade ainda). Teste de eco com 2 navegadores.
2. **Fase 2 — Espacialidade**: zonas no banco + cálculo no emulador + eventos WS + volume/pan.
3. **Fase 3 — Editor de zonas**: overlay no quarto + persistência.
4. **Fase 4 — Mute automático + câmera + tela.**

## Decisões abertas

- LiveKit vs. mediasoup (proposta: LiveKit — decidir antes da Fase 1).
- Ouvir "toda a sala" (modo assembleia) como toggle por sala? (proposta: sim, toggle do dono).
- Gravação de reuniões? (fora de escopo por enquanto)
