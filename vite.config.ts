import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import { BASE, pwaOptions } from './pwa.config';

export default defineConfig({ base: BASE, plugins: [react(), VitePWA(pwaOptions)] });
