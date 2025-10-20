# VM Provisioning with RHDH

## Complete Production Implementation Guide

**Red Hat Developer Hub → GitHub Actions → Nutanix**

**Version 2.0 | Production Ready with Backend Token Authentication**

-----

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
1. [Notification Strategy (4 Notifications)](#2-notification-strategy-4-notifications)
1. [Prerequisites & Setup](#3-prerequisites--setup)
1. [RHDH Template Configuration](#4-rhdh-template-configuration)
1. [GitHub Actions Workflow](#5-github-actions-workflow)
1. [Testing & Validation](#6-testing--validation)
1. [Production Deployment Checklist](#7-production-deployment-checklist)
1. [Appendix](#8-appendix)

-----

## 1. Architecture Overview

### 1.1 Objective

Enable self-service VM provisioning through RHDH with real-time progress tracking and automatic catalog registration for successful builds only.

### 1.2 High-Level Flow

```
User submits RHDH Template
    ↓
RHDH validates inputs & triggers GitHub Actions
    ↓
🚀 NOTIFICATION 1: "VM Provisioning Started"
    ↓
GitHub Actions workflow starts
    ↓
Node.js calls Nutanix API to create VM
    ↓
Monitor VM creation (polling every 30 seconds)
    ↓ (~15 minutes)
⏱️ NOTIFICATION 2: "VM Building... 33% complete"
    ↓ (~15 minutes)
⏱️ NOTIFICATION 3: "VM Building... 66% complete"
    ↓ (~15 minutes)
VM fully provisioned with IP address
    ↓
SUCCESS PATH:
    Register VM in RHDH Catalog
    ↓
    ✅ NOTIFICATION 4: "VM Ready!" (with IP, UUID, catalog link)

FAILURE PATH:
    NO catalog registration
    ↓
    ❌ NOTIFICATION 4: "VM Provisioning Failed" (with error details)
```

### 1.3 Key Components

|Component         |Purpose                           |Technology                    |
|------------------|----------------------------------|------------------------------|
|RHDH Template     |User interface for VM requests    |Backstage YAML                |
|GitHub Actions    |Orchestration & provisioning logic|workflow_dispatch + Node.js   |
|Nutanix API       |VM creation & management          |REST API (Prism Central)      |
|RHDH Notifications|Real-time status updates          |Backstage Notifications Plugin|
|RHDH Catalog      |VM inventory & metadata           |Backstage Catalog API         |
|Backend Token Auth|Secure API authentication         |Static Bearer Token           |

### 1.4 Notification Strategy

**4 Notifications Per Request:**

1. **START**: Immediate confirmation that provisioning began
1. **Progress Update 1**: At 15 minutes (33% complete)
1. **Progress Update 2**: At 30 minutes (66% complete)
1. **COMPLETION**: Success with full details OR Failure with error info

-----

## 2. Notification Strategy (4 Notifications)

### 2.1 Notification Timeline

|Time|Notification                |Severity       |Recipients                          |
|----|----------------------------|---------------|------------------------------------|
|0:00|🚀 VM Provisioning Started   |High           |Owner + Requester                   |
|0:15|⏱️ VM Building Progress (33%)|Normal         |Owner + Requester                   |
|0:30|⏱️ VM Building Progress (66%)|Normal         |Owner + Requester                   |
|0:45|✅ VM Ready! (or ❌ Failed)   |High / Critical|Owner + Requester (+ Ops on failure)|

### 2.2 Notification Content Examples

#### Notification 1: Start

```
Title: 🚀 VM Provisioning Started
Description:
Building VM: test-vm-001

• Environment: production
• CPU: 4 cores
• Memory: 16GB
• OS: rhel-9

Estimated time: ~45 minutes
```

#### Notification 2 & 3: Progress

```
Title: ⏱️ VM Building Progress
Description:
VM: test-vm-001

Progress: ~33% complete
Elapsed: 15 minutes

Still provisioning...
```

#### Notification 4a: Success

```
Title: ✅ VM Ready!
Description:
VM test-vm-001 is fully provisioned and ready to use!

Details:
• IP Address: 192.168.1.100
• UUID: abc-123-def-456
• CPU: 4 cores
• Memory: 16GB
• OS: rhel-9
• Environment: production

[View in Catalog →]
```

#### Notification 4b: Failure

```
Title: ❌ VM Provisioning Failed
Description:
Failed to provision VM: test-vm-001

Requested Configuration:
• CPU: 4 cores
• Memory: 16GB
• OS: rhel-9
• Environment: production

The VM was NOT added to the catalog.

[View Logs →]
```

-----

## 3. Prerequisites & Setup

### 3.1 Required Components

- **Red Hat Developer Hub (RHDH)** - v1.2 or higher
- **GitHub Repository** - For workflow storage
- **Nutanix Prism Central** - API access enabled
- **RHDH Notifications Plugin** - Installed and enabled

### 3.2 GitHub Secrets Configuration

Add the following secrets to your GitHub repository (Settings → Secrets → Actions):

|Secret Name       |Description                      |Example Value                   |
|------------------|---------------------------------|--------------------------------|
|`BACKEND_TOKEN`   |RHDH backend authentication token|`your-secure-backend-token-here`|
|`NUTANIX_API_URL` |Prism Central URL                |`https://prism.company.com:9440`|
|`NUTANIX_USERNAME`|API username                     |`api-user`                      |
|`NUTANIX_PASSWORD`|API password                     |`••••••••`                      |
|`RHDH_URL`        |RHDH instance URL                |`https://rhdh.company.com`      |

### 3.3 RHDH Backend Token Setup

RHDH uses backend tokens for secure API authentication from external services like GitHub Actions.

#### Step 1: Generate a Backend Token

Generate a secure random token:

```bash
# Generate a 32-byte random token
openssl rand -hex 32
```

**Example output:**

```
a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f2
```

#### Step 2: Configure RHDH Backend

Add the token to your RHDH configuration. This can be done in two ways:

**Option A: Via app-config.yaml (for local/development)**

```yaml
backend:
  auth:
    keys:
      - secret: ${BACKEND_SECRET}
  
  # Allow backend token authentication
  auth:
    externalAccess:
      - type: static
        options:
          token: ${BACKEND_TOKEN}
          subject: github-actions-provisioner
```

**Option B: Via Kubernetes Secret (for production)**

Create a secret in your RHDH namespace:

```bash
# Create Kubernetes secret
kubectl create secret generic backstage-backend-token \
  --from-literal=token='a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f2' \
  -n rhdh
```

Update your RHDH deployment ConfigMap:

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: app-config-rhdh
  namespace: rhdh
data:
  app-config-production.yaml: |
    backend:
      auth:
        keys:
          - secret: ${BACKEND_SECRET}
      
      # External access configuration
      externalAccess:
        - type: static
          options:
            token: ${BACKEND_TOKEN}
            subject: github-actions
```

Update your RHDH Deployment to inject the token:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: backstage
  namespace: rhdh
spec:
  template:
    spec:
      containers:
      - name: backstage
        env:
        - name: BACKEND_TOKEN
          valueFrom:
            secretKeyRef:
              name: backstage-backend-token
              key: token
        - name: BACKEND_SECRET
          valueFrom:
            secretKeyRef:
              name: backstage-backend-secret
              key: secret
```

#### Step 3: Add Token to GitHub Secrets

1. Go to your GitHub repository
1. Navigate to **Settings → Secrets and variables → Actions**
1. Click **New repository secret**
1. Name: `BACKEND_TOKEN`
1. Value: `a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f2`
1. Click **Add secret**

#### Step 4: Verify Token Configuration

Test the token with a simple API call:

```bash
# Test Notifications API
curl -X POST https://rhdh.company.com/api/notifications \
  -H "Authorization: Bearer a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f2" \
  -H "Content-Type: application/json" \
  -d '{
    "recipients": {
      "type": "entity",
      "entityRef": ["user:default/your-username"]
    },
    "payload": {
      "title": "Test Notification",
      "description": "Testing backend token authentication",
      "severity": "normal",
      "topic": "test"
    }
  }'
```

**Expected Response:** `200 OK` with notification appearing in RHDH

```bash
# Test Catalog API
curl -X GET https://rhdh.company.com/api/catalog/entities \
  -H "Authorization: Bearer a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f2"
```

**Expected Response:** `200 OK` with list of catalog entities

### 3.4 Enable RHDH Notifications Plugin

Ensure the notifications plugin is enabled in your RHDH configuration:

**For dynamic plugins (Red Hat build):**

```yaml
dynamicPlugins:
  frontend:
    janus-idp.backstage-plugin-notifications:
      disabled: false
  backend:
    janus-idp.backstage-plugin-notifications-backend:
      disabled: false
```

**For standard Backstage:**

```yaml
# In packages/backend/src/index.ts
backend.add(import('@backstage/plugin-notifications-backend'));

# In packages/app/src/App.tsx
import { NotificationsPage } from '@backstage/plugin-notifications';
```

-----

## 4. RHDH Template Configuration

### 4.1 Template File Structure

Create the following file structure in your RHDH templates repository:

```
rhdh-templates/
└── nutanix-vm/
    ├── template.yaml
    └── README.md
```

### 4.2 Complete Template Code

**File:** `templates/nutanix-vm/template.yaml`

```yaml
apiVersion: scaffolder.backstage.io/v1beta3
kind: Template
metadata:
  name: provision-nutanix-vm
  title: Provision Nutanix VM
  description: Self-service VM provisioning with progress tracking
  tags:
    - nutanix
    - vm
    - infrastructure
spec:
  owner: platform-team
  type: infrastructure
  
  parameters:
    - title: VM Configuration
      required:
        - vmName
        - environment
        - cpu
        - memory
        - osType
        - owner
      properties:
        vmName:
          title: VM Name
          type: string
          description: Name for the virtual machine (lowercase, alphanumeric, hyphens only)
          pattern: '^[a-z0-9-]+$'
          maxLength: 32
          ui:autofocus: true
          ui:help: 'Example: web-server-001'
          
        environment:
          title: Environment
          type: string
          description: Deployment environment for this VM
          enum:
            - dev
            - staging
            - production
          enumNames:
            - 'Development'
            - 'Staging'
            - 'Production'
          default: dev
          
        cpu:
          title: CPU Cores
          type: number
          description: Number of virtual CPU cores
          default: 2
          enum: [2, 4, 8, 16]
          
        memory:
          title: Memory (GB)
          type: number
          description: Amount of RAM in gigabytes
          default: 4
          enum: [4, 8, 16, 32, 64]
          
        osType:
          title: Operating System
          type: string
          description: Base operating system image
          enum:
            - rhel-9
            - ubuntu-22.04
            - windows-2022
          enumNames:
            - 'Red Hat Enterprise Linux 9'
            - 'Ubuntu 22.04 LTS'
            - 'Windows Server 2022'
          default: rhel-9
          
        owner:
          title: Owner Team
          type: string
          description: Team responsible for this VM
          ui:field: OwnerPicker
          ui:options:
            catalogFilter:
              kind: [Group]
              
        requestedBy:
          title: Requested By
          type: string
          description: User requesting this VM
          ui:field: OwnerPicker
          ui:options:
            catalogFilter:
              kind: [User]
          default: ${{ user.entity.metadata.name }}
          
  steps:
    - id: trigger-github-action
      name: Trigger VM Provisioning
      action: github:actions:dispatch
      input:
        repoUrl: github.com?owner=your-org&repo=infrastructure-automation
        workflowId: provision-vm.yml
        branchOrTagName: main
        workflowInputs:
          vmName: ${{ parameters.vmName }}
          environment: ${{ parameters.environment }}
          cpu: ${{ parameters.cpu }}
          memory: ${{ parameters.memory }}
          osType: ${{ parameters.osType }}
          owner: ${{ parameters.owner }}
          requestedBy: ${{ parameters.requestedBy }}
          
  output:
    links:
      - title: View GitHub Workflow
        icon: github
        url: ${{ steps['trigger-github-action'].output.workflowUrl }}
      - title: View Workflow Logs
        icon: dashboard
        url: ${{ steps['trigger-github-action'].output.workflowUrl }}
```

### 4.3 Register Template in RHDH

**Option A: Via Catalog Info File**

Create or update your `catalog-info.yaml`:

```yaml
apiVersion: backstage.io/v1alpha1
kind: Location
metadata:
  name: vm-provisioning-templates
  description: VM provisioning templates
  annotations:
    backstage.io/managed-by-location: url:https://github.com/your-org/rhdh-templates/
spec:
  type: url
  targets:
    - https://github.com/your-org/rhdh-templates/blob/main/nutanix-vm/template.yaml
```

**Option B: Via RHDH UI**

1. Navigate to RHDH → **Create** → **Register Existing Component**
1. Enter URL: `https://github.com/your-org/rhdh-templates/blob/main/nutanix-vm/template.yaml`
1. Click **Analyze** → **Import**

**Option C: Via app-config.yaml**

```yaml
catalog:
  locations:
    - type: url
      target: https://github.com/your-org/rhdh-templates/blob/main/nutanix-vm/template.yaml
      rules:
        - allow: [Template]
```

-----

## 5. GitHub Actions Workflow

### 5.1 Workflow File Location

Create the workflow file at:

```
.github/workflows/provision-vm.yml
```

### 5.2 Complete Workflow Code

**IMPORTANT:** This workflow uses `BACKEND_TOKEN` for all RHDH API authentication and includes all 4 notifications with proper success/failure handling.

```yaml
name: Provision Nutanix VM

on:
  workflow_dispatch:
    inputs:
      vmName:
        description: 'VM Name'
        required: true
        type: string
      environment:
        description: 'Environment (dev/staging/production)'
        required: true
        type: string
      cpu:
        description: 'CPU Cores'
        required: true
        type: number
      memory:
        description: 'Memory (GB)'
        required: true
        type: number
      osType:
        description: 'OS Type'
        required: true
        type: string
      owner:
        description: 'Owner Team'
        required: true
        type: string
      requestedBy:
        description: 'Requested By User'
        required: true
        type: string

jobs:
  provision:
    runs-on: ubuntu-latest
    timeout-minutes: 60
    
    steps:
      - name: Checkout Repository
        uses: actions/checkout@v4
      
      # ========================================
      # NOTIFICATION 1: START
      # ========================================
      - name: 📢 Notification 1 - Provisioning Started
        uses: actions/github-script@v7
        env:
          RHDH_URL: ${{ secrets.RHDH_URL }}
          BACKEND_TOKEN: ${{ secrets.BACKEND_TOKEN }}
        with:
          script: |
            const response = await fetch(`${process.env.RHDH_URL}/api/notifications`, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${process.env.BACKEND_TOKEN}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                recipients: {
                  type: "entity",
                  entityRef: ["${{ inputs.owner }}", "${{ inputs.requestedBy }}"]
                },
                payload: {
                  title: "🚀 VM Provisioning Started",
                  description: "Building VM: **${{ inputs.vmName }}**\n\n" +
                             "**Configuration:**\n" +
                             "• Environment: `${{ inputs.environment }}`\n" +
                             "• CPU: ${{ inputs.cpu }} cores\n" +
                             "• Memory: ${{ inputs.memory }}GB\n" +
                             "• OS: `${{ inputs.osType }}`\n\n" +
                             "_Estimated time: ~45 minutes_",
                  link: "${{ github.server_url }}/${{ github.repository }}/actions/runs/${{ github.run_id }}",
                  severity: "high",
                  topic: "vm-provisioning",
                  scope: "${{ inputs.vmName }}"
                }
              })
            });
            
            if (!response.ok) {
              const errorText = await response.text();
              console.error(`Failed to send notification: ${response.status} - ${errorText}`);
              core.warning('Notification 1 failed, but continuing workflow');
            } else {
              console.log('✅ Notification 1 sent successfully');
            }
      
      # ========================================
      # PROVISION VM WITH PROGRESS TRACKING
      # ========================================
      - name: 🔧 Provision and Monitor VM
        id: provision
        uses: actions/github-script@v7
        env:
          RHDH_URL: ${{ secrets.RHDH_URL }}
          BACKEND_TOKEN: ${{ secrets.BACKEND_TOKEN }}
          NUTANIX_API_URL: ${{ secrets.NUTANIX_API_URL }}
          NUTANIX_USERNAME: ${{ secrets.NUTANIX_USERNAME }}
          NUTANIX_PASSWORD: ${{ secrets.NUTANIX_PASSWORD }}
        with:
          script: |
            // ================================================
            // HELPER FUNCTION: Send Notifications
            // ================================================
            const sendNotification = async (title, description, severity = "normal") => {
              try {
                const response = await fetch(`${process.env.RHDH_URL}/api/notifications`, {
                  method: 'POST',
                  headers: {
                    'Authorization': `Bearer ${process.env.BACKEND_TOKEN}`,
                    'Content-Type': 'application/json'
                  },
                  body: JSON.stringify({
                    recipients: {
                      type: "entity",
                      entityRef: ["${{ inputs.owner }}", "${{ inputs.requestedBy }}"]
                    },
                    payload: {
                      title,
                      description,
                      link: "${{ github.server_url }}/${{ github.repository }}/actions/runs/${{ github.run_id }}",
                      severity,
                      topic: "vm-provisioning",
                      scope: "${{ inputs.vmName }}"
                    }
                  })
                });
                
                if (!response.ok) {
                  const errorText = await response.text();
                  console.error(`Notification failed: ${response.status} - ${errorText}`);
                } else {
                  console.log(`✅ Notification sent: ${title}`);
                }
              } catch (error) {
                console.error('Notification error:', error.message);
              }
            };

            // ================================================
            // STEP 1: Create VM in Nutanix
            // ================================================
            console.log('🚀 Creating VM in Nutanix...');
            console.log(`VM Name: ${{ inputs.vmName }}`);
            console.log(`CPU: ${{ inputs.cpu }}, Memory: ${{ inputs.memory }}GB, OS: ${{ inputs.osType }}`);
            
            const authHeader = 'Basic ' + Buffer.from(
              `${process.env.NUTANIX_USERNAME}:${process.env.NUTANIX_PASSWORD}`
            ).toString('base64');

            const createResponse = await fetch(
              `${process.env.NUTANIX_API_URL}/api/nutanix/v3/vms`,
              {
                method: 'POST',
                headers: {
                  'Authorization': authHeader,
                  'Content-Type': 'application/json',
                  'Accept': 'application/json'
                },
                body: JSON.stringify({
                  spec: {
                    name: "${{ inputs.vmName }}",
                    description: "Provisioned via RHDH - ${{ inputs.environment }}",
                    resources: {
                      num_sockets: ${{ inputs.cpu }},
                      memory_size_mib: ${{ inputs.memory }} * 1024,
                      power_state: "ON",
                      nic_list: [{
                        subnet_reference: {
                          kind: "subnet",
                          name: "default-network"
                        }
                      }]
                    }
                  },
                  metadata: {
                    kind: "vm",
                    categories: {
                      environment: "${{ inputs.environment }}",
                      provisioned_by: "rhdh"
                    }
                  }
                })
              }
            );

            if (!createResponse.ok) {
              const errorText = await createResponse.text();
              throw new Error(`Failed to create VM: ${createResponse.status} - ${errorText}`);
            }

            const createData = await createResponse.json();
            const vmUuid = createData.metadata.uuid;
            
            console.log(`✅ VM created successfully`);
            console.log(`UUID: ${vmUuid}`);
            core.setOutput('vm_uuid', vmUuid);

            // ================================================
            // STEP 2: Monitor VM Provisioning with Progress Notifications
            // ================================================
            console.log('⏳ Monitoring VM provisioning...');
            
            const startTime = Date.now();
            const maxDuration = 50 * 60 * 1000; // 50 minutes
            let notification2Sent = false;
            let notification3Sent = false;
            let checkCount = 0;

            while (true) {
              checkCount++;
              const elapsed = Date.now() - startTime;
              const elapsedMinutes = Math.floor(elapsed / 60000);

              // ========================================
              // NOTIFICATION 2: 15-minute Progress Update
              // ========================================
              if (elapsedMinutes >= 15 && !notification2Sent) {
                await sendNotification(
                  "⏱️ VM Building Progress",
                  "VM: **${{ inputs.vmName }}**\n\n" +
                  "**Progress:** ~33% complete\n" +
                  `**Elapsed:** ${elapsedMinutes} minutes\n\n` +
                  "_Still provisioning... Please wait._",
                  "normal"
                );
                notification2Sent = true;
                console.log('📢 Sent 15-minute progress notification');
              }

              // ========================================
              // NOTIFICATION 3: 30-minute Progress Update
              // ========================================
              if (elapsedMinutes >= 30 && !notification3Sent) {
                await sendNotification(
                  "⏱️ VM Building Progress",
                  "VM: **${{ inputs.vmName }}**\n\n" +
                  "**Progress:** ~66% complete\n" +
                  `**Elapsed:** ${elapsedMinutes} minutes\n\n` +
                  "_Nearing completion..._",
                  "normal"
                );
                notification3Sent = true;
                console.log('📢 Sent 30-minute progress notification');
              }

              // Check VM status
              console.log(`Check #${checkCount}: Querying VM status...`);
              
              const statusResponse = await fetch(
                `${process.env.NUTANIX_API_URL}/api/nutanix/v3/vms/${vmUuid}`,
                {
                  headers: {
                    'Authorization': authHeader,
                    'Accept': 'application/json'
                  }
                }
              );

              if (!statusResponse.ok) {
                console.error(`⚠️ Failed to get VM status: ${statusResponse.status}`);
                await new Promise(resolve => setTimeout(resolve, 30000));
                continue;
              }

              const statusData = await statusResponse.json();
              const state = statusData.status?.state;
              const powerState = statusData.status?.resources?.power_state;
              const nicList = statusData.status?.resources?.nic_list || [];
              const ipAddress = nicList[0]?.ip_endpoint_list?.[0]?.ip;

              console.log(`State: ${state}, Power: ${powerState}, IP: ${ipAddress || 'pending'}`);

              // Check if VM is fully provisioned
              if (state === 'COMPLETE' && powerState === 'ON' && ipAddress) {
                console.log('🎉 VM is fully provisioned!');
                core.setOutput('ip_address', ipAddress);
                core.setOutput('power_state', powerState);
                core.setOutput('provisioning_time', Math.floor(elapsed / 60000));
                break;
              }

              // Timeout check
              if (elapsed > maxDuration) {
                throw new Error(`VM provisioning timeout after ${Math.floor(elapsed/60000)} minutes. VM may still be building.`);
              }

              // Wait 30 seconds before next check
              await new Promise(resolve => setTimeout(resolve, 30000));
            }

            console.log('✅ VM provisioning monitoring complete!');
      
      # ========================================
      # REGISTER IN CATALOG (SUCCESS ONLY)
      # ========================================
      - name: 📝 Register VM in RHDH Catalog
        if: success()
        id: register
        uses: actions/github-script@v7
        env:
          RHDH_URL: ${{ secrets.RHDH_URL }}
          BACKEND_TOKEN: ${{ secrets.BACKEND_TOKEN }}
        with:
          script: |
            console.log('📝 Registering VM in RHDH Catalog...');
            
            const entity = {
              apiVersion: "backstage.io/v1alpha1",
              kind: "Resource",
              metadata: {
                name: "${{ inputs.vmName }}".toLowerCase().replace(/_/g, '-'),
                namespace: "default",
                title: "${{ inputs.vmName }}",
                description: "Nutanix VM running ${{ inputs.osType }} in ${{ inputs.environment }}",
                labels: {
                  environment: "${{ inputs.environment }}",
                  "os-type": "${{ inputs.osType }}",
                  "provisioned-by": "rhdh",
                  "cpu-cores": "${{ inputs.cpu }}",
                  "memory-gb": "${{ inputs.memory }}"
                },
                annotations: {
                  "nutanix.com/vm-uuid": "${{ steps.provision.outputs.vm_uuid }}",
                  "nutanix.com/ip-address": "${{ steps.provision.outputs.ip_address }}",
                  "nutanix.com/cpu-cores": "${{ inputs.cpu }}",
                  "nutanix.com/memory-gb": "${{ inputs.memory }}",
                  "nutanix.com/os-type": "${{ inputs.osType }}",
                  "github.com/workflow-run": "${{ github.server_url }}/${{ github.repository }}/actions/runs/${{ github.run_id }}",
                  "github.com/workflow-name": "provision-vm",
                  "backstage.io/managed-by-location": "url:https://github.com/${{ github.repository }}",
                  "provisioned-at": new Date().toISOString(),
                  "provisioning-time-minutes": "${{ steps.provision.outputs.provisioning_time }}",
                  "requested-by": "${{ inputs.requestedBy }}"
                },
                tags: ["vm", "nutanix", "${{ inputs.environment }}", "${{ inputs.osType }}"]
              },
              spec: {
                type: "virtual-machine",
                lifecycle: "${{ inputs.environment }}",
                owner: "${{ inputs.owner }}",
                system: "nutanix-infrastructure",
                dependsOn: [],
                providesApis: []
              }
            };

            console.log('Entity to register:', JSON.stringify(entity, null, 2));

            const response = await fetch(`${process.env.RHDH_URL}/api/catalog/entities`, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${process.env.BACKEND_TOKEN}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({ entity })
            });

            if (!response.ok) {
              const errorText = await response.text();
              throw new Error(`Failed to register in catalog: ${response.status} - ${errorText}`);
            }

            const result = await response.json();
            const entityName = entity.metadata.name;
            const catalogUrl = `${process.env.RHDH_URL}/catalog/default/resource/${entityName}`;
            
            console.log('✅ Successfully registered in RHDH catalog');
            console.log(`Catalog URL: ${catalogUrl}`);
            
            core.setOutput('catalog_url', catalogUrl);
            core.setOutput('entity_name', entityName);
      
      # ========================================
      # NOTIFICATION 4a: SUCCESS
      # ========================================
      - name: 📢 Notification 4 - Success
        if: success()
        uses: actions/github-script@v7
        env:
          RHDH_URL: ${{ secrets.RHDH_URL }}
          BACKEND_TOKEN: ${{ secrets.BACKEND_TOKEN }}
        with:
          script: |
            const response = await fetch(`${process.env.RHDH_URL}/api/notifications`, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${process.env.BACKEND_TOKEN}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                recipients: {
                  type: "entity",
                  entityRef: ["${{ inputs.owner }}", "${{ inputs.requestedBy }}"]
                },
                payload: {
                  title: "✅ VM Ready!",
                  description: "VM **${{ inputs.vmName }}** is fully provisioned and ready to use!\n\n" +
                             "**Details:**\n" +
                             "• **IP Address:** `${{ steps.provision.outputs.ip_address }}`\n" +
                             "• **UUID:** `${{ steps.provision.outputs.vm_uuid }}`\n" +
                             "• **CPU:** ${{ inputs.cpu }} cores\n" +
                             "• **Memory:** ${{ inputs.memory }}GB\n" +
                             "• **OS:** `${{ inputs.osType }}`\n" +
                             "• **Environment:** `${{ inputs.environment }}`\n" +
                             "• **Provisioning Time:** ${{ steps.provision.outputs.provisioning_time }} minutes\n\n" +
                             "🔗 [View in Catalog](${{ steps.register.outputs.catalog_url }})",
                  link: "${{ steps.register.outputs.catalog_url }}",
                  severity: "high",
                  topic: "vm-provisioning",
                  scope: "${{ inputs.vmName }}"
                }
              })
            });
            
            if (!response.ok) {
              const errorText = await response.text();
              console.error(`Failed to send success notification: ${response.status} - ${errorText}`);
            } else {
              console.log('✅ Success notification sent');
            }
      
      # ========================================
      # NOTIFICATION 4b: FAILURE
      # ========================================
      - name: 📢 Notification 4 - Failure
        if: failure()
        uses: actions/github-script@v7
        env:
          RHDH_URL: ${{ secrets.RHDH_URL }}
          BACKEND_TOKEN: ${{ secrets.BACKEND_TOKEN }}
        with:
          script: |
            const response = await fetch(`${process.env.RHDH_URL}/api/notifications`, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${process.env.BACKEND_TOKEN}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                recipients: {
                  type: "entity",
                  entityRef: [
                    "${{ inputs.owner }}", 
                    "${{ inputs.requestedBy }}",
                    "group:default/platform-ops"
                  ]
                },
                payload: {
                  title: "❌ VM Provisioning Failed",
                  description: "Failed to provision VM: **${{ inputs.vmName }}**\n\n" +
                             "**Requested Configuration:**\n" +
                             "• **CPU:** ${{ inputs.cpu }} cores\n" +
                             "• **Memory:** ${{ inputs.memory }}GB\n" +
                             "• **OS:** `${{ inputs.osType }}`\n" +
                             "• **Environment:** `${{ inputs.environment }}`\n\n" +
                             "⚠️ **The VM was NOT added to the catalog.**\n\n" +
                             "Please review the workflow logs for error details.\n\n" +
                             "🔗 [View Logs](${{ github.server_url }}/${{ github.repository }}/actions/runs/${{ github.run_id }})",
                  link: "${{ github.server_url }}/${{ github.repository }}/actions/runs/${{ github.run_id }}",
                  severity: "critical",
                  topic: "vm-provisioning",
                  scope: "${{ inputs.vmName }}"
                }
              })
            });
            
            if (!response.ok) {
              const errorText = await response.text();
              console.error(`Failed to send failure notification: ${response.status} - ${errorText}`);
            } else {
              console.log('✅ Failure notification sent');
            }
      
      # ========================================
      # JOB SUMMARY
      # ========================================
      - name: 📊 Generate Job Summary
        if: always()
        run: |
          if [ "${{ job.status }}" == "success" ]; then
            echo "# ✅ VM Provisioned Successfully" >> $GITHUB_STEP_SUMMARY
            echo "" >> $GITHUB_STEP_SUMMARY
            echo "## VM Details" >> $GITHUB_STEP_SUMMARY
            echo "" >> $GITHUB_STEP_SUMMARY
            echo "| Property | Value |" >> $GITHUB_STEP_SUMMARY
            echo "|----------|-------|" >> $GITHUB_STEP_SUMMARY
            echo "| **VM Name** | \`${{ inputs.vmName }}\` |" >> $GITHUB_STEP_SUMMARY
            echo "| **UUID** | \`${{ steps.provision.outputs.vm_uuid }}\` |" >> $GITHUB_STEP_SUMMARY
            echo "| **IP Address** | \`${{ steps.provision.outputs.ip_address }}\` |" >> $GITHUB_STEP_SUMMARY
            echo "| **CPU Cores** | ${{ inputs.cpu }} |" >> $GITHUB_STEP_SUMMARY
            echo "| **Memory** | ${{ inputs.memory }}GB |" >> $GITHUB_STEP_SUMMARY
            echo "| **Operating System** | ${{ inputs.osType }} |" >> $GITHUB_STEP_SUMMARY
            echo "| **Environment** | ${{ inputs.environment }} |" >> $GITHUB_STEP_SUMMARY
            echo "| **Owner** | ${{ inputs.owner }} |" >> $GITHUB_STEP_SUMMARY
            echo "| **Requested By** | ${{ inputs.requestedBy }} |" >> $GITHUB_STEP_SUMMARY
            echo "| **Provisioning Time** | ${{ steps.provision.outputs.provisioning_time }} minutes |" >> $GITHUB_STEP_SUMMARY
            echo "" >> $GITHUB_STEP_SUMMARY
            echo "## Quick Links" >> $GITHUB_STEP_SUMMARY
            echo "" >> $GITHUB_STEP_SUMMARY
            echo "- 🔗 [View in RHDH Catalog](${{ steps.register.outputs.catalog_url }})" >> $GITHUB_STEP_SUMMARY
            echo "- 📊 [View Workflow Run](${{ github.server_url }}/${{ github.repository }}/actions/runs/${{ github.run_id }})" >> $GITHUB_STEP_SUMMARY
          else
            echo "# ❌ VM Provisioning Failed" >> $GITHUB_STEP_SUMMARY
            echo "" >> $GITHUB_STEP_SUMMARY
            echo "VM **${{ inputs.vmName }}** failed to provision." >> $GITHUB_STEP_SUMMARY
            echo "" >> $GITHUB_STEP_SUMMARY
            echo "## Requested Configuration" >> $GITHUB_STEP_SUMMARY
            echo "" >> $GITHUB_STEP_SUMMARY
            echo "| Property | Value |" >> $GITHUB_STEP_SUMMARY
            echo "|----------|-------|" >> $GITHUB_STEP_SUMMARY
            echo "| **VM Name** | \`${{ inputs.vmName }}\` |" >> $GITHUB_STEP_SUMMARY
            echo "| **CPU Cores** | ${{ inputs.cpu }} |" >> $GITHUB_STEP_SUMMARY
            echo "| **Memory** | ${{ inputs.memory }}GB |" >> $GITHUB_STEP_SUMMARY
            echo "| **Operating System** | ${{ inputs.osType }} |" >> $GITHUB_STEP_SUMMARY
            echo "| **Environment** | ${{ inputs.environment }} |" >> $GITHUB_STEP_SUMMARY
            echo "" >> $GITHUB_STEP_SUMMARY
            echo "⚠️ **The VM was not added to the RHDH catalog.**" >> $GITHUB_STEP_SUMMARY
            echo "" >> $GITHUB_STEP_SUMMARY
            echo "Please review the workflow logs above for detailed error information." >> $GITHUB_STEP_SUMMARY
          fi
