import {defineConfig} from "vite";

export default defineConfig({
    root: 'src',      // source files including index.html are in src/
    build: {
        outDir: '../dist',  // output folder relative to root (src)
        assetsDir: '',
        emptyOutDir: true,  // clear dist folder before build
    },
})
