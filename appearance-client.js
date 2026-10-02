import {glassAppearance,glassBackground,labelAppearance,regionColors} from './appearance-model.js';

const glassSelector='.desktop-canvas>.widget-card,.desktop-canvas>.folder-tile:not(.compact),.top-actions,#searchTrigger';
const labelSelector='.desktop-canvas>.app-shortcut>a>.app-name,.desktop-canvas>.folder-tile.compact>.app-name,.top-context';
const presetColors={sunny:[190,216,211],peach:[236,223,216],sage:[184,211,196],night:[66,88,117]};
export class WallpaperAppearance{
  constructor(wall,shell){
    this.wall=wall;this.shell=shell;this.images=new Map();this.source='';this.preset='sunny';this.canvas=document.createElement('canvas');
    this.context=this.canvas.getContext('2d',{willReadFrequently:true});this.version=0;
    window.addEventListener('resize',()=>{this.pixelKey='';this.schedule(140);},{passive:true});
    shell.addEventListener('transitionend',event=>{if(event.target.matches('#pageTrack,.app-shortcut,.folder-tile,.widget-card'))this.schedule(40);});
    document.fonts?.ready.then(()=>this.schedule(60));
  }
  async setWallpaper(preset,src=''){
    if(preset==='sunny')src=new URL('./assets/sunny-town.png',import.meta.url).href;
    const key=`${preset}:${src}`;if(key===this.source)return;
    this.source=key;this.preset=preset;this.image=null;this.pixelKey='';const version=++this.version;
    this.shell.dataset.wallpaperTone=preset==='night'?'dark':'light';this.schedule(30);
    if(!src||!this.context)return;
    try{
      let promise=this.images.get(src);
      if(!promise){promise=new Promise((resolve,reject)=>{
        const image=new Image(),timer=setTimeout(()=>{image.src='';reject(Error('appearance_timeout'));},6500);
        image.crossOrigin='anonymous';image.referrerPolicy='no-referrer';image.decoding='async';
        image.onload=()=>{clearTimeout(timer);image.naturalWidth?resolve(image):reject(Error('appearance_empty'));};image.onerror=()=>{clearTimeout(timer);reject(Error('appearance_image'));};image.src=src;
      });this.images.set(src,promise);if(this.images.size>3)this.images.delete(this.images.keys().next().value);}
      const image=await promise;if(version!==this.version)return;
      this.image=image;this.pixelKey='';this.schedule(30);
    }catch{if(version===this.version)this.schedule(30);}
  }
  schedule(delay=60){clearTimeout(this.timer);clearTimeout(this.settleTimer);this.timer=setTimeout(()=>this.update(),delay);this.settleTimer=setTimeout(()=>this.update(),delay+420);}
  pixels(){
    const key=`${this.source}:${innerWidth}:${innerHeight}`;if(this.pixelKey===key)return;
    this.pixelKey=key;this.raw=this.blurred=null;if(!this.image||!this.context)return;
    try{
      const width=192,height=Math.max(1,Math.round(width*innerHeight/innerWidth)),scale=Math.max(innerWidth/this.image.naturalWidth,innerHeight/this.image.naturalHeight);
      const sourceWidth=innerWidth/scale,sourceHeight=innerHeight/scale;
      this.canvas.width=width;this.canvas.height=height;const ctx=this.context;
      ctx.filter='none';ctx.fillStyle='#aed6e9';ctx.fillRect(0,0,width,height);
      ctx.drawImage(this.image,(this.image.naturalWidth-sourceWidth)/2,(this.image.naturalHeight-sourceHeight)/2,sourceWidth,sourceHeight,0,0,width,height);
      // Match the wallpaper wash, so caption ink is chosen against the visible image.
      const wash=ctx.createLinearGradient(0,0,0,height);wash.addColorStop(0,'rgba(244,250,247,.18)');wash.addColorStop(.44,'rgba(235,248,247,.12)');wash.addColorStop(1,'rgba(22,43,54,.1)');ctx.fillStyle=wash;ctx.fillRect(0,0,width,height);
      this.raw=ctx.getImageData(0,0,width,height);
      const copy=document.createElement('canvas');copy.width=width;copy.height=height;copy.getContext('2d').putImageData(this.raw,0,0);
      ctx.filter=`blur(${Math.max(1,26*width/innerWidth)}px)`;ctx.drawImage(copy,0,0);ctx.filter='none';this.blurred=ctx.getImageData(0,0,width,height);
    }catch{this.raw=this.blurred=null;}
  }
  colors(node,glass=false){
    const rect=node.getBoundingClientRect();if(rect.right<=0||rect.left>=innerWidth||rect.bottom<=0||rect.top>=innerHeight||!rect.width||!rect.height)return null;
    const pixels=glass?this.blurred:this.raw;
    if(!pixels)return presetColors[this.preset]?[presetColors[this.preset]]:[];
    const ratio=pixels.width/innerWidth;
    return regionColors(pixels,{x:rect.x*ratio,y:rect.y*ratio,width:rect.width*ratio,height:rect.height*ratio});
  }
  copyAppearance(origin,copy){
    // A seed/drag clone has different ancestors; preserve the source's typography.
    const sources=[origin,...origin.querySelectorAll('*')],copies=[copy,...copy.querySelectorAll('*')];
    sources.forEach((node,index)=>{if(!copies[index])return;const style=getComputedStyle(node);for(const property of ['font-size','font-weight','line-height','letter-spacing','color','text-shadow'])copies[index].style.setProperty(property,style.getPropertyValue(property));});
    if(!origin.dataset.surfaceTone)return;
    const style=getComputedStyle(origin),tone=origin.dataset.surfaceTone,opacity=parseFloat(style.getPropertyValue('--surface-alpha'));
    const colors=this.colors(origin,true)||[],average=colors.length?colors.reduce((sum,rgb)=>sum.map((value,index)=>value+rgb[index]/colors.length),[0,0,0]):[128,128,128];
    copy.style.backgroundColor=`rgb(${glassBackground(average,tone,opacity).map(Math.round).join(' ')})`;
    copy.style.backgroundImage=style.backgroundImage;copy.style.borderColor=style.borderColor;copy.style.backdropFilter='none';copy.style.webkitBackdropFilter='none';
  }
  update(){
    this.pixels();
    for(const node of this.shell.querySelectorAll(glassSelector)){
      const colors=this.colors(node,true);if(colors===null)continue;const {tone,opacity}=glassAppearance(colors);
      if(node.dataset.surfaceTone!==tone)node.dataset.surfaceTone=tone;
      if(node.style.getPropertyValue('--surface-alpha')!==String(opacity))node.style.setProperty('--surface-alpha',opacity);
    }
    for(const node of this.shell.querySelectorAll(labelSelector)){
      const colors=this.colors(node);if(colors===null)continue;const {tone,busy}=labelAppearance(colors,node.dataset.labelTone);
      if(node.dataset.labelTone!==tone)node.dataset.labelTone=tone;
      const detail=busy?'busy':'calm';if(node.dataset.labelDetail!==detail)node.dataset.labelDetail=detail;
    }
  }
}
