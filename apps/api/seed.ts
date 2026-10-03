import{PrismaClient,StaffRole}from"@prisma/client";import{scryptSync}from"node:crypto";import{encryptMfaSecret}from"./src/mfa-crypto.js";
const p=new PrismaClient();const pepper=process.env.PASSWORD_PEPPER||"dev-only";const pass=process.env.BOOTSTRAP_ADMIN_PASSWORD||"";const bootstrapToken=process.env.BOOTSTRAP_ADMIN_TOKEN||"";const secret=process.env.BOOTSTRAP_ADMIN_TOTP_SECRET||"";
if(pass.length<12)throw new Error("BOOTSTRAP_ADMIN_PASSWORD must be at least 12 characters");
if(!bootstrapToken||bootstrapToken.length<32)throw new Error("BOOTSTRAP_ADMIN_TOKEN must be at least 32 characters");
if(!secret)throw new Error("BOOTSTRAP_ADMIN_TOTP_SECRET required");
const hash=(s:string)=>scryptSync(s,pepper,32).toString("hex");
async function main(){const marker=await p.setting.findUnique({where:{key:"bootstrap.admin.initialized"}});if(marker?.value===true)throw new Error("BOOTSTRAP_ALREADY_COMPLETED");
const existing=await p.staffUser.findFirst({where:{role:StaffRole.ADMIN}});if(existing)throw new Error("ADMIN_ALREADY_EXISTS");
const encrypted=encryptMfaSecret(secret);
await p.$transaction(async tx=>{const admin=await tx.staffUser.create({data:{username:"admin",name:"Administrator",passwordHash:hash(pass),role:StaffRole.ADMIN,status:"ACTIVE",mfaEnabled:true}});
const roles=["admin","manager","cashier"];for(const name of roles)await tx.role.upsert({where:{name},update:{},create:{name}});
const permissions=["admin.access","pos.use","products.view","products.manage","sales.view","sales.create","sales.discount","sales.void","sales.refund","inventory.manage","reports.view","audit.view","terminals.manage","users.manage","roles.manage","settings.manage","payments.create","cash_session.open","cash_session.close","approvals.grant"];
for(const key of permissions)await tx.permission.upsert({where:{key},update:{},create:{key}});
const adminRole=await tx.role.findUniqueOrThrow({where:{name:"admin"}});const all=await tx.permission.findMany();
for(const perm of all)await tx.rolePermission.upsert({where:{roleId_permissionId:{roleId:adminRole.id,permissionId:perm.id}},update:{},create:{roleId:adminRole.id,permissionId:perm.id}});
await tx.staffRoleAssignment.create({data:{staffUserId:admin.id,roleId:adminRole.id}});
await tx.mfaCredential.create({data:{staffUserId:admin.id,secretEncrypted:encrypted}});
await tx.setting.create({data:{key:"bootstrap.admin.initialized",value:true}});
await tx.auditLog.create({data:{actorId:admin.id,action:"bootstrap.admin.created",entity:"staff",entityId:admin.id,success:true,metadata:{username:"admin"}}});});
process.stdout.write("Bootstrap admin initialized once. Disable/remove bootstrap secrets after success.\n");await p.$disconnect()}
main().catch(async e=>{process.stderr.write(String(e)+"\n");await p.$disconnect();process.exit(1)})