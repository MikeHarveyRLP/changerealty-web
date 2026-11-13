(() => {
 'use strict';
 if(!document.querySelector('#hero-title'))return;
 const fonts={manrope:'Manrope, Arial, sans-serif','dm-sans':'"DM Sans", Arial, sans-serif',georgia:'Georgia, serif',arial:'Arial, sans-serif'};
 const baseline=new Map();
 const text=(selector,value,max=1800)=>{const el=document.querySelector(selector);if(!el)return;if(!baseline.has(selector))baseline.set(selector,el.innerHTML);if(typeof value==='string'&&value.trim()&&value.length<=max)el.textContent=value;else el.innerHTML=baseline.get(selector)};
 const video=document.querySelector('#hero-video'),source=video?.querySelector('source');const originalVideo=source?.getAttribute('src'),originalPoster=video?.getAttribute('poster');
 let previewActive=false;
 function asset(value){try{const url=new URL(value);return url.protocol==='https:'&&url.hostname==='cdn.sanity.io'?url.href:null}catch{return null}}
 function size(name,value,min,max){if(Number.isFinite(value)&&value>=min&&value<=max)document.documentElement.style.setProperty(name,value+'px');else document.documentElement.style.removeProperty(name)}
 function render(c){if(!c||typeof c!=='object')return;document.documentElement.classList.add('cms-content-active');
  const pairs=[['.hero .eyebrow','heroEyebrow'],['#hero-title','heroTitle'],['.location-field>span','searchLabel'],['.experience .eyebrow','experienceEyebrow'],['#experience-title','experienceTitle'],['.experience>p:last-child','experienceText'],['.office-section .eyebrow','officeEyebrow'],['#office-title','officeTitle']];pairs.forEach(([selector,key])=>text(selector,c[key]));
  const input=document.querySelector('.home-search input');if(input){input.placeholder=typeof c.searchPlaceholder==='string'&&c.searchPlaceholder.length<=200?c.searchPlaceholder:'City, address or MLS® number'}
  const button=document.querySelector('.home-search button');if(button){button.firstChild.textContent=(typeof c.searchButton==='string'&&c.searchButton.trim()?c.searchButton.slice(0,30):'Search')+' ';}
  for(const [css,key]of [['--cms-heading-font','headingFont'],['--cms-body-font','bodyFont']]){if(fonts[c[key]])document.documentElement.style.setProperty(css,fonts[c[key]]);else document.documentElement.style.removeProperty(css)}
  size('--cms-hero-size',c.heroSize,36,88);size('--cms-heading-size',c.headingSize,26,60);size('--cms-body-size',c.bodySize,13,22);size('--cms-office-size',c.officeSize,24,48);
  if(video&&source){const next=asset(c.heroVideoUrl)||originalVideo;if(source.getAttribute('src')!==next){source.src=next;video.load();if(!matchMedia('(prefers-reduced-motion: reduce)').matches)video.play().catch(()=>{})}const poster=asset(c.heroPosterUrl)||originalPoster;if(poster)video.setAttribute('poster',poster);else video.removeAttribute('poster');}
 }
 if(new URLSearchParams(location.search).get('editorPreview')==='1'){
  const allowed=window.APP_CONFIG?.SANITY_STUDIO_ORIGIN||location.origin;
  window.addEventListener('message',e=>{if(!allowed||e.origin!==allowed||e.source!==parent||e.data?.type!=='changerealty-home-preview')return;previewActive=true;render(e.data.content)});
 }
 fetch('/api/content/homepage',{signal:AbortSignal.timeout(5000)}).then(r=>r.ok?r.json():null).then(data=>{if(!previewActive&&data?.content)render(data.content)}).catch(()=>{});
})();
