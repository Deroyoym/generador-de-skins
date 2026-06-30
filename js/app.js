"use strict";
/* ============================================================
   FORJA DE SKINS v2 — editor 2D + previsualización 3D animada
   Atlas 64×64 (modelo moderno de Minecraft)
   ============================================================ */
const T = 64;
const atlas = document.createElement("canvas");
atlas.width = atlas.height = T;
const actx = atlas.getContext("2d",{willReadFrequently:true});
actx.imageSmoothingEnabled = false;

const editor = document.getElementById("editor");
const ectx = editor.getContext("2d");
ectx.imageSmoothingEnabled = false;
const hud = document.getElementById("hud");
const zoomhud = document.getElementById("zoomhud");

/* ---------- estado ---------- */
let tool="pencil", color="#5fbf57", showGrid=true, symmetry=false;
let spaceDown=false, hoverPx=null;
const view={scale:1, ox:0, oy:0};               // zoom/desplazamiento del lienzo

/* ---------- historial ----------
   Cada entrada guarda el atlas + el flag slim del modelo, así deshacer/rehacer
   restaura también la silueta 3D (clásico vs. slim), no solo la textura. */
let currentSlim=false;                            // lo setea buildModel()
const undoStack=[], redoStack=[];
function snapshot(){ undoStack.push([actx.getImageData(0,0,T,T),currentSlim]); if(undoStack.length>80)undoStack.shift(); redoStack.length=0; }
function restore(from,to){
  if(!from.length)return;
  to.push([actx.getImageData(0,0,T,T),currentSlim]);
  const[img,slim]=from.pop();
  actx.putImageData(img,0,0);
  if(slim!==currentSlim) buildModel(slim);        // reconstruye el modelo si cambió la silueta
  refresh();
}
function undo(){ restore(undoStack,redoStack); }
function redo(){ restore(redoStack,undoStack); }

/* ============================================================
   Regiones del atlas
   ============================================================ */
const NET_BLOCKS=[
  {x:0,y:0,w:32,h:16,label:"CABEZA"},   {x:32,y:0,w:32,h:16,label:"sombrero"},
  {x:0,y:16,w:16,h:16,label:"P.DER"},   {x:16,y:16,w:24,h:16,label:"CUERPO"},
  {x:40,y:16,w:16,h:16,label:"B.DER"},  {x:16,y:48,w:16,h:16,label:"P.IZQ"},
  {x:32,y:48,w:16,h:16,label:"B.IZQ"},  {x:0,y:48,w:16,h:16,label:"capa"},
  {x:48,y:48,w:16,h:16,label:"capa"},
];
function partAt(x,y){ for(const b of NET_BLOCKS){ if(x>=b.x&&x<b.x+b.w&&y>=b.y&&y<b.y+b.h) return b.label; } return "—"; }

// caras "frente" donde el espejo dentro de la cara tiene sentido
const SYM_REGIONS=[
  [8,8,8,8],[40,8,8,8],        // cara + sombrero
  [20,20,8,12],[20,36,8,12],   // cuerpo + chaqueta
  [44,20,4,12],[44,36,4,12],   // brazo der + manga
  [4,20,4,12],[4,36,4,12],     // pierna der + capa
  [36,52,4,12],[52,52,4,12],   // brazo izq + manga
  [20,52,4,12],[4,52,4,12],    // pierna izq + capa
];

/* ============================================================
   Dibujo del editor (con zoom/desplazamiento)
   ============================================================ */
function cellPix(){ return (editor.width/T)*view.scale; }
function clampView(){
  const span=64*cellPix();
  if(span<=editor.width){ view.ox=(editor.width-span)/2; view.oy=(editor.height-span)/2; }
  else{
    view.ox=Math.min(0,Math.max(editor.width-span,view.ox));
    view.oy=Math.min(0,Math.max(editor.height-span,view.oy));
  }
}
// ajedrez de transparencia pre-renderizado a resolución de atlas (64×64);
// se escala con drawImage en vez de pintar 4096 rects en cada frame
const checker=document.createElement("canvas");
checker.width=checker.height=T;
(function(){ const c=checker.getContext("2d");
  for(let y=0;y<T;y++)for(let x=0;x<T;x++){ c.fillStyle=((x+y)&1)?"#20262f":"#171c24"; c.fillRect(x,y,1,1); }
})();
function refresh(){ drawEditor(); tex.needsUpdate=true; }
function drawEditor(){
  const cp=cellPix();
  ectx.clearRect(0,0,editor.width,editor.height);
  ectx.imageSmoothingEnabled=false;
  ectx.drawImage(checker,0,0,T,T,view.ox,view.oy,64*cp,64*cp);
  ectx.drawImage(atlas,0,0,T,T,view.ox,view.oy,64*cp,64*cp);

  // bloques guía
  ectx.strokeStyle="rgba(95,191,87,.55)";ectx.lineWidth=1.5;
  NET_BLOCKS.forEach(b=>ectx.strokeRect(view.ox+b.x*cp+.75,view.oy+b.y*cp+.75,b.w*cp-1.5,b.h*cp-1.5));

  if(showGrid && cp>=5){
    ectx.strokeStyle="rgba(255,255,255,.06)";ectx.lineWidth=1;ectx.beginPath();
    for(let i=1;i<T;i++){
      ectx.moveTo(view.ox+i*cp+.5,view.oy); ectx.lineTo(view.ox+i*cp+.5,view.oy+64*cp);
      ectx.moveTo(view.ox,view.oy+i*cp+.5); ectx.lineTo(view.ox+64*cp,view.oy+i*cp+.5);
    }
    ectx.stroke();
  }
  // etiquetas
  ectx.fillStyle="rgba(233,237,242,.45)";ectx.font="700 9px ui-monospace,monospace";ectx.textBaseline="top";
  NET_BLOCKS.forEach(b=>{ if(b.label) ectx.fillText(b.label,view.ox+b.x*cp+3,view.oy+b.y*cp+3); });

  // cursor de hover
  if(hoverPx && !spaceDown){
    const[x,y]=hoverPx;
    ectx.strokeStyle="#fff";ectx.lineWidth=2;
    ectx.strokeRect(view.ox+x*cp+1,view.oy+y*cp+1,cp-2,cp-2);
    ectx.strokeStyle="rgba(0,0,0,.6)";ectx.lineWidth=1;
    ectx.strokeRect(view.ox+x*cp+.5,view.oy+y*cp+.5,cp-1,cp-1);
  }
}

