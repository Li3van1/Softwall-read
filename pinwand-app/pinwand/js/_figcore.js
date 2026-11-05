const FUNCS={sin:Math.sin,cos:Math.cos,tan:Math.tan,exp:Math.exp,ln:Math.log,log:Math.log,sqrt:Math.sqrt,abs:Math.abs,sinh:Math.sinh,cosh:Math.cosh,tanh:Math.tanh,
  asin:Math.asin,acos:Math.acos,atan:Math.atan,arcsin:Math.asin,arccos:Math.acos,arctan:Math.atan,sign:Math.sign,sgn:Math.sign,cot:x=>1/Math.tan(x)};
const FKEYS=Object.keys(FUNCS).sort((a,b)=>b.length-a.length);
function parseExpr(src,withY=false){
  let s=String(src).replace(/[−–]/g,"-").replace(/[·×⋅]/g,"*").replace(/÷/g,"/").replace(/²/g,"^2").replace(/³/g,"^3").replace(/π/g,"pi").replace(/[µμ]/g,"mu").replace(/\*\*/g,"^");
  const toks=[];let i=0;
  while(i<s.length){const c=s[i];if(/\s/.test(c)){i++;continue}
    const m=s.slice(i).match(/^(\d+\.?\d*(?:e[+-]?\d+)?|\.\d+(?:e[+-]?\d+)?)/i);if(m){toks.push({k:"n",v:parseFloat(m[1])});i+=m[1].length;continue}
    const w=s.slice(i).match(/^[A-Za-z_][A-Za-z0-9_]*/);if(w){splitIdent(w[0]).forEach(x=>toks.push(x));i+=w[0].length;continue}
    if("+-*/^(),".includes(c)){toks.push({k:c});i++;continue}
    throw new Error(t("Unknown sign “{c}”",{c}))}
  let pos=0,param=null;const peek=()=>toks[pos],eat=k=>{const tk=toks[pos];if(!tk||tk.k!==k)throw new Error(k===")"?t("A bracket is missing"):t("Something is missing"));pos++;return tk};
  const startsPrimary=tk=>tk&&(tk.k==="n"||tk.k==="id"||tk.k==="fn"||tk.k==="(");
  function expr(){let a=term();for(;;){const tk=peek();if(tk&&(tk.k==="+"||tk.k==="-")){pos++;const b=term(),A=a;a=tk.k==="+"?(x,p,y)=>A(x,p,y)+b(x,p,y):(x,p,y)=>A(x,p,y)-b(x,p,y)}else return a}}
  function term(){let a=unary();for(;;){const tk=peek();
    if(tk&&(tk.k==="*"||tk.k==="/")){pos++;const b=unary(),A=a;a=tk.k==="*"?(x,p,y)=>A(x,p,y)*b(x,p,y):(x,p,y)=>A(x,p,y)/b(x,p,y)}
    else if(startsPrimary(tk)){const b=power(),A=a;a=(x,p,y)=>A(x,p,y)*b(x,p,y)}else return a}}
  function unary(){const tk=peek();if(tk&&tk.k==="-"){pos++;const a=unary();return (x,p,y)=>-a(x,p,y)}if(tk&&tk.k==="+"){pos++;return unary()}return power()}
  function power(){const a=primary();if(peek()&&peek().k==="^"){pos++;const b=unary();return (x,p,y)=>Math.pow(a(x,p,y),b(x,p,y))}return a}
  function primary(){const tk=peek();if(!tk)throw new Error(t("The formula ends too early"));pos++;
    if(tk.k==="n"){const v=tk.v;return ()=>v}
    if(tk.k==="("){const a=expr();eat(")");return a}
    if(tk.k==="fn"){const F=FUNCS[tk.v];let a;if(peek()&&peek().k==="("){pos++;a=expr();eat(")")}else a=power();
      return (x,p,y)=>F(a(x,p,y))}
    if(tk.k==="id"){if(tk.v==="x")return x=>x;if(withY&&tk.v==="y")return (x,p,y)=>y;if(tk.v==="pi")return ()=>Math.PI;if(tk.v==="e")return ()=>Math.E;
      if(param&&param!==tk.v)throw new Error(t("Only one parameter is possible (found {a} and {b})",{a:param,b:tk.v}));param=tk.v;return (x,p,y)=>p}
    throw new Error(t("Something is missing"))}
  function splitIdent(w){if(FUNCS[w.toLowerCase()])return [{k:"fn",v:w.toLowerCase()}];if(["x","y","pi","e","mu"].includes(w))return [{k:"id",v:w}];
    if(w.length===1)return [{k:"id",v:w}];
    // "rx" → r·x, "xsin" is not supported; a known function at the end is split off ("rsin" → r·sin)
    const out=[];let rest=w;while(rest.length){const fn=FKEYS.find(f=>rest.toLowerCase().startsWith(f));
      if(fn&&rest.length>=fn.length){out.push({k:"fn",v:fn});rest=rest.slice(fn.length);continue}
      if(rest.startsWith("pi")){out.push({k:"id",v:"pi"});rest=rest.slice(2);continue}
      if(rest.startsWith("mu")){out.push({k:"id",v:"mu"});rest=rest.slice(2);continue}
      out.push({k:"id",v:rest[0]});rest=rest.slice(1)}return out}
  if(!toks.length)throw new Error(t("Type a function of x"));
  const f=expr();if(pos<toks.length)throw new Error(t("Something doesn't fit near “{c}”",{c:toks[pos].k==="n"?toks[pos].v:toks[pos].v||toks[pos].k}));
  return {f,param}}
const normExpr=s=>String(s).replace(/\s+/g,"").toLowerCase();

