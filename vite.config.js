import { defineConfig } from 'vite';

export default defineConfig({
  // Relative base so the build works whether it's served from a domain
  // root (custom domain) or a GitHub Pages project path (/repo-name/).
  base: './',
});