```

-----

## 6. Testing & Validation

### 6.1 Pre-Deployment Testing

#### Test 1: Validate Backend Token

```bash
# Test RHDH Notifications API
curl -X POST https://your-rhdh.com/api/notifications \
  -H "Authorization: Bearer YOUR_BACKEND_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "recipients": {
      "type": "entity",
      "entityRef": ["user:default/your-username"]
    },
    "payload": {
      "title": "Backend Token Test",
      "description": "Testing authentication with backend token",
      "severity": "normal",
      "topic": "test"
    }
  }'

# Expected Response: HTTP 200 OK
# Check RHDH UI for the notification
```

#### Test 2: Validate Catalog API Access

```bash
# Test RHDH Catalog API (Read)
curl -X GET https://your-rhdh.com/api/catalog/entities \
  -H "Authorization: Bearer YOUR_BACKEND_TOKEN"

# Expected: HTTP 200 OK with JSON array of entities
```

```bash
# Test RHDH Catalog API (Create - Dry Run)
curl -X POST https://your-rhdh.com/api/catalog/entities \
  -H "Authorization: Bearer YOUR_BACKEND_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "entity": {
      "apiVersion": "backstage.io/v1alpha1",
      "kind": "Resource",
      "metadata": {
        "name": "test-vm-validation",
        "namespace": "default"
      },
      "spec": {
        "type": "virtual-machine",
        "owner": "group:default/platform-team"
      }
    }
  }'

