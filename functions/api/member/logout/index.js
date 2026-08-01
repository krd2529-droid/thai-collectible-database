import { json } from '../../../lib/admin-auth.js';import { clearMemberCookie,deleteCurrentMemberSession } from '../../../lib/member-auth.js';
export async function onRequestPost(context){await deleteCurrentMemberSession(context.request,context.env);return json({ok:true},200,{'set-cookie':clearMemberCookie()})}export function onRequest(){return json({ok:false,error:'Method not allowed'},405)}
