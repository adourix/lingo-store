import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins:[react()],
  server:{
    proxy:{
      "/api":{
        target:process.env.API_INTERNAL_URL||"http://127.0.0.1:4000",
        changeOrigin:false
      },
      "/ws":{
        target:process.env.API_INTERNAL_URL||"http://127.0.0.1:4000",
        ws:true,
        changeOrigin:false
      }
    }
  }
});