# Expected: HTTP 200/201 Created
# Then delete the test entity in RHDH UI
```

#### Test 3: Validate Nutanix API Connectivity

```bash
# Test Nutanix Prism Central API
curl -k -u "$NUTANIX_USERNAME:$NUTANIX_PASSWORD" \
  "$NUTANIX_API_URL/api/nutanix/v3/clusters/list" \
  -H "Content-Type: application/json" \
  -d '{"kind":"cluster","length":10}'

# Expected: JSON response with cluster list
```

#### Test 4: Test GitHub Actions Workflow Manually

```bash
# Using GitHub CLI
gh workflow run provision-vm.yml \
  -f vmName=test-vm-validation-001 \
  -f environment=dev \
  -f cpu=2 \
  -f memory=4 \
  -f osType=rhel-9 \
  -f owner=group:default/platform-team \
  -f requestedBy=user:default/your-username

# Monitor the workflow
gh run watch
```

### 6.2 Post-Deployment Validation Checklist

After deploying to production, validate the following:

|Item                        |Validation Method              |Expected Result                        |
|----------------------------|-------------------------------|---------------------------------------|
|**Template Visibility**     |Navigate to RHDH → Create      |Template appears in list               |
|**Form Validation**         |Submit form with invalid inputs|Proper error messages                  |
|**Workflow Trigger**        |Submit valid form              |GitHub Actions workflow starts         |
|**Notification 1**          |Check RHDH notifications       |“Started” notification appears         |
|**Notification 2**          |Wait 15 minutes                |“33% Progress” notification appears    |
|**Notification 3**          |Wait 30 minutes                |“66% Progress” notification appears    |
|**Notification 4 (Success)**|Wait for completion            |“VM Ready” notification with details   |
|**Catalog Registration**    |Check RHDH Catalog             |VM entity appears with correct metadata|
|**Notification 4 (Failure)**|Test with invalid config       |“Failed” notification, NO catalog entry|
|**Workflow Logs**           |Check GitHub Actions           |All steps complete successfully        |

### 6.3 Test Scenarios

#### Scenario 1: Happy Path (Success)

```
Input: Valid VM configuration
Expected Outcome:
  ✅ All 4 notifications sent
  ✅ VM created in Nutanix
  ✅ VM registered in RHDH Catalog
  ✅ Correct metadata in catalog entity
