export type SetupMail={to:string;name:string;setupUrl:string;totpSecret:string;expiresAt:Date};
export async function sendStaffSetupMail(mail:SetupMail){const hook=process.env.MAILER_WEBHOOK_URL;if(!hook){if(process.env.NODE_ENV==="production")throw new Error("MAILER_NOT_CONFIGURED");return}
const body={to:mail.to,name:mail.name,subject:"Lingo Store staff account setup",text:"Open the secure setup link to choose your password and enroll MFA. The link expires soon.",setupUrl:mail.setupUrl,totpSecret:mail.totpSecret,expiresAt:mail.expiresAt.toISOString()};
const r=await fetch(hook,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(body)});if(!r.ok)throw new Error("MAILER_FAILED")}
