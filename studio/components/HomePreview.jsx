import React,{useEffect,useRef,useState} from 'react';
import {useClient} from 'sanity';
export default function HomePreview(props){
 const client=useClient({apiVersion:'2025-02-19'}),frame=useRef(null),[width,setWidth]=useState('100%'),[assets,setAssets]=useState({});
 const doc=props.document?.displayed||{};
 const website=new URL(window.location.origin);
 const videoRef=doc.heroVideo?.asset?._ref,posterRef=doc.heroPoster?.asset?._ref;
 useEffect(()=>{let active=true;const ids=[videoRef,posterRef].filter(Boolean);if(!ids.length){setAssets({});return}client.fetch('*[_id in $ids]{_id,url}',{ids}).then(rows=>{if(active)setAssets(Object.fromEntries(rows.map(x=>[x._id,x.url])))}).catch(()=>{if(active)setAssets({})});return()=>{active=false}},[client,videoRef,posterRef]);
 const send=()=>frame.current?.contentWindow?.postMessage({type:'changerealty-home-preview',content:{...doc,heroVideoUrl:assets[videoRef]||null,heroPosterUrl:assets[posterRef]||null}},website.origin);
 useEffect(send,[doc,assets]);
 return <div style={{height:'100%',display:'flex',flexDirection:'column',background:'#f3f3ef'}}><div style={{padding:12,display:'flex',gap:12,alignItems:'center',flexWrap:'wrap'}}><button type="button" onClick={()=>setWidth('100%')}>Desktop</button><button type="button" onClick={()=>setWidth('390px')}>Mobile</button><span style={{fontSize:12}}>Draft preview · publish to update the website</span></div><iframe ref={frame} onLoad={send} title="Homepage draft preview" src={website.origin+'/?editorPreview=1'} style={{width,maxWidth:'100%',flex:1,alignSelf:'center',border:0,background:'white'}}/></div>;
}