/* ============================================================
   Pintura
   ============================================================ */
function setPx(x,y,col){ if(x<0||y<0||x>=T||y>=T)return; if(col===null)actx.clearRect(x,y,1,1); else{actx.fillStyle=col;actx.fillRect(x,y,1,1);} }
function shadePx(x,y,lighten){
  if(x<0||y<0||x>=T||y>=T)return;
  const d=actx.getImageData(x,y,1,1).data; if(d[3]===0)return;
  const f=lighten?1.18:0.84;
  actx.fillStyle=`rgba(${clamp(d[0]*f)},${clamp(d[1]*f)},${clamp(d[2]*f)},${(d[3]/255).toFixed(3)})`;
  actx.clearRect(x,y,1,1); actx.fillRect(x,y,1,1);
}
const clamp=v=>Math.max(0,Math.min(255,v|0));
function symPartner(x,y){
  for(const[rx,ry,rw,rh] of SYM_REGIONS){
    if(x>=rx&&x<rx+rw&&y>=ry&&y<ry+rh) return [rx+(rw-1)-(x-rx),y];
  }
  return null;
}
function applyTool(x,y,alt,defer){
  if(tool==="shade"){ shadePx(x,y,alt); if(symmetry){const p=symPartner(x,y);if(p)shadePx(p[0],p[1],alt);} }
  else{
    const col=(tool==="eraser")?null:color;
    setPx(x,y,col);
    if(symmetry){const p=symPartner(x,y);if(p)setPx(p[0],p[1],col);}
  }
  tex.needsUpdate=true;
  if(!defer) drawEditor();   // en trazos se difiere y se redibuja una sola vez al final
}
function bucketFill(x,y){
  const img=actx.getImageData(0,0,T,T),d=img.data,idx=(px,py)=>(py*T+px)*4,t=idx(x,y);
  const tr=d[t],tg=d[t+1],tb=d[t+2],ta=d[t+3];
  const tmp=document.createElement("canvas");tmp.width=tmp.height=1;
  const tc=tmp.getContext("2d");tc.fillStyle=color;tc.fillRect(0,0,1,1);const fc=tc.getImageData(0,0,1,1).data;
  if(tr===fc[0]&&tg===fc[1]&&tb===fc[2]&&ta===fc[3])return;
  const same=i=>d[i]===tr&&d[i+1]===tg&&d[i+2]===tb&&d[i+3]===ta;
  const st=[[x,y]];
  while(st.length){const[cx,cy]=st.pop();if(cx<0||cy<0||cx>=T||cy>=T)continue;const i=idx(cx,cy);if(!same(i))continue;
    d[i]=fc[0];d[i+1]=fc[1];d[i+2]=fc[2];d[i+3]=fc[3];st.push([cx+1,cy],[cx-1,cy],[cx,cy+1],[cx,cy-1]);}
  actx.putImageData(img,0,0);refresh();
}
function pickColor(x,y){const d=actx.getImageData(x,y,1,1).data;if(d[3]===0)return;
  setColor("#"+[d[0],d[1],d[2]].map(v=>v.toString(16).padStart(2,"0")).join(""));}

/* ---------- reflejar lado derecho -> izquierdo ---------- */
function copyFace(sx,sy,dx,dy,w,h,flip){
  const src=actx.getImageData(sx,sy,w,h),out=actx.createImageData(w,h);
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){
    const sX=flip?(w-1-x):x;const si=(y*w+sX)*4,di=(y*w+x)*4;
    out.data[di]=src.data[si];out.data[di+1]=src.data[si+1];out.data[di+2]=src.data[si+2];out.data[di+3]=src.data[si+3];
  }
  actx.putImageData(out,dx,dy);
}
// pares [sx,sy,dx,dy,w,h,flip] — copia lado derecho -> izquierdo (brazo, pierna, capa base y exterior)
const LIMB_MIRROR=[
  // BRAZO  der(40,16)->izq(32,48)
  [44,16,36,48,4,4,true],[48,16,40,48,4,4,true],     // top, bottom
  [44,20,36,52,4,12,true],[52,20,44,52,4,12,true],   // front, back
  [40,20,40,52,4,12,false],[48,20,32,52,4,12,false], // +x<->-x (lados cruzados)
  // MANGA der(40,32)->izq(48,48)
  [44,32,52,48,4,4,true],[48,32,56,48,4,4,true],
  [44,36,52,52,4,12,true],[52,36,60,52,4,12,true],
  [40,36,56,52,4,12,false],[48,36,48,52,4,12,false],
  // PIERNA der(0,16)->izq(16,48)
  [4,16,20,48,4,4,true],[8,16,24,48,4,4,true],
  [4,20,20,52,4,12,true],[12,20,28,52,4,12,true],
  [0,20,24,52,4,12,false],[8,20,16,52,4,12,false],
  // CAPA pierna der(0,32)->izq(0,48)  [dest = bloque capa (0,48), no la base (16,48)]
  [4,32,4,48,4,4,true],[8,32,8,48,4,4,true],
  [4,36,4,52,4,12,true],[12,36,12,52,4,12,true],
  [0,36,8,52,4,12,false],[8,36,0,52,4,12,false],
];
function copyLimbs(){ LIMB_MIRROR.forEach(p=>copyFace(p[0],p[1],p[2],p[3],p[4],p[5],p[6])); }
function mirrorSides(){ snapshot(); copyLimbs(); refresh(); }

