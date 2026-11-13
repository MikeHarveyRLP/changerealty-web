(() => {
 'use strict';
 const key=document.body.dataset.editorPage;
 if(!key)return;
 const fonts={manrope:'Manrope, Arial, sans-serif','dm-sans':'"DM Sans", Arial, sans-serif',georgia:'Georgia, serif',arial:'Arial, sans-serif'};
 const baseline=new Map();let previewActive=false;
 const image=document.querySelector('[data-page-image="portrait"]'),originalImage=image?.getAttribute('src');
 function render(c){
  if(!c||typeof c!=='object')return;
  document.querySelectorAll('[data-page-copy]').forEach(el=>{
   if(!baseline.has(el))baseline.set(el,el.innerHTML);
   const value=c.copy?.[el.dataset.pageCopy];
   if(typeof value==='string'&&value.trim()&&value.length<=6000)el.textContent=value;
   else el.innerHTML=baseline.get(el);
  });
  for(const [name,field]of [['--page-heading-font','headingFont'],['--page-body-font','bodyFont']]){
   if(fonts[c[field]])document.documentElement.style.setProperty(name,fonts[c[field]]);
   else document.documentElement.style.removeProperty(name);
  }
  for(const [name,field,min,max]of [['--page-heading-size','headingSize',26,64],['--page-body-size','bodySize',13,22]]){
   if(Number.isFinite(c[field])&&c[field]>=min&&c[field]<=max)document.documentElement.style.setProperty(name,c[field]+'px');
   else document.documentElement.style.removeProperty(name);
  }
  document.documentElement.classList.toggle('cms-page-heading-size',Number.isFinite(c.headingSize)&&c.headingSize>=26&&c.headingSize<=64);
  document.documentElement.classList.toggle('cms-page-body-size',Number.isFinite(c.bodySize)&&c.bodySize>=13&&c.bodySize<=22);
  document.documentElement.classList.toggle('cms-page-heading-font',Boolean(fonts[c.headingFont]));
  document.documentElement.classList.toggle('cms-page-body-font',Boolean(fonts[c.bodyFont]));
  if(image){let next=originalImage;try{const u=new URL(c.portraitUrl);if(u.protocol==='https:'&&u.hostname==='cdn.sanity.io')next=u.href}catch{}image.src=next;}
  document.documentElement.classList.add('cms-page-active');
 }
 if(new URLSearchParams(location.search).get('editorPreview')==='1'){
  const origin=window.APP_CONFIG?.SANITY_STUDIO_ORIGIN||location.origin;
  window.addEventListener('message',e=>{if(e.origin!==origin||e.source!==parent||e.data?.type!=='changerealty-page-preview'||e.data?.page!==key)return;previewActive=true;render(e.data.content)});
 }
 fetch('/api/content/pages/'+encodeURIComponent(key),{signal:AbortSignal.timeout(5000)}).then(r=>r.ok?r.json():null).then(j=>{if(!previewActive&&j?.content)render(j.content)}).catch(()=>{});
})();
