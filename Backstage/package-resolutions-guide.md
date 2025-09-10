# Package Resolutions Guide

This document explains the comprehensive resolutions block used in `package.json` to resolve dependency conflicts when developing and packaging Backstage plugins.

## What This Resolves

✅ **react/jsx-runtime errors** - Forces consistent React JSX runtime across all packages  
✅ **Module not found errors** - Ensures all common dependencies are available  
✅ **Version conflicts** - Prevents different packages from requesting incompatible versions  
✅ **Build failures** - Resolves TypeScript, Webpack, and build tool conflicts  
✅ **Material UI conflicts** - Handles both v4 and v5 compatibility  
✅ **Plugin packaging issues** - Ensures dynamic plugin exports work correctly  

## Resolution Categories

### React Ecosystem
Core React packages and JSX runtime that most plugins depend on:
- `react`, `react-dom` - Core React libraries
- `react/jsx-runtime`, `react/jsx-dev-runtime` - **Fixes jsx-runtime errors**
- `@types/react`, `@types/react-dom` - TypeScript definitions

### TypeScript & Build Tools
Essential build toolchain dependencies:
- `typescript` - TypeScript compiler
- `@babel/*` - Babel transformation tools
- `webpack`, `esbuild`, `rollup`, `vite` - Bundlers
- `ts-loader`, `babel-loader` - Webpack loaders

### Material UI
Both v4 (legacy Backstage) and v5 (modern) Material UI packages:
- `@material-ui/*` - Material UI v4 (legacy Backstage)
- `@mui/*` - Material UI v5 (modern)
- `@emotion/*` - Emotion CSS-in-JS (required by MUI v5)

### Routing
React Router packages for navigation:
- `react-router`, `react-router-dom` - Client-side routing
- `history` - History management

### React Utilities
Common React helper libraries:
- `react-use` - React hooks collection
- `react-hook-form` - Form handling
- `react-markdown` - Markdown rendering
- `react-icons` - Icon components

### State Management
State management solutions:
- `zustand` - Lightweight state management
- `react-query`, `@tanstack/react-query` - Server state management
- `swr` - Data fetching

### JavaScript Utilities
Common utility libraries:
- `lodash`, `ramda` - Utility functions
- `uuid` - UUID generation
- `classnames`, `clsx` - CSS class helpers
- `immer` - Immutable updates

### HTTP & API
Network request libraries:
- `axios` - HTTP client
- `cross-fetch`, `node-fetch` - Fetch polyfills
- `whatwg-fetch` - Fetch API polyfill

### Date & Time
Date manipulation libraries:
- `luxon` - Modern date library
- `moment` - Legacy date library
- `date-fns` - Modular date utilities
- `dayjs` - Lightweight date library

### Charts & Visualization
Data visualization libraries:
- `recharts` - React chart components
- `d3` - Data visualization
- `chart.js`, `react-chartjs-2` - Chart.js integration
- `plotly.js`, `react-plotly.js` - Plotly integration

### Form Handling
Form libraries and validation:
- `formik` - Form library
- `yup`, `joi` - Schema validation
- `ajv` - JSON schema validation

### CSS & Styling
Styling solutions:
- `styled-components` - CSS-in-JS
- `sass`, `postcss` - CSS preprocessors
- CSS loaders for Webpack

### Markdown & Documentation
Markdown processing:
- `remark`, `unified` - Markdown processing
- `remark-gfm` - GitHub Flavored Markdown
- `prismjs`, `react-syntax-highlighter` - Code highlighting

### Testing
Testing framework dependencies:
- `@testing-library/*` - React testing utilities
- `jest` - Testing framework
- `jest-environment-jsdom` - DOM environment for tests

### Node.js Utilities
Node.js specific utilities:
- `fs-extra` - Enhanced file system operations
- `glob` - File pattern matching
- `rimraf` - Cross-platform rm -rf
- `mkdirp` - Directory creation

### Data Processing
Data manipulation libraries:
- `js-yaml` - YAML parsing
- `csv-parser`, `papaparse` - CSV processing
- `xml2js` - XML parsing

### Compression & Archives
File compression utilities:
- `tar` - TAR archives
- `unzipper` - ZIP extraction
- `archiver` - Archive creation

### Security & Crypto
Browser-compatible crypto:
- `crypto-browserify` - Crypto polyfill
- `buffer` - Buffer polyfill
- `stream-browserify` - Stream polyfill

### Internationalization
i18n support:
- `react-i18next`, `i18next` - Internationalization

### Development Tools
Development utilities:
- `nodemon` - Development server
- `concurrently` - Run multiple commands
- `cross-env` - Cross-platform environment variables
- `dotenv` - Environment variable loading

### Webpack Plugins
Essential Webpack plugins:
- `html-webpack-plugin` - HTML generation
- `copy-webpack-plugin` - File copying
- `mini-css-extract-plugin` - CSS extraction
- `terser-webpack-plugin` - JS minification

### Polyfills
Browser compatibility:
- `core-js` - JavaScript polyfills
- `regenerator-runtime` - Async/await support

## Usage

1. **Add the resolutions block** to your root `package.json`
2. **Run yarn install** to apply the resolutions
3. **Build your plugins** - dependency conflicts should be resolved

```bash
yarn install
yarn workspace @your-org/plugin-name build
