const ESTIMATE_PARSER_V3=3;

function estimateMoneyCandidates(text){
  return moneyValues(text).filter(n=>Number.isFinite(n)&&n>=100);
}

function finalEstimateLabels(){
  return [
    {re:/итоговая\s+(?:сумма|стоимость)/i,label:'Итоговая сумма',priority:1200},
    {re:/общ(?:ая|ий)\s+(?:сумма|стоимость|итог)/i,label:'Общая стоимость',priority:1180},
    {re:/итог\s+сметы/i,label:'Итог сметы',priority:1170},
    {re:/итого\s+по\s+смете/i,label:'Итого по смете',priority:1160},
    {re:/всего\s+по\s+смете/i,label:'Всего по смете',priority:1150},
    {re:/сумма\s+по\s+смете/i,label:'Сумма по смете',priority:1140},
    {re:/всего\s+к\s+оплате/i,label:'Всего к оплате',priority:1130},
    {re:/итого\s+к\s+оплате/i,label:'Итого к оплате',priority:1120},
    {re:/к\s+оплате/i,label:'К оплате',priority:1100},
    {re:/итого\s+(?:работ|работы|стоимость\s+работ)/i,label:'Итого работ',priority:1040},
    {re:/общая\s+стоимость\s+работ/i,label:'Общая стоимость работ',priority:1030},
    {re:/^\s*итог(?:о)?\b/i,label:'Итого',priority:900},
    {re:/^\s*всего\b/i,label:'Всего',priority:880}
  ];
}

function isIntermediateEstimateLine(text){
  return /(?:итог|итого|всего).*(?:добавленн|дополнительн|по\s+разделу|раздела|по\s+этапу|этапа|по\s+позици|позици|по\s+группе|группы|подраздел|подытог)|(?:подытог|subtotal)/i.test(String(text||''));
}

analyzeEstimatePdf=async function(blob){
  const pages=await pdfTextLines(blob);
  if(!pages.length)return null;
  const labels=finalEstimateLabels();
  const candidates=[];
  const all=[];
  pages.forEach((lines,pageIndex)=>lines.forEach((line,lineIndex)=>all.push({line,pageIndex,lineIndex,lines})));
  const totalLines=Math.max(1,all.length);

  for(let globalIndex=0;globalIndex<all.length;globalIndex++){
    const entry=all[globalIndex];
    const line=String(entry.line||'');
    if(isIntermediateEstimateLine(line))continue;
    for(const label of labels){
      const match=line.match(label.re);
      if(!match)continue;

      const sameAfter=line.slice((match.index||0)+match[0].length);
      let values=estimateMoneyCandidates(sameAfter);
      let distancePenalty=0;

      if(!values.length){
        const nearby=[];
        for(let offset=-1;offset<=3;offset++){
          if(offset===0)continue;
          const neighbour=entry.lines[entry.lineIndex+offset];
          if(neighbour&&!isIntermediateEstimateLine(neighbour)){
            const nums=estimateMoneyCandidates(neighbour);
            if(nums.length)nearby.push({offset,nums});
          }
        }
        if(nearby.length){
          nearby.sort((a,b)=>Math.abs(a.offset)-Math.abs(b.offset)||a.offset-b.offset);
          values=nearby[0].nums;
          distancePenalty=Math.abs(nearby[0].offset)*8;
        }
      }
      if(!values.length)continue;

      const amount=values[values.length-1];
      const globalRatio=globalIndex/Math.max(1,totalLines-1);
      const pageRatio=entry.lineIndex/Math.max(1,entry.lines.length-1);
      const lastPageBonus=entry.pageIndex===pages.length-1?280:0;
      const bottomBonus=pageRatio>=0.55?120:0;
      candidates.push({
        amount,
        label:label.label,
        score:label.priority+lastPageBonus+bottomBonus+globalRatio*180+pageRatio*80-distancePenalty,
        globalIndex,
        method:'label'
      });
      break;
    }
  }

  if(candidates.length){
    candidates.sort((a,b)=>b.score-a.score||b.globalIndex-a.globalIndex);
    return candidates[0];
  }

  // Fallback for PDFs where Cyrillic labels are split or encoded oddly:
  // inspect only the bottom area of the last page and choose the largest plausible amount.
  const lastLines=pages[pages.length-1]||[];
  if(!lastLines.length)return null;
  const start=Math.max(0,Math.floor(lastLines.length*0.62));
  const tail=lastLines.slice(start);
  const tailText=tail.join(' ');
  let values=estimateMoneyCandidates(tailText).filter(n=>n>=1000);

  if(!values.length){
    const widerStart=Math.max(0,Math.floor(lastLines.length*0.45));
    values=estimateMoneyCandidates(lastLines.slice(widerStart).join(' ')).filter(n=>n>=1000);
  }
  if(!values.length)return null;

  const amount=Math.max(...values);
  return {amount,label:'Итог по концу сметы',score:500,globalIndex:all.length-1,method:'bottom-fallback'};
};

analyzePdfMeta=async function(meta,blob){
  meta.analysisStatus='processing';
  meta.analysisVersion=ESTIMATE_PARSER_V3;
  try{
    const result=await analyzeEstimatePdf(blob);
    if(result){
      meta.estimateTotal=result.amount;
      meta.estimateLabel=result.label;
      meta.estimateMethod=result.method||'label';
      meta.analysisStatus='recognized';
      return true;
    }
    delete meta.estimateTotal;
    delete meta.estimateLabel;
    delete meta.estimateMethod;
    meta.analysisStatus='not_found';
    return false;
  }catch(e){
    console.error('PDF analysis failed',e);
    delete meta.estimateTotal;
    delete meta.estimateLabel;
    delete meta.estimateMethod;
    meta.analysisStatus='error';
    return false;
  }
};