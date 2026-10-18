const http = require('http');
const fs = require('fs');
const path = require('path');
const {WebSocketServer} = require('ws');
const PORT = process.env.PORT || 3000;
const rooms = new Map();
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function code(){let s; do{s=Array.from({length:6},()=>ALPHABET[Math.floor(Math.random()*ALPHABET.length)]).join('')}while(rooms.has(s));return s;}
const server=http.createServer((req,res)=>{
  if(req.url!=='/'&&req.url!=='/index.html'){res.writeHead(404);return res.end('Not found')}
  res.writeHead(200,{'content-type':'text/html; charset=utf-8'});
  fs.createReadStream(path.join(__dirname,'index.html')).pipe(res);
});
const wss=new WebSocketServer({server});
function send(ws,data){if(ws.readyState===1)ws.send(JSON.stringify(data))}
function members(room){return room.players.map(p=>p?{name:p.name,score:p.score,combo:p.combo,hp:p.hp}:null)}
function broadcast(room){for(const p of room.players)if(p)send(p.ws,{type:'state',code:room.code,players:members(room),boss:room.boss,phase:room.phase,host:room.host,startedAt:room.startedAt,difficulty:room.difficulty,round:room.round})}
function cleanName(x){return String(x||'Viajante').trim().replace(/[\x00-\x1f<>]/g,'').slice(0,18)||'Viajante'}
function leave(ws){const room=rooms.get(ws.room); if(!room)return;const i=room.players.findIndex(p=>p&&p.ws===ws);if(i<0)return;room.players[i]=null;if(room.players.every(p=>!p)){rooms.delete(room.code);return}if(room.host===i)room.host=room.players.findIndex(Boolean);broadcast(room);ws.room=null;}
wss.on('connection',ws=>{
  ws.on('message',raw=>{
    let m;try{m=JSON.parse(raw)}catch{return}if(!m||typeof m!=='object')return;
    if(m.type==='create'){
      leave(ws);const id=code(),room={code:id,players:Array(5).fill(null),boss:100,phase:'lobby',host:0,startedAt:0,difficulty:'normal',round:0};
      rooms.set(id,room);room.players[0]={ws,name:cleanName(m.name),score:0,combo:0,hp:100,hitIds:new Set()};ws.room=id;send(ws,{type:'joined',slot:0});broadcast(room);
    }else if(m.type==='join'){
      const room=rooms.get(String(m.code||'').toUpperCase());if(!room)return send(ws,{type:'error',message:'Sala não encontrada.'});
      if(room.phase==='playing')return send(ws,{type:'error',message:'A partida já começou.'});
      let slot=Number.isInteger(m.slot)?m.slot:room.players.findIndex(p=>!p);
      if(slot<0||slot>=5||room.players[slot])return send(ws,{type:'error',message:'Slot indisponível.'});
      leave(ws);room.players[slot]={ws,name:cleanName(m.name),score:0,combo:0,hp:100,hitIds:new Set()};ws.room=room.code;send(ws,{type:'joined',slot});broadcast(room);
    }else{
      const room=rooms.get(ws.room);if(!room)return;
      const i=room.players.findIndex(p=>p&&p.ws===ws);if(i<0)return;const p=room.players[i];
      if(m.type==='name'){p.name=cleanName(m.name);broadcast(room)}
      if(m.type==='selectSlot'&&room.phase==='lobby'&&Number.isInteger(m.slot)&&m.slot>=0&&m.slot<5&&!room.players[m.slot]){room.players[m.slot]=p;room.players[i]=null;if(room.host===i)room.host=m.slot;send(ws,{type:'joined',slot:m.slot});broadcast(room)}
      if(m.type==='start'&&i===room.host){
        room.boss=100;room.phase='playing';room.startedAt=Date.now()+3500;room.difficulty=['easy','normal','hard'].includes(m.difficulty)?m.difficulty:'normal';room.round++;
        room.players.forEach(player=>{if(player){player.score=0;player.combo=0;player.hp=100;player.hitIds=new Set()}});
        broadcast(room);
      }
      if(m.type==='hit'&&room.phase==='playing'&&Date.now()>=room.startedAt-400){
        const id=Number(m.id),max=room.difficulty==='easy'?100:room.difficulty==='hard'?220:160;
        if(!Number.isInteger(id)||id<0||id>=max||p.hitIds.has(id))return;
        const timing=Number(m.timing);
        if(!Number.isFinite(timing)||Math.abs(timing)>170)return;
        const beat=room.difficulty==='easy'?650:room.difficulty==='hard'?360:480;
        const expected=room.startedAt+1500+id*beat;
        if(Math.abs(Date.now()-expected)>480)return;
        p.hitIds.add(id);p.combo++;p.score+=Math.abs(timing)<55?300:Math.abs(timing)<110?150:75;
        room.boss=Math.max(0,room.boss-1);
        if(room.boss===0)room.phase='victory';
        broadcast(room);
      }
      if(m.type==='miss'&&room.phase==='playing'){p.combo=0;broadcast(room)}
      if(m.type==='reset'&&i===room.host){room.phase='lobby';room.boss=100;broadcast(room)}
    }
  });
  ws.on('close',()=>leave(ws));
});
server.listen(PORT,()=>console.log('DARKBEAT listening on',PORT));