```

#### Scenario 2: VM Creation Failure

```
Input: Invalid Nutanix configuration
Expected Outcome:
  ✅ Notifications 1-3 sent (if reached)
  ✅ Notification 4 (Failure) sent
  ❌ NO catalog registration
  ✅ Error details in logs
```

#### Scenario 3: Timeout

```
Input: VM takes >50 minutes
Expected Outcome:
  ✅ Notifications 1-3 sent
  ✅ Notification 4 (Failure) sent with timeout message
  ❌ NO catalog registration
```

-----

## 7. Production Deployment Checklist

### 7.1 Pre-Deployment Checklist

|Category   |Item                                       |Status|Notes                        |
|-----------|-------------------------------------------|------|-----------------------------|
|**GitHub** |Repository created                         |☐     |                             |
|           |Workflow file added to `.github/workflows/`|☐     |                             |
|           |`BACKEND_TOKEN` secret configured          |☐     |                             |
|           |`NUTANIX_API_URL` secret configured        |☐     |                             |
|           |`NUTANIX_USERNAME` secret configured       |☐     |                             |
|           |`NUTANIX_PASSWORD` secret configured       |☐     |                             |
|           |`RHDH_URL` secret configured               |☐     |                             |
|**RHDH**   |Backend token generated                    |☐     |Keep securely stored         |
|           |Backend token configured in RHDH           |☐     |Via ConfigMap or Secret      |
|           |Notifications plugin enabled               |☐     |Check `dynamicPlugins` config|
|           |Template registered                        |☐     |Visible in Create page       |
|           |Test notification sent                     |☐     |Verify delivery              |
|**Nutanix**|API access verified                        |☐     |Test with curl               |
|           |Network subnet identified                  |☐     |For VM NIC configuration     |
|           |OS images available                        |☐     |rhel-9, ubuntu-22.04, etc.   |
|**Testing**|End-to-end test completed                  |☐     |Full workflow validation     |
|           |All 4 notifications received               |☐     |Check timing and content     |
|           |Catalog registration verified              |☐     |Entity appears correctly     |
|           |Failure path tested                        |☐     |No catalog entry on failure  |

### 7.2 Post-Deployment Monitoring

Monitor these areas after deployment:

#### GitHub Actions

```bash
# View recent workflow runs
gh run list --workflow=provision-vm.yml --limit=10