const FLOW_PRESETS=[
  {name:"sin x (L02, Fig. 1)",expr:"sin(x)",xmin:-7,xmax:7,tmax:6},
  {name:"x³: unstable, f′=0 (L02, Fig. 2)",expr:"x^3",xmin:-1.5,xmax:1.5,tmax:2},
  {name:"−x³: stable, f′=0 (L02, Fig. 2)",expr:"-x^3",xmin:-1.5,xmax:1.5,tmax:6},
  {name:"1 + x²: blow-up (L02)",expr:"1+x^2",xmin:-4,xmax:4,tmax:3},
  {name:"1/(1 + x²): no blow-up (L02)",expr:"1/(1+x^2)",xmin:-4,xmax:4,tmax:6},
  {name:"Greenland ice sheet (L01)",expr:"(-r+x)*x-x^5",xmin:-0.05,xmax:1,pmin:0,pmax:0.6,p:0.25,tmax:40},
  {name:"x − x³ (prep 1.8)",expr:"x-x^3",xmin:-1.6,xmax:1.6,tmax:6},
  {name:"Logistic growth x(1 − x) (prep 2.10)",expr:"x*(1-x)",xmin:-0.3,xmax:1.4,tmax:8},
  {name:"Saddle-node: r + x² (prep 3.5)",expr:"r+x^2",xmin:-2,xmax:2,pmin:-1,pmax:1,p:-0.5,tmax:3},
  {name:"Transcritical: rx − x² (prep 3.5)",expr:"r*x-x^2",xmin:-2,xmax:2,pmin:-1,pmax:1,p:0.5,tmax:6},
  {name:"Pitchfork: rx − x³ (prep 3.5)",expr:"r*x-x^3",xmin:-2,xmax:2,pmin:-1,pmax:1,p:0.5,tmax:8},
  {name:"Flow on the circle: r − sin x (prep 3.6, ω = r, a = 1)",expr:"r-sin(x)",xmin:0,xmax:6.2832,pmin:0,pmax:2,p:0.5,tmax:20}];
const MAP_PRESETS=[
  {name:"Logistic map, 2.5 < r < 4 (L01)",expr:"r*x*(1-x)",xmin:0,xmax:1,pmin:2.5,pmax:4,p:3.3,x0:0.2,steps:100},
  {name:"Logistic map, 0 < r < 4 (L01)",expr:"r*x*(1-x)",xmin:0,xmax:1,pmin:0,pmax:4,p:1.5,x0:0.2,steps:100},
  {name:"xₙ₊₁ = cos xₙ (prep 7.5)",expr:"cos(x)",xmin:0,xmax:1.6,x0:1.5,steps:40}];
const PLANE_PRESETS=[
  {name:"Saddle: ẋ = x + y, ẏ = 4x − 2y (prep 4.7)",f:"x+y",g:"4x-2y",xmin:-3,xmax:3,ymin:-3,ymax:3,tmax:3},
  {name:"Stable node: ẋ = −3x + y, ẏ = x − 3y (prep 4.7)",f:"-3x+y",g:"x-3y",xmin:-3,xmax:3,ymin:-3,ymax:3,tmax:4},
  {name:"Stable spiral: ẋ = −x + 2y, ẏ = −2x − y (prep 5.8)",f:"-x+2y",g:"-2x-y",xmin:-3,xmax:3,ymin:-3,ymax:3,tmax:6},
  {name:"Centre: ẋ = y, ẏ = −x (prep 5.8)",f:"y",g:"-x",xmin:-3,xmax:3,ymin:-3,ymax:3,tmax:7},
  {name:"Damped oscillator: ẋ = y, ẏ = −x − r·y (prep 6.3)",f:"y",g:"-x-r*y",xmin:-3,xmax:3,ymin:-3,ymax:3,pmin:0,pmax:3,p:0.5,tmax:12},
  {name:"Pendulum: ẋ = y, ẏ = −sin x (prep 6.6)",f:"y",g:"-sin(x)",xmin:-7,xmax:7,ymin:-3,ymax:3,tmax:12},
  {name:"ẋ = −x + x³, ẏ = −2y (prep 6.6)",f:"-x+x^3",g:"-2y",xmin:-1.8,xmax:1.8,ymin:-1.5,ymax:1.5,tmax:5},
  {name:"Limit cycle r = 1 (prep 7.2)",f:"x-y-x(x^2+y^2)",g:"x+y-y(x^2+y^2)",xmin:-2,xmax:2,ymin:-2,ymax:2,tmax:12},
  {name:"Hopf bifurcation, parameter r = μ (prep 7.3)",f:"r*x-y-x(x^2+y^2)",g:"x+r*y-y(x^2+y^2)",xmin:-1.5,xmax:1.5,ymin:-1.5,ymax:1.5,pmin:-1,pmax:1,p:0.25,tmax:30},
  {name:"Van der Pol, ε = r (L01)",f:"y",g:"r(1-x^2)y-x",xmin:-3,xmax:3,ymin:-4,ymax:4,pmin:0,pmax:5,p:1.5,tmax:20}];
// ---- Numerics ----
function fmt(v){if(!isFinite(v))return String(v);const a=Math.abs(v);if(a<1e-9)return "0";if(a>=1e4||a<1e-3)return v.toExponential(2);return (+v.toPrecision(4)).toString()}
function findRoots(g,a,b,N=2400){const xs=new Float64Array(N+1),ys=new Float64Array(N+1);let scale=0;
  for(let i=0;i<=N;i++){const x=a+(b-a)*i/N;xs[i]=x;ys[i]=g(x);if(isFinite(ys[i]))scale=Math.max(scale,Math.abs(ys[i]))}scale=scale||1;
  const out=[],ok=x=>{const v=g(x);return isFinite(v)&&Math.abs(v)<1e-6*scale+1e-10};
  for(let i=0;i<N;i++){const y0=ys[i],y1=ys[i+1];if(!isFinite(y0)||!isFinite(y1))continue;
    if(y0===0){out.push(xs[i]);continue}
    if(y0*y1<0){let lo=xs[i],hi=xs[i+1],flo=y0;for(let k=0;k<70;k++){const m=(lo+hi)/2,fm=g(m);if(!isFinite(fm))break;if(fm*flo<=0)hi=m;else{lo=m;flo=fm}}
      const r=(lo+hi)/2;if(ok(r))out.push(r);continue}
    if(i>0&&isFinite(ys[i-1])&&Math.abs(y0)<=Math.abs(ys[i-1])&&Math.abs(y0)<=Math.abs(y1)&&Math.abs(y0)<2e-2*scale){
      let lo=xs[i-1],hi=xs[i+1];for(let k=0;k<90;k++){const m1=lo+(hi-lo)*.382,m2=lo+(hi-lo)*.618;if(Math.abs(g(m1))<Math.abs(g(m2)))hi=m2;else lo=m1}
      const r=(lo+hi)/2;if(Math.abs(g(r))<1e-9*scale+1e-12)out.push(r)}}
  if(ys[N]===0)out.push(b);
  out.sort((p,q)=>p-q);return out.filter((x,i)=>i===0||Math.abs(x-out[i-1])>(b-a)*2e-4)}