/* ============================================================
   Interacción con el lienzo (mouse + touch + zoom + pan)
   ============================================================ */
let painting=false,lastPx=null,panning=false,panStart=null;
function evCanvas(e){
  const r=editor.getBoundingClientRect();
  const cx=(e.touches?e.touches[0].clientX:e.clientX)-r.left;
  const cy=(e.touches?e.touches[0].clientY:e.clientY)-r.top;
  return [cx/r.width*editor.width, cy/r.height*editor.height];
}
function evPx(e){ const[cx,cy]=evCanvas(e);const cp=cellPix();return [Math.floor((cx-view.ox)/cp),Math.floor((cy-view.oy)/cp)]; }

function editorDown(e){
  if(e.button===2){ const[x,y]=evPx(e);pickColor(x,y);e.preventDefault();return; } // clic derecho = gotero
  if(spaceDown||e.button===1){ panning=true;panStart=evCanvas(e);e.preventDefault();return; }
  e.preventDefault();
  const[x,y]=evPx(e);
  if(tool==="bucket"){snapshot();bucketFill(x,y);return;}
  if(tool==="picker"){pickColor(x,y);return;}
  snapshot();painting=true;lastPx=[x,y];applyTool(x,y,e.shiftKey);
}
function editorMove(e){
  const[x,y]=evPx(e);
  hoverPx=(x>=0&&y>=0&&x<T&&y<T)?[x,y]:null;
  hud.innerHTML = hoverPx?`<b>${x},${y}</b> · ${partAt(x,y)}`:"—";
  if(panning){ const[cx,cy]=evCanvas(e);view.ox+=cx-panStart[0];view.oy+=cy-panStart[1];panStart=[cx,cy];clampView();drawEditor();return; }
  if(painting){
    e.preventDefault();
    if(lastPx&&(lastPx[0]!==x||lastPx[1]!==y)){
      let[x0,y0]=lastPx,dx=Math.abs(x-x0),dy=Math.abs(y-y0),sx=x0<x?1:-1,sy=y0<y?1:-1,err=dx-dy;
      while(true){applyTool(x0,y0,e.shiftKey,true);if(x0===x&&y0===y)break;const e2=2*err;if(e2>-dy){err-=dy;x0+=sx;}if(e2<dx){err+=dx;y0+=sy;}}
      drawEditor();
    } else applyTool(x,y,e.shiftKey);
    lastPx=[x,y];
  } else drawEditor();
}
function editorUp(){painting=false;panning=false;lastPx=null;}
function editorLeave(){hoverPx=null;hud.innerHTML="—";drawEditor();}
editor.addEventListener("mousedown",editorDown);
window.addEventListener("mousemove",editorMove);
window.addEventListener("mouseup",editorUp);
editor.addEventListener("mouseleave",editorLeave);
editor.addEventListener("contextmenu",e=>e.preventDefault());
/* ---------- zoom centralizado (rueda, pellizco y botones) ---------- */
function zoomAt(mul,cx,cy){
  const cp=cellPix();
  const wx=(cx-view.ox)/cp, wy=(cy-view.oy)/cp;       // punto del lienzo bajo el cursor/dedos
  view.scale=Math.max(1,Math.min(8, view.scale*mul));
  const ncp=cellPix();
  view.ox=cx-wx*ncp; view.oy=cy-wy*ncp; clampView();  // mantiene ese punto fijo
  zoomhud.textContent=Math.round(view.scale*100)+"%";
  drawEditor();
}
function resetZoom(){ view.scale=1; clampView(); zoomhud.textContent="100%"; drawEditor(); }
editor.addEventListener("wheel",e=>{ e.preventDefault(); const[cx,cy]=evCanvas(e); zoomAt(e.deltaY<0?1.2:1/1.2,cx,cy); },{passive:false});
document.getElementById("zoomInBtn").addEventListener("click",()=>zoomAt(1.25,editor.width/2,editor.height/2));
document.getElementById("zoomOutBtn").addEventListener("click",()=>zoomAt(1/1.25,editor.width/2,editor.height/2));
document.getElementById("zoomResetBtn").addEventListener("click",resetZoom);

/* ---------- táctil: 1 dedo pinta · 2 dedos mueven y hacen zoom (pellizco) ---------- */
let pinch=null;
function touchPt(t){ const r=editor.getBoundingClientRect();
  return [(t.clientX-r.left)/r.width*editor.width,(t.clientY-r.top)/r.height*editor.height]; }
function abortStroke(){ if(!painting)return; painting=false; lastPx=null;
  const s=undoStack.pop(); if(s)actx.putImageData(s[0],0,0); refresh(); }
