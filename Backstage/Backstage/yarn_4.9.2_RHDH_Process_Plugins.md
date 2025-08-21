# Packaging RHDH Plugins for Yarn 3+
#### Ran with yarn 4.9.2

## Backend Plugin Flow

### Clone the plugin repo
```
git clone <your-plugin-repo>.git 
cd <your-plugin-repo>
```

```
yarn install
```
### Run tsc in each plugin folder
```
npx tsc
```
### Run red hat developer cli tool
```
npx @red-hat-developer-hub/cli@latest plugin export --shared-package '!/"@<individual-plugin-name-from-package.json>' --embed-package @<individual-plugin-name-from-package.json>
```
## Package the plugin
```
npm pack
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

## Front End Plugin Flow

### Clone the plugin repo
```
git clone <your-plugin-repo>.git 
cd <your-plugin-repo>
```

```
yarn install
```
### Run cli build for front end plugins
```
yarn backstage-cli package build
```

### Run tsc in each plugin folder
```
npx tsc
```
### Run red hat developer cli tool
```
npx @red-hat-developer-hub/cli@latest plugin export
```
## Package the plugin
```
npm pack
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