const dnum=(f,x,p)=>{const h=1e-6*Math.max(1,Math.abs(x));return (f(x+h,p)-f(x-h,p))/(2*h)};
function niceTicks(a,b,n=5){const span=b-a;if(!(span>0))return [a];const step0=span/n,mag=Math.pow(10,Math.floor(Math.log10(step0))),r=step0/mag;
  const step=(r<1.5?1:r<3?2:r<7?5:10)*mag,out=[];for(let v=Math.ceil(a/step)*step;v<=b+step*1e-9;v+=step)out.push(Math.abs(v)<step*1e-9?0:v);return out}
function mkPanel(x,y,w,h,xr,yr){return {x,y,w,h,xr,yr,X:v=>x+(v-xr[0])/(xr[1]-xr[0])*w,Y:v=>y+h-(v-yr[0])/(yr[1]-yr[0])*h}}
function drawAxes(g,P,C,xl,yl){g.save();g.font="11px Verdana, sans-serif";g.fillStyle=C.panel;g.fillRect(P.x,P.y,P.w,P.h);
  g.strokeStyle=C.line;g.lineWidth=1;g.fillStyle=C.muted;g.textBaseline="top";g.textAlign="center";
  for(const v of niceTicks(P.xr[0],P.xr[1],P.w/70)){const X=P.X(v);g.beginPath();g.moveTo(X+.5,P.y);g.lineTo(X+.5,P.y+P.h);g.stroke();g.fillText(fmt(v),X,P.y+P.h+4)}
  g.textAlign="right";g.textBaseline="middle";
  for(const v of niceTicks(P.yr[0],P.yr[1],P.h/40)){const Y=P.Y(v);g.beginPath();g.moveTo(P.x,Y+.5);g.lineTo(P.x+P.w,Y+.5);g.stroke();g.fillText(fmt(v),P.x-5,Y)}
  g.strokeStyle=C.muted;g.strokeRect(P.x+.5,P.y+.5,P.w,P.h);
  g.fillStyle=C.fg;g.font="italic 12px Verdana, sans-serif";g.textAlign="right";g.textBaseline="bottom";g.fillText(xl,P.x+P.w,P.y+P.h-3);
  g.textAlign="left";g.textBaseline="top";g.fillText(yl,P.x+4,P.y+3);g.restore()}
function clipTo(g,P){g.beginPath();g.rect(P.x,P.y,P.w,P.h);g.clip()}
function dot(g,x,y,r,kind,C){g.save();g.lineWidth=2;g.beginPath();g.arc(x,y,r,0,7);g.fillStyle=kind==="stable"?C.good:C.panel;g.strokeStyle=kind==="stable"?C.good:kind==="half"?C.half:C.again;g.fill();g.stroke();
  if(kind==="half"){g.beginPath();g.arc(x,y,r,-Math.PI/2,Math.PI/2);g.fillStyle=C.half;g.fill()}g.restore()}
function curve(g,P,fn,a,b,C,color,width=2){g.save();clipTo(g,P);g.strokeStyle=color;g.lineWidth=width;g.beginPath();let pen=false;const N=Math.max(200,Math.round(P.w*1.5));
  const lo=P.yr[0]-(P.yr[1]-P.yr[0])*2,hi=P.yr[1]+(P.yr[1]-P.yr[0])*2;
  for(let i=0;i<=N;i++){const x=a+(b-a)*i/N,y=fn(x);if(!isFinite(y)||y<lo||y>hi){pen=false;continue}const X=P.X(x),Y=P.Y(y);pen?g.lineTo(X,Y):g.moveTo(X,Y);pen=true}
  g.stroke();g.restore()}
function classifyFlow(f,x,p,span){const h=span*2e-4,l=f(x-h,p),r=f(x+h,p);if(l>0&&r<0)return "stable";if(l<0&&r>0)return "unstable";if(l===0&&r===0)return "neutral";return "half"}
const KINDLAB={stable:"stable",unstable:"unstable",half:"half-stable",neutral:"neutral"};
function fpList(list){if(!list.length)return "<b>"+t("No fixed points in this range.")+"</b>";
  const show=list.slice(0,10).map(([x,k,extra])=>`${fmt(x)} <span class="${k==="stable"?"st":k==="unstable"?"un":"hs"}">${t(KINDLAB[k])}</span>${extra||""}`).join(" · ");
  return `<b>${t("Fixed points")}:</b> `+show+(list.length>10?" …":"")}

