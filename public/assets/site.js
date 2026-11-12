(() => {
 'use strict';
 const menu=document.querySelector('.menu-toggle'),nav=document.querySelector('#navigation');
 menu?.addEventListener('click',()=>{const open=menu.getAttribute('aria-expanded')!=='true';menu.setAttribute('aria-expanded',String(open));nav.classList.toggle('open',open)});
 document.addEventListener('keydown',e=>{if(e.key==='Escape'){menu?.setAttribute('aria-expanded','false');nav?.classList.remove('open');document.querySelectorAll('nav details[open]').forEach(d=>d.open=false)}});
 document.querySelectorAll('nav details').forEach(d=>d.addEventListener('toggle',()=>{if(d.open)document.querySelectorAll('nav details').forEach(other=>{if(other!==d)other.open=false})}));
 document.getElementById('year').textContent=new Date().getFullYear();
 const video=document.querySelector('#hero-video'),control=document.querySelector('.video-control');
 if(video){
  video.muted=true;
  const update=()=>{control.textContent=video.paused?'Play video ▷':'Pause video Ⅱ';control.setAttribute('aria-label',video.paused?'Play background video':'Pause background video')};
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  const motion=()=>{if(reduced.matches){video.autoplay=false;video.pause()}else video.play().catch(update);update()};motion();reduced.addEventListener('change',motion);
  video.addEventListener('play',update);video.addEventListener('pause',update);
  control.addEventListener('click',()=>{if(video.paused)video.play().catch(update);else video.pause()});
 }
 const track=document.querySelector('#office-listings');if(!track)return;
 const previous=document.querySelector('#previous'),next=document.querySelector('#next'),status=document.querySelector('#listing-status');
 const reduced=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;
 const updateArrows=()=>{previous.disabled=track.scrollLeft<5;next.disabled=track.scrollLeft+track.clientWidth>=track.scrollWidth-5};
 previous.addEventListener('click',()=>track.scrollBy({left:-track.clientWidth,behavior:reduced()?'instant':'smooth'}));
 next.addEventListener('click',()=>track.scrollBy({left:track.clientWidth,behavior:reduced()?'instant':'smooth'}));
 track.addEventListener('scroll',updateArrows,{passive:true});new ResizeObserver(updateArrows).observe(track);
 const money=n=>new Intl.NumberFormat('en-CA',{style:'currency',currency:'CAD',maximumFractionDigits:0}).format(n);
 function price(l){
  if(!l.is_lease)return money(Number(l.list_price));
  const unit=String(l.lease_per_unit||l.raw?.LeasePerUnit||'');
  const frequency=String(l.raw?.LeaseAmountFrequency||'').toLowerCase();
  const area=/sq|square/i.test(unit)?(/met/i.test(unit)?'/sq m':'/sq ft'):'';
  const period={monthly:'/month',month:'/month',annually:'/year',annual:'/year',yearly:'/year',weekly:'/week',daily:'/day'}[frequency]||'';
  return money(Number(l.lease_amount))+area+period;
 }
 const text=(tag,value,className)=>{const el=document.createElement(tag);el.textContent=value;if(className)el.className=className;return el};
 function card(l){
  const article=document.createElement('article');article.className='property-card';
  const link=document.createElement('a');link.href='/listing.html?key='+encodeURIComponent(l.listing_key);
  const photo=document.createElement('div');photo.className='card-photo';
  let url;try{const parsed=new URL(l.photo);if(parsed.protocol==='https:')url=parsed.href}catch{}
  const fallback=()=>photo.prepend(text('span','Photo unavailable','no-photo'));
  if(url){const img=new Image();img.src=url;img.alt=l.address_full||'Listing photo';img.loading='lazy';img.addEventListener('error',()=>{img.remove();fallback()},{once:true});photo.append(img)}else fallback();
  photo.append(text('span',l.is_lease?'For lease':'For sale','tag'));
  const body=document.createElement('div');body.className='card-body';
  body.append(text('p',price(l),'card-price'),text('h3',l.address_full||'View property','card-address'),text('p',[l.city,l.province].filter(Boolean).join(', '),'card-city'));
  const facts=[];if(Number(l.bedrooms_total)>0)facts.push(Number(l.bedrooms_total)+' beds');if(Number(l.bathrooms_total)>0)facts.push(Number(l.bathrooms_total)+' baths');facts.push('MLS® '+l.mls_number);
  body.append(text('div',facts.join(' · '),'card-details'),text('p',l.brokerage_name,'card-brokerage'));link.append(photo,body);article.append(link);return article;
 }
 async function load(){
  try{
   const base=String(window.APP_CONFIG?.API_BASE||'https://changerealty-api-production.up.railway.app').replace(/\/$/,'');
   const response=await fetch(base+'/api/listings?mode=all&brokerage=Royal%20LePage%20Wolle%20Realty&limit=20',{signal:AbortSignal.timeout(20000)});
   if(!response.ok)throw Error('Listing request failed');const rows=await response.json();if(!Array.isArray(rows))throw Error('Invalid listing response');
   // Guard against an older API ignoring the new filter during deployment.
   const listings=rows.filter(l=>String(l.brokerage_name||'').trim().toLowerCase()==='royal lepage wolle realty');
   const seen=new Set();const unique=listings.filter(l=>{const key=l.mls_number||l.listing_key;if(seen.has(key))return false;seen.add(key);return true});
   track.replaceChildren(...unique.map(card));status.textContent=unique.length?'':'No office listings are available right now. Please check back soon.';updateArrows();
  }catch{status.replaceChildren(text('span','Office listings couldn’t load. '));const retry=text('button','Try again');retry.addEventListener('click',()=>{status.textContent='Loading office listings…';load()});status.append(retry)}
 }
 load();
})();