editor.addEventListener("touchstart",e=>{
  if(e.touches.length>=2){                              // dos dedos = navegar
    abortStroke();                                      // descarta el puntito accidental del 1er dedo
    const [ax,ay]=touchPt(e.touches[0]), [bx,by]=touchPt(e.touches[1]);
    pinch={dist:Math.hypot(ax-bx,ay-by), mx:(ax+bx)/2, my:(ay+by)/2};
    e.preventDefault(); return;
  }
  pinch=null; e.preventDefault();
  const[x,y]=evPx(e);
  if(tool==="bucket"){snapshot();bucketFill(x,y);return;}
  if(tool==="picker"){pickColor(x,y);return;}
  snapshot();painting=true;lastPx=[x,y];
  hoverPx=(x>=0&&y>=0&&x<T&&y<T)?[x,y]:null;
  applyTool(x,y,false);
},{passive:false});
editor.addEventListener("touchmove",e=>{
  if(pinch && e.touches.length>=2){
    e.preventDefault();
    const [ax,ay]=touchPt(e.touches[0]), [bx,by]=touchPt(e.touches[1]);
    const dist=Math.hypot(ax-bx,ay-by), mx=(ax+bx)/2, my=(ay+by)/2;
    view.ox+=mx-pinch.mx; view.oy+=my-pinch.my;         // paneo según el punto medio
    if(pinch.dist>0) zoomAt(dist/pinch.dist,mx,my);      // zoom por pellizco (anclado al medio)
    else { clampView(); drawEditor(); }
    pinch={dist,mx,my};
    return;
  }
  if(painting && e.touches.length===1){
    e.preventDefault();
    const[x,y]=evPx(e);
    hoverPx=(x>=0&&y>=0&&x<T&&y<T)?[x,y]:null;
    if(lastPx&&(lastPx[0]!==x||lastPx[1]!==y)){
      let[x0,y0]=lastPx,dx=Math.abs(x-x0),dy=Math.abs(y-y0),sx=x0<x?1:-1,sy=y0<y?1:-1,err=dx-dy;
      while(true){applyTool(x0,y0,false,true);if(x0===x&&y0===y)break;const e2=2*err;if(e2>-dy){err-=dy;x0+=sx;}if(e2<dx){err+=dx;y0+=sy;}}
      drawEditor();
    } else applyTool(x,y,false);
    lastPx=[x,y];
  }
},{passive:false});
function endTouch(e){ if(!e.touches||e.touches.length<2)pinch=null;
  if(!e.touches||e.touches.length===0){painting=false;lastPx=null;} }
editor.addEventListener("touchend",endTouch);
editor.addEventListener("touchcancel",endTouch);

/* ============================================================
   Color
   ============================================================ */