function drawFlow(g,W,H,n,F,C,info,cv){const f=F.f,p=n.p,a=n.xmin,b=n.xmax,fx=x=>f(x,p);
  const stack=W<540,m={l:46,r:14,t:12,b:26},gap=44,w1=stack?W-m.l-m.r:Math.round((W-m.l-m.r-gap)*.55),w2=stack?w1:W-m.l-m.r-gap-w1,
    h=stack?Math.round((H-m.t-m.b-gap)/2):H-m.t-m.b,x2=stack?m.l:m.l+w1+gap,y2=stack?m.t+h+gap:m.t;
  // robust y-range for f(x)
  const ys=[];for(let i=0;i<=400;i++){const v=fx(a+(b-a)*i/400);if(isFinite(v))ys.push(Math.abs(v))}ys.sort((u,v)=>u-v);
  let ym=ys.length?ys[Math.min(ys.length-1,Math.floor(ys.length*.97))]*1.15:1;if(!(ym>1e-12))ym=1;
  const P1=mkPanel(m.l,m.t,w1,h,[a,b],[-ym,ym]);drawAxes(g,P1,C,"x","ẋ = f(x)");
  g.save();clipTo(g,P1);g.strokeStyle=C.fg;g.lineWidth=1.6;g.beginPath();g.moveTo(P1.x,P1.Y(0));g.lineTo(P1.x+P1.w,P1.Y(0));g.stroke();g.restore();
  curve(g,P1,fx,a,b,C,C.blue,2.2);
  const roots=findRoots(fx,a,b),kinds=roots.map(r=>classifyFlow(f,r,p,b-a));
  // flow arrows on the x-axis between fixed points
  const cuts=[a,...roots,b];g.save();clipTo(g,P1);g.fillStyle=C.fg;
  for(let i=0;i<cuts.length-1;i++){const lo=cuts[i],hi=cuts[i+1];if(P1.X(hi)-P1.X(lo)<22)continue;const mid=(lo+hi)/2,s=Math.sign(fx(mid));if(!s||!isFinite(s))continue;
    const X=P1.X(mid),Y=P1.Y(0);g.beginPath();g.moveTo(X+s*7,Y);g.lineTo(X-s*6,Y-5.5);g.lineTo(X-s*6,Y+5.5);g.closePath();g.fill()}g.restore();
  roots.forEach((r,i)=>dot(g,P1.X(r),P1.Y(0),5.5,kinds[i],C));
  // x(t) for several initial conditions (RK4); stops at blow-up
  const T=n.tmax,P2=mkPanel(x2,y2,w2,h,[0,T],[a,b]);drawAxes(g,P2,C,"t","x(t)");
  g.save();clipTo(g,P2);g.setLineDash([4,4]);g.lineWidth=1.2;roots.forEach((r,i)=>{g.strokeStyle=kinds[i]==="stable"?C.good:kinds[i]==="unstable"?C.again:C.half;g.beginPath();g.moveTo(P2.x,P2.Y(r));g.lineTo(P2.x+P2.w,P2.Y(r));g.stroke()});
  g.setLineDash([]);const K=13,N=700,dt=T/N,big=(b-a)*50+Math.abs(a)+Math.abs(b);let blew=false;
  for(let k=0;k<K;k++){let x=a+(b-a)*(k+.5)/K;g.strokeStyle=C.accent;g.globalAlpha=.85;g.lineWidth=1.6;g.beginPath();g.moveTo(P2.X(0),P2.Y(x));
    for(let i=1;i<=N;i++){const k1=fx(x),k2=fx(x+dt/2*k1),k3=fx(x+dt/2*k2),k4=fx(x+dt*k3),nx=x+dt/6*(k1+2*k2+2*k3+k4);
      if(!isFinite(nx)||Math.abs(nx)>big){blew=true;g.lineTo(P2.X(i*dt),P2.Y(nx>0||nx!==nx?b+(b-a):a-(b-a)));break}x=nx;g.lineTo(P2.X(i*dt),P2.Y(x))}g.stroke()}
  g.restore();cv._panels=[{...P1,role:"none"},{...P2,role:"none"}];
  info.innerHTML=fpList(roots.map((r,i)=>[r,kinds[i],kinds[i]==="half"||kinds[i]==="neutral"?"":` <small>(f′=${fmt(dnum(f,r,p))})</small>`]))+(blew?" · <b>"+t("Some solutions run off to ±∞ (watch for blow-up).")+"</b>":"")}

const bifCache=new Map();
function bifData(f,n,cols){const key=[n.expr,n.pmin,n.pmax,n.xmin,n.xmax,n.x0,cols].join("|");let D=bifCache.get(key);if(D)return D;
  const pts=[],lam=new Float64Array(cols),esc=new Uint8Array(cols),big=1e6;
  for(let c=0;c<cols;c++){const r=n.pmin+(n.pmax-n.pmin)*(c+.5)/cols;let x=n.x0,ls=0,cnt=0,ok=true;
    for(let i=0;i<500;i++){x=f(x,r);if(!isFinite(x)||Math.abs(x)>big){ok=false;break}}
    if(ok)for(let i=0;i<500;i++){const d=Math.abs(dnum(f,x,r));ls+=Math.log(Math.max(d,1e-300));cnt++;x=f(x,r);if(!isFinite(x)||Math.abs(x)>big){ok=false;break}if(i<160)pts.push(c,x)}
    esc[c]=ok?0:1;lam[c]=ok&&cnt?ls/cnt:NaN}
  D={pts,lam,esc,cols};if(bifCache.size>12)bifCache.clear();bifCache.set(key,D);return D}
