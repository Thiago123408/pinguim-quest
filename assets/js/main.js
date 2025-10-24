
// Pinguim Quest — jogo em HTML5 Canvas (sem dependências)

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d', { alpha: false });

// --- UI elements
const hud = document.getElementById('hud');
const levelLabel = document.getElementById('levelLabel');
const xpLabel = document.getElementById('xpLabel');
const coinLabel = document.getElementById('coinLabel');
const livesLabel = document.getElementById('livesLabel');
const distanceLabel = document.getElementById('distanceLabel');
const progressBar = document.getElementById('progressBar').firstElementChild;

const menu = document.getElementById('menu');
const btnStart = document.getElementById('btnStart');
const btnSettings = document.getElementById('btnSettings');
const btnHow = document.getElementById('btnHow');
const bestScoreLabel = document.getElementById('bestScoreLabel');

const settings = document.getElementById('settings');
const volumeRange = document.getElementById('volumeRange');
const particlesCheck = document.getElementById('particlesCheck');
const difficultySelect = document.getElementById('difficultySelect');
const btnBackSettings = document.getElementById('btnBackSettings');

const howto = document.getElementById('howto');
const btnBackHow = document.getElementById('btnBackHow');

const pause = document.getElementById('pause');
const btnResume = document.getElementById('btnResume');
const btnQuit = document.getElementById('btnQuit');

const gameover = document.getElementById('gameover');
const btnRestart = document.getElementById('btnRestart');
const btnMenu = document.getElementById('btnMenu');
const finalXp = document.getElementById('finalXp');
const finalCoins = document.getElementById('finalCoins');
const finalLevel = document.getElementById('finalLevel');

// --- Helpers
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const rand = (a, b) => a + Math.random() * (b - a);
const randi = (a, b) => Math.floor(rand(a, b + 1));
const lerp = (a, b, t) => a + (b - a) * t;

// --- Audio (WebAudio procedural)
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
let masterGain = audioCtx.createGain();
masterGain.gain.value = 0.6;
masterGain.connect(audioCtx.destination);

function beep({freq=440, type='sine', duration=0.08, volume=0.3, attack=0.005, release=0.05}){
  const now = audioCtx.currentTime;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(volume, now + attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + attack + duration + release);
  osc.connect(gain);
  gain.connect(masterGain);
  osc.start(now);
  osc.stop(now + attack + duration + release + 0.02);
}

const SFX = {
  collect(){ beep({freq:880, type:'triangle', duration:0.06, volume:0.25}); },
  coin(){ beep({freq:1200, type:'square', duration:0.07, volume:0.22}); },
  jump(){ beep({freq:300, type:'sawtooth', duration:0.12, volume:0.3}); },
  hit(){ beep({freq:120, type:'sine', duration:0.18, volume:0.32}); },
  level(){ beep({freq:660, type:'triangle', duration:0.12, volume:0.3}); setTimeout(()=>beep({freq:990,type:'triangle',duration:0.12,volume:0.28}),80); },
};

// Settings persistence
const storageKey = 'pinguim-quest-settings-v1';
const bestKey = 'pinguim-quest-best-v1';
const Settings = {
  volume: 0.6,
  particles: true,
  difficulty: 'normal',
  load(){
    try {
      const d = JSON.parse(localStorage.getItem(storageKey) || '{}');
      if('volume' in d) this.volume = d.volume;
      if('particles' in d) this.particles = d.particles;
      if('difficulty' in d) this.difficulty = d.difficulty;
    } catch {}
  },
  save(){
    localStorage.setItem(storageKey, JSON.stringify({volume:this.volume, particles:this.particles, difficulty:this.difficulty}));
  }
};
Settings.load();
masterGain.gain.value = Settings.volume;
volumeRange.value = Settings.volume;
particlesCheck.checked = Settings.particles;
difficultySelect.value = Settings.difficulty;
bestScoreLabel.textContent = (localStorage.getItem(bestKey) || 0) + " XP";

