export function normalizeProgress(value){
  const total=Number.isFinite(Number(value?.total))?Math.min(100000,Math.max(1,Number(value.total))):6;
  const current=Number.isFinite(Number(value?.value))?Math.min(total,Math.max(0,Number(value.value))):Math.min(4,total);
  return {value:current,total,unit:String(value?.unit||'个目标').slice(0,16)};
}
export function progressSummary(value){const progress=normalizeProgress(value);return {...progress,percent:Math.round(progress.value/progress.total*100)};}
export function monthGrid(year,month){
  const date=new Date(year,month,1),normalizedYear=date.getFullYear(),normalizedMonth=date.getMonth(),offset=(date.getDay()+6)%7,count=new Date(normalizedYear,normalizedMonth+1,0).getDate();
  return {year:normalizedYear,month:normalizedMonth,cells:Array.from({length:Math.ceil((offset+count)/7)*7},(_,index)=>index>=offset&&index<offset+count?index-offset+1:null)};
}
export function weatherInfo(code){
  if([95,96,99].includes(code))return {label:'雷雨',symbol:'⛈️'};
  if([71,73,75,77,85,86].includes(code))return {label:'雪',symbol:'❄️'};
  if([51,53,55,56,57,61,63,65,66,67,80,81,82].includes(code))return {label:'雨',symbol:'🌧️'};
  if([45,48].includes(code))return {label:'雾',symbol:'🌫️'};
  if([2,3].includes(code))return {label:'多云',symbol:'⛅'};
  if([0,1].includes(code))return {label:'晴',symbol:'☀️'};
  return {label:'未知',symbol:'☁️'};
}