function drawMap(g,W,H,n,F,C,info,cv){const f=F.f,p=n.p,a=n.xmin,b=n.xmax,fx=x=>f(x,p),hasP=!!F.param;
  const m={l:46,r:14,t:12,b:26},gap=48,vgap=44,w1=Math.round((W-m.l-m.r-gap)*.5),w2=W-m.l-m.r-gap-w1,h1=Math.round((H-m.t-m.b-vgap)*.52),h2=H-m.t-m.b-vgap-h1;
  // cobweb
  const P1=mkPanel(m.l,m.t,w1,h1,[a,b],[a,b]);drawAxes(g,P1,C,"xₙ","xₙ₊₁");
  g.save();clipTo(g,P1);g.strokeStyle=C.muted;g.setLineDash([4,4]);g.lineWidth=1;g.beginPath();g.moveTo(P1.X(a),P1.Y(a));g.lineTo(P1.X(b),P1.Y(b));g.stroke();g.setLineDash([]);g.restore();
  curve(g,P1,fx,a,b,C,C.blue,2.2);
  const traj=[n.x0];let x=n.x0,div=false;for(let i=0;i<n.steps;i++){x=fx(x);if(!isFinite(x)||Math.abs(x)>1e9){div=true;break}traj.push(x)}
  g.save();clipTo(g,P1);g.strokeStyle=C.accent;g.lineWidth=1.3;g.globalAlpha=.9;g.beginPath();g.moveTo(P1.X(traj[0]),P1.Y(a));
  for(let i=0;i<traj.length-1;i++){g.lineTo(P1.X(traj[i]),P1.Y(traj[i+1]));g.lineTo(P1.X(traj[i+1]),P1.Y(traj[i+1]))}g.stroke();g.restore();
  const roots=findRoots(x=>fx(x)-x,a,b),kinds=roots.map(r=>{const d=Math.abs(dnum(f,r,p));return Math.abs(d-1)<1e-5?"half":d<1?"stable":"unstable"});
  roots.forEach((r,i)=>dot(g,P1.X(r),P1.Y(r),5,kinds[i],C));
  g.save();g.fillStyle=C.accent;g.beginPath();g.arc(P1.X(n.x0),P1.Y(a)-1,4,0,7);g.fill();g.restore();
  // time series
  const P2=mkPanel(m.l+w1+gap,m.t,w2,h1,[0,n.steps],[a,b]);drawAxes(g,P2,C,"n","xₙ");
  g.save();clipTo(g,P2);g.strokeStyle=C.line;g.lineWidth=1;g.beginPath();traj.forEach((v,i)=>i?g.lineTo(P2.X(i),P2.Y(v)):g.moveTo(P2.X(i),P2.Y(v)));g.stroke();
  g.fillStyle=C.accent;const rr=n.steps>150?1.6:2.4;traj.forEach((v,i)=>{g.beginPath();g.arc(P2.X(i),P2.Y(v),rr,0,7);g.fill()});g.restore();
  const pl=hasP?(F.param==="mu"?"μ":F.param):"r";
  const P3=mkPanel(m.l,m.t+h1+vgap,w1,h2,[n.pmin,n.pmax],[a,b]),P4=mkPanel(m.l+w1+gap,m.t+h1+vgap,w2,h2,[n.pmin,n.pmax],[-3,1]);
  if(hasP){const cols=Math.max(100,Math.min(900,Math.round(P3.w*1.5))),D=bifData(f,n,cols);
    drawAxes(g,P3,C,pl,"x");g.save();clipTo(g,P3);g.fillStyle=C.blue;g.globalAlpha=.55;const cw=P3.w/cols;
    for(let i=0;i<D.pts.length;i+=2){const X=P3.x+(D.pts[i]+.5)*cw,Y=P3.Y(D.pts[i+1]);g.fillRect(X-.6,Y-.6,1.2,1.2)}g.restore();
    let lmin=-3,lmax=1;for(const v of D.lam)if(isFinite(v)){lmin=Math.min(lmin,Math.max(v,-6));lmax=Math.max(lmax,v)}P4.yr=[lmin,lmax+.15];
    drawAxes(g,P4,C,pl,"λ");g.save();clipTo(g,P4);g.strokeStyle=C.muted;g.setLineDash([4,4]);g.beginPath();g.moveTo(P4.x,P4.Y(0));g.lineTo(P4.x+P4.w,P4.Y(0));g.stroke();g.setLineDash([]);
    const cw4=P4.w/cols;for(let c=0;c<cols;c++){const v=D.lam[c];if(!isFinite(v))continue;g.fillStyle=v>0?C.again:C.blue;g.fillRect(P4.x+(c+.5)*cw4-.9,P4.Y(Math.max(v,P4.yr[0]))-.9,1.8,1.8)}g.restore();
    [P3,P4].forEach(P=>{const X=P.X(p);g.save();g.strokeStyle=C.accent;g.lineWidth=1.5;g.beginPath();g.moveTo(X,P.y);g.lineTo(X,P.y+P.h);g.stroke();
      g.fillStyle=C.accent;g.font="600 11px Verdana, sans-serif";g.textAlign=X>P.x+P.w-60?"right":"left";g.textBaseline="top";g.fillText(pl+" = "+fmt(p),X+(g.textAlign==="right"?-5:5),P.y+4);g.restore()});
    const c=Math.min(cols-1,Math.max(0,Math.floor((p-n.pmin)/(n.pmax-n.pmin)*cols)));var lamNow=D.lam[c]}
  else[P3,P4].forEach(P=>{g.save();g.fillStyle=C.panel;g.fillRect(P.x,P.y,P.w,P.h);g.strokeStyle=C.line;g.strokeRect(P.x+.5,P.y+.5,P.w,P.h);g.fillStyle=C.muted;
    g.font="13px Verdana, sans-serif";g.textAlign="center";g.textBaseline="middle";g.fillText(t("Add a parameter (e.g. r) to see this"),P.x+P.w/2,P.y+P.h/2);g.restore()});
  cv._panels=[{...P1,role:"x0"},{...P2,role:"none"},{...P3,role:"param",hasParam:hasP},{...P4,role:"param",hasParam:hasP}];
  // what the orbit does in the long run
  let tail="";if(!div){let y=n.x0,ok=true;for(let i=0;i<3000;i++){y=fx(y);if(!isFinite(y)||Math.abs(y)>1e9){ok=false;break}}
    if(ok){const orb=[y];for(let i=0;i<64;i++){y=fx(y);orb.push(y)}let per=0;for(let q=1;q<=32;q++){if(Math.abs(orb[q]-orb[0])<1e-6*(1+Math.abs(orb[0]))){per=q;break}}
      tail=per===1?t("long run: settles on a fixed point"):per?t("long run: period {p}",{p:per}):t("long run: no period up to 32 (chaotic or very slow)")}else div=true}
  info.innerHTML=fpList(roots.map((r,i)=>[r,kinds[i],` <small>(|f′|=${fmt(Math.abs(dnum(f,r,p)))})</small>`]))+
    (div?" · <b>"+t("The orbit escapes to infinity.")+"</b>":tail?" · "+tail:"")+(hasP&&isFinite(lamNow)?` · λ ≈ <b>${fmt(lamNow)}</b>`:"")}

function jac2(f,g,x,y){const hx=1e-6*Math.max(1,Math.abs(x)),hy=1e-6*Math.max(1,Math.abs(y));
  return [(f(x+hx,y)-f(x-hx,y))/(2*hx),(f(x,y+hy)-f(x,y-hy))/(2*hy),(g(x+hx,y)-g(x-hx,y))/(2*hx),(g(x,y+hy)-g(x,y-hy))/(2*hy)]}
function fixedPoints2(f,g,xr,yr,scale){const out=[],sx=xr[1]-xr[0],sy=yr[1]-yr[0],tol=1e-9*(1+scale);
  for(let i=0;i<=12;i++)for(let j=0;j<=12;j++){let x=xr[0]+sx*i/12,y=yr[0]+sy*j/12,ok=false;
    for(let k=0;k<60;k++){const F=f(x,y),G=g(x,y);if(!isFinite(F)||!isFinite(G))break;if(Math.abs(F)+Math.abs(G)<tol){ok=true;break}
      const J=jac2(f,g,x,y),det=J[0]*J[3]-J[1]*J[2];if(!isFinite(det)||Math.abs(det)<1e-14)break;
      let dx=(J[3]*F-J[1]*G)/det,dy=(-J[2]*F+J[0]*G)/det;const st=Math.hypot(dx/sx,dy/sy);if(st>.25){dx*=.25/st;dy*=.25/st}x-=dx;y-=dy}
    if(ok&&x>=xr[0]-1e-9*sx&&x<=xr[1]+1e-9*sx&&y>=yr[0]-1e-9*sy&&y<=yr[1]+1e-9*sy&&!out.some(q=>Math.hypot((q[0]-x)/sx,(q[1]-y)/sy)<1e-5))out.push([Math.abs(x)<1e-10*sx?0:x,Math.abs(y)<1e-10*sy?0:y])}
  return out.sort((a,b)=>a[0]-b[0]||a[1]-b[1])}
