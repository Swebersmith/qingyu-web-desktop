const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
export const GLASS_PALETTES={
  light:{ink:[25,51,62],muted:[45,71,83],tint:[248,252,250],brightness:1.04},
  dark:{ink:[246,251,255],muted:[226,237,242],tint:[18,32,42],brightness:.72}
};
export function luminance(rgb){return rgb.slice(0,3).reduce((sum,value,index)=>{const channel=clamp(value,0,255)/255;return sum+(channel<=.04045?channel/12.92:((channel+.055)/1.055)**2.4)*[.2126,.7152,.0722][index];},0);}
export function contrastRatio(a,b){const first=luminance(a),second=luminance(b);return (Math.max(first,second)+.05)/(Math.min(first,second)+.05);}
export function regionColors(pixels,rect){
  if(!pixels?.data||pixels.width<1||pixels.height<1)return [];
  const x=clamp(Math.floor(rect.x),0,pixels.width-1),y=clamp(Math.floor(rect.y),0,pixels.height-1);
  const right=clamp(Math.ceil(rect.x+rect.width),x+1,pixels.width),bottom=clamp(Math.ceil(rect.y+rect.height),y+1,pixels.height);
  const stepX=Math.max(1,Math.floor((right-x)/16)),stepY=Math.max(1,Math.floor((bottom-y)/16)),colors=[];
  for(let row=y;row<bottom;row+=stepY)for(let column=x;column<right;column+=stepX){const index=(row*pixels.width+column)*4;if(pixels.data[index+3]>240)colors.push([...pixels.data.slice(index,index+3)]);}
  return colors;
}
function summary(colors){
  const list=colors.length?colors:[[146,159,170]],levels=list.map(luminance).sort((a,b)=>a-b);
  return {average:list.reduce((sum,rgb)=>sum+luminance(rgb),0)/list.length,spread:levels[Math.ceil((levels.length-1)*.9)]-levels[Math.floor((levels.length-1)*.1)]};
}
export function labelAppearance(colors,previousTone){
  const stats=summary(colors),background=colors.length?colors.reduce((sum,rgb)=>sum.map((value,index)=>value+rgb[index]/colors.length),[0,0,0]):[80,100,118];
  const scores={dark:contrastRatio(GLASS_PALETTES.light.ink,background),light:contrastRatio(GLASS_PALETTES.dark.ink,background)};
  let tone=scores.dark>=scores.light?'dark':'light';
  if(previousTone in scores&&scores[previousTone]*1.15>=scores[tone])tone=previousTone;
  return {tone,busy:!colors.length||stats.spread>.22};
}
export function glassBackground(rgb,tone,opacity){const palette=GLASS_PALETTES[tone];return rgb.map((value,index)=>palette.tint[index]*opacity+clamp(value*palette.brightness,0,255)*(1-opacity));}
export function glassAppearance(colors){
  const list=colors.length?colors:[[0,0,0],[255,255,255]],stats=summary(list);
  const preferred=stats.average<.29?'dark':'light';
  const opacityFor=tone=>{
    const palette=GLASS_PALETTES[tone];let opacity=tone==='dark'?.28:.30;
    // Use the whole sampled region: a bright or dark patch may sit under a small caption.
    while(opacity<.76&&list.some(rgb=>contrastRatio(palette.muted,glassBackground(rgb,tone,opacity))<5.1))opacity+=.02;
    return +Math.min(.76,opacity).toFixed(2);
  };
  let tone=preferred,opacity=opacityFor(tone);
  if(opacity>.68){const other=tone==='dark'?'light':'dark',alternative=opacityFor(other);if(alternative<opacity){tone=other;opacity=alternative;}}
  return {tone,opacity};
}
