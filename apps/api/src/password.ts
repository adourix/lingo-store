import argon2 from "argon2";
import { createHash } from "node:crypto";

const COMMON=new Set(["password","password123","1234567890","12345678901234","qwertyuiop","letmein12345678"]);

export const validatePassword=(password:string,identity:string)=>{
  if(password.length<14||password.length>128)throw new Error("INVALID_PASSWORD");
  const folded=password.toLowerCase();
  if(folded.includes(identity.toLowerCase()))throw new Error("INVALID_PASSWORD");
  if(COMMON.has(folded))throw new Error("INVALID_PASSWORD");
};

export const validateCustomerPassword=(password:string,identity:string)=>{
  if(password.length<10||password.length>128)throw new Error("INVALID_PASSWORD");
  const folded=password.toLowerCase();
  if(folded.includes(identity.toLowerCase()))throw new Error("INVALID_PASSWORD");
  if(COMMON.has(folded))throw new Error("INVALID_PASSWORD");
};

const ARGON2_OPTIONS={memoryCost:19456,timeCost:2,parallelism:1};

export const hashPassword=(password:string)=>argon2.hash(password,ARGON2_OPTIONS);
export const verifyPassword=async(password:string,encoded:string)=>argon2.verify(encoded,password);
export const needsPasswordRehash=(encoded:string)=>argon2.needsRehash(encoded,ARGON2_OPTIONS);


export async function assertNotBreached(password: string): Promise<void> {
  if (process.env.NODE_ENV === "test" || process.env.PASSWORD_BREACH_CHECK === "off") return;
  const digest = createHash("sha1").update(password).digest("hex").toUpperCase();
  const prefix = digest.slice(0, 5);
  const suffix = digest.slice(5);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 2500);
  try {
    const response = await fetch("https://api.pwnedpasswords.com/range/" + prefix, {
      headers: { "Add-Padding": "true", "User-Agent": "Lingo-Store-Password-Check" },
      signal: controller.signal,
    });
    if (!response.ok) throw new Error("PASSWORD_BREACH_CHECK_UNAVAILABLE");
    const body = await response.text();
    const hit = body.split(/\\r?\\n/).some(line => line.toUpperCase().startsWith(suffix + ":"));
    if (hit) throw new Error("PASSWORD_BREACHED");
  } catch (error) {
    if (error instanceof Error && error.message === "PASSWORD_BREACHED") throw error;
    if (process.env.NODE_ENV === "production") throw new Error("PASSWORD_BREACH_CHECK_UNAVAILABLE");
  } finally {
    clearTimeout(timeout);
  }
}