function classify2(J){const tr=J[0]+J[3],det=J[0]*J[3]-J[1]*J[2],disc=tr*tr-4*det,sc=1+Math.abs(tr)+Math.abs(det),eps=1e-7*sc,etr=1e-6*(1+Math.sqrt(Math.abs(det)));
  let kind,lam;if(disc>=-eps){const s=Math.sqrt(Math.max(0,disc));lam=`λ = ${fmt((tr+s)/2)}, ${fmt((tr-s)/2)}`}else lam=`λ = ${fmt(tr/2)} ± ${fmt(Math.sqrt(-disc)/2)}i`;
  if(det<-eps)kind="saddle";else if(Math.abs(det)<=eps)kind="degenerate (Δ = 0)";
  else if(disc<-eps)kind=Math.abs(tr)<=etr?"centre (linearization)":tr<0?"stable spiral":"unstable spiral";
  else if(Math.abs(disc)<=eps)kind=tr<0?"stable degenerate node / star":"unstable degenerate node / star";else kind=tr<0?"stable node":"unstable node";
  return {tr,det,disc,kind,lam}}
const FP2_LAB={"saddle":"saddle","degenerate (Δ = 0)":"degenerate (Δ = 0)","centre (linearization)":"centre (linearization)","stable spiral":"stable spiral","unstable spiral":"unstable spiral",
  "stable degenerate node / star":"stable degenerate node / star","unstable degenerate node / star":"unstable degenerate node / star","stable node":"stable node","unstable node":"unstable node"};
