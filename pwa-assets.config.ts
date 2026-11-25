// Generates the PNG icons in public/ from public/icon.svg. Run `npm run icons`
// after changing the SVG; the generated PNGs are committed so builds don't
// depend on native image tooling.
import { defineConfig, minimal2023Preset as preset } from '@vite-pwa/assets-generator/config'

const background = '#0f1217'

export default defineConfig({
  headLinkOptions: { preset: '2023' },
  preset: {
    ...preset,
    maskable: { ...preset.maskable, resizeOptions: { background } },
    apple: { ...preset.apple, resizeOptions: { background } },
  },
  images: ['public/icon.svg'],
})
