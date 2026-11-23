(function(){
"use strict";
// This scores correspondence between browser-recognised text and a reading passage.
// It does not measure pronunciation, accent, timbre, intonation, or confidence.
function words(str){return(String(str||"").toLowerCase().replace(/ё/g,"е").match(/[а-яa-z0-9]+/g)||[])}
function analyze(reference,heard,durationMs){
 const expected=words(reference),spoken=words(heard),n=expected.length,m=spoken.length;
 if(!m)return {available:false,expectedCount:n,spokenCount:0,reason:"Браузер не вернул распознанный текст. Прослушай запись и сравни её с образцом самостоятельно."};
 // LCS alignment, so repetitions and omissions do not become random 'pronunciation errors'.
 const dp=Array.from({length:n+1},()=>new Uint16Array(m+1));
 for(let i=n-1;i>=0;i--)for(let j=m-1;j>=0;j--)dp[i][j]=expected[i]===spoken[j]?1+dp[i+1][j+1]:Math.max(dp[i+1][j],dp[i][j+1]);
 const missed=[],extra=[];
 let i=0,j=0;
 while(i<n&&j<m){
  if(expected[i]===spoken[j]){i++;j++;continue}
  if(dp[i+1][j]>=dp[i][j+1]){missed.push(expected[i]);i++}else{extra.push(spoken[j]);j++}
 }
 while(i<n)missed.push(expected[i++]);
 while(j<m)extra.push(spoken[j++]);
 const matched=n-missed.length,coverage=n?Math.round(matched/n*100):0;
 const rate=durationMs>1000?Math.round(m/(durationMs/60000)):null;
 const filler=["ну","короче","типа","ээ","эээ"],fillers=extra.filter(x=>filler.includes(x));
 const notes=[];
 if(coverage>=90)notes.push("Распознанный текст близок к образцу. Прослушай запись и оцени паузы, ударения и интонацию.");
 else if(coverage>=70)notes.push("Есть расхождения с текстом. Прослушай фрагменты с выделенными словами, особенно профессиональные термины.");
 else notes.push("Распознавание сильно расходится с образцом. Причиной могут быть пропуски, шум или ошибки браузера. Проверь запись на слух.");
 if(rate!==null&&coverage>=70){
  if(rate<95)notes.push("Темп по распознанным словам невысокий. Потренируй плавные смысловые фразы без лишних остановок.");
  else if(rate>165)notes.push("Темп по распознанным словам высокий. Попробуй замедлиться и выделить выводы паузами.");
  else notes.push("Оценочный темп находится в умеренном диапазоне. Проверь, насколько речь звучит естественно.");
 }
 if(fillers.length)notes.push("В расшифровке обнаружены возможные слова-паразиты. Сверь их с аудиозаписью.");
 notes.push("Это сравнение с автоматической расшифровкой, а не оценка произношения, дикции или уверенности.");
 return {available:true,expectedCount:n,spokenCount:m,matched,coverage,rate,omissions:missed.slice(0,12),extra:extra.slice(0,12),fillerCount:fillers.length,notes};
}
window.TrainerReading={analyze,words};
})();