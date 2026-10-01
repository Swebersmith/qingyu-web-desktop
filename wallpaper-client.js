import {bingImageID,bingImageURL,bingProxyURL} from './wallpaper-model.js';
function loadImage(src){return new Promise((resolve,reject)=>{const image=new Image(),timer=setTimeout(()=>{image.src='';reject(Error('wallpaper_timeout'));},12000);image.referrerPolicy='no-referrer';image.onload=()=>{clearTimeout(timer);image.naturalWidth?resolve():reject(Error('empty_wallpaper'));};image.onerror=()=>{clearTimeout(timer);reject(Error('wallpaper_image'));};image.src=src;});}
export async function loadDailyBing({cached,day,force=false,origin=location.origin,fetcher=fetch,imageLoader=loadImage}={}){
 let data=cached&&bingImageID(cached.url)&&cached.date===day&&!force?cached:null;
 if(!data){const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),12000);try{const response=await fetcher('/api/wallpaper/bing',{signal:controller.signal,...(force?{cache:'reload'}:{})});if(!response.ok)throw Error('bing_metadata');data=await response.json();if(!bingImageID(data.url)||!/^\d{4}-\d{2}-\d{2}$/.test(data.date||''))throw Error('invalid_wallpaper');}catch(error){if(cached&&bingImageID(cached.url))data=cached;else throw error;}finally{clearTimeout(timer);}}
 const id=bingImageID(data.url),value={url:bingImageURL(id),date:data.date,copyright:String(data.copyright||'Bing 每日一图').slice(0,200)};
 for(const src of [bingProxyURL(value.url,origin),value.url,value.url.replace('cn.bing.com','www.bing.com')])try{await imageLoader(src);return {value,src};}catch{}
 throw Error('wallpaper_unavailable');
}
