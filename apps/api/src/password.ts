import argon2 from "argon2";
const COMMON=new Set(["password","password123","1234567890","12345678901234","qwertyuiop","letmein12345678"]);
export const validatePassword=(password:string,identity:string)=>{if(password.length<14||password.length>128)throw new Error("INVALID_PASSWORD");const folded=password.toLowerCase();if(folded.includes(identity.toLowerCase()))throw new Error("INVALID_PASSWORD");if(COMMON.has(folded))throw new Error("INVALID_PASSWORD")};
export const validateCustomerPassword=(password:string,identity:string)=>{if(password.length<10||password.length>128)throw new Error("INVALID_PASSWORD");const folded=password.toLowerCase();if(folded.includes(identity.toLowerCase()))throw new Error("INVALID_PASSWORD");if(COMMON.has(folded))throw new Error("INVALID_PASSWORD")};
export const hashPassword=(password:string)=>argon2.hash(password,{type:argon2.argon2id,memoryCost:19456,timeCost:2,parallelism:1});
export const verifyPassword=async(password:string,encoded:string)=>argon2.verify(encoded,password);export const needsPasswordRehash=(encoded:string)=>argon2.needsRehash(encoded,{type:argon2.argon2id,memoryCost:19456,timeCost:2,parallelism:1});
