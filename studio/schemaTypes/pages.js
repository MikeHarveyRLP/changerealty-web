import {defineType,defineField} from 'sanity';
import pages from '../page-manifest.json';
const fontOptions=[{title:'Keep page font',value:'default'},{title:'Manrope',value:'manrope'},{title:'DM Sans',value:'dm-sans'},{title:'Georgia',value:'georgia'},{title:'Arial',value:'arial'}];
export const pageSchemas=pages.map(page=>defineType({
 name:'page_'+page.key,title:page.title,type:'document',
 groups:[{name:'content',title:'Page text',default:true},{name:'style',title:'Fonts & sizes'}],
 initialValue:{copy:Object.fromEntries(page.fields.map(f=>[f.name,f.value])),headingFont:'default',bodyFont:'default'},
 fields:[defineField({name:'copy',title:'Page text',type:'object',group:'content',fields:page.fields.map(f=>defineField({name:f.name,title:f.title,type:f.multiline?'text':'string',...(f.multiline?{rows:4}:{}),validation:r=>r.required().max(6000)}))}),
 ...(page.key==='about'?[defineField({name:'portrait',title:'Portrait',type:'image',group:'content',options:{hotspot:true},description:'Leave empty to keep the existing photo.'})]:[]),
 ...['heading','body'].map(kind=>defineField({name:kind+'Font',title:kind==='heading'?'Heading font':'Body font',type:'string',group:'style',options:{list:fontOptions},initialValue:'default'})),
 defineField({name:'headingSize',title:'Main heading size',type:'number',group:'style',description:'Optional, 26–64 pixels. Leave empty to retain the page design.',validation:r=>r.integer().min(26).max(64)}),
 defineField({name:'bodySize',title:'Paragraph size',type:'number',group:'style',description:'Optional, 13–22 pixels.',validation:r=>r.integer().min(13).max(22)})],
 preview:{prepare:()=>({title:page.title,subtitle:'Website page text and style'})}
}));