function drawPlane(g,W,H,n,PF,PG,C,info,cv){const p=n.p,f=(x,y)=>PF.f(x,p,y),gg=(x,y)=>PG.f(x,p,y);
  const m={l:46,r:14,t:12,b:26},gap=52,h=H-m.t-m.b,w1=Math.round((W-m.l-m.r-gap)*.6),w2=W-m.l-m.r-gap-w1;
  const P=mkPanel(m.l,m.t,w1,h,[n.xmin,n.xmax],[n.ymin,n.ymax]);drawAxes(g,P,C,"x","y");
  const sx=n.xmax-n.xmin,sy=n.ymax-n.ymin;
  // sample both components on a grid (nullclines and scale)
  const NX=120,NY=Math.max(40,Math.round(120*h/w1)),FV=new Float64Array((NX+1)*(NY+1)),GV=new Float64Array((NX+1)*(NY+1));let scale=0;
  for(let j=0;j<=NY;j++)for(let i=0;i<=NX;i++){const x=n.xmin+sx*i/NX,y=n.ymin+sy*j/NY,F=f(x,y),G=gg(x,y);FV[j*(NX+1)+i]=F;GV[j*(NX+1)+i]=G;if(isFinite(F))scale=Math.max(scale,Math.abs(F));if(isFinite(G))scale=Math.max(scale,Math.abs(G))}
  g.save();clipTo(g,P);
  // direction field
  const AX=17,AY=Math.max(8,Math.round(17*h/w1)),cw=P.w/AX,ch=P.h/AY,Lr=Math.min(cw,ch)*.36;g.strokeStyle=C.muted;g.fillStyle=C.muted;g.globalAlpha=.45;g.lineWidth=1;
  for(let i=0;i<AX;i++)for(let j=0;j<AY;j++){const X=P.x+(i+.5)*cw,Y=P.y+(j+.5)*ch,x=n.xmin+(i+.5)/AX*sx,y=n.ymax-(j+.5)/AY*sy,F=f(x,y),G=gg(x,y);
    if(!isFinite(F)||!isFinite(G))continue;let ux=F/sx*P.w,uy=-G/sy*P.h;const l=Math.hypot(ux,uy);if(l<1e-12)continue;ux/=l;uy/=l;
    g.beginPath();g.moveTo(X-ux*Lr,Y-uy*Lr);g.lineTo(X+ux*Lr,Y+uy*Lr);g.stroke();
    g.beginPath();g.moveTo(X+ux*Lr,Y+uy*Lr);g.lineTo(X+ux*Lr-ux*4-uy*2.6,Y+uy*Lr-uy*4+ux*2.6);g.lineTo(X+ux*Lr-ux*4+uy*2.6,Y+uy*Lr-uy*4-ux*2.6);g.closePath();g.fill()}
  g.globalAlpha=1;
  // nullclines (marching squares)
  const contour=(V,color)=>{g.strokeStyle=color;g.lineWidth=2.2;g.beginPath();const X=i=>P.x+i/NX*P.w,Y=j=>P.y+P.h-j/NY*P.h;
    for(let j=0;j<NY;j++)for(let i=0;i<NX;i++){const a=V[j*(NX+1)+i],b=V[j*(NX+1)+i+1],c=V[(j+1)*(NX+1)+i+1],e=V[(j+1)*(NX+1)+i];
      if(!(isFinite(a)&&isFinite(b)&&isFinite(c)&&isFinite(e)))continue;const pts=[];
      const ed=(v1,v2,x1,y1,x2,y2)=>{if((v1<0)!==(v2<0)){const s=v1/(v1-v2);pts.push([x1+(x2-x1)*s,y1+(y2-y1)*s])}};
      ed(a,b,i,j,i+1,j);ed(b,c,i+1,j,i+1,j+1);ed(c,e,i+1,j+1,i,j+1);ed(e,a,i,j+1,i,j);
      if(pts.length>=2){g.moveTo(X(pts[0][0]),Y(pts[0][1]));g.lineTo(X(pts[1][0]),Y(pts[1][1]))}if(pts.length===4){g.moveTo(X(pts[2][0]),Y(pts[2][1]));g.lineTo(X(pts[3][0]),Y(pts[3][1]))}}
    g.stroke()};
  const big=[n.xmin-sx,n.xmax+sx,n.ymin-sy,n.ymax+sy];
  const traj=(x,y,dir,T,steps)=>{const pts=[[x,y]],dt=dir*T/steps;for(let k=0;k<steps;k++){
      const k1x=f(x,y),k1y=gg(x,y),k2x=f(x+dt/2*k1x,y+dt/2*k1y),k2y=gg(x+dt/2*k1x,y+dt/2*k1y),k3x=f(x+dt/2*k2x,y+dt/2*k2y),k3y=gg(x+dt/2*k2x,y+dt/2*k2y),k4x=f(x+dt*k3x,y+dt*k3y),k4y=gg(x+dt*k3x,y+dt*k3y);
      x+=dt/6*(k1x+2*k2x+2*k3x+k4x);y+=dt/6*(k1y+2*k2y+2*k3y+k4y);if(!isFinite(x)||!isFinite(y)||x<big[0]||x>big[1]||y<big[2]||y>big[3])break;pts.push([x,y])}return pts};
  const drawTraj=(pts,color,width,alpha,dash)=>{if(pts.length<2)return;g.save();g.strokeStyle=color;g.fillStyle=color;g.globalAlpha=alpha;g.lineWidth=width;if(dash)g.setLineDash(dash);g.beginPath();
    pts.forEach(([x,y],i)=>i?g.lineTo(P.X(x),P.Y(y)):g.moveTo(P.X(x),P.Y(y)));g.stroke();g.setLineDash([]);
    const k=Math.min(pts.length-2,Math.max(1,Math.floor(pts.length*.35))),[x1,y1]=pts[k],[x2,y2]=pts[k+1],X1=P.X(x1),Y1=P.Y(y1),X2=P.X(x2),Y2=P.Y(y2),l=Math.hypot(X2-X1,Y2-Y1);
    if(l>1e-6&&!dash){const ux=(X2-X1)/l,uy=(Y2-Y1)/l;g.beginPath();g.moveTo(X2+ux*3,Y2+uy*3);g.lineTo(X2-ux*6-uy*4,Y2-uy*6+ux*4);g.lineTo(X2-ux*6+uy*4,Y2-uy*6-ux*4);g.closePath();g.fill()}g.restore()};
  for(let i=0;i<7;i++)for(let j=0;j<6;j++){const x=n.xmin+sx*(i+.5)/7,y=n.ymin+sy*(j+.5)/6;drawTraj(traj(x,y,1,n.tmax,500),C.accent,1.25,.55)}
  contour(FV,C.half);contour(GV,C.purple);
  if(n.x0!=null&&n.y0!=null){drawTraj(traj(n.x0,n.y0,-1,n.tmax,700),C.blue,1.6,.6,[5,4]);drawTraj(traj(n.x0,n.y0,1,n.tmax*2,1400),C.blue,2.6,1);
    g.fillStyle=C.blue;g.beginPath();g.arc(P.X(n.x0),P.Y(n.y0),4,0,7);g.fill()}
  // fixed points
  const fps=fixedPoints2(f,gg,[n.xmin,n.xmax],[n.ymin,n.ymax],scale).slice(0,12),cls=fps.map(([x,y])=>{const J=jac2(f,gg,x,y);return {J,...classify2(J)}});
  fps.forEach(([x,y],i)=>{const c=cls[i],X=P.X(x),Y=P.Y(y);
    if(c.kind==="saddle"){const J=c.J,s=Math.sqrt(Math.max(0,c.disc));[(c.tr+s)/2,(c.tr-s)/2].forEach(l=>{let vx,vy;if(Math.abs(J[1])>1e-9){vx=J[1];vy=l-J[0]}else if(Math.abs(J[2])>1e-9){vx=l-J[3];vy=J[2]}else{vx=Math.abs(J[0]-l)<1e-9?1:0;vy=1-vx}
        const ux=vx/sx*P.w,uy=-vy/sy*P.h,ll=Math.hypot(ux,uy)||1,L=Math.min(P.w,P.h)*.14;g.save();g.strokeStyle=l>0?C.again:C.good;g.lineWidth=2;g.globalAlpha=.85;g.beginPath();g.moveTo(X-ux/ll*L,Y-uy/ll*L);g.lineTo(X+ux/ll*L,Y+uy/ll*L);g.stroke();g.restore()})}
    const kind=c.kind.startsWith("stable")?"stable":c.kind.startsWith("unstable")?"unstable":"half";dot(g,X,Y,6,kind,C);
    if(c.kind.startsWith("centre")){g.save();g.strokeStyle=C.good;g.lineWidth=1.5;g.beginPath();g.arc(X,Y,10,0,7);g.stroke();g.restore()}
    g.save();g.fillStyle=C.fg;g.font="600 11px Verdana, sans-serif";g.textBaseline="bottom";g.fillText(String(i+1),X+7,Y-5);g.restore()});
  g.restore();
  // trace–determinant plane
  let T=2,Dp=2,Dn=1;cls.forEach(c=>{T=Math.max(T,Math.abs(c.tr)*1.3);Dp=Math.max(Dp,c.det*1.3);Dn=Math.max(Dn,-c.det*1.3)});Dp=Math.max(Dp,T*T/4*1.05);
  const P2=mkPanel(m.l+w1+gap,m.t,w2,h,[-T,T],[-Dn,Dp]);drawAxes(g,P2,C,"τ = trace","Δ = det");
  g.save();clipTo(g,P2);g.strokeStyle=C.fg;g.lineWidth=1.3;g.beginPath();g.moveTo(P2.x,P2.Y(0));g.lineTo(P2.x+P2.w,P2.Y(0));g.moveTo(P2.X(0),P2.y);g.lineTo(P2.X(0),P2.y+P2.h);g.stroke();
  g.strokeStyle=C.muted;g.setLineDash([5,4]);g.beginPath();for(let i=0;i<=120;i++){const tau=-T+2*T*i/120;i?g.lineTo(P2.X(tau),P2.Y(tau*tau/4)):g.moveTo(P2.X(tau),P2.Y(tau*tau/4))}g.stroke();g.setLineDash([]);
  g.fillStyle=C.muted;g.font="11px Verdana, sans-serif";g.textAlign="center";g.textBaseline="middle";
  const lab=(s,tau,D)=>g.fillText(t(s),P2.X(tau),P2.Y(D));
  lab("saddles",0,-Dn*.55);lab("stable spirals",-T*.42,Dp*.82);lab("unstable spirals",T*.42,Dp*.82);const nd=Math.min(Dp*.3,(.6*T)*(.6*T)/4*.45);lab("stable nodes",-T*.6,nd);lab("unstable nodes",T*.6,nd);
  g.save();g.translate(P2.X(0)+9,P2.Y(Dp*.55));g.rotate(-Math.PI/2);g.fillText(t("centres"),0,0);g.restore();
  cls.forEach((c,i)=>{const X=P2.X(Math.max(-T,Math.min(T,c.tr))),Y=P2.Y(Math.max(-Dn,Math.min(Dp,c.det)));dot(g,X,Y,5,c.kind.startsWith("stable")?"stable":c.kind.startsWith("unstable")?"unstable":"half",C);
    g.fillStyle=C.fg;g.font="600 11px Verdana, sans-serif";g.textAlign="left";g.textBaseline="bottom";g.fillText(String(i+1),X+7,Y-4)});
  g.restore();
  cv._panels=[{...P,role:"start"},{...P2,role:"none"}];
  info.innerHTML=fps.length?`<b>${escHTML(t("Fixed points"))}:</b> `+fps.map(([x,y],i)=>{const c=cls[i],k=c.kind.startsWith("stable")?"st":c.kind.startsWith("unstable")?"un":"hs";
      return `${i+1}. (${fmt(x)}, ${fmt(y)}) <span class="${k}">${escHTML(t(FP2_LAB[c.kind]||c.kind))}</span> <small>${c.lam} · τ=${fmt(c.tr)}, Δ=${fmt(c.det)}</small>`}).join(" · ")
    :`<b>${escHTML(t("No fixed points in this range."))}</b>`}

