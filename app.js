import * as THREE from 'three';
import {OrbitControls} from './vendor/OrbitControls.js';
import {GLTFLoader} from './vendor/GLTFLoader.js';
import {ToothVolume} from './volume.js';
import {surfaceNets} from './mesher.js';
const $=id=>document.getElementById(id);
const STORAGE='dentalab.caries.v1';
const SOURCES=[
 {title:'Кариесология и заболевания твёрдых тканей зубов — Пироговский университет',url:'https://rsmu.ru/fileadmin/templates/DOC/Discipliny/Stomatology/Rab_prog_disciplines/RP_Kariesologija_i_zabol_tverdykh_tkanei_zubov.pdf',scope:'Российская учебная основа: обследование, показания, лечение и осложнения. Опубликованная программа; актуальность учебного плана уточняется.'},
 {title:'ADA · Restorative Treatments for Caries Lesions, 2023',url:'https://www.ada.org/resources/research/science/evidence-based-dental-research/caries-management-clinical-practice-guidelines/evidence-based-clinical-practice-guideline-on-restorative-treatments-for-caries-lesions',scope:'Выбор подхода к удалению кариозных тканей и прямых реставрационных материалов. Не задаёт универсальные углы или глубину препарирования.'},
 {title:'IADT · Guidelines for traumatic dental injuries, 2020',url:'https://iadt-dentaltrauma.org/guidelines-and-resources/current-guidelines-2/',scope:'Источник для планируемого сценария скола зуба; в текущем случае травма не моделируется.'},
 {title:'AAOMS · Management of Third Molar Teeth',url:'https://aaoms.org/wp-content/uploads/2024/03/management_third_molar_white_paper.pdf',scope:'Источник для планируемого хирургического случая; операция в этой версии не реализована.'}
];
const names={inspect:'Зеркало / осмотр',round:'Шаровидный бор',fissure:'Фиссурный бор',composite:'Внесение композита',light:'Полимеризационная лампа',polish:'Финирование реставрации'};
const descriptions=[['Обследование','Изучите карту пациента и выберите план лечения.'],['Подготовка','Обеспечьте изоляцию рабочего поля перед вмешательством.'],['Препарирование','Работайте короткими контролируемыми движениями. Сохраняйте здоровые ткани.'],['Восстановление','Заполните подготовленный дефект, затем полимеризуйте материал.'],['Контроль результата','Оцените оставшийся дефект, материал и повреждения тканей.']];
let volume,meta,renderer,scene,camera,controls,tooth,reference,toolGroup,head,shaft,lesionMesh,pulpMesh,fullMouth,mouthHighlight,mouthWork;
let stage=0,diagnosed=false,isolated=false,tool='inspect',powered=false,view='tooth',mode='learn',showRoots=false,section=false,showLesion=false;
let cursor=null,previous=null,pressing=false,pointerInside=false,worker,busy=false,pending=false,meshRevision=0,history=[],timer,lastTick=0,saveTimer,dirty=false,lightTime=0,statsCache,lastStats=0,lastGate='';
let isReady=false;
const axis=new THREE.Vector3(0,-1,0),ray=new THREE.Raycaster(),mouse=new THREE.Vector2(),normal=new THREE.Vector3(0,1,0);
const clips={crown:new THREE.Plane(new THREE.Vector3(0,1,0),.55),section:new THREE.Plane(new THREE.Vector3(0,0,-1),0)};
function toast(text,error=false){$('toast').textContent=text;$('toast').classList.toggle('error',error);$('toast').hidden=false;clearTimeout(timer);timer=setTimeout(()=>$('toast').hidden=true,4500);}
function modal(html){$('modal-content').innerHTML=html;if(!$('modal').open)$('modal').showModal();setPower(false);stopStroke();}
function sourceList(){return SOURCES.map(s=>`<div class="source-card"><a href="${s.url}" target="_blank" rel="noopener noreferrer">${s.title}</a><p>${s.scope}</p></div>`).join('');}
function sources(){modal(`<span class="modal-eyebrow">МЕДИЦИНСКАЯ ОСНОВА</span><h2>Почему так?</h2><p>У каждой клинической подсказки есть основание. Библиография доступна без передачи ваших действий внешним сервисам.</p>${sourceList()}<h3>Что требует проверки</h3><p>Реконструкция пульпы, границы учебного поражения, допустимость обработки и критерии завершения ожидают экспертной валидации. Геометрические миллиметры приблизительны: масштаб исходной модели не подтверждён.</p><p>Время полимеризации в прототипе условное. В клинике оно зависит от материала, лампы и инструкции производителя. Нагрев, давление, анестезия и биологический ответ тканей пока не рассчитываются.</p><div class="clinical-status">Список источников проверен 20.11.2026. Полные тексты учебников в проект не копируются. Перед клинической валидацией требуется сверка с действующим рубрикатором Минздрава РФ.</div>`);}
function patient(){modal(`<span class="modal-eyebrow">КЛИНИЧЕСКИЙ СЛУЧАЙ 01</span><h2>Кариес жевательной поверхности</h2><p>Виртуальный взрослый пациент. Кратковременная чувствительность от сладкого и холодного; самопроизвольной и ночной боли не описывает.</p><h3>Учебные условия</h3><ul><li>Постоянный жевательный зуб с локальным кавитированным поражением.</li><li>Для этого сценария жизнеспособность пульпы условно сохранена, апикальные изменения не заданы.</li><li>Достоверного снимка и результатов тестов в этой версии нет. Диагностические условия заданы автором случая.</li><li>Нумерация FDI и точный анатомический масштаб исходной модели не подтверждены.</li></ul><h3>План занятия</h3><p>Оценить исходные условия, подготовить поле, освоить контроль бора и восстановить учебный дефект. Это тренировка геометрии и последовательности, без постановки диагноза реальному пациенту.</p><div class="warning-box">История болезни вымышленная. Внутренняя анатомия реконструирована и ожидает проверки экспертом.</div><div class="modal-actions"><button id="choose-plan">Принять учебный план</button><button id="patient-sources">Источники</button></div>`);
 $('choose-plan').onclick=()=>{diagnosed=true;setStage(1);$('modal').close();markDirty();toast('Учебный план выбран. Подготовьте рабочее поле.');};$('patient-sources').onclick=sources;}
