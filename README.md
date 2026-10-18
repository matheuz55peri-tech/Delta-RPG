# DARKBEAT Multiplayer

Jogo de ritmo cooperativo para até cinco jogadores com chefe de 100 HP, salas por código e placar compartilhado.

## Iniciar localmente

```bash
npm install
npm start
```

Abra http://localhost:3000.

## Hospedagem

O projeto inclui `render.yaml` para publicar como Web Service no Render. A hospedagem precisa executar `npm start` e manter conexões WebSocket; GitHub Pages sozinho não suporta o servidor multiplayer.
