// Post-processes dist/ to give the ESM condition its own declaration files.
// Remove once @makerx/ts-toolkit emits per-condition types natively.
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

const dist = 'dist'
const pkgPath = join(dist, 'package.json')
const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'))

// Order matters: `import` before `require`, `types` before `default`.
pkg.exports = {
  '.': {
    import: { types: './index.d.mts', default: './index.mjs' },
    require: { types: './index.d.ts', default: './index.js' },
  },
}

writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n')

// ESM resolution requires a matching .d.mts for every .d.ts that the ESM entry
// can transitively reach, and extensionless relative specifiers (`./plugins`)
// are invalid in ESM — they must be rewritten to explicit `./plugins/index.js`
// or `./foo.js` form so TypeScript resolves them to the sibling .d.mts files.
function rewriteSpecifiers(source, fileDir) {
  return source.replace(/(from\s+['"])(\.{1,2}\/[^'"]+?)(['"])/g, (match, prefix, spec, suffix) => {
    if (/\.(m?js|json)$/.test(spec)) return match
    const absolute = join(fileDir, spec)
    if (existsSync(absolute + '.d.ts')) return `${prefix}${spec}.js${suffix}`
    if (existsSync(join(absolute, 'index.d.ts'))) return `${prefix}${spec}/index.js${suffix}`
    return match
  })
}

function mirrorDeclarations(dir) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) {
      mirrorDeclarations(full)
    } else if (entry.endsWith('.d.ts')) {
      const target = full.slice(0, -'.d.ts'.length) + '.d.mts'
      writeFileSync(target, rewriteSpecifiers(readFileSync(full, 'utf-8'), dirname(full)))
    }
  }
}

mirrorDeclarations(dist)