function renderStage(){
 $('stage-count').textContent=`${stage+1} / 5`;$('current-number').textContent=String(stage+1).padStart(2,'0');$('stage-title').textContent=descriptions[stage][0];$('stage-description').textContent=descriptions[stage][1];
 document.querySelectorAll('[data-stage]').forEach(b=>{const n=+b.dataset.stage;b.classList.toggle('active',n===stage);b.classList.toggle('done',(n===0&&diagnosed)||(n===1&&isolated));b.setAttribute('aria-current',n===stage?'step':'false');});
 const s=volume?.stats();
 const content=[
  `<div class="stage-box"><p>Планируем восстановление кавитированного поражения при заданной сохранённой жизнеспособности пульпы.</p><button id="open-patient">Изучить случай и выбрать план</button></div>`,
  `<div class="stage-box"><label class="check-row"><input id="isolation-check" type="checkbox" ${isolated?'checked':''}>Изолировать рабочее поле</label><p>В этой версии изоляция задаётся условно. Установка коффердама вручную пока не моделируется.</p><button id="begin-prep">Перейти к препарированию</button></div>`,
  `<div class="stage-box"><div class="stat-line"><span>Учебный объём поражения</span><strong id="remaining-label">${s?.remainingPercent.toFixed(0)}%</strong></div><div class="progress-track"><div id="remaining-bar" style="width:${s?.remainingPercent||0}%"></div></div><p>Индикатор показывает заданный объём, а не универсальную клиническую границу удаления.</p><button id="begin-restore">Оценить дефект и восстановить</button></div>`,
  `<div class="stage-box"><p>Композит добавляется только в удалённый объём зуба. Подведите наконечник к дефекту и регулируйте подачу.</p><p>Для лампы: удерживайте ЛКМ рядом с реставрацией 5 секунд. Время условное; моделирование послойности ещё не реализовано.</p><button id="begin-control">Проверить результат</button></div>`,
  `<div class="stage-box"><p>Сравните сохранность тканей и заполнение дефекта. Клиническая оценка краевого прилегания и окклюзии в этой версии не выполняется.</p><button id="open-report">Открыть подробный разбор</button></div>`
 ];$('stage-content').innerHTML=content[stage];
 $('open-patient')?.addEventListener('click',patient);
 $('isolation-check')?.addEventListener('change',e=>{isolated=e.target.checked;markDirty();updateIsolation();});
 $('begin-prep')?.addEventListener('click',()=>{if(!diagnosed){toast('Сначала изучите карту случая.',true);return;}if(!isolated){toast('Подтвердите изоляцию рабочего поля.',true);return;}setStage(2);selectTool('round');});
 $('begin-restore')?.addEventListener('click',()=>{setStage(3);selectTool('composite');});
 $('begin-control')?.addEventListener('click',()=>{setStage(4);selectTool('inspect');});$('open-report')?.addEventListener('click',report);
 if(mode==='exam'&&stage===2){$('remaining-label').textContent='Скрыт';$('remaining-bar').style.width='0%';}
 updateHint();
}
function setStage(n){stopStroke();setPower(false);stage=n;renderStage();markDirty();}
function setPower(value){powered=!!value&&tool!=='inspect'&&view==='tooth';$('power-button').classList.toggle('on',powered);$('power-button').setAttribute('aria-pressed',String(powered));$('power-button').querySelector('span:nth-child(2)').textContent=powered?'Инструмент включён':'Включить инструмент';$('power-status').textContent=powered?'Включён':'Выключен';$('power-status').className=powered?'good':'';if(!powered){previous=null;lightTime=0;}updateInstrument();}
function selectTool(value){stopStroke();tool=value;setPower(false);$('tool-name').textContent=names[tool];document.querySelectorAll('[data-tool]').forEach(b=>{b.classList.toggle('active',b.dataset.tool===tool);b.setAttribute('aria-pressed',String(b.dataset.tool===tool));});if(controls)controls.mouseButtons.LEFT=tool==='inspect'?THREE.MOUSE.ROTATE:undefined;updateInstrument();updateHint();}
function updateHint(){
 if(!volume)return;const s=statsCache||volume.stats();let hint;
 if(s.critical)hint='Обнаружен контакт с реконструированной пульпой или её вскрытие. Прекратите обработку и разберите ошибку. Реальный случай требует пересмотра лечения.';
 else if(!diagnosed)hint='Начните с обследования. Метод лечения выбирают после оценки состояния зуба и пульпы.';
 else if(!isolated)hint='Подготовьте рабочее поле. В прототипе изоляция задаётся переключателем и не оценивает реальную установку коффердама.';
 else if(!$('cooling').checked&&['round','fissure'].includes(tool))hint='Охлаждение выключено. Система фиксирует работу без воды; достоверная модель нагрева тканей пока отсутствует.';
 else if(tool==='composite')hint='Перед реставрацией оцените состояние подготовленной полости. Адгезивный протокол зависит от выбранной системы и инструкции производителя; здесь он ещё не моделируется.';
 else if(tool==='light')hint='Подведите лампу к материалу и включите её. Учебный таймер 5 секунд демонстрирует смену состояния; это не клиническая экспозиция.';
 else if(s.healthyVolume>3)hint='Удалён заметный объём непоражённых тканей. Оцените траекторию, размер рабочей части и глубину подачи.';
 else hint='Объём удаления зависит от глубины поражения и выбранной тактики. Не ориентируйтесь только на цвет: тёмная ткань сама по себе не задаёт границу обработки.';
 $('hint-text').textContent=mode==='exam'?'Подсказки скрыты. Вы можете открыть базу знаний или завершить попытку и посмотреть разбор.':hint;
}
function geometry(mesh){const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(mesh.positions,3));g.setAttribute('color',new THREE.BufferAttribute(mesh.colors,3));g.setIndex(new THREE.BufferAttribute(mesh.indices,1));g.computeVertexNormals();g.computeBoundingSphere();return g;}
function requestMesh(){if(!worker)return;if(busy){pending=true;return;}busy=true;worker.postMessage({volume:volume.data.slice(),meta,request:++meshRevision});}
function updateClip(){if(!tooth)return;tooth.material.clippingPlanes=[...(!showRoots?[clips.crown]:[]),...(section?[clips.section]:[])];tooth.material.needsUpdate=true;reference.material.clippingPlanes=tooth.material.clippingPlanes;
 if(pulpMesh){pulpMesh.visible=section&&view==='tooth';pulpMesh.material.clippingPlanes=showRoots?[]:[clips.crown];}if(lesionMesh)lesionMesh.visible=showLesion&&mode==='learn'&&view==='tooth';
}
function updateIsolation(){const cuff=scene?.getObjectByName('isolation');if(cuff)cuff.visible=isolated&&view==='tooth';}
function updateInstrument(){if(!toolGroup)return;
 toolGroup.visible=view==='tooth'&&tool!=='inspect'&&cursor!==null&&!$('modal').open;
 const tilt=+$('tilt').value*Math.PI/180,yaw=+$('yaw').value*Math.PI/180;
 axis.set(Math.sin(tilt)*Math.sin(yaw),-Math.cos(tilt),Math.sin(tilt)*Math.cos(yaw));
 if(cursor)toolGroup.position.copy(cursor).addScaledVector(axis,+$('depth').value);
 toolGroup.quaternion.setFromUnitVectors(normal,axis.clone().negate());
 const radius=+$('radius').value;
 head.visible=true;head.geometry.dispose();
 head.geometry=tool==='fissure'?new THREE.CylinderGeometry(radius,radius,1.8,20):new THREE.SphereGeometry(tool==='light'?1.1:radius,20,14);
 head.position.y=tool==='fissure'?.9:0;
 head.material.color.set(tool==='composite'?0x9dc7ba:tool==='light'?0x4b9be7:tool==='polish'?0xbfa2ab:0x929e9b);
 head.material.emissive.set(tool==='light'&&powered?0x285dba:0x000000);shaft.material.color.set(tool==='light'?0x407489:tool==='composite'?0x5c9b8d:0xb3bfbc);
 $('live-depth').innerHTML=`${(+$('depth').value).toFixed(1)} <small>мм</small>`;
}
function setView(next){stopStroke();setPower(false);view=next;document.querySelectorAll('[data-view]').forEach(b=>b.classList.toggle('selected',b.dataset.view===view));tooth.visible=view==='tooth';toolGroup.visible=false;
 if(fullMouth)fullMouth.visible=view==='mouth';if(mouthWork)mouthWork.visible=view==='mouth';if(mouthHighlight)mouthHighlight.visible=view==='mouth';
 if(view==='mouth'&&!fullMouth)loadMouth();
 $('scene-title').childNodes[0].textContent=view==='mouth'?'Полость рта':'Окклюзионная поверхность';$('scene-description').textContent=view==='mouth'?'Выделен зуб текущего учебного случая':'Моляр, выделенный из исходной модели';
 $('tool-dock').style.opacity=view==='mouth'?'.45':'1';$('hover-info').textContent=view==='mouth'?'Осмотрите модель · вернитесь к рабочему зубу для лечения':'Наведите инструмент на зуб';
 updateClip();updateIsolation();resetCamera();
}
function resetCamera(top=false){if(view==='mouth'){camera.position.set(0,62,180);controls.target.set(0,-22,7);controls.minDistance=80;controls.maxDistance=350;}else{camera.position.set(top?.01:16,top?33:27,top?.01:26);controls.target.set(0,2.2,0);controls.minDistance=10;controls.maxDistance=65;}controls.update();}
async function loadMouth(){
 try{const gltf=await new GLTFLoader().loadAsync('./assets/human_mouth_detailed.glb');fullMouth=gltf.scene;fullMouth.scale.multiplyScalar(365.8);fullMouth.traverse(o=>{if(o.isMesh){o.material.envMapIntensity=.8;if(o.material.transmission){o.material.transmission=.12;o.material.opacity=.18;o.material.transparent=true;o.material.depthWrite=false;}}});fullMouth.visible=view==='mouth';scene.add(fullMouth);
  const selected=new Set(reference.userData.sourceVertices);fullMouth.traverse(o=>{if(o.isMesh&&o.material.name==='teeth'){const g=o.geometry.clone();const idx=Array.from(g.index.array),keep=[];for(let i=0;i<idx.length;i+=3)if(!selected.has(idx[i]))keep.push(idx[i],idx[i+1],idx[i+2]);g.setIndex(keep);o.geometry=g;}});
  mouthWork=new THREE.Mesh(tooth.geometry.clone(),tooth.material.clone());mouthWork.material.clippingPlanes=[];mouthWork.position.set(meta.sourceCenter[0]*850,meta.sourceCenter[1]*850-5.5,meta.sourceCenter[2]*850);mouthWork.visible=view==='mouth';scene.add(mouthWork);
  const g=reference.geometry.clone();const pos=g.attributes.position;const c=meta.sourceCenter;for(let i=0;i<pos.count;i++)pos.setXYZ(i,pos.getX(i)+c[0]*850,pos.getY(i)-5.5+c[1]*850,pos.getZ(i)+c[2]*850);g.computeVertexNormals();
  mouthHighlight=new THREE.Mesh(g,new THREE.MeshStandardMaterial({color:0x4b9c85,transparent:true,opacity:.15,wireframe:true,roughness:.4,depthWrite:false}));mouthHighlight.scale.setScalar(1.015);mouthHighlight.visible=view==='mouth';scene.add(mouthHighlight);
 }catch(e){toast('Не удалось загрузить полость рта. Рабочий зуб доступен; повторите переключение.',true);console.error(e);}
}
function movePointer(event){if(!isReady||view!=='tooth')return;const rect=renderer.domElement.getBoundingClientRect();mouse.set((event.clientX-rect.left)/rect.width*2-1,-(event.clientY-rect.top)/rect.height*2+1);ray.setFromCamera(mouse,camera);const hits=ray.intersectObject(reference,false).filter(h=>showRoots||h.point.y>-.55);
 if(hits.length){cursor=hits[0].point.clone();pointerInside=true;$('hover-info').textContent=tool==='inspect'?'Поверхность зуба · ПКМ или ЛКМ — вращение':`${names[tool]} · ${powered?'включён':'выключен'} · подача ${(+ $('depth').value).toFixed(1)} мм`;}
 else{cursor=null;pointerInside=false;previous=null;if(pressing)stopStroke();$('hover-info').textContent='Наведите инструмент на зуб';}updateInstrument();}