const picker=document.getElementById("picker"),hexInput=document.getElementById("hex");
function setColor(hex){color=hex.toLowerCase();picker.value=color;hexInput.value=hex.toUpperCase();}
picker.addEventListener("input",e=>setColor(e.target.value));
hexInput.addEventListener("change",e=>{let v=e.target.value.trim();
  if(/^#?[0-9a-fA-F]{6}$/.test(v)){if(v[0]!=="#")v="#"+v;setColor(v);}else hexInput.value=color.toUpperCase();});
const PALETTE=["#000000","#3b3b3b","#7d7d7d","#c6c6c6","#ffffff","#5fbf57","#3f8f3a","#2a6f8f","#3a5fc0","#7a3fc0","#c0418f",
  "#e1574c","#f4773c","#f4c542","#f7e7a0","#ffe0bd","#f1c27d","#c68642","#8d5524","#6b4423","#3d2b1f","#1a1a2e"];
const swWrap=document.getElementById("swatches");
PALETTE.forEach(c=>{const d=document.createElement("div");d.className="sw";d.style.background=c;d.title=c.toUpperCase();
  d.addEventListener("click",()=>setColor(c));swWrap.appendChild(d);});

/* ============================================================
   Herramientas / toggles
   ============================================================ */
function selectTool(t){tool=t;document.querySelectorAll("[data-tool]").forEach(b=>b.classList.toggle("on",b.dataset.tool===t));}
document.querySelectorAll("[data-tool]").forEach(b=>b.addEventListener("click",()=>selectTool(b.dataset.tool)));
const symBtn=document.getElementById("symBtn"),gridBtn=document.getElementById("gridBtn");
symBtn.addEventListener("click",()=>{symmetry=!symmetry;symBtn.classList.toggle("on",symmetry);});
gridBtn.addEventListener("click",()=>{showGrid=!showGrid;gridBtn.classList.toggle("on",showGrid);drawEditor();});
document.getElementById("mirrorBtn").addEventListener("click",mirrorSides);
document.getElementById("undoBtn").addEventListener("click",undo);
document.getElementById("redoBtn").addEventListener("click",redo);

window.addEventListener("keydown",e=>{
  const tag=e.target.tagName;
  if(tag==="INPUT"||tag==="TEXTAREA")return;   // no robar teclas mientras se escribe (hex, etc.)
  if(e.code==="Space"){spaceDown=true;}
  if(e.ctrlKey||e.metaKey){if(e.key==="z"){e.preventDefault();undo();return;}if(e.key==="y"){e.preventDefault();redo();return;}}
  const map={b:"pencil",g:"bucket",s:"shade",i:"picker",e:"eraser"};
  if(map[e.key]&&!e.ctrlKey&&!e.metaKey)selectTool(map[e.key]);
});
window.addEventListener("keyup",e=>{if(e.code==="Space")spaceDown=false;});

/* ============================================================
   Plantillas
   ============================================================ */
function clearAtlas(){actx.clearRect(0,0,T,T);}
function fillR(x,y,w,h,c){actx.fillStyle=c;actx.fillRect(x,y,w,h);}
function noise(x,y,w,h,amt){const img=actx.getImageData(x,y,w,h),d=img.data;
  for(let i=0;i<d.length;i+=4){if(d[i+3]===0)continue;const n=(Math.random()*2-1)*amt;d[i]=clamp(d[i]+n);d[i+1]=clamp(d[i+1]+n);d[i+2]=clamp(d[i+2]+n);}
  actx.putImageData(img,x,y);}
const SKIN_ASSETS={steve:"skins/steve.png",alex:"skins/alex.png"};
function loadSkinAsset(url){
  const img=new Image();
  img.onload=()=>{clearAtlas();actx.imageSmoothingEnabled=false;actx.drawImage(img,0,0,T,T);buildModel(false);refresh();};
  img.onerror=()=>{clearAtlas();buildModel(false);refresh();console.warn("No se pudo cargar el skin:",url);};
  img.src=url;
}

/* ----- generador aleatorio por capas (cuerpo + peinado + cara + atuendo) -----
   Cada capa es independiente y se elige al azar de su propia lista, así las
   combinaciones crecen multiplicativamente en vez de necesitar un template
   "completo" por cada apariencia posible. Todas pintan directo sobre las
   regiones del UV map de 64×64 (mismas que usa el editor y el modelo 3D). */
const r=a=>a[Math.floor(Math.random()*a.length)];
const SKIN_TONES=["#ffe0bd","#f1c27d","#e0ac69","#c68642","#8d5524","#5a3a26"];
const HAIR_COLORS=["#1a1a1a","#3a2a16","#6b4423","#c8722e","#d8c84a","#9a3a3a","#5f4fbf"];
const CLOTH_COLORS=["#5fbf57","#e1574c","#3a5fc0","#f4c542","#c0418f","#2a8f8f","#7a3fc0","#3b3b3b"];
const SHOE_COLORS=["#3b3b3b","#1a1a1a","#5a3b27","#ffffff"];
const EYE_COLORS=["#3a2a6b","#3a6b3a","#6b3a3a","#222","#2a4a8a","#6b4a2a"];
const MOUTH_COLORS=["#8a5a3a","#6b3a2a","#a85a4a","#5a3a2a"];

function headBase(x,y,w,h,c){fillR(x,y,w,h,c);}        // capa base de la cabeza (0,0)-(32,16)
function headOver(x,y,w,h,c){fillR(32+x,y,w,h,c);}     // capa "sombrero" (32,0)-(64,16), mismo recorte +32px

const HAIRSTYLES=[
  {name:"corto",  draw(p){ headBase(8,0,8,8,p.hair); headBase(0,8,32,2,p.hair); }},
  {name:"rapado", draw(p){ headBase(8,0,8,8,p.hair); }},
  {name:"calvo",  draw(p){ /* sin pelo: queda la piel */ }},
  {name:"largo",  draw(p){ headBase(8,0,8,8,p.hair); headBase(0,8,32,3,p.hair);
                            headOver(8,0,8,2,p.hair); headOver(0,8,32,5,p.hair); }},
  {name:"gorra",  draw(p){ headBase(8,0,8,8,p.cap); headBase(0,8,32,2,p.cap);
                            headOver(8,0,8,1,p.cap); headOver(0,7,32,2,p.cap); }},
];

const FACES=[
  {name:"normal",       draw(p){ fillR(9,12,1,1,"#fff"); fillR(10,12,1,1,p.eye); fillR(13,12,1,1,"#fff"); fillR(14,12,1,1,p.eye);
                                  fillR(11,14,3,1,p.mouth); }},
  {name:"grandes",      draw(p){ fillR(8,11,2,2,"#fff"); fillR(9,12,1,1,p.eye); fillR(14,11,2,2,"#fff"); fillR(14,12,1,1,p.eye);
                                  fillR(10,14,4,2,p.mouth); }},
  {name:"sonriente",    draw(p){ fillR(9,12,1,1,"#fff"); fillR(10,12,1,1,p.eye); fillR(13,12,1,1,"#fff"); fillR(14,12,1,1,p.eye);
                                  fillR(11,14,3,1,p.mouth); fillR(10,15,5,1,p.mouth); }},
  {name:"sorprendido",  draw(p){ fillR(9,11,2,2,"#1a1a1a"); fillR(13,11,2,2,"#1a1a1a"); fillR(11,14,2,2,p.mouth); }},
  {name:"entrecerrado", draw(p){ fillR(9,12,2,1,p.eye); fillR(13,12,2,1,p.eye); fillR(11,14,3,1,p.mouth); }},
];

const OUTFITS=[
  {name:"remera",    draw(p){
    fillR(16,16,24,16,p.shirt); fillR(0,16,16,16,p.pants); fillR(16,48,16,16,p.pants);
    fillR(40,16,16,5,p.shirt); fillR(32,48,16,5,p.shirt); // manga corta
  }},
  {name:"musculosa", draw(p){
    fillR(16,16,24,16,p.shirt); fillR(16,16,24,3,p.skin); // hombros descubiertos
    fillR(0,16,16,16,p.pants); fillR(16,48,16,16,p.pants);
  }},
  {name:"campera",   draw(p){
    fillR(16,16,24,16,p.shirt);
    fillR(16,32,24,16,p.accent);                          // capa exterior del torso
    fillR(40,32,16,16,p.accent); fillR(48,48,16,16,p.accent); // mangas largas (capa)
    fillR(0,16,16,16,p.pants); fillR(16,48,16,16,p.pants);
  }},
  {name:"rayas",     draw(p){
    fillR(16,16,24,16,p.shirt);
    for(let y=20;y<32;y+=4) fillR(16,y,24,2,p.accent);    // banda que envuelve todo el torso
    fillR(40,16,16,5,p.shirt); fillR(32,48,16,5,p.shirt);
    fillR(0,16,16,16,p.pants); fillR(16,48,16,16,p.pants);
  }},
  {name:"overol",    draw(p){
    fillR(16,16,24,16,p.shirt);
    fillR(20,20,8,12,p.pants);                            // babero al frente del torso
    fillR(0,16,16,16,p.pants); fillR(16,48,16,16,p.pants);
  }},
  {name:"chaleco",   draw(p){
    fillR(16,16,24,16,p.shirt);
    fillR(16,32,24,16,p.accent);                          // chaleco como capa exterior
    fillR(23,20,2,12,p.shirt);                            // abierto al frente: se ve la remera
    fillR(0,16,16,16,p.pants); fillR(16,48,16,16,p.pants);
  }},
  {name:"capucha",   draw(p){
    fillR(16,16,24,16,p.shirt);
    fillR(16,32,24,16,p.accent);                          // buzo/campera con capucha
    fillR(40,32,16,16,p.accent); fillR(48,48,16,16,p.accent); // mangas largas (capa)
    headOver(8,0,8,3,p.accent); headOver(0,8,32,1,p.accent);  // capucha asomando atrás de la cabeza
    fillR(0,16,16,16,p.pants); fillR(16,48,16,16,p.pants);
  }},
  {name:"deportivo", draw(p){
    fillR(16,16,24,16,p.shirt);
    fillR(40,16,16,5,p.shirt); fillR(32,48,16,5,p.shirt); // manga corta
    fillR(0,16,16,16,p.pants); fillR(16,48,16,16,p.pants);
    fillR(4,20,2,12,p.accent); fillR(20,52,2,12,p.accent); // franja lateral en el pantalón
  }},
  {name:"traje",     draw(p){
    fillR(16,16,24,16,p.accent);                          // saco oscuro
    fillR(22,20,4,2,p.shirt);                             // corbata/moño al cuello
    fillR(40,16,16,5,p.accent); fillR(32,48,16,5,p.accent);
    fillR(0,16,16,16,p.accent); fillR(16,48,16,16,p.accent); // pantalón a juego
  }},
];

function randomTemplate(){
  let shirt=r(CLOTH_COLORS), accent=r(CLOTH_COLORS);
  while(accent===shirt) accent=r(CLOTH_COLORS);
  return{
    skin:r(SKIN_TONES), hair:r(HAIR_COLORS), cap:r(CLOTH_COLORS),
    shirt, accent, pants:r(CLOTH_COLORS), shoe:r(SHOE_COLORS),
    eye:r(EYE_COLORS), mouth:r(MOUTH_COLORS),
    slim:Math.random()<.5,
    hairstyle:r(HAIRSTYLES), face:r(FACES), outfit:r(OUTFITS),
    tex:true,
  };
}
function buildRandomHumanoid(p){
  clearAtlas();
  fillR(0,0,32,16,p.skin); fillR(16,16,24,16,p.skin); fillR(40,16,16,16,p.skin);
  fillR(0,16,16,16,p.skin); fillR(32,48,16,16,p.skin); fillR(16,48,16,16,p.skin);
  p.hairstyle.draw(p);
  p.outfit.draw(p);
  fillR(0,28,16,4,p.shoe); fillR(16,60,16,4,p.shoe);
  p.face.draw(p); // último: ojos/boca siempre por encima del pelo y la ropa
  if(p.tex){
    noise(16,16,24,16,14); noise(0,16,16,16,12); noise(16,48,16,16,12);
    noise(16,32,24,16,14); noise(40,32,16,16,12); noise(48,48,16,16,12);
  }
  buildModel(p.slim);
  refresh();
}

document.querySelectorAll("[data-tmpl]").forEach(t=>t.addEventListener("click",()=>{
  snapshot();const k=t.dataset.tmpl;
  if(k==="blank"){clearAtlas();buildModel(false);refresh();}
  else if(k==="random")buildRandomHumanoid(randomTemplate());
  else loadSkinAsset(SKIN_ASSETS[k]);
}));

/* ============================================================
   Importar / exportar
   ============================================================ */
const fileInput=document.getElementById("fileInput");
document.getElementById("importBtn").addEventListener("click",()=>fileInput.click());
fileInput.addEventListener("change",e=>{const f=e.target.files[0];if(!f)return;const img=new Image();
  const url=URL.createObjectURL(f);
  img.onload=()=>{
    snapshot();clearAtlas();actx.imageSmoothingEnabled=false;
    if(img.width===64&&img.height===32){            // skin legacy: mitad superior + espejar miembros
      actx.drawImage(img,0,0);
      copyLimbs();
    } else if(img.width===64&&img.height===64){      // skin moderna: tal cual
      actx.drawImage(img,0,0);
    } else {                                         // cualquier otro tamaño: escalar a 64×64
      actx.drawImage(img,0,0,img.width,img.height,0,0,T,T);
    }
    refresh();URL.revokeObjectURL(url);
  };
  img.onerror=()=>{URL.revokeObjectURL(url);console.warn("No se pudo importar la imagen");};
  img.src=url;fileInput.value="";});
document.getElementById("exportBtn").addEventListener("click",()=>{
  // Blob + objectURL: la forma más confiable de forzar descarga (los data: URL fallan en Safari/Firefox)
  atlas.toBlob(blob=>{
    if(!blob){ showSaveModal(atlas.toDataURL("image/png")); return; }
    const url=URL.createObjectURL(blob);
    try{const a=document.createElement("a");a.download="mi-skin.png";a.href=url;document.body.appendChild(a);a.click();a.remove();}catch(e){}
    showSaveModal(url); // respaldo: ventanita para guardar a mano si el navegador igual no baja
  },"image/png");
});
function showSaveModal(url){
  const old=document.getElementById("saveModal"); if(old)old.remove();
  const btnCss="appearance:none;border:1px solid #2b3444;background:#1f2632;color:#e9edf2;font:inherit;font-size:12px;font-weight:700;padding:8px 12px;border-radius:3px;cursor:pointer";
  const primCss="appearance:none;border:1px solid #3f8f3a;background:linear-gradient(180deg,#5fbf57,#3f8f3a);color:#08240a;font:inherit;font-size:12px;font-weight:700;padding:8px 12px;border-radius:3px;cursor:pointer";
  const ov=document.createElement("div");
  ov.id="saveModal";
  ov.style.cssText="position:fixed;inset:0;z-index:50;display:flex;align-items:center;justify-content:center;background:rgba(6,8,12,.82);padding:20px";
  ov.innerHTML=
    '<div style="background:linear-gradient(180deg,#1f2632,#181d27);border:1px solid #2b3444;border-radius:6px;box-shadow:0 10px 40px rgba(0,0,0,.6);max-width:340px;width:100%;padding:18px;text-align:center;font-family:ui-monospace,monospace;color:#e9edf2">'+
      '<div style="font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#8a96a8;margin-bottom:12px;font-weight:700">Guardá tu skin</div>'+
      '<img src="'+url+'" width="192" height="192" style="image-rendering:pixelated;border:1px solid #2b3444;border-radius:4px;background:repeating-conic-gradient(#20262f 0% 25%,#171c24 0% 50%) 50%/16px 16px">'+
      '<p style="font-size:12px;color:#8a96a8;line-height:1.6;margin:14px 0">Clic derecho sobre la imagen → <b style="color:#5fbf57">Guardar imagen como…</b><br>En el celu, mantené presionada la imagen.<br><span style="color:#6a7588">(se guarda en 64×64 aunque se vea grande)</span></p>'+
      '<div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap">'+
        '<button id="copyImg" style="'+btnCss+'">Copiar imagen</button>'+
        '<button id="dlAgain" style="'+primCss+'">Descargar</button>'+
        '<button id="closeModal" style="'+btnCss+'">Cerrar</button>'+
      '</div>'+
      '<div id="copyMsg" style="font-size:11px;color:#5fbf57;margin-top:10px;min-height:14px"></div>'+
    '</div>';
  document.body.appendChild(ov);
  const close=()=>{ ov.remove(); if(url.startsWith("blob:"))URL.revokeObjectURL(url); };
  ov.addEventListener("click",e=>{if(e.target===ov)close();});
  ov.querySelector("#closeModal").onclick=close;
  ov.querySelector("#dlAgain").onclick=()=>{const a=document.createElement("a");a.download="mi-skin.png";a.href=url;document.body.appendChild(a);a.click();a.remove();};
  ov.querySelector("#copyImg").onclick=async()=>{
    const msg=ov.querySelector("#copyMsg");
    try{const blob=await (await fetch(url)).blob();await navigator.clipboard.write([new ClipboardItem({"image/png":blob})]);msg.textContent="¡Copiada! Ya la podés pegar.";}
    catch(err){msg.textContent="Acá no deja copiar. Usá clic derecho → Guardar imagen.";}
  };
}

/* ============================================================
   ===============  VISTA 3D  ====================
   ============================================================ */
const stage=document.getElementById("stage");
const renderer=new THREE.WebGLRenderer({canvas:stage,antialias:true,alpha:true});
renderer.setPixelRatio(Math.min(devicePixelRatio,2));
const scene=new THREE.Scene();
const camera=new THREE.PerspectiveCamera(34,3/4,0.1,1000);
camera.position.set(0,2,62);camera.lookAt(0,0,0);
scene.add(new THREE.AmbientLight(0xffffff,0.86));
const dir=new THREE.DirectionalLight(0xffffff,0.5);dir.position.set(20,30,40);scene.add(dir);
const dir2=new THREE.DirectionalLight(0xbcd0ff,0.22);dir2.position.set(-30,10,-20);scene.add(dir2);

// sombra de piso
const shadow=new THREE.Mesh(new THREE.CircleGeometry(9,32),
  new THREE.MeshBasicMaterial({color:0x000000,transparent:true,opacity:0.28}));
shadow.rotation.x=-Math.PI/2;shadow.position.y=-16.3;scene.add(shadow);

const tex=new THREE.CanvasTexture(atlas);
tex.magFilter=THREE.NearestFilter;tex.minFilter=THREE.NearestFilter;tex.generateMipmaps=false;tex.flipY=false;
const baseMat=new THREE.MeshLambertMaterial({map:tex,transparent:true,alphaTest:0.05,side:THREE.FrontSide});
const overMat=new THREE.MeshLambertMaterial({map:tex,transparent:true,alphaTest:0.5,side:THREE.DoubleSide,polygonOffset:true,polygonOffsetFactor:-1});

const charGroup=new THREE.Group();scene.add(charGroup);
const limbs=[];      // pivots animables {pivot,phase}
const overlays=[];   // meshes de capa exterior

function faceUV(g,f,x1,y1,x2,y2){const a=g.attributes.uv,o=f*4;
  a.setXY(o,x1/T,y1/T);a.setXY(o+1,x2/T,y1/T);a.setXY(o+2,x1/T,y2/T);a.setXY(o+3,x2/T,y2/T);}
function mapBox(g,u,v,w,h,d){
  faceUV(g,2,u+d,v,u+d+w,v+d); faceUV(g,3,u+d+w,v,u+d+2*w,v+d);
  // +X(0) y -X(1) van cruzadas respecto al orden del atlas: la 1ª región del
  // renglón es el lado -X y la 3ª es el +X (convención de Minecraft skinview)
  faceUV(g,1,u,v+d,u+d,v+d+h); faceUV(g,4,u+d,v+d,u+d+w,v+d+h);
  faceUV(g,0,u+d+w,v+d,u+2*d+w,v+d+h); faceUV(g,5,u+2*d+w,v+d,u+2*d+2*w,v+d+h);
  g.attributes.uv.needsUpdate=true;
}
function buildPart(w,h,d,uv,ov){
  const grp=new THREE.Group();
  const g=new THREE.BoxGeometry(w,h,d);mapBox(g,uv[0],uv[1],w,h,d);
  grp.add(new THREE.Mesh(g,baseMat));
  if(ov){const e=0.6;const g2=new THREE.BoxGeometry(w+e,h+e,d+e);mapBox(g2,ov[0],ov[1],w,h,d);
    const m2=new THREE.Mesh(g2,overMat);grp.add(m2);overlays.push(m2);}
  return grp;
}
function addLimb(w,h,d,uv,ov,jointX,jointY,phase){
  const pivot=new THREE.Group();pivot.position.set(jointX,jointY,0);
  const part=buildPart(w,h,d,uv,ov);part.position.set(0,-h/2,0);
  pivot.add(part);charGroup.add(pivot);limbs.push({pivot,phase});
}
function buildModel(slim){
  currentSlim=slim;                                       // para que el historial restaure la silueta
  charGroup.traverse(o=>{ if(o.geometry) o.geometry.dispose(); }); // liberar geometrías en la GPU
  while(charGroup.children.length)charGroup.remove(charGroup.children[0]);
  limbs.length=0;overlays.length=0;
  const aw=slim?3:4, ax=slim?5.5:6;
  // cabeza + cuerpo (fijos)
  const head=buildPart(8,8,8,[0,0],[32,0]);head.position.set(0,12,0);charGroup.add(head);
  const body=buildPart(8,12,4,[16,16],[16,32]);body.position.set(0,2,0);charGroup.add(body);
  // miembros con pivote en la articulación
  addLimb(aw,12,4,[40,16],[40,32],-ax,8,0);          // brazo der (hombro y=8)
  addLimb(aw,12,4,[32,48],[48,48], ax,8,Math.PI);    // brazo izq (contrafase)
  addLimb(4,12,4,[0,16],[0,32],-2,-4,Math.PI);       // pierna der (cadera y=-4)
  addLimb(4,12,4,[16,48],[0,48], 2,-4,0);            // pierna izq
  overlays.forEach(m=>m.visible=overlayOn);
  tex.needsUpdate=true;
}

/* ---------- controles 3D ---------- */
let autoSpin=true,walk=false,overlayOn=true,dragging=false,lastX=0,lastY=0,velY=0,rotY=0.5,rotX=0;
const spinBtn=document.getElementById("spinBtn"),walkBtn=document.getElementById("walkBtn"),overBtn=document.getElementById("overBtn");
spinBtn.addEventListener("click",()=>{autoSpin=!autoSpin;spinBtn.classList.toggle("on",autoSpin);});
walkBtn.addEventListener("click",()=>{walk=!walk;walkBtn.classList.toggle("on",walk);
  if(!walk)limbs.forEach(l=>l.pivot.rotation.x=0);});
overBtn.addEventListener("click",()=>{overlayOn=!overlayOn;overBtn.classList.toggle("on",overlayOn);overlays.forEach(m=>m.visible=overlayOn);});

function onDown(e){dragging=true;autoSpin=false;spinBtn.classList.remove("on");
  lastX=(e.touches?e.touches[0].clientX:e.clientX);lastY=(e.touches?e.touches[0].clientY:e.clientY);}
function onMove(e){if(!dragging)return;const cx=(e.touches?e.touches[0].clientX:e.clientX),cy=(e.touches?e.touches[0].clientY:e.clientY);
  velY=(cx-lastX)*0.01;rotY+=velY;rotX=Math.max(-0.8,Math.min(0.8,rotX+(cy-lastY)*0.01));lastX=cx;lastY=cy;}
function onUp(){dragging=false;}
stage.addEventListener("mousedown",onDown);window.addEventListener("mousemove",onMove);window.addEventListener("mouseup",onUp);
stage.addEventListener("touchstart",onDown,{passive:true});stage.addEventListener("touchmove",onMove,{passive:true});window.addEventListener("touchend",onUp);

function resize3D(){const r=stage.getBoundingClientRect();renderer.setSize(r.width,r.height,false);camera.aspect=r.width/r.height;camera.updateProjectionMatrix();}
window.addEventListener("resize",resize3D);

function loop(ts){
  requestAnimationFrame(loop);
  const t=(ts||0)/1000;
  if(autoSpin)rotY+=0.012; else if(!dragging){rotY+=velY;velY*=0.94;if(Math.abs(velY)<0.0005)velY=0;}
  charGroup.rotation.y=rotY;charGroup.rotation.x=rotX;
  if(walk){limbs.forEach(l=>l.pivot.rotation.x=Math.sin(t*4+l.phase)*0.5);}
  renderer.render(scene,camera);
}

/* ============================================================
   Arranque
   ============================================================ */
function init(){
  buildModel(false);
  resize3D();
  clampView();
  loadSkinAsset(SKIN_ASSETS.steve);
  undoStack.length=0;
  drawEditor();
  requestAnimationFrame(loop);
}
init();