// --- Resize
function resize(){
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
window.addEventListener('resize', resize);
resize();

// --- Input
const keys = new Set();
window.addEventListener('keydown', e => {
  keys.add(e.key.toLowerCase());
  if([' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(e.key.toLowerCase())) e.preventDefault();
});
window.addEventListener('keyup', e => keys.delete(e.key.toLowerCase()));

// --- Game objects
class Penguin {
  constructor(){
    this.x = 100;
    this.y = 0;
    this.vx = 0;
    this.vy = 0;
    this.onGround = false;
    this.w = 48; this.h = 42;
    this.lives = 3;
    this.stamina = 1;
    this.faceRight = true;
    this.slide = false;
  }
  reset(x,y){
    this.x=x; this.y=y; this.vx=0; this.vy=0; this.onGround=false; this.slide=false; this.stamina=1;
  }
  logic(dt, world){
    // Controls
    const acc = 120; // base accel
    const max = 280; // base max
    let friction = this.slide ? 0.995 : 0.96;
    let maxSpeed = this.slide ? 420 : max;
    let accel = this.slide ? acc*1.2 : acc;

    if(keys.has('arrowleft') || keys.has('a')) { this.vx -= accel * dt; this.faceRight=false; }
    if(keys.has('arrowright') || keys.has('d')){ this.vx += accel * dt; this.faceRight=true; }
    this.slide = (keys.has('arrowdown') || keys.has('s')) && this.onGround;

    // Jump
    if((keys.has('arrowup') || keys.has('w')) && this.onGround){
      this.vy = -360; this.onGround=false; SFX.jump();
    }
    // Boost (space) uses stamina
    if(keys.has(' ') && this.stamina > 0.12){
      const dir = this.faceRight ? 1 : -1;
      this.vx += dir * 900 * dt;
      this.stamina -= 0.6 * dt;
    } else {
      this.stamina = clamp(this.stamina + 0.25 * dt, 0, 1);
    }

    // Physics
    this.vy += world.gravity * dt;
    this.x += this.vx * dt;
    this.y += this.vy * dt;

    // Friction
    if(this.onGround){
      this.vx *= friction;
    } else {
      this.vx *= 0.995;
    }

    // Ground collision
    if(this.y + this.h/2 >= world.groundYAt(this.x)){
      this.y = world.groundYAt(this.x) - this.h/2;
      this.vy = 0;
      this.onGround = true;
    } else {
      this.onGround = false;
    }

    // Clamp speeds
    this.vx = clamp(this.vx, -maxSpeed, maxSpeed);

    // Collide with obstacles
    for(const ob of world.obstacles){
      if(aabb(this, ob)){
        // simple resolve: push out horizontally
        if (this.x < ob.x) this.x = ob.x - this.w/2;
        else this.x = ob.x + ob.w + this.w/2;
        this.vx *= -0.2;
        SFX.hit();
      }
    }
  }
  draw(g){
    // Penguin with vector shapes
    const {x,y} = this.screenPos();
    g.save();
      g.translate(x,y);
      g.scale(this.faceRight ? 1 : -1, 1);
      // body
      roundedRect(g, -24,-20, 48,40, 16, '#0b2036');
      ellipse(g, 0,0, 16,14, '#ffffff');
      // belly shine
      ellipse(g, -4,-2, 6,4, 'rgba(255,255,255,.6)');
      // head
      roundedRect(g, -18,-34, 36,24, 12, '#0b2036');
      ellipse(g, 6,-24, 4,4, '#fff'); // eye
      ellipse(g, 7,-24, 1.8,1.8, '#000');
      // beak
      roundedRect(g, 10,-20, 10,6, 3, '#f59e0b');
      // flippers
      roundedRect(g, -34,-10, 16,8, 4, '#0b2036');
      roundedRect(g, 18,-10, 16,8, 4, '#0b2036');
      // feet
      roundedRect(g, -16,18, 12,6, 3, '#f59e0b');
      roundedRect(g, 4,18, 12,6, 3, '#f59e0b');
      // slide pose tilt
      if(this.slide){ g.rotate(-0.12); }
    g.restore();
  }
  screenPos(){
    return { x: this.x - camera.x, y: this.y - camera.y };
  }
}

class Orca {
  constructor(){ this.x=-9999; this.y=0; this.vx=0; this.active=false; this.w=120; this.h=60; }
  spawnBehind(player, world){
    this.active = true;
    this.x = player.x - 400;
    this.y = world.groundYAt(this.x) - this.h/2 - 10;
    this.vx = 120;
  }
  logic(dt, player, world){
    if(!this.active) return;
    // Move towards player
    const targetY = world.groundYAt(this.x) - this.h/2 - 10;
    this.y = lerp(this.y, targetY, 4*dt);
    const desired = (player.x - 180) - this.x;
    this.vx = clamp(desired*1.2, 80, 360);
    this.x += this.vx * dt;

    // Collision with player
    if(aabb(this, player)){
      player.lives -= 1; SFX.hit();
      this.x -= 160; // knockback orca
      if(player.lives <= 0){
        Game.end();
      }
    }
  }
  draw(g){
    if(!this.active) return;
    const {x,y} = this.screenPos();
    g.save();
      g.translate(x,y);
      // Orca silhouette
      roundedRect(g, -60,-25, 120,50, 25, '#0b1b2b'); // body
      ellipse(g, 30,-10, 16,10, '#ffffff'); // patch
      roundedRect(g, -20,-35, 40,18, 10, '#0b1b2b'); // top
      roundedRect(g, -50,-5, 30,12, 6, '#0b1b2b'); // fin L
      roundedRect(g, 20,-5, 30,12, 6, '#0b1b2b');  // fin R
      roundedRect(g, 50,0, 22,12, 6, '#0b1b2b');   // tail
      ellipse(g, -15,-18, 4,4, '#fff'); // eye
    g.restore();
  }
  screenPos(){ return { x: this.x - camera.x, y: this.y - camera.y }; }
}

class Item {
  constructor(x,y,type='fish'){
    this.x=x; this.y=y; this.type=type;
    this.w=28; this.h=18; this.collected=false;
  }
  draw(g){
    const {x,y} = this.screenPos();
    if(this.type==='fish'){
      drawFish(g, x, y, '#0ea5e9');
    } else {
      drawFish(g, x, y, '#f59e0b'); // golden
    }
  }
  screenPos(){ return { x: this.x - camera.x, y: this.y - camera.y }; }
}

class Obstacle {
  constructor(x,y,w,h){ this.x=x; this.y=y; this.w=w; this.h=h; }
  draw(g){
    const {x,y} = this.screenPos();
    roundedRect(g, x, y, this.w, this.h, 10, '#6ec1ff');
    g.strokeStyle='rgba(255,255,255,.5)'; g.strokeRect(x,y,this.w,this.h);
  }
  screenPos(){ return { x: this.x - camera.x, y: this.y - camera.y }; }
}

// World/Level
const camera = { x:0, y:0 };
const World = {
  gravity: 980, // px/s^2
  groundBase: 420,
  waves: [
    {amp: 16, len: 2800},
    {amp: 10, len: 900},
  ],
  obstacles: [],
  items: [],
  length: 2000, // scroll length per level (will be set)
  groundYAt(x){
    // smooth wave ground
    let y = this.groundBase;
    for(const w of this.waves){
      y += Math.sin((x)/w.len*2*Math.PI) * w.amp;
    }
    return y;
  }
};

// Simple collision AABB
function aabb(a,b){
  const ax = a.x - a.w/2, ay = a.y - a.h/2, aw=a.w, ah=a.h;
  const bx = b.x, by = b.y, bw=b.w, bh=b.h;
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
}

// Drawing helpers
function roundedRect(g, x,y,w,h,r, color){
  g.fillStyle = color; g.beginPath();
  g.moveTo(x+r,y); g.arcTo(x+w,y,x+w,y+h,r); g.arcTo(x+w,y+h,x,y+h,r);
  g.arcTo(x,y+h,x,y,r); g.arcTo(x,y,x+w,y,r); g.closePath(); g.fill();
}
function ellipse(g, x,y, rx,ry, color){ g.fillStyle=color; g.beginPath(); g.ellipse(x,y,rx,ry,0,0,Math.PI*2); g.fill(); }
function drawFish(g, x,y, body='#0ea5e9'){
  g.save(); g.translate(x,y);
  ellipse(g, 0,0, 12,7, body); // body
  roundedRect(g, -16,-6, 10,12, 6, body); // tail
  ellipse(g, 5,-1, 2,2, '#001b2a'); // eye
  g.restore();
}
function drawParallax(g, t){
  const w = canvas.width, h = canvas.height;
  // Sky gradient via CSS; add ground lines
  g.fillStyle='rgba(255,255,255,.5)';
  for(let i=0;i<6;i++){
    const px = -((camera.x*0.2) % (w/2)) + i*(w/2) - (w/2);
    g.fillRect(px, h*0.62, w/2-40, 6);
  }
  // Snow particles
  if(Game.options.particles){
    Snow.draw(g,t);
  }
}

// Snow particles
const Snow = {
  flakes: [],
  init(){
    this.flakes = [];
    const count = Math.min(140, Math.floor(canvas.width*canvas.height/24000));
    for(let i=0;i<count;i++){
      this.flakes.push({x:Math.random()*canvas.width, y:Math.random()*canvas.height, s:rand(1,3), v:rand(20,60)});
    }
  },
  draw(g, dt){
    g.fillStyle='rgba(255,255,255,.75)';
    for(const f of this.flakes){
      f.y += f.v * dt;
      f.x += Math.sin(f.y*0.02) * 0.3;
      if(f.y > canvas.height){ f.y = -4; f.x = Math.random()*canvas.width; }
      g.fillRect(f.x, f.y, f.s, f.s);
    }
  }
};
Snow.init();

// --- Game state machine
const Game = {
  state: 'MENU',
  level: 1,
  xp: 0,
  coins: 0,
  distance: 0,
  targetDistance: 600, // per level
  player: new Penguin(),
  orca: new Orca(),
  options: { particles: Settings.particles, difficulty: Settings.difficulty },
  lastTime: 0,
  startTime: 0,
  pauseTime: 0,
  init(){
    this.bindUI();
    this.showMenu();
    this.loop(0);
  },
  bindUI(){
    btnStart.onclick = ()=> this.start();
    btnSettings.onclick = ()=> { menu.classList.add('hidden'); settings.classList.remove('hidden'); };
    btnHow.onclick = ()=> { menu.classList.add('hidden'); howto.classList.remove('hidden'); };

    btnBackSettings.onclick = ()=> { settings.classList.add('hidden'); menu.classList.remove('hidden'); };
    btnBackHow.onclick = ()=> { howto.classList.add('hidden'); menu.classList.remove('hidden'); };

    btnResume.onclick = ()=> this.resume();
    btnQuit.onclick = ()=> { pause.classList.add('hidden'); this.showMenu(); };

    btnRestart.onclick = ()=> { gameover.classList.add('hidden'); this.start(); };
    btnMenu.onclick = ()=> { gameover.classList.add('hidden'); this.showMenu(); };

    volumeRange.oninput = (e)=>{ Settings.volume = parseFloat(e.target.value); masterGain.gain.value = Settings.volume; Settings.save(); };
    particlesCheck.onchange = (e)=>{ Settings.particles = e.target.checked; this.options.particles = Settings.particles; Snow.init(); Settings.save(); };
    difficultySelect.onchange = (e)=>{ Settings.difficulty = e.target.value; this.options.difficulty = Settings.difficulty; Settings.save(); };

    window.addEventListener('keydown', e => {
      if(this.state==='PLAY' && (e.key==='Escape' || e.key.toLowerCase()==='p')){ this.pause(); }
      if(this.state==='MENU' && e.key==='Enter'){ this.start(); }
    });
  },
  setupLevel(n){
    this.level = n;
    levelLabel.textContent = n;
    // Difficulty scaling
    const diffMul = this.options.difficulty==='easy'?0.9: this.options.difficulty==='hard'?1.25:1.0;
    this.targetDistance = Math.floor(600 * (1 + (n-1)*0.3) * diffMul);
    World.length = this.targetDistance + 400;
    World.obstacles = [];
    World.items = [];

    // Place obstacles + items procedurally
    let x = 240;
    while(x < World.length){
      // obstacle?
      if(Math.random() < Math.min(0.15 + (n-1)*0.04, 0.4)){
        const w = randi(60, 120);
        const h = randi(20, 40);
        const y = World.groundYAt(x) - h;
        World.obstacles.push(new Obstacle(x, y, w, h));
        x += w + randi(80, 180);
      } else {
        x += randi(80, 160);
      }
      // items near
      for(let i=0;i<randi(2,4);i++){
        const iy = World.groundYAt(x + i*24) - randi(60, 140);
        World.items.push(new Item(x + i*26, iy, Math.random()<0.18?'coin':'fish'));
      }
    }

    // Player position
    const startY = World.groundYAt(100) - 60;
    this.player.reset(100, startY);

    // Orca off
    this.orca = new Orca();
    this.orca.active = false;

    // Stats
    this.distance = 0;

    // UI
    xpLabel.textContent = this.xp;
    coinLabel.textContent = this.coins;
    livesLabel.textContent = this.player.lives;
    distanceLabel.textContent = '0 m';
    progressBar.style.width = '0%';
  },
  start(){
    this.xp = 0; this.coins = 0;
    this.player.lives = 3;
    this.options.particles = Settings.particles;
    this.options.difficulty = Settings.difficulty;
    this.setupLevel(1);
    menu.classList.add('hidden');
    settings.classList.add('hidden');
    howto.classList.add('hidden');
    pause.classList.add('hidden');
    gameover.classList.add('hidden');
    hud.classList.remove('hidden');
    this.state='PLAY';
    this.startTime = performance.now();
  },
  pause(){
    if(this.state!=='PLAY') return;
    this.state='PAUSE';
    pause.classList.remove('hidden');
    this.pauseTime = performance.now();
  },
  resume(){
    if(this.state!=='PAUSE') return;
    pause.classList.add('hidden');
    this.state='PLAY';
    const paused = performance.now() - this.pauseTime;
    this.startTime += paused; // keep timers consistent
  },
  nextLevel(){
    SFX.level();
    this.setupLevel(this.level+1);
  },
  end(){
    this.state='GAMEOVER';
    hud.classList.add('hidden');
    finalXp.textContent = this.xp;
    finalCoins.textContent = this.coins;
    finalLevel.textContent = this.level;
    gameover.classList.remove('hidden');
    const best = Math.max(parseInt(localStorage.getItem(bestKey) || '0',10), this.xp);
    localStorage.setItem(bestKey, best.toString());
    bestScoreLabel.textContent = best + " XP";
  },
  showMenu(){
    this.state='MENU';
    hud.classList.add('hidden');
    settings.classList.add('hidden');
    howto.classList.add('hidden');
    pause.classList.add('hidden');
    gameover.classList.add('hidden');
    menu.classList.remove('hidden');
  },
  update(dt){
    if(this.state!=='PLAY') return;
    this.player.logic(dt, World);

    // Camera follow
    camera.x = lerp(camera.x, this.player.x - canvas.width*0.35, 6*dt);
    camera.y = lerp(camera.y, this.player.y - canvas.height*0.62, 6*dt);

    // Collect items
    for(const it of World.items){
      if(!it.collected){
        if(aabb(this.player, {x:it.x, y:it.y, w:it.w, h:it.h})){
          it.collected = true;
          if(it.type==='fish'){ this.xp += 10; SFX.collect(); }
          else { this.coins += 1; SFX.coin(); }
          xpLabel.textContent = this.xp;
          coinLabel.textContent = this.coins;
        }
      }
    }

    // Distance/progress
    this.distance = Math.max(this.distance, Math.floor(this.player.x - 100));
    const d = clamp(this.distance / this.targetDistance, 0, 1);
    progressBar.style.width = (d*100).toFixed(0) + '%';
    distanceLabel.textContent = Math.max(0, Math.floor(this.player.x/4)) + " m";

    // Spawn orca if player atrasado
    const elapsed = (performance.now() - this.startTime)/1000;
    const trigger = this.options.difficulty==='easy' ? 22 : this.options.difficulty==='hard' ? 12 : 16;
    if(!this.orca.active && elapsed > trigger){
      this.orca.spawnBehind(this.player, World);
    }
    this.orca.logic(dt, this.player, World);

    // Level complete
    if(this.player.x >= this.targetDistance+80){
      this.nextLevel();
    }

    // Keep player above bottom
    if(this.player.y > canvas.height + 200){
      this.player.lives -= 1;
      livesLabel.textContent = this.player.lives;
      SFX.hit();
      this.player.reset(this.player.x - 80, World.groundYAt(this.player.x)-60);
      if(this.player.lives <= 0) this.end();
    }
    livesLabel.textContent = this.player.lives;
  },
  draw(dt){
    // background sky is via CSS; draw parallax snow/ice
    drawParallax(ctx, dt);

    // Ground strip
    const y0 = World.groundYAt(camera.x);
    const w = canvas.width, h = canvas.height;
    ctx.fillStyle = '#dff4ff';
    ctx.fillRect(0, y0 - camera.y + 38, w, h);

    // Obstacles
    for(const ob of World.obstacles){ ob.draw(ctx); }
    // Items
    for(const it of World.items){ if(!it.collected) it.draw(ctx); }
    // Orca
    this.orca.draw(ctx);
    // Player
    this.player.draw(ctx);

    // Ice sheen
    const grad = ctx.createLinearGradient(0, y0 - camera.y + 18, 0, h);
    grad.addColorStop(0, 'rgba(255,255,255,.6)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, y0 - camera.y + 18, w, h - (y0 - camera.y));
  },
  loop(ts){
    const dt = Math.min(0.033, (ts - this.lastTime)/1000 || 0);
    this.lastTime = ts;
    // clear
    ctx.clearRect(0,0,canvas.width,canvas.height);
    this.update(dt);
    this.draw(dt);
    requestAnimationFrame(this.loop.bind(this));
  }
};

// Start
Game.init();

// --- Ensure audio starts on first input (mobile policies)
['click','keydown','touchstart'].forEach(ev => {
  window.addEventListener(ev, async () => {
    if(audioCtx.state==='suspended'){ await audioCtx.resume(); }
  }, { once: true });
});
