import {defineConfig} from 'sanity';
import {structureTool} from 'sanity/structure';
import homepage from './schemaTypes/homepage';
import HomePreview from './components/HomePreview';
import PagePreview from './components/PagePreview';
import {pageSchemas} from './schemaTypes/pages';
import pages from './page-manifest.json';
const projectId=import.meta.env.SANITY_STUDIO_PROJECT_ID;
if(!projectId)throw new Error('Set SANITY_STUDIO_PROJECT_ID in the Studio .env file.');
export default defineConfig({name:'changerealty',title:'Change Realty editor',projectId,dataset:import.meta.env.SANITY_STUDIO_DATASET||'production',plugins:[structureTool({structure:S=>S.list().title('Your website').items([S.listItem().title('Homepage').id('homepage').child(S.document().schemaType('homepage').documentId('homepage').title('Homepage').views([S.view.form().title('Edit content'),S.view.component(HomePreview).title('Preview')])),...pages.map(page=>S.listItem().title(page.title).id(page.key).child(S.document().schemaType('page_'+page.key).documentId('page-'+page.key).title(page.title).views([S.view.form().title('Edit content'),S.view.component(PagePreview).title('Preview')])))])})],schema:{types:[homepage,...pageSchemas]},document:{newDocumentOptions:()=>[],actions:prev=>prev.filter(action=>!['duplicate','delete','unpublish'].includes(action.action))}});

