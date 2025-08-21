# Packaging RHDH Plugins

## Clone the plugin repo
```
git clone <your-plugin-repo>.git 
cd <your-plugin-repo>
```
## Temporarily switch to Yarn classic and install dependencies if applicable
#### Optional
```
yarn set version 1.22.22
```
Or yarn install if only using yarn classic and not yarn berry 2+ or higher
```
yarn install
```

## Switch back to Yarn 4.9.2 if applicable
#### Optional
```
yarn set version 4.9.2
```
## Run yarn tsc in each plugin folder
```
yarn tsc
```
## Run yarn build in each plugin folder
```
yarn build
```
## Create build.mjs in the plugin folder [BACKEND PLUGINS ONLY]
```
touch build.mjs
```
```
// build.mjs
import { build } from 'esbuild';

await build({
  entryPoints: ['./src/index.ts'],
  bundle: true,
  platform: 'node',
  target: 'node16',
  outfile: 'dist/index.cjs.js',
  format: 'cjs',
  external: [],
});
```

## Run the custom esbuild build CMD [BACKEND PLUGINS ONLY]
```
rmdir /s /q dist
node build.mjs
```

## Run the custom esbuild build Git Bash [BACKEND PLUGINS ONLY]
```
rm -rf dist
node build.mjs
```
## Package the plugin
```
yarn pack
```
## Copy the package to your RHDH plugin server [Git Bash]
```
oc cp <plugin.tgz> <plugin-server-pod>:/opt/app-root/src -n <namespace>
```
## Copy the package to your RHDH plugin server [CMD or PowerShell]
```
oc cp your-plugin-name.tgz <namespace>/<plugin-server-pod>:/var/www/html/
```
## Generate SHA-512 hash for the plugin package
```
openssl dgst -sha512 -binary your-plugin-name.tgz | openssl base64 -A
```
## Include .tgz file and sha512 in dynamic plugins [Example]
```
includes:
- dynamic-plugins.default.yaml
plugins:
  - package: https://plugin-server-poteatc-dev.apps.rm1.0a51.p1.openshiftapps.com/your-plugin-name.tgz
    integrity: sha512-<sha512-value>==
    disabled: false
```
