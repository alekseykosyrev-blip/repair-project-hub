(function(){
"use strict";
const SpeechAPI=window.SpeechRecognition||window.webkitSpeechRecognition;
let voice={recorder:null,stream:null,chunks:[],recording:false,saving:false,blob:null,url:null,saved:false,clipId:null,recognizer:null,listening:false,status:"",transcript:"",durationMs:0,startedAt:0,speechError:""};
const escapeHTML=s=>String(s||"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
function refresh(update){if(typeof update==="function")update()}
function reset(){
 if(voice.recognizer){try{voice.recognizer.onend=null;voice.recognizer.onresult=null;voice.recognizer.abort()}catch(e){}}
 if(voice.recorder&&voice.recorder.state!=="inactive"){try{voice.recorder.onstop=null;voice.recorder.stop()}catch(e){}}
 if(voice.stream)voice.stream.getTracks().forEach(t=>t.stop());
 if(voice.url)URL.revokeObjectURL(voice.url);
 voice={recorder:null,stream:null,chunks:[],recording:false,saving:false,blob:null,url:null,saved:false,clipId:null,recognizer:null,listening:false,status:"",transcript:"",durationMs:0,startedAt:0,speechError:""};
}
let dbPromise=null;
function database(){
 if(!window.indexedDB)return Promise.resolve(null);
 if(!dbPromise)dbPromise=new Promise(resolve=>{
  let req;try{req=indexedDB.open("rech-rukovoditelya-recordings",1)}catch(e){resolve(null);return}
  req.onupgradeneeded=()=>{if(!req.result.objectStoreNames.contains("clips"))req.result.createObjectStore("clips")};
  req.onsuccess=()=>resolve(req.result);req.onerror=()=>resolve(null);
 });
 return dbPromise;
}
async function saveClip(id,blob){
 const db=await database();if(!db)return false;
 return new Promise(resolve=>{
  try{const tx=db.transaction("clips","readwrite");tx.objectStore("clips").put(blob,id);
   tx.oncomplete=()=>resolve(true);tx.onerror=()=>resolve(false);tx.onabort=()=>resolve(false)}
  catch(e){resolve(false)}
 });
}
async function playClip(id){
 const db=await database();
 if(!db){alert("Записи недоступны в этом браузере.");return}
 try{
  const blob=await new Promise((resolve,reject)=>{const r=db.transaction("clips","readonly").objectStore("clips").get(id);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)});
  if(!blob){alert("Запись не найдена на этом устройстве.");return}
  const url=URL.createObjectURL(blob),player=new Audio(url);
  player.onended=()=>URL.revokeObjectURL(url);player.onerror=()=>URL.revokeObjectURL(url);
  await player.play();
 }catch(e){alert("Не получилось воспроизвести запись.");}
}
const canRecord=()=>!!(navigator.mediaDevices&&navigator.mediaDevices.getUserMedia&&window.MediaRecorder);
const canDictate=()=>!!SpeechAPI;
async function record(update,complete,onTranscript){
 if(!canRecord()||voice.recording||voice.saving){voice.status="Запись недоступна или уже запущена";refresh(update);return}
 if(voice.listening&&voice.recognizer){try{voice.recognizer.abort()}catch(e){}}
 let stream;
 try{
  stream=await navigator.mediaDevices.getUserMedia({audio:true});
  const types=["audio/webm;codecs=opus","audio/mp4","audio/webm"];
  const type=types.find(t=>MediaRecorder.isTypeSupported&&MediaRecorder.isTypeSupported(t));
  const recorder=new MediaRecorder(stream,type?{mimeType:type}:undefined);
  if(voice.url)URL.revokeObjectURL(voice.url);
  voice.recorder=recorder;voice.stream=stream;voice.chunks=[];voice.recording=true;voice.saving=false;voice.blob=null;voice.url=null;voice.saved=false;voice.clipId=null;voice.status="";voice.transcript="";voice.durationMs=0;voice.startedAt=Date.now();voice.speechError="";
  recorder.ondataavailable=e=>{if(e.data&&e.data.size)voice.chunks.push(e.data)};
  recorder.onerror=()=>{voice.status="Ошибка записи. Попробуй повторить";voice.recording=false;voice.saving=false;stream.getTracks().forEach(t=>t.stop());refresh(update)};
  recorder.onstop=async()=>{
   stream.getTracks().forEach(t=>t.stop());voice.recording=false;voice.saving=true;refresh(update);
   const blob=new Blob(voice.chunks,{type:recorder.mimeType||"audio/webm"});
   voice.blob=blob;voice.url=blob.size?URL.createObjectURL(blob):null;
   if(blob.size){
    const id="v"+Date.now()+"-"+Math.random().toString(36).slice(2,8);
    const saved=await saveClip(id,blob);
    voice.clipId=saved?id:null;voice.saved=saved;
    voice.status=saved?"Запись сохранена в этом браузере":"Запись готова. Скачай её, чтобы сохранить";
    if(typeof complete==="function")complete(voice.clipId);
   }else voice.status="Запись пуста. Попробуй ещё раз";
   voice.saving=false;refresh(update);
  };
  recorder.start();
  if(typeof onTranscript==="function"&&SpeechAPI){
   try{
    const listen=new SpeechAPI();voice.recognizer=listen;voice.listening=true;
    listen.lang="ru-RU";listen.interimResults=true;listen.continuous=true;
    listen.onresult=e=>{
     const result=Array.from(e.results).map(r=>r[0]?.transcript||"").join(" ").trim();
     voice.transcript=result;onTranscript(result);
    };
    listen.onerror=e=>{voice.speechError=e.error==="not-allowed"?"Нет разрешения на распознавание":e.error==="network"?"Распознавание требует соединения с сетью":"Распознавание прервано: "+e.error};
    listen.onend=()=>{voice.listening=false;voice.recognizer=null;refresh(update)};
    listen.start();
   }catch(e){voice.listening=false;voice.speechError="Распознавание недоступно. Аудиозапись продолжается"}
  }
  refresh(update);
 }catch(e){
  if(stream)stream.getTracks().forEach(t=>t.stop());
  voice.recording=false;voice.status="Доступ к микрофону не получен. Проверь разрешения браузера";refresh(update);
 }
}
function stop(update){
 if(voice.recorder&&voice.recorder.state==="recording"){
  voice.durationMs=Math.max(0,Date.now()-(voice.startedAt||Date.now()));
  if(voice.listening&&voice.recognizer){try{voice.recognizer.stop()}catch(e){}}
  voice.saving=true;voice.recorder.stop();
  if(voice.stream)voice.stream.getTracks().forEach(t=>t.stop());
  refresh(update);
 }
}
function dictate(field,onText,update){
 if(!canDictate()){voice.status="Распознавание речи недоступно в этом браузере";refresh(update);return}
 if(voice.recording||voice.saving)return;
 if(voice.listening&&voice.recognizer){try{voice.recognizer.stop()}catch(e){}return}
 const before=(field?.value||"").trim();
 try{
  const rec=new SpeechAPI();voice.recognizer=rec;voice.listening=true;voice.status="";
  rec.lang="ru-RU";rec.interimResults=true;rec.continuous=false;
  rec.onresult=e=>{
   const spoken=Array.from(e.results).map(r=>r[0]?.transcript||"").join(" ").trim();
   const value=[before,spoken].filter(Boolean).join(" ");
   const active=document.querySelector('input[name="answer"],textarea[name="answer"]');
   if(active)active.value=value;
   if(typeof onText==="function")onText(value);
  };
  rec.onerror=e=>{voice.status=e.error==="not-allowed"?"Разреши доступ к микрофону":"Распознавание не удалось. Попробуй ещё раз"};
  rec.onend=()=>{voice.listening=false;voice.recognizer=null;refresh(update)};
  rec.start();refresh(update);
 }catch(e){voice.listening=false;voice.recognizer=null;voice.status="Не удалось запустить распознавание";refresh(update)}
}
function download(){
 if(!voice.blob||!voice.url)return;
 const ext=voice.blob.type.includes("mp4")?"m4a":voice.blob.type.includes("ogg")?"ogg":"webm";
 const a=document.createElement("a");a.href=voice.url;a.download="rech-rukovoditelya-"+new Date().toISOString().slice(0,10)+"."+ext;
 document.body.appendChild(a);a.click();a.remove();
}
function box(opts){
 const recordEnabled=!!opts.record,dictationEnabled=!!opts.dictate,buttons=[];
 if(recordEnabled)buttons.push(voice.recording?
  '<button type="button" class="secondary" data-action="voice-stop">■ Остановить запись</button>':
  '<button type="button" class="secondary" data-action="voice-record" '+(voice.saving||voice.listening||!canRecord()?'disabled':'')+'>● '+(voice.blob?"Перезаписать":"Записать голос")+'</button>');
 if(dictationEnabled)buttons.push('<button type="button" class="secondary" data-action="voice-dictate" '+(!canDictate()||voice.recording||voice.saving?'disabled':'')+'>'+(voice.listening?"■ Остановить диктовку":"🎙 Надиктовать текст")+'</button>');
 if(voice.blob)buttons.push('<button type="button" class="secondary" data-action="voice-download">Скачать запись</button>');
 return '<div class="voice-box"><div class="voice-heading">'+(recordEnabled?"Запись голоса":"Голосовой ввод")+'</div>'+
  '<div class="voice-controls">'+buttons.join("")+'</div>'+
  (voice.recording?'<p class="mini recording-indicator">● Идёт запись. Прочитай текст и останови запись.</p>':"")+
  (voice.saving?'<p class="mini">Обрабатываем запись…</p>':"")+
  (voice.listening?'<p class="mini">Говори, затем останови диктовку. Текст появится в ответе.</p>':"")+
  (voice.url?'<audio controls preload="metadata" src="'+escapeHTML(voice.url)+'"></audio>':"")+
  (voice.status?'<p class="mini">'+escapeHTML(voice.status)+'</p>':"")+
  (voice.speechError?'<p class="mini">'+escapeHTML(voice.speechError)+'</p>':"")+
  (recordEnabled&&!canRecord()?'<p class="mini">Запись недоступна. Проверь браузер и доступ к микрофону.</p>':"")+
  (dictationEnabled&&!canDictate()?'<p class="mini">Распознавание не поддерживается этим браузером, используй клавиатуру.</p>':"")+
  '<p class="mini">'+(recordEnabled?"Записи сохраняются только в этом браузере. При распознавании речь может обрабатываться сервисом браузера. Точность произношения не оценивается автоматически.":"Перед отправкой проверь распознанный текст. Распознавание зависит от браузера и сети.")+'</p>'+
 '</div>';
}
window.TrainerVoice={box,record,stop,dictate,download,playClip,reset,canRecord,canDictate,state:()=>voice};
})();
