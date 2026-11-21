// Recommendations are computed from this virtual tooth, not clinical angle/depth norms.
export function planEarlyExcavation(volume,radius=.65,{beyondIntro=false}={}){
 const stats=volume.stats(),goal=Math.min(10,volume.initialCaries*volume.meta.step**3);
 if(!beyondIntro&&stats.removedVolume>=goal)return null;
 if(stats.critical)return {status:'stop',title:'Остановите обработку',reason:'Обнаружен контакт с пульпой. Не увеличивайте подачу; откройте разбор результата.'};
 const {size:[nx,ny,nz],origin,step,lesionCenter}=volume.meta,data=volume.data,base=volume.base;
 let best=null;const clearance=radius+.25,cells=Math.ceil(clearance/step);
 for(let z=1;z<nz-1;z++)for(let x=1;x<nx-1;x++){
  let top=-1,original=-1;
  for(let y=ny-2;y>=1;y--){const i=x+nx*(y+ny*z);if(original<0&&base[i])original=y;if(top<0&&data[i])top=y;if(original>=0&&top>=0)break;}
  if(top<0||data[x+nx*(top+ny*z)]!==3)continue;
  const point=[origin[0]+x*step,origin[1]+top*step+.12,origin[2]+z*step];
  const depth=Math.max(0,Math.floor(((original-top)*step-.12)*10)/10);if(depth>4.8)continue;
  // The proposed centre includes the same initial-surface depth convention as the UI.
  point[1]=origin[1]+original*step-depth;
  let caries=0,healthy=0,pulp=false;
  for(let dz=-cells;dz<=cells&&!pulp;dz++)for(let dy=-cells;dy<=cells&&!pulp;dy++)for(let dx=-cells;dx<=cells;dx++){
   const xx=x+dx,yy=top+dy,zz=z+dz;if(xx<0||xx>=nx||yy<0||yy>=ny||zz<0||zz>=nz)continue;
   const d=(origin[0]+xx*step-point[0])**2+(origin[1]+yy*step-point[1])**2+(origin[2]+zz*step-point[2])**2;
   const tissue=data[xx+nx*(yy+ny*zz)];if(tissue===4&&d<clearance**2){pulp=true;break;}
   if(d<=radius**2){if(tissue===3)caries++;else if(tissue===1||tissue===2)healthy++;}
  }
  if(pulp||caries===0)continue;
  const score=caries-healthy*4-Math.hypot(point[0]-lesionCenter[0],point[2]-lesionCenter[2])*.05;
  if(!best||score>best.score)best={score,point,depth,caries,healthy};
 }
 if(!best)return {status:'inspect',title:'Сначала осмотрите полость',reason:'Видимая поверхность не даёт точки для дальнейшего прохода с запасом до пульпы. Не углубляйтесь ради счётчика: измените обзор и оцените границу обработки.'};
 return {status:'work',title:goal<10?'Первое препарирование · короткие проходы':'Первые 10 мм³ · короткие проходы',goal,point:best.point,depth:best.depth,tilt:0,yaw:0,increment:.1,removed:stats.removedVolume,reason:best.healthy?'Работайте у отмеченной точки коротко: рядом находятся непоражённые ткани.':'Сначала обработайте отмеченный открытый участок поражения.'};
}
export function earlyGuideSteps(plan){
 if(!plan)return null;
 if(plan.status!=='work')return [{title:plan.title,text:plan.reason,target:plan.status==='stop'?'#finish-button':'#top-view'}];
 const depth=plan.depth.toFixed(1);
 return [
 {title:'Посмотрите сверху',text:'Перейдите к виду сверху, чтобы видеть вход в полость. Для стенок слегка поверните модель ПКМ; не работайте там, где наконечник закрыт краем зуба.',target:'#top-view'},
 {title:'Найдите следующую точку',text:plan.reason+' Стрелка перестраивается по оставшимся тканям.',target:'early'},
 {title:'Выставьте бор',text:'Для отмеченной точки модели начните с наклона 0° и поворота 0°. Зафиксируйте оси; при осмотре стенки проверяйте, что рабочая часть не касается её здорового края.',target:'#early-settings'},
 {title:'Подача от исходной поверхности',text:`Для следующего прохода ориентир ${depth} мм. Подача отсчитывается от исходной поверхности, а не от дна уже сформированной полости.`,target:'#depth'},
 {title:'Углубляйтесь постепенно',text:'После короткого прохода отпустите ЛКМ и осмотрите результат. Если открытая поражённая ткань остаётся под рабочей частью, добавляйте по 0,1 мм; при изменении точки сверяйте новый ориентир. Не углубляйтесь в область пульпы.',target:'early'}
 ];
}