# View specific run details
gh run view <run-id>

# Watch live run
gh run watch <run-id>
```

#### RHDH Logs

```bash
# View RHDH backend logs (Kubernetes)
kubectl logs -n rhdh deployment/backstage -f --tail=100

# Search for notification-related logs
kubectl logs -n rhdh deployment/backstage | grep -i notification

# Search for catalog-related logs
kubectl logs -n rhdh deployment/backstage | grep -i catalog
```

#### Nutanix Monitoring

- Check Prism Central for VM creation tasks
- Monitor API rate limits (check response headers)
- Review VM provisioning times

### 7.3 Common Issues & Solutions

|Issue                              |Possible Cause                      |Solution                                               |
|-----------------------------------|------------------------------------|-------------------------------------------------------|
|**Notifications not appearing**    |Wrong entity reference format       |Use `user:default/username` or `group:default/teamname`|
|**401 Unauthorized on API calls**  |Invalid backend token               |Regenerate token and update secrets                    |
|**Catalog registration fails**     |Duplicate entity name               |Ensure VM names are unique (check existing catalog)    |
|**Catalog registration fails**     |Missing required fields             |Verify entity structure matches Backstage schema       |
|**Workflow doesn’t start**         |Missing workflow_dispatch permission|Check GitHub repository settings                       |
|**Workflow timeout**               |VM provisioning >60 minutes         |Increase `timeout-minutes` in workflow                 |
|**VM has no IP address**           |Network configuration issue         |Verify Nutanix subnet configuration                    |
|**Progress notifications not sent**|Workflow interrupted                |Check for errors before notification steps             |

### 7.4 Troubleshooting Commands

```bash
# Test backend token authentication
curl -v https://your-rhdh.com/api/catalog/entities \
  -H "Authorization: Bearer YOUR_TOKEN" 2>&1 | grep -i "401\|403\|200"

