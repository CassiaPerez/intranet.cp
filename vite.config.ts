import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  // Altere conforme o ambiente:
  // - Dev local: http://127.0.0.1:3005
  // - StackBlitz/Remoto: https://intranet.grupocropfield.com.br
  const target = env.VITE_API_URL || 'http://127.0.0.1:3005'

  return {
    plugins: [react()],
    server: {
      port: 5176,
      strictPort: true,
      host: true, // acessível pela rede/StackBlitz
      proxy: {
        '/api': {
          target,
          changeOrigin: true,
          secure: false,
          // Se seu backend NÃO usa prefixo /api, descomente:
          // rewrite: p => p.replace(/^\/api/, ''),
        },
      },
    },
  }
})