function snapshot(){history.push({data:volume.data.slice(),metrics:{...volume.metrics}});if(history.length>18)history.shift();$('undo-button').disabled=false;}
function stopStroke(){pressing=false;previous=null;lightTime=0;lastGate='';if(controls)controls.enabled=true;}
function beginStroke(e){if(e.button!==0||tool==='inspect'||view!=='tooth'||!isReady)return;movePointer(e);if(!cursor)return;
 if(!powered){toast('Включите инструмент кнопкой питания или клавишей Space.');return;}
 if(!diagnosed||!isolated){toast(!diagnosed?'Сначала изучите карту случая и примите учебный план.':'Сначала изолируйте рабочее поле.',true);return;}
 if(section){toast('Отключите учебный разрез перед работой инструментом.');return;}
 snapshot();pressing=true;previous=cursor.clone().addScaledVector(axis,-(+$('radius').value+1));controls.enabled=false;renderer.domElement.setPointerCapture(e.pointerId);lastTick=performance.now();
}
function work(dt){if(!pressing||!powered||!cursor||!pointerInside||view!=='tooth')return;
 const tip=cursor.clone().addScaledVector(axis,+$('depth').value);
 if(tool==='light'){
  const s=volume.stats();if(!s.uncured){if(!lastGate){toast('В полости пока нет неполимеризованного материала.');lastGate='empty';}return;}
  // Only count exposure near the restorative cavity and with the lamp aimed into it.
  const center=new THREE.Vector3(...meta.lesionCenter);if(tip.distanceTo(center)>5||axis.y>-.65){$('hover-info').textContent='Лампа вне зоны реставрации';lightTime=0;return;}
  lightTime+=dt;$('hover-info').textContent=`Учебная полимеризация · ${Math.min(5,lightTime).toFixed(1)} / 5 с`;
  if(lightTime>=5){const cured=volume.cure();stopStroke();requestMesh();updateStats();markDirty();toast(`Материал изменил состояние (${(cured*meta.step**3).toFixed(1)} мм³). Клиническая экспозиция не моделируется.`);}return;
 }
 const options={tool,radius:+$('radius').value,powered,cooling:$('cooling').checked,dt};
 const before=volume.metrics.pulpRemoved;
 const n=volume.stroke((previous||tip).toArray(),tip.toArray(),axis.toArray(),options);previous=tip.clone();
 if(n){requestMesh();markDirty();if(volume.metrics.pulpRemoved>before){toast('Контакт с пульпой. Остановите обработку и разберите результат.',true);setPower(false);stopStroke();} }
}
function undo(){if(!history.length)return;stopStroke();setPower(false);const h=history.pop();volume.data.set(h.data);volume.metrics={...h.metrics};$('undo-button').disabled=!history.length;requestMesh();updateStats();markDirty();toast('Последнее действие отменено.');}
function updateStats(){if(!volume)return;statsCache=volume.stats();const s=statsCache;$('healthy-volume').innerHTML=`${s.healthyVolume.toFixed(1)} <small>мм³</small>`;$('healthy-volume').classList.toggle('bad',s.healthyVolume>3||s.critical);
 if($('remaining-label'))$('remaining-label').textContent=mode==='exam'?'Скрыт':`${s.remainingPercent.toFixed(0)}%`;
 if($('remaining-bar'))$('remaining-bar').style.width=mode==='exam'?'0%':`${s.remainingPercent}%`;updateHint();
}
function markDirty(){dirty=true;clearTimeout(saveTimer);saveTimer=setTimeout(save,1100);}
function extras(){return {stage,diagnosed,isolated,mode};}
function save(){if(!volume||!dirty)return;try{localStorage.setItem(STORAGE,JSON.stringify(volume.serialize(extras())));dirty=false;$('save-status').textContent='Прогресс сохранён на этом устройстве';}catch(e){$('save-status').textContent='Сохранение недоступно · экспортируйте файл';}}
function applyExtras(extra){stage=Number.isInteger(extra.stage)?Math.max(0,Math.min(4,extra.stage)):0;diagnosed=extra.diagnosed===true;isolated=extra.isolated===true;mode=extra.mode==='exam'?'exam':'learn';$('mode').value=mode;applyMode();renderStage();updateIsolation();}
function download(value,filename){const url=URL.createObjectURL(new Blob([JSON.stringify(value,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function dataPanel(){modal(`<span class="modal-eyebrow">ЛОКАЛЬНЫЕ ДАННЫЕ</span><h2>Ваше рабочее место</h2><p>Модель, действия и параметры сохраняются в браузере на этом устройстве. Серверной базы, аккаунтов и аналитики нет. Очистка данных браузера удалит сохранение.</p><div class="modal-actions"><button id="export-button">Экспорт прогресса</button><button id="restart-button">Начать случай заново</button></div><h3>Восстановить из файла</h3><p>Файл заменит текущее состояние этого учебного случая.</p><input id="import-file" class="file-input" type="file" accept="application/json,.json"><p id="import-status" role="status"></p><h3>Исходная модель</h3><p>Human mouth detailed — <a href="https://sketchfab.com/Mince" target="_blank" rel="noopener noreferrer">Mince</a>, <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener noreferrer">CC BY 4.0</a>. Зуб выделен, масштаб нормализован, добавлены реконструированные ткани и поражение.</p>`);
 $('export-button').onclick=()=>download(volume.serialize(extras()),'dentalab-progress.json');
 $('restart-button').onclick=()=>{modal(`<h2>Начать случай заново?</h2><p>Текущая попытка будет заменена. Сначала можно сохранить её в файл.</p><div class="modal-actions"><button id="backup-reset">Экспортировать</button><button id="confirm-reset">Сбросить случай</button></div>`);$('backup-reset').onclick=()=>download(volume.serialize(extras()),'dentalab-progress.json');$('confirm-reset').onclick=()=>{volume.reset();history=[];diagnosed=false;isolated=false;stage=0;showLesion=false;section=false;showRoots=false;['lesion-button','section-button','roots-button'].forEach(id=>$(id).classList.remove('active'));$('undo-button').disabled=true;selectTool('inspect');applyExtras(extras());updateClip();requestMesh();updateStats();markDirty();$('modal').close();toast('Начат новый учебный случай.');};};
 $('import-file').onchange=async e=>{const f=e.target.files[0];if(!f)return;try{if(f.size>8_000_000)throw Error('Файл слишком большой.');const parsed=JSON.parse(await f.text());const extra=volume.restore(parsed);history=[];$('undo-button').disabled=true;applyExtras(extra);requestMesh();updateStats();markDirty();$('modal').close();toast('Прогресс восстановлен.');}catch(err){$('import-status').textContent=`Импорт отклонён: ${err.message}`;$('import-status').className='bad';}};
}
function applyMode(){const exam=mode==='exam';$('mode-badge').textContent=exam?'Самостоятельная практика':'Обучение';if(exam){section=false;showLesion=false;$('section-button').classList.remove('active');$('lesion-button').classList.remove('active');}updateClip();renderStage();}
function report(){if(!volume)return;stopStroke();setPower(false);const s=volume.stats();let outcome=s.critical?'Обнаружено повреждение пульпы':s.caries===volume.initialCaries?'Работа с тканями ещё не выполнена':s.missing>0?'Дефект остаётся незаполненным':s.uncured>0?'Материал не полимеризован':s.caries>0?'Сохранён участок заданного поражения':'Учебная геометрическая задача выполнена';
 modal(`<span class="modal-eyebrow">РАЗБОР ПОПЫТКИ</span><h2>${outcome}</h2><p>Отчёт описывает геометрию учебной модели. Он не подтверждает клиническую готовность или качество реального лечения.</p><div class="result-grid"><div class="result-card"><strong>${s.remainingPercent.toFixed(0)}%</strong><span>заданного поражения осталось</span></div><div class="result-card"><strong>${s.healthyVolume.toFixed(2)} мм³</strong><span>непоражённых тканей удалено</span></div><div class="result-card"><strong>${s.cavityVolume.toFixed(2)} мм³</strong><span>незаполненного дефекта</span></div><div class="result-card"><strong>${s.fillVolume.toFixed(2)} мм³</strong><span>реставрационного материала</span></div></div><div class="stat-line"><span>Повреждение реконструированной пульпы</span><strong class="${s.critical?'bad':'good'}">${s.critical?'Обнаружено':'Не обнаружено'}</strong></div><div class="stat-line"><span>Изоляция рабочего поля</span><strong>${isolated?'Подтверждена условно':'Не подтверждена'}</strong></div><div class="stat-line"><span>Работа без охлаждения</span><strong>${volume.metrics.drySeconds.toFixed(1)} с</strong></div><div class="stat-line"><span>Неполимеризованный материал</span><strong>${(s.uncured*meta.step**3).toFixed(2)} мм³</strong></div><div class="clinical-status">Остаток заданного поражения сам по себе не означает ошибку: клиническая граница удаления зависит от случая. Угол влияет на геометрию контакта; универсального «правильного угла» в оценке нет. Порог «заметного удаления» в подсказках — интерфейсный параметр, ожидающий проверки экспертом.</div><h3>Что пока не оценивается</h3><p>Реальное усилие, температура, инфекционный контроль, адгезия, краевое прилегание, контактные пункты, окклюзия и отсроченный результат.</p><div class="modal-actions"><button id="continue-button">Продолжить практику</button><button id="export-report">Скачать разбор</button><button id="report-sources">Источники</button></div>`);
 $('continue-button').onclick=()=>$('modal').close();$('export-report').onclick=()=>download({kind:'DentaLab teaching report',createdAt:new Date().toISOString(),clinicalValidation:'pending',stats:s,metrics:volume.metrics},'dentalab-report.json');$('report-sources').onclick=sources;
}
function help(){modal(`<span class="modal-eyebrow">УПРАВЛЕНИЕ НА ПК</span><h2>Рабочее место стоматолога</h2><ul><li><b>ПКМ + движение мыши</b> — вращение камеры; колесо — масштаб.</li><li><b>Осмотр:</b> ЛКМ также вращает модель.</li><li><b>1–6</b> — выбрать инструмент; <b>Space</b> — включить или выключить.</li><li><b>ЛКМ удерживать</b> — работа включённым инструментом.</li><li><b>W / S</b> — увеличить / уменьшить подачу на 0,1 мм.</li><li><b>A / D</b> — изменить наклон на 5°; поворот — ползунком.</li><li><b>Shift + колесо</b> — изменить глубину подачи.</li><li><b>Ctrl / ⌘ + Z</b> — отменить последнее действие.</li></ul><p>Подача отсчитывается от исходной поверхности вдоль оси инструмента. Для углубления в полость постепенно увеличивайте её. Фиссурный бор имеет цилиндрическую рабочую часть; шаровидный — сферическую.</p><h3>Учебные режимы просмотра</h3><p>«Разрез» открывает реконструированную пульпу и временно блокирует обработку. «Поражение» показывает его исходный объём. «Корни» показывает зуб целиком. В самостоятельной практике разрез и подсветка поражения недоступны.</p><div class="legend"><span><i style="background:#ece6c9"></i>Эмаль</span><span><i style="background:#c79652"></i>Дентин</span><span><i style="background:#62351a"></i>Поражение</span><span><i style="background:#b5121a"></i>Пульпа</span><span><i style="background:#7bc2c9"></i>Композит</span></div>`);}
function cases(){modal(`<span class="modal-eyebrow">УЧЕБНАЯ ПРОГРАММА</span><h2>Клинические случаи</h2><div class="case-choice"><h3>01 · Кариес жевательной поверхности</h3><p>Объёмное препарирование, контроль глубины, восстановление учебного дефекта.</p><small>Доступен · прототип, ожидает медицинской проверки</small></div><div class="case-choice"><h3>02 · Замена реставрации</h3><p>Старая пломба, состояние тканей и выбор восстановления.</p><small>Следующий этап · ещё не реализован</small></div><div class="case-choice"><h3>03 · Горизонтальный третий моляр</h3><p>Хирургическое планирование и работа с анатомическими зонами риска.</p><small>Запланирован · ещё не реализован</small></div><div class="case-choice"><h3>04 · Восстановление скола</h3><p>Оценка травмы и восстановление формы зуба.</p><small>Запланирован · ещё не реализован</small></div>`);}
function bind(){
 $('modal-close').onclick=()=>$('modal').close();$('modal').addEventListener('click',e=>{if(e.target===$('modal')){const r=$('modal').getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)$('modal').close();}});
 $('modal').addEventListener('close',updateInstrument);$('sources-button').onclick=sources;$('hint-source').onclick=sources;$('help-button').onclick=help;$('cases-button').onclick=cases;$('patient-button').onclick=patient;$('data-button').onclick=dataPanel;$('finish-button').onclick=report;
 document.querySelectorAll('[data-stage]').forEach(b=>b.onclick=()=>setStage(+b.dataset.stage));document.querySelectorAll('[data-tool]').forEach(b=>b.onclick=()=>selectTool(b.dataset.tool));document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>{if(isReady)setView(b.dataset.view);});
 $('mode').onchange=e=>{mode=e.target.value;stopStroke();setPower(false);applyMode();updateStats();markDirty();};$('power-button').onclick=()=>setPower(!powered);
 for(const id of ['depth','tilt','yaw','radius'])$(id).addEventListener('input',()=>{updateOutputs();updateInstrument();});$('cooling').onchange=updateHint;
 $('reset-view').onclick=()=>resetCamera();$('top-view').onclick=()=>resetCamera(true);$('undo-button').onclick=undo;
 $('roots-button').onclick=()=>{showRoots=!showRoots;$('roots-button').classList.toggle('active',showRoots);updateClip();};
 $('section-button').onclick=()=>{if(mode==='exam'){toast('Разрез недоступен в самостоятельной практике.');return;}stopStroke();setPower(false);section=!section;$('section-button').classList.toggle('active',section);updateClip();};
 $('lesion-button').onclick=()=>{if(mode==='exam'){toast('Подсветка недоступна в самостоятельной практике.');return;}showLesion=!showLesion;$('lesion-button').classList.toggle('active',showLesion);updateClip();};
 window.addEventListener('keydown',e=>{if(e.target.matches('input,textarea,select')||$('modal').open)return;if((e.metaKey||e.ctrlKey)&&e.code==='KeyZ'){e.preventDefault();undo();return;}if(e.code==='Space'){e.preventDefault();if(!e.repeat)setPower(!powered);}const keys=['Digit1','Digit2','Digit3','Digit4','Digit5','Digit6'];if(keys.includes(e.code))selectTool(Object.keys(names)[keys.indexOf(e.code)]);
  if(['KeyW','KeyS','KeyA','KeyD'].includes(e.code)){e.preventDefault();const input=['KeyW','KeyS'].includes(e.code)?$('depth'):$('tilt');const direction=['KeyW','KeyD'].includes(e.code)?1:-1;input.value=+input.value+direction*(input===$('depth')?.1:5);updateOutputs();updateInstrument();}
  if(e.key==='?')help();});
 window.addEventListener('pointerup',()=>{if(pressing){stopStroke();updateStats();markDirty();}});window.addEventListener('blur',()=>{stopStroke();setPower(false);save();});document.addEventListener('visibilitychange',()=>{if(document.hidden){stopStroke();setPower(false);save();}});window.addEventListener('pagehide',save);
}
function updateOutputs(){for(const [id,unit,mult] of [['depth',' мм',1],['tilt','°',1],['yaw','°',1],['radius',' мм',2]])$(`${id}-value`).textContent=(+$(`${id}`).value*mult).toFixed(unit==='°'?0:1)+unit;}
async function init(){
 bind();
 try{
  const results=await Promise.all([fetch('./assets/tooth-volume.json').then(r=>{if(!r.ok)throw Error('Метаданные модели недоступны');return r.json();}),fetch('./assets/tooth-volume.bin').then(r=>{if(!r.ok)throw Error('Объёмная модель недоступна');return r.arrayBuffer();}),fetch('./assets/tooth-reference.json').then(r=>r.json())]);
  meta=results[0];volume=new ToothVolume(meta,new Uint8Array(results[1]));
  renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,powerPreference:'high-performance'});renderer.setPixelRatio(Math.min(window.devicePixelRatio,2));renderer.setClearColor(0x000000,0);renderer.localClippingEnabled=true;renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=.9;
  $('viewport').appendChild(renderer.domElement);renderer.domElement.setAttribute('aria-label','Трёхмерная модель рабочего зуба. Вращение правой кнопкой мыши.');renderer.domElement.setAttribute('role','img');
  renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();stopStroke();setPower(false);toast('Графический контекст потерян. Прогресс сохранён; обновите страницу.',true);save();});
  scene=new THREE.Scene();camera=new THREE.PerspectiveCamera(34,1,.1,1200);controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.dampingFactor=.1;controls.enablePan=true;controls.mouseButtons={LEFT:THREE.MOUSE.ROTATE,MIDDLE:THREE.MOUSE.DOLLY,RIGHT:THREE.MOUSE.ROTATE};
  scene.add(new THREE.HemisphereLight(0xf8fff5,0x6a8073,1.8));const key=new THREE.DirectionalLight(0xfff9ec,2.4);key.position.set(-12,28,15);scene.add(key);const rim=new THREE.DirectionalLight(0xe0f5ff,1.4);rim.position.set(15,5,-10);scene.add(rim);const fill=new THREE.DirectionalLight(0xffffff,.8);fill.position.set(-10,-5,20);scene.add(fill);
  tooth=new THREE.Mesh(geometry(surfaceNets(volume.data,meta)),new THREE.MeshStandardMaterial({vertexColors:true,roughness:.32,metalness:0,side:THREE.DoubleSide}));scene.add(tooth);
  const ref=new THREE.BufferGeometry();ref.setAttribute('position',new THREE.Float32BufferAttribute(results[2].vertices.flat(),3));ref.setIndex(results[2].faces.flat());ref.computeVertexNormals();reference=new THREE.Mesh(ref,new THREE.MeshBasicMaterial({side:THREE.DoubleSide}));reference.userData.sourceVertices=results[2].sourceVertices;reference.updateMatrixWorld();
  lesionMesh=new THREE.Mesh(geometry(surfaceNets(volume.base,meta,3)),new THREE.MeshBasicMaterial({color:0xb58242,transparent:true,opacity:.48,depthTest:false,wireframe:true}));lesionMesh.renderOrder=3;lesionMesh.visible=false;scene.add(lesionMesh);
  pulpMesh=new THREE.Mesh(geometry(surfaceNets(volume.base,meta,4)),new THREE.MeshStandardMaterial({color:0xb92839,roughness:.5,side:THREE.DoubleSide}));pulpMesh.visible=false;scene.add(pulpMesh);
  const cuff=new THREE.Mesh(new THREE.TorusGeometry(6.6,1.2,20,72),new THREE.MeshStandardMaterial({color:0x6b9a8e,roughness:.65}));cuff.rotation.x=Math.PI/2;cuff.scale.set(1,1.2,.5);cuff.position.y=-.8;cuff.name='isolation';cuff.visible=false;scene.add(cuff);
  toolGroup=new THREE.Group();head=new THREE.Mesh(new THREE.SphereGeometry(.65,20,14),new THREE.MeshStandardMaterial({color:0x9ba6a3,metalness:.75,roughness:.3}));toolGroup.add(head);shaft=new THREE.Mesh(new THREE.CylinderGeometry(.15,.15,5,16),new THREE.MeshStandardMaterial({color:0xc6d0c9,metalness:.8,roughness:.26}));shaft.position.y=3.2;toolGroup.add(shaft);
  const handle=new THREE.Mesh(new THREE.CylinderGeometry(.8,.45,5,24),new THREE.MeshStandardMaterial({color:0x75958d,metalness:.65,roughness:.32}));handle.position.y=7.9;handle.rotation.z=.08;toolGroup.add(handle);toolGroup.visible=false;scene.add(toolGroup);
  worker=new Worker(new URL('./mesh-worker.js',import.meta.url),{type:'module'});worker.onmessage=({data:{mesh}})=>{tooth.geometry.dispose();tooth.geometry=geometry(mesh);if(mouthWork){mouthWork.geometry.dispose();mouthWork.geometry=tooth.geometry.clone();}busy=false;if(pending){pending=false;requestMesh();}};worker.onerror=e=>{busy=false;toast('Не удалось обновить геометрию. Перезагрузите страницу; прогресс сохранён.',true);console.error(e);};
  renderer.domElement.addEventListener('pointermove',movePointer);renderer.domElement.addEventListener('pointerdown',beginStroke);renderer.domElement.addEventListener('pointerleave',()=>{pointerInside=false;previous=null;stopStroke();toolGroup.visible=false;});renderer.domElement.addEventListener('pointercancel',stopStroke);renderer.domElement.addEventListener('lostpointercapture',()=>{if(pressing)stopStroke();});renderer.domElement.addEventListener('contextmenu',e=>e.preventDefault());
  renderer.domElement.addEventListener('wheel',e=>{if(e.shiftKey&&view==='tooth'){e.preventDefault();e.stopImmediatePropagation();$('depth').value=+$('depth').value+(e.deltaY>0?.1:-.1);updateOutputs();updateInstrument();}},{passive:false,capture:true});
  const resize=()=>{const r=$('viewport').getBoundingClientRect();renderer.setSize(r.width,r.height);camera.aspect=r.width/r.height;camera.updateProjectionMatrix();};new ResizeObserver(resize).observe($('viewport'));resize();
  try{const saved=localStorage.getItem(STORAGE);if(saved){const extra=volume.restore(JSON.parse(saved));applyExtras(extra);requestMesh();toast('Продолжена сохранённая попытка.');}}catch(e){toast('Сохранение не прочитано. Доступен новый случай; исходный файл не изменён.',true);}
  resetCamera();updateClip();renderStage();updateStats();updateOutputs();$('loading').hidden=true;isReady=true;
  let lastWork=0;function frame(now){requestAnimationFrame(frame);controls.update();if(now-lastWork>75){const dt=Math.min(.15,(now-lastWork)/1000);lastWork=now;work(dt);}if(now-lastStats>600){lastStats=now;updateStats();}renderer.render(scene,camera);}requestAnimationFrame(frame);
  if('serviceWorker'in navigator)navigator.serviceWorker.register('./sw.js').catch(()=>{});
 }catch(e){console.error(e);$('loading').hidden=true;$('webgl-error').hidden=false;$('webgl-error').querySelector('p').textContent=`${e.message}. Попробуйте актуальный браузер с WebGL 2 и аппаратным ускорением.`;}
}
init();
