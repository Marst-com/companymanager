import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
// 루트의 .env를 읽음. VITE_ 접두사가 붙은 값만 브라우저에 노출됨 (서버 비밀키는 노출 안 됨)
export default defineConfig({ plugins: [react()], envDir: '..' });