# List all catalog entities
curl -s https://your-rhdh.com/api/catalog/entities \
  -H "Authorization: Bearer YOUR_TOKEN" | jq '.[] | {name: .metadata.name, kind: .kind}'

# Check if specific VM exists in catalog
curl -s https://your-rhdh.com/api/catalog/entities/by-name/resource/default/test-vm-001 \
  -H "Authorization: Bearer YOUR_TOKEN"

# Delete a test entity (if needed)
curl -X DELETE https://your-rhdh.com/api/catalog/entities/by-name/resource/default/test-vm-001 \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 7.5 Success Metrics

Track these KPIs to measure success:

|Metric                                 |Target    |How to Measure                                |
|---------------------------------------|----------|----------------------------------------------|
|**Provisioning Success Rate**          |≥95%      |(Successful runs / Total runs) × 100          |
|**Average Provisioning Time**          |≤45 min   |Average duration from start to completion     |
|**Notification Delivery Rate**         |100%      |Verify all 4 notifications sent per request   |
|**User Adoption**                      |Increasing|Track VMs provisioned per week/month          |
|**Time Saved vs Manual**               |≥60%      |Compare to previous manual process            |
|**Failed Provisioning Resolution Time**|≤2 hours  |Time from failure to root cause identification|

#### Tracking with GitHub Actions Insights

