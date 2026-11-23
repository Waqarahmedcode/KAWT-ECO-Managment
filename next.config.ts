import type { NextConfig } from 'next';
const nextConfig: NextConfig = {
 reactStrictMode: true,
 poweredByHeader: false,
 serverExternalPackages: ['pdf-parse','pdfjs-dist','@napi-rs/canvas','tesseract.js','tesseract.js-core'],
 outputFileTracingIncludes: {
  '/api/lab/import': [
   './node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs',
   './node_modules/tesseract.js/src/**/*',
   './node_modules/tesseract.js-core/*.js',
   './node_modules/tesseract.js-core/*.wasm',
   './public/ocr-data/eng.traineddata',
   './public/ocr-data/LICENSE',
  ],
 },
};
export default nextConfig;
