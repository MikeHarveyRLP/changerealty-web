(() => {
 'use strict';
 const currency=n=>new Intl.NumberFormat('en-CA',{style:'currency',currency:'CAD',maximumFractionDigits:2}).format(n);
 const calculator=document.querySelector('#mortgage-form');
 if(calculator){
  const clearResults=()=>['payment','principal','cash-needed'].forEach(id=>document.getElementById(id).textContent='—');
  const calculate=e=>{e?.preventDefault();if(!calculator.reportValidity()){clearResults();return;}
   const values=new FormData(calculator),value=k=>Number(values.get(k));
   const price=value('price'),down=value('down'),rate=value('rate')/100,years=value('years'),frequency=value('frequency'),closing=value('closing');
   const error=document.querySelector('#mortgage-error');
   if(![price,down,rate,years,frequency,closing].every(Number.isFinite)||down>price){error.textContent='Down payment must not exceed the purchase price.';['payment','principal','cash-needed'].forEach(id=>document.getElementById(id).textContent='—');return}
   error.textContent='';const principal=price-down,r=Math.pow(1+rate/2,2/frequency)-1,n=years*frequency;
   const payment=principal===0?0:r===0?principal/n:principal*r/(1-Math.pow(1+r,-n));
   document.querySelector('#payment').textContent=currency(payment);document.querySelector('#principal').textContent=currency(principal);document.querySelector('#cash-needed').textContent=currency(down+closing);document.querySelector('#frequency-label').textContent={12:'per month',24:'twice a month',26:'every two weeks',52:'per week'}[frequency];
  };calculator.addEventListener('submit',calculate);calculator.addEventListener('input',()=>{if(calculator.checkValidity())calculate();else clearResults()});calculate();
 }
 const form=document.querySelector('#evaluation-form');if(!form)return;
 const phone=form.elements.phone,preference=form.elements.contactPreference;
 const phoneRequired=()=>{phone.required=preference.value!=='email';phone.setAttribute('aria-required',String(phone.required))};preference.addEventListener('change',phoneRequired);phoneRequired();
 form.addEventListener('submit',async e=>{
  e.preventDefault();if(!form.reportValidity())return;
  const button=form.querySelector('[type="submit"]'),status=document.querySelector('#evaluation-status');button.disabled=true;status.textContent='Sending your request…';
  const f=new FormData(form),get=k=>String(f.get(k)||'').trim();
  const detail=[['Postal',get('postal')],['Beds',get('bedrooms')],['Baths',get('bathrooms')],['Size',get('size')?get('size')+'sqft':''],['Features',get('features')],['Notes',get('notes')]].filter(([,v])=>v).map(([k,v])=>k+':'+v).join(';');
  const payload={type:'home_evaluation',name:get('name'),email:get('email'),phone:get('phone'),contactPreference:get('contactPreference'),address:[get('address'),get('city')].join(','),message:detail,consent:f.get('consent')==='on',website:get('website')};
  try{const base=String(window.APP_CONFIG?.API_BASE||'https://changerealty-api-production.up.railway.app').replace(/\/$/,'');const response=await fetch(base+'/api/inquiries',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),signal:AbortSignal.timeout(20000)});const result=await response.json();if(!response.ok||result.ok!==true)throw Error(result.error||'Your request could not be sent. Please try again.');status.textContent='Thank you! Your request has been sent to Mike. He’ll follow up using your preferred contact method.';form.reset();phoneRequired();}
  catch(error){status.textContent=error.name==='TimeoutError'?'We couldn’t confirm delivery. Please call or text 519-588-8088 before submitting again.':error.message||'Unable to send. Please call or text 519-588-8088.';}
  finally{button.disabled=false;}
 });
})();
