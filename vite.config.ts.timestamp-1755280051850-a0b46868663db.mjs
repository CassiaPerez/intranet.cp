// vite.config.ts
import { defineConfig, loadEnv } from "file:///home/project/node_modules/vite/dist/node/index.js";
import react from "file:///home/project/node_modules/@vitejs/plugin-react/dist/index.mjs";
var vite_config_default = defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const target = env.VITE_API_URL || "http://127.0.0.1:3005";
  return {
    plugins: [react()],
    server: {
      port: 0,
      strictPort: false,
      host: true,
      // acessível pela rede/StackBlitz
      watch: {
        ignored: ["**/data/**"]
        // Ignore database files to prevent EIO errors
      },
      hmr: {
        overlay: false
        // Disable error overlay that can cause crashes
      },
      proxy: {
        "/api": {
          target,
          changeOrigin: true,
          secure: false,
          timeout: 3e4,
          onError: (err, req, res) => {
            console.error("[VITE-PROXY] Proxy error:", err.message);
          },
          onProxyReq: (proxyReq, req, res) => {
            console.log("[VITE-PROXY] Request:", req.method, req.url);
          }
          // Se seu backend NÃO usa prefixo /api, descomente:
          // rewrite: p => p.replace(/^\/api/, ''),
        },
        "/auth": {
          target,
          changeOrigin: true,
          secure: false,
          timeout: 3e4
        }
      }
    },
    build: {
      sourcemap: true,
      rollupOptions: {
        onwarn: (warning, defaultHandler) => {
          if (warning.code === "SOURCEMAP_ERROR") {
            return;
          }
          defaultHandler(warning);
        }
      }
    }
  };
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCIvaG9tZS9wcm9qZWN0XCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ZpbGVuYW1lID0gXCIvaG9tZS9wcm9qZWN0L3ZpdGUuY29uZmlnLnRzXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ltcG9ydF9tZXRhX3VybCA9IFwiZmlsZTovLy9ob21lL3Byb2plY3Qvdml0ZS5jb25maWcudHNcIjtpbXBvcnQgeyBkZWZpbmVDb25maWcsIGxvYWRFbnYgfSBmcm9tICd2aXRlJ1xuaW1wb3J0IHJlYWN0IGZyb20gJ0B2aXRlanMvcGx1Z2luLXJlYWN0J1xuXG5leHBvcnQgZGVmYXVsdCBkZWZpbmVDb25maWcoKHsgbW9kZSB9KSA9PiB7XG4gIGNvbnN0IGVudiA9IGxvYWRFbnYobW9kZSwgcHJvY2Vzcy5jd2QoKSwgJycpXG4gIC8vIEFsdGVyZSBjb25mb3JtZSBvIGFtYmllbnRlOlxuICAvLyAtIERldiBsb2NhbDogaHR0cDovLzEyNy4wLjAuMTozMDA1XG4gIC8vIC0gU3RhY2tCbGl0ei9SZW1vdG86IGh0dHBzOi8vaW50cmFuZXQuZ3J1cG9jcm9wZmllbGQuY29tLmJyXG4gIGNvbnN0IHRhcmdldCA9IGVudi5WSVRFX0FQSV9VUkwgfHwgJ2h0dHA6Ly8xMjcuMC4wLjE6MzAwNSdcblxuICByZXR1cm4ge1xuICAgIHBsdWdpbnM6IFtyZWFjdCgpXSxcbiAgICBzZXJ2ZXI6IHtcbiAgICAgIHBvcnQ6IDAsXG4gICAgICBzdHJpY3RQb3J0OiBmYWxzZSxcbiAgICAgIGhvc3Q6IHRydWUsIC8vIGFjZXNzXHUwMEVEdmVsIHBlbGEgcmVkZS9TdGFja0JsaXR6XG4gICAgICB3YXRjaDoge1xuICAgICAgICBpZ25vcmVkOiBbJyoqL2RhdGEvKionXSwgLy8gSWdub3JlIGRhdGFiYXNlIGZpbGVzIHRvIHByZXZlbnQgRUlPIGVycm9yc1xuICAgICAgfSxcbiAgICAgIGhtcjoge1xuICAgICAgICBvdmVybGF5OiBmYWxzZSwgLy8gRGlzYWJsZSBlcnJvciBvdmVybGF5IHRoYXQgY2FuIGNhdXNlIGNyYXNoZXNcbiAgICAgIH0sXG4gICAgICBwcm94eToge1xuICAgICAgICAnL2FwaSc6IHtcbiAgICAgICAgICB0YXJnZXQsXG4gICAgICAgICAgY2hhbmdlT3JpZ2luOiB0cnVlLFxuICAgICAgICAgIHNlY3VyZTogZmFsc2UsXG4gICAgICAgICAgdGltZW91dDogMzAwMDAsXG4gICAgICAgICAgb25FcnJvcjogKGVyciwgcmVxLCByZXMpID0+IHtcbiAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoJ1tWSVRFLVBST1hZXSBQcm94eSBlcnJvcjonLCBlcnIubWVzc2FnZSk7XG4gICAgICAgICAgfSxcbiAgICAgICAgICBvblByb3h5UmVxOiAocHJveHlSZXEsIHJlcSwgcmVzKSA9PiB7XG4gICAgICAgICAgICBjb25zb2xlLmxvZygnW1ZJVEUtUFJPWFldIFJlcXVlc3Q6JywgcmVxLm1ldGhvZCwgcmVxLnVybCk7XG4gICAgICAgICAgfVxuICAgICAgICAgIC8vIFNlIHNldSBiYWNrZW5kIE5cdTAwQzNPIHVzYSBwcmVmaXhvIC9hcGksIGRlc2NvbWVudGU6XG4gICAgICAgICAgLy8gcmV3cml0ZTogcCA9PiBwLnJlcGxhY2UoL15cXC9hcGkvLCAnJyksXG4gICAgICAgIH0sXG4gICAgICAgICcvYXV0aCc6IHtcbiAgICAgICAgICB0YXJnZXQsXG4gICAgICAgICAgY2hhbmdlT3JpZ2luOiB0cnVlLFxuICAgICAgICAgIHNlY3VyZTogZmFsc2UsXG4gICAgICAgICAgdGltZW91dDogMzAwMDAsXG4gICAgICAgIH0sXG4gICAgICB9LFxuICAgIH0sXG4gICAgYnVpbGQ6IHtcbiAgICAgIHNvdXJjZW1hcDogdHJ1ZSxcbiAgICAgIHJvbGx1cE9wdGlvbnM6IHtcbiAgICAgICAgb253YXJuOiAod2FybmluZywgZGVmYXVsdEhhbmRsZXIpID0+IHtcbiAgICAgICAgICAvLyBTdXBwcmVzcyBjZXJ0YWluIHdhcm5pbmdzIHRoYXQgY2FuIGNhdXNlIGJ1aWxkIGlzc3Vlc1xuICAgICAgICAgIGlmICh3YXJuaW5nLmNvZGUgPT09ICdTT1VSQ0VNQVBfRVJST1InKSB7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgfVxuICAgICAgICAgIGRlZmF1bHRIYW5kbGVyKHdhcm5pbmcpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICB9XG59KVxuIl0sCiAgIm1hcHBpbmdzIjogIjtBQUF5TixTQUFTLGNBQWMsZUFBZTtBQUMvUCxPQUFPLFdBQVc7QUFFbEIsSUFBTyxzQkFBUSxhQUFhLENBQUMsRUFBRSxLQUFLLE1BQU07QUFDeEMsUUFBTSxNQUFNLFFBQVEsTUFBTSxRQUFRLElBQUksR0FBRyxFQUFFO0FBSTNDLFFBQU0sU0FBUyxJQUFJLGdCQUFnQjtBQUVuQyxTQUFPO0FBQUEsSUFDTCxTQUFTLENBQUMsTUFBTSxDQUFDO0FBQUEsSUFDakIsUUFBUTtBQUFBLE1BQ04sTUFBTTtBQUFBLE1BQ04sWUFBWTtBQUFBLE1BQ1osTUFBTTtBQUFBO0FBQUEsTUFDTixPQUFPO0FBQUEsUUFDTCxTQUFTLENBQUMsWUFBWTtBQUFBO0FBQUEsTUFDeEI7QUFBQSxNQUNBLEtBQUs7QUFBQSxRQUNILFNBQVM7QUFBQTtBQUFBLE1BQ1g7QUFBQSxNQUNBLE9BQU87QUFBQSxRQUNMLFFBQVE7QUFBQSxVQUNOO0FBQUEsVUFDQSxjQUFjO0FBQUEsVUFDZCxRQUFRO0FBQUEsVUFDUixTQUFTO0FBQUEsVUFDVCxTQUFTLENBQUMsS0FBSyxLQUFLLFFBQVE7QUFDMUIsb0JBQVEsTUFBTSw2QkFBNkIsSUFBSSxPQUFPO0FBQUEsVUFDeEQ7QUFBQSxVQUNBLFlBQVksQ0FBQyxVQUFVLEtBQUssUUFBUTtBQUNsQyxvQkFBUSxJQUFJLHlCQUF5QixJQUFJLFFBQVEsSUFBSSxHQUFHO0FBQUEsVUFDMUQ7QUFBQTtBQUFBO0FBQUEsUUFHRjtBQUFBLFFBQ0EsU0FBUztBQUFBLFVBQ1A7QUFBQSxVQUNBLGNBQWM7QUFBQSxVQUNkLFFBQVE7QUFBQSxVQUNSLFNBQVM7QUFBQSxRQUNYO0FBQUEsTUFDRjtBQUFBLElBQ0Y7QUFBQSxJQUNBLE9BQU87QUFBQSxNQUNMLFdBQVc7QUFBQSxNQUNYLGVBQWU7QUFBQSxRQUNiLFFBQVEsQ0FBQyxTQUFTLG1CQUFtQjtBQUVuQyxjQUFJLFFBQVEsU0FBUyxtQkFBbUI7QUFDdEM7QUFBQSxVQUNGO0FBQ0EseUJBQWUsT0FBTztBQUFBLFFBQ3hCO0FBQUEsTUFDRjtBQUFBLElBQ0Y7QUFBQSxFQUNGO0FBQ0YsQ0FBQzsiLAogICJuYW1lcyI6IFtdCn0K