Navigate to: **Repository → Actions → Workflows → provision-vm.yml**

- View success/failure rates
- Average execution time
- Identify failure patterns

-----

## 8. Appendix

### 8.1 API Reference

#### RHDH Notifications API

**Endpoint:** `POST /api/notifications`

**Authentication:** Backend token (Bearer)

**Request:**

```json
{
  "recipients": {
    "type": "entity",
    "entityRef": ["user:default/username", "group:default/teamname"]
  },
  "payload": {
    "title": "Notification Title",
    "description": "Notification body text (supports Markdown)",
    "link": "https://link-to-resource",
    "severity": "high",
    "topic": "vm-provisioning",
    "scope": "unique-identifier"
  }
}
```

**Response:** `200 OK` or `201 Created`

**Headers:**

```
Authorization: Bearer YOUR_BACKEND_TOKEN
Content-Type: application/json
```

#### RHDH Catalog API

**Endpoint:** `POST /api/catalog/entities`

**Authentication:** Backend token (Bearer)

**Request:**

```json
{
  "entity": {
    "apiVersion": "backstage.io/v1alpha1",
    "kind": "Resource",
    "metadata": {
      "name": "vm-name",
      "namespace": "default",
      "title": "Display Name",
      "description": "Description",
      "labels": {
        "key": "value"
      },
      "annotations": {
        "key": "value"
      },
      "tags": ["tag1", "tag2"]
    },
    "spec": {
      "type": "virtual-machine",
      "lifecycle": "production",
      "owner": "group:default/team-name",
      "system": "system-name"
    }
  }
}
```

