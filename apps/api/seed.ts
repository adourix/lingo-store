import{PrismaClient}from"@prisma/client";
const p=new PrismaClient();
const permissions=[
"admin.access","dashboard.view","pos.use","approvals.grant","cash_session.open","cash_session.close","cash_session.override",
"products.view","products.view_cost","products.create","products.update","products.delete","categories.manage","inventory.view","inventory.adjust",
"sales.view","sales.view_all","sales.create","sales.discount","sales.void","sales.refund","sales.reprint",
"purchases.view","purchases.create","customers.view","customers.manage","suppliers.view","suppliers.manage","payments.view","payments.create",
"expenses.view","expenses.create","reports.view","reports.view_profit","reports.export","users.view","users.create","users.update","users.disable",
"users.assign_role","users.reset_mfa","roles.manage","terminals.manage","sessions.revoke","audit.view","settings.manage"
];
async function main(){for(const key of permissions)await p.permission.upsert({where:{key},update:{},create:{key}});
for(const name of ["admin","manager","cashier"])await p.role.upsert({where:{name},update:{},create:{name}});
const all=await p.permission.findMany();const roles=await p.role.findMany();const admin=roles.find(x=>x.name==="admin");if(!admin)throw new Error("ADMIN_ROLE_MISSING");
for(const perm of all)await p.rolePermission.upsert({where:{roleId_permissionId:{roleId:admin.id,permissionId:perm.id}},update:{},create:{roleId:admin.id,permissionId:perm.id}});
const managerKeys=new Set(["dashboard.view","products.view","products.view_cost","products.create","products.update","products.delete","categories.manage","inventory.view","inventory.adjust","sales.view","sales.view_all","sales.create","sales.discount","sales.void","sales.refund","sales.reprint","purchases.view","purchases.create","customers.view","customers.manage","suppliers.view","suppliers.manage","payments.view","payments.create","expenses.view","expenses.create","reports.view","reports.view_profit","reports.export","cash_session.open","cash_session.close","approvals.grant"]);
const manager=roles.find(x=>x.name==="manager");if(!manager)throw new Error("MANAGER_ROLE_MISSING");await p.rolePermission.deleteMany({where:{roleId:manager.id}});for(const perm of all.filter(x=>managerKeys.has(x.key)))await p.rolePermission.upsert({where:{roleId_permissionId:{roleId:manager.id,permissionId:perm.id}},update:{},create:{roleId:manager.id,permissionId:perm.id}});
const cashierKeys=new Set(["pos.use","products.view","customers.view","customers.manage","sales.create","sales.discount","sales.void","sales.refund","sales.reprint","payments.create","cash_session.open","cash_session.close"]);
const cashier=roles.find(x=>x.name==="cashier");if(!cashier)throw new Error("CASHIER_ROLE_MISSING");await p.rolePermission.deleteMany({where:{roleId:cashier.id}});for(const perm of all.filter(x=>cashierKeys.has(x.key)))await p.rolePermission.upsert({where:{roleId_permissionId:{roleId:cashier.id,permissionId:perm.id}},update:{},create:{roleId:cashier.id,permissionId:perm.id}});
await p.setting.upsert({where:{key:"pos.discount.maxMinor"},update:{},create:{key:"pos.discount.maxMinor",value:0}});await p.setting.upsert({where:{key:"admin.refund.maxMinor"},update:{},create:{key:"admin.refund.maxMinor",value:0}});await p.setting.upsert({where:{key:"pos.refund.maxMinor"},update:{},create:{key:"pos.refund.maxMinor",value:0}});process.stdout.write("RBAC registry initialized. Use dist/cli.js admin:create for the first administrator.\n");await p.$disconnect()}
main().catch(async e=>{process.stderr.write(String(e)+"\n");await p.$disconnect();process.exit(1)});