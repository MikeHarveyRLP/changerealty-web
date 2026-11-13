import React,{useEffect,useRef,useState} from 'react';
import {useClient} from 'sanity';
import pages from '../page-manifest.json';
export default function PagePreview(props){
 const client=useClient({apiVersion:'2025-02-19'}),frame=useRef(null),[width,setWidth]=useState('100%'),[portraitUrl,setPortraitUrl]=useState(null);
 const doc=props.document?.displayed||{},key=String(doc._type||'').replace(/^page_/,''),page=pages.find(p=>p.key===key),ref=doc.portrait?.asset?._ref;
 useEffect(()=>{let active=true;if(!ref){setPortraitUrl(null);return}client.fetch('*[_id == $id][0].url',{id:ref}).then(url=>{if(active)setPortraitUrl(url)}).catch(()=>{if(active)setPortraitUrl(null)});return()=>{active=false}},[client,ref]);
 const send=()=>frame.current?.contentWindow?.postMessage({type:'changerealty-page-preview',page:key,content:{...doc,portraitUrl}},window.location.origin);
 useEffect(send,[doc,portraitUrl,key]);
 if(!page)return <p>Select a page to preview.</p>;
 return <div style={{height:'100%',display:'flex',flexDirection:'column',background:'#f3f3ef'}}><div style={{padding:12,display:'flex',gap:12,alignItems:'center',flexWrap:'wrap'}}><button type="button" onClick={()=>setWidth('100%')}>Desktop</button><button type="button" onClick={()=>setWidth('390px')}>Mobile</button><span style={{fontSize:12}}>Draft preview · publish to update the website</span></div><iframe ref={frame} onLoad={send} title={page.title+' draft preview'} src={window.location.origin+page.path+'?editorPreview=1'} style={{width,maxWidth:'100%',flex:1,alignSelf:'center',border:0,background:'white'}}/></div>;
}
