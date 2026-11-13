import {defineType,defineField} from 'sanity';
const text=(name,title,group,value,max=200)=>defineField({name,title,type:'string',group,initialValue:value,validation:r=>r.required().max(max)});
const size=(name,title,value,min,max)=>defineField({name,title,type:'number',group:'style',initialValue:value,validation:r=>r.required().integer().min(min).max(max),description:`Pixels. Choose ${min}–${max}; mobile sizes adjust automatically.`});
export default defineType({name:'homepage',title:'Homepage',type:'document',groups:[{name:'hero',title:'Video & search',default:true},{name:'experience',title:'Experience message'},{name:'listings',title:'Office listings'},{name:'style',title:'Fonts & sizes'}],fields:[
 text('heroEyebrow','Small heading above the headline','hero','WATERLOO REGION & BEYOND'),
 text('heroTitle','Main headline','hero','Where’s your next change?',100),
 text('searchLabel','Search field label','hero','Location or MLS®'),
 text('searchPlaceholder','Search placeholder','hero','City, address or MLS® number'),
 text('searchButton','Search button text','hero','Search',30),
 defineField({name:'heroVideo',title:'Background video',type:'file',group:'hero',options:{accept:'video/mp4'},description:'Optional MP4 upload. Leave empty to retain the existing website video.'}),
 defineField({name:'heroPoster',title:'Video cover image',type:'image',group:'hero',options:{hotspot:true},description:'Optional cover image shown while the video loads.'}),
 text('experienceEyebrow','Small heading','experience','YOUR NEXT CHAPTER STARTS HERE'),
 text('experienceTitle','Experience heading','experience','Why your real estate experience matters.'),
 defineField({name:'experienceText',title:'Experience message',type:'text',rows:5,group:'experience',initialValue:'You are about to complete the biggest transaction of your life. Something that must be done right and with care. Let me help you make sure that is what happens.',validation:r=>r.required().max(1800)}),
 text('officeEyebrow','Office label','listings','ROYAL LEPAGE WOLLE REALTY'),text('officeTitle','Carousel heading','listings','Our office listings'),
 defineField({name:'headingFont',title:'Heading font',type:'string',group:'style',initialValue:'manrope',options:{list:[{title:'Manrope (current)',value:'manrope'},{title:'DM Sans',value:'dm-sans'},{title:'Georgia (serif)',value:'georgia'},{title:'Arial',value:'arial'}]},validation:r=>r.required()}),
 defineField({name:'bodyFont',title:'Body font',type:'string',group:'style',initialValue:'dm-sans',options:{list:[{title:'DM Sans (current)',value:'dm-sans'},{title:'Manrope',value:'manrope'},{title:'Georgia (serif)',value:'georgia'},{title:'Arial',value:'arial'}]},validation:r=>r.required()}),
 size('heroSize','Main headline size',64,36,88),size('headingSize','Experience heading size',44,26,60),size('bodySize','Experience message size',16,13,22),size('officeSize','Carousel heading size',34,24,48),
 ],preview:{prepare:()=>({title:'Homepage',subtitle:'Text, video, fonts and sizes'})}});

