import {defineConfig} from "vite";
import basicSsl from '@vitejs/plugin-basic-ssl'

export default defineConfig({
    root: 'src',      // source files including index.html are in src/
    build: {
        outDir: '../dist',  // output folder relative to root (src)
        assetsDir: '',
        emptyOutDir: true,  // clear dist folder before build
    },
    plugins: [basicSsl()]
})