**Response:** `200 OK` or `201 Created`

**Headers:**

```
Authorization: Bearer YOUR_BACKEND_TOKEN
Content-Type: application/json
```

#### Nutanix Prism Central API

**Endpoint:** `POST /api/nutanix/v3/vms`

**Authentication:** Basic Auth

**Request:**

```json
{
  "spec": {
    "name": "vm-name",
    "resources": {
      "num_sockets": 4,
      "memory_size_mib": 16384,
      "power_state": "ON"
    }
  },
  "metadata": {
    "kind": "vm"
  }
}
```

**Response:** `200 OK` with task UUID

**Headers:**

```
Authorization: Basic base64(username:password)
Content-Type: application/json
Accept: application/json
```

### 8.2 Entity Reference Format

RHDH uses a specific format for entity references:

```
<kind>:<namespace>/<name>

Examples:
- user:default/john-doe
- group:default/platform-team
- component:default/my-service
- resource:default/my-vm
```

### 8.3 Notification Severity Levels

|Severity  |Color |When to Use                           |Example                       |
|----------|------|--------------------------------------|------------------------------|
|`critical`|Red   |Failures requiring immediate attention|VM provisioning failed        |
|`high`    |Orange|Important status changes              |VM ready, provisioning started|
|`normal`  |Blue  |Standard updates                      |Progress notifications        |
|`low`     |Gray  |Informational only                    |Background tasks              |

### 8.4 Backstage Entity Kinds

Common entity kinds in Backstage/RHDH:

- **Component** - Services, libraries, websites
- **Resource** - Infrastructure (VMs, databases, queues)
- **API** - API definitions
- **Group** - Teams or groups of users
- **User** - Individual users
- **System** - Collection of entities working together
- **Domain** - Business domain groupings

### 8.5 Useful GitHub CLI Commands

```bash
# Install GitHub CLI
# macOS: brew install gh
# Linux: See https://cli.github.com/manual/installation

# Authenticate
gh auth login

# List workflows
gh workflow list

# Run workflow interactively
gh workflow run

# View workflow runs
gh run list --workflow=provision-vm.yml

# View run details
gh run view <run-id>

# Download logs
gh run download <run-id>

# Watch live run
gh run watch
```

### 8.6 Sample RHDH Catalog Query

Query VMs by environment:

```bash
# Get all production VMs
curl -s "https://your-rhdh.com/api/catalog/entities?filter=kind=resource,metadata.labels.environment=production" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  | jq '.[] | {name: .metadata.name, ip: .metadata.annotations."nutanix.com/ip-address"}'
```

Query VMs by owner:

```bash
# Get all VMs owned by platform-team
curl -s "https://your-rhdh.com/api/catalog/entities?filter=kind=resource,spec.owner=group:default/platform-team" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  | jq '.[] | {name: .metadata.name, owner: .spec.owner}'
```

### 8.7 Security Best Practices

1. **Backend Token Management**
- Store tokens in Kubernetes Secrets, not ConfigMaps
- Rotate tokens quarterly
- Use different tokens for different environments (dev/staging/prod)
- Never commit tokens to version control
1. **GitHub Secrets**
- Use environment-specific secrets
- Limit secret access to required workflows only
- Enable secret scanning in repository settings
1. **Nutanix API Access**
- Use dedicated service account with minimal permissions
- Enable API logging in Prism Central
- Rotate credentials regularly
1. **RHDH Access Control**
- Configure RBAC for catalog entities
- Limit who can create VMs via template
- Audit catalog changes

### 8.8 Backup & Recovery

**Backup GitHub Workflow**

```bash
# Clone repository
git clone https://github.com/your-org/infrastructure-automation.git

# Backup is in version control
```

**Backup RHDH Configuration**

```bash
# Export ConfigMap
kubectl get configmap app-config-rhdh -n rhdh -o yaml > rhdh-config-backup.yaml

# Export Secrets
kubectl get secret backstage-backend-token -n rhdh -o yaml > rhdh-secrets-backup.yaml
```

**Recover from Failed Provisioning**

- Check Nutanix Prism Central for orphaned VMs
- Delete incomplete VMs manually if needed
- Re-run workflow after fixing issues

### 8.9 Support Resources

- **RHDH Documentation:** https://access.redhat.com/documentation/en-us/red_hat_developer_hub
- **Backstage Documentation:** https://backstage.io/docs
- **GitHub Actions Documentation:** https://docs.github.com/en/actions
- **Nutanix API Documentation:** Check your Prism Central at `/api/nutanix/v3/api_reference`

-----

## 🎉 Implementation Complete!

Your production VM provisioning workflow with **backend token authentication** is ready to deploy!

### Quick Start Summary

1. ✅ Generate backend token: `openssl rand -hex 32`
1. ✅ Configure token in RHDH (ConfigMap/Secret)
1. ✅ Add secrets to GitHub repository
1. ✅ Deploy workflow file to `.github/workflows/`
1. ✅ Register template in RHDH
1. ✅ Test end-to-end provisioning
1. ✅ Monitor and validate

### What This Gives You

- ✨ Self-service VM provisioning through RHDH
- 📢 Real-time progress notifications (4 per request)
- 📝 Automatic catalog registration (success only)
- 🔒 Secure authentication via backend token
- 📊 Full observability and audit trail
- ⚡ ~45 minute average provisioning time

-----

**Version 2.0** | Updated for Backend Token Authentication  
**© Your Organization** | Internal Use Only