// =====================================================================
// v8 · Bifurcation diagram under every 1D flow figure that has a parameter; L03 presets; arcosh & co.
// =====================================================================
Object.assign(FUNCS,{acosh:Math.acosh,arccosh:Math.acosh,arcosh:Math.acosh,asinh:Math.asinh,arcsinh:Math.asinh,arsinh:Math.asinh,atanh:Math.atanh,arctanh:Math.atanh,artanh:Math.atanh});
FKEYS.length=0;FKEYS.push(...Object.keys(FUNCS).sort((a,b)=>b.length-a.length));
FLOW_PRESETS.push(
  {name:"Saddle-node: r + x² (L03 eq. 1)",expr:"r+x^2",xmin:-2,xmax:2,pmin:-1,pmax:1,p:-0.5,tmax:3},
  {name:"Transcritical: rx − x² (L03 eq. 6)",expr:"r*x-x^2",xmin:-2,xmax:2,pmin:-1,pmax:1,p:0.5,tmax:6},
  {name:"Supercritical pitchfork: rx − x³ (L03 eq. 10)",expr:"r*x-x^3",xmin:-2,xmax:2,pmin:-1,pmax:1,p:0.5,tmax:8},
  {name:"Subcritical pitchfork: rx + x³ (L03 eq. 11)",expr:"r*x+x^3",xmin:-2,xmax:2,pmin:-1,pmax:1,p:-0.5,tmax:3},
  {name:"Hysteresis: rx + x³ − x⁵ (L03 eq. 12)",expr:"r*x+x^3-x^5",xmin:-1.6,xmax:1.6,pmin:-0.5,pmax:0.4,p:-0.15,tmax:20});
const FLOW_BIF_H=250,flowParamCache=new Map();
function flowBifH(n){if(n.ft!=="flow")return 0;let v=flowParamCache.get(n.expr);
  if(v==null){try{v=!!parseExpr(n.expr).param}catch(e){v=false}if(flowParamCache.size>200)flowParamCache.clear();flowParamCache.set(n.expr,v)}return v?FLOW_BIF_H:0}
const flowBifCache=new Map();
function flowBifData(f,n,cols){const key=[n.expr,n.pmin,n.pmax,n.xmin,n.xmax,cols].join("|");let D=flowBifCache.get(key);if(D)return D;D=[];
  for(let c=0;c<cols;c++){const r=n.pmin+(n.pmax-n.pmin)*(c+.5)/cols,fx=x=>f(x,r),rs=findRoots(fx,n.xmin,n.xmax,500);
    rs.forEach(x=>D.push([c,x,classifyFlow(f,x,r,n.xmax-n.xmin)]))}
  if(flowBifCache.size>16)flowBifCache.clear();flowBifCache.set(key,D);return D}
drawFlow=(inner=>function(g,W,H,n,F,C,info,cv){if(!F.param)return inner.apply(this,arguments);
  const HB=FLOW_BIF_H,Ht=H-HB;inner.call(this,g,W,Ht,n,F,C,info,cv);
  const m={l:46,r:14,t:14,b:26},P=mkPanel(m.l,Ht+m.t,W-m.l-m.r,HB-m.t-m.b,[n.pmin,n.pmax],[n.xmin,n.xmax]),d=cv.closest(".figc"),pl=F.param==="mu"?"μ":F.param;
  if(d&&d._pm==="pred"){hiddenPanel(g,P,C,t("bifurcation diagram: hidden while you predict"));return}
  drawAxes(g,P,C,pl,"fixed points x*");const cols=Math.max(80,Math.min(420,Math.round(P.w/2))),D=flowBifData(F.f,n,cols),cw=P.w/cols;
  g.save();clipTo(g,P);
  for(const [c,x,k] of D){const X=P.x+(c+.5)*cw,Y=P.Y(x);
    if(k==="stable"){g.fillStyle=C.good;g.fillRect(X-cw*.6,Y-1.4,cw*1.2,2.8)}
    else if(k==="unstable"){if(c%3===2)continue;g.fillStyle=C.again;g.fillRect(X-cw*.6,Y-1,cw*1.2,2)}
    else{g.fillStyle=C.half;g.beginPath();g.arc(X,Y,1.8,0,7);g.fill()}}
  const X=P.X(n.p);g.strokeStyle=C.accent;g.lineWidth=1.5;g.beginPath();g.moveTo(X,P.y);g.lineTo(X,P.y+P.h);g.stroke();
  g.fillStyle=C.accent;g.font="600 11px Verdana, sans-serif";g.textBaseline="top";g.textAlign=X>P.x+P.w-70?"right":"left";g.fillText(pl+" = "+fmt(n.p),X+(g.textAlign==="right"?-5:5),P.y+4);
  g.restore();
  g.save();g.font="11px Verdana, sans-serif";g.textBaseline="top";g.textAlign="right";
  g.fillStyle=C.good;g.fillText(t("━ stable"),P.x+P.w-90,P.y+P.h-16);g.fillStyle=C.again;g.fillText(t("╍ unstable"),P.x+P.w-6,P.y+P.h-16);g.restore();
  (cv._panels||(cv._panels=[])).push({...P,role:"param",hasParam:true})})(drawFlow);

