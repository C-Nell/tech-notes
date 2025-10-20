# VM Provisioning with RHDH

## Complete Production Implementation Guide

**Red Hat Developer Hub → GitHub Actions → Nutanix**

Version 1.0 | Production Ready

-----

## Table of Contents

1. Architecture Overview
1. Notification Strategy (4 Notifications)
1. Prerequisites & Setup
1. RHDH Template Configuration
1. GitHub Actions Workflow
1. Catalog Registration
1. Testing & Validation
1. Production Deployment Checklist
1. Appendix

-----

# 1. Architecture Overview

## 1.1 Objective

Enable self-service VM provisioning through RHDH with real-time progress tracking and automatic catalog registration for successful builds only.

## 1.2 High-Level Flow

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

## 1.3 Key Components

|Component         |Purpose                           |Technology                    |
|------------------|----------------------------------|------------------------------|
|RHDH Template     |User interface for VM requests    |Backstage YAML                |
|GitHub Actions    |Orchestration & provisioning logic|workflow_dispatch + Node.js   |
|Nutanix API       |VM creation & management          |REST API (Prism Central)      |
|RHDH Notifications|Real-time status updates          |Backstage Notifications Plugin|
|RHDH Catalog      |VM inventory & metadata           |Backstage Catalog API         |

## 1.4 Notification Strategy

**4 Notifications Per Request:**

1. **START:** Immediate confirmation that provisioning began
1. **Progress Update 1:** At 15 minutes (33% complete)
1. **Progress Update 2:** At 30 minutes (66% complete)
1. **COMPLETION:** Success with full details OR Failure with error info

-----

# 2. Notification Strategy (4 Notifications)

## 2.1 Notification Timeline

|Time|Notification                |Severity       |Recipients                          |
|----|----------------------------|---------------|------------------------------------|
|0:00|🚀 VM Provisioning Started   |High           |Owner + Requester                   |
|0:15|⏱️ VM Building Progress (33%)|Normal         |Owner + Requester                   |
|0:30|⏱️ VM Building Progress (66%)|Normal         |Owner + Requester                   |
|0:45|✅ VM Ready! (or ❌ Failed)   |High / Critical|Owner + Requester (+ Ops on failure)|

## 2.2 Notification Content Examples

### Notification 1: Start

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

### Notification 2 & 3: Progress

```
Title: ⏱️ VM Building Progress
Description:
VM: test-vm-001

Progress: ~33% complete
Elapsed: 15 minutes

Still provisioning...
```

### Notification 4a: Success

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

### Notification 4b: Failure

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

# 3. Prerequisites & Setup

## 3.1 Required Components

- **Red Hat Developer Hub (RHDH)** - v1.2 or higher
- **GitHub Repository** - For workflow storage
- **Nutanix Prism Central** - API access enabled
- **RHDH Notifications Plugin** - Installed and enabled

## 3.2 GitHub Secrets Configuration

Add the following secrets to your GitHub repository (Settings → Secrets → Actions):

|Secret Name       |Description               |Example Value                 |
|------------------|--------------------------|------------------------------|
|`BACKSTAGE_TOKEN` |RHDH service account token|eyJhbGciOiJIUzI1…             |
|`NUTANIX_API_URL` |Prism Central URL         |https://prism.company.com:9440|
|`NUTANIX_USERNAME`|API username              |api-user                      |
|`NUTANIX_PASSWORD`|API password              |••••••••                      |
|`RHDH_URL`        |RHDH instance URL         |https://rhdh.company.com      |

## 3.3 RHDH Service Account Setup

**Create a service account in RHDH:**

1. Go to RHDH → **Settings** → **Administration** → **Service Accounts**
1. Click **Create Service Account**
1. Name: `github-actions-provisioner`
1. Permissions:
- `catalog.entity.create`
- `catalog.entity.read`
- `notifications.create`
1. Copy the generated token
1. Add to GitHub Secrets as `BACKSTAGE_TOKEN`

## 3.4 Enable RHDH Notifications Plugin

In your RHDH `app-config.yaml`:

```yaml
notifications:
  processors:
    webhook:
      enabled: true

dynamicPlugins:
  frontend:
    janus-idp.backstage-plugin-notifications:
      disabled: false
  backend:
    janus-idp.backstage-plugin-notifications-backend:
      disabled: false
```

-----

# 4. RHDH Template Configuration

## 4.1 Template File Structure

Create the following file structure in your RHDH templates repository:

```
rhdh-templates/
└── nutanix-vm/
    ├── template.yaml
    └── README.md
```

## 4.2 Complete Template Code

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
          description: Name for the virtual machine
          pattern: '^[a-z0-9-]+$'
          maxLength: 32
          
        environment:
          title: Environment
          type: string
          enum:
            - dev
            - staging
            - production
          
        cpu:
          title: CPU Cores
          type: number
          default: 2
          enum: [2, 4, 8, 16]
          
        memory:
          title: Memory (GB)
          type: number
          default: 4
          enum: [4, 8, 16, 32, 64]
          
        osType:
          title: Operating System
          type: string
          enum:
            - rhel-9
            - ubuntu-22.04
            - windows-2022
          
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
        url: ${{ steps['trigger-github-action'].output.workflowUrl }}
```

## 4.3 Register Template in RHDH

Add to your `catalog-info.yaml`:

```yaml
apiVersion: backstage.io/v1alpha1
kind: Location
metadata:
  name: vm-provisioning-templates
  description: VM provisioning templates
spec:
  type: url
  targets:
    - https://github.com/your-org/rhdh-templates/blob/main/nutanix-vm/template.yaml
```

-----

# 5. GitHub Actions Workflow

## 5.1 Workflow File Location

Create the workflow file at:

`.github/workflows/provision-vm.yml`

## 5.2 Complete Workflow Code

**IMPORTANT:** This workflow includes all 4 notifications and handles both success and failure paths.

```yaml
name: Provision Nutanix VM

on:
  workflow_dispatch:
    inputs:
      vmName:
        required: true
        type: string
      environment:
        required: true
        type: string
      cpu:
        required: true
        type: number
      memory:
        required: true
        type: number
      osType:
        required: true
        type: string
      owner:
        required: true
        type: string
      requestedBy:
        required: true
        type: string

jobs:
  provision:
    runs-on: ubuntu-latest
    timeout-minutes: 60
    
    steps:
      - name: Checkout
        uses: actions/checkout@v4
      
      # ========================================
      # NOTIFICATION 1: START
      # ========================================
      - name: Notification 1 - Started
        uses: actions/github-script@v7
        env:
          RHDH_URL: ${{ secrets.RHDH_URL }}
          BACKSTAGE_TOKEN: ${{ secrets.BACKSTAGE_TOKEN }}
        with:
          script: |
            await fetch(`${process.env.RHDH_URL}/api/notifications`, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${process.env.BACKSTAGE_TOKEN}`,
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
                             "• Environment: ${{ inputs.environment }}\n" +
                             "• CPU: ${{ inputs.cpu }} cores\n" +
                             "• Memory: ${{ inputs.memory }}GB\n" +
                             "• OS: ${{ inputs.osType }}\n\n" +
                             "_Estimated time: ~45 minutes_",
                  link: "${{ github.server_url }}/${{ github.repository }}/actions/runs/${{ github.run_id }}",
                  severity: "high",
                  topic: "vm-provisioning",
                  scope: "${{ inputs.vmName }}"
                }
              })
            });
      
      # ========================================
      # PROVISION VM WITH PROGRESS TRACKING
      # ========================================
      - name: Provision and Monitor VM
        id: provision
        uses: actions/github-script@v7
        env:
          RHDH_URL: ${{ secrets.RHDH_URL }}
          BACKSTAGE_TOKEN: ${{ secrets.BACKSTAGE_TOKEN }}
          NUTANIX_API_URL: ${{ secrets.NUTANIX_API_URL }}
          NUTANIX_USERNAME: ${{ secrets.NUTANIX_USERNAME }}
          NUTANIX_PASSWORD: ${{ secrets.NUTANIX_PASSWORD }}
        with:
          script: |
            // Helper function to send notifications
            const sendNotification = async (title, description, severity = "normal") => {
              try {
                const response = await fetch(`${process.env.RHDH_URL}/api/notifications`, {
                  method: 'POST',
                  headers: {
                    'Authorization': `Bearer ${process.env.BACKSTAGE_TOKEN}`,
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
                  console.error(`Failed to send notification: ${response.status}`);
                }
              } catch (error) {
                console.error('Notification error:', error);
              }
            };

            // Create VM in Nutanix
            console.log('Creating VM in Nutanix...');
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
                    resources: {
                      num_sockets: ${{ inputs.cpu }},
                      memory_size_mib: ${{ inputs.memory }} * 1024,
                      power_state: "ON"
                    }
                  },
                  metadata: {
                    kind: "vm"
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
            
            console.log(`VM created with UUID: ${vmUuid}`);
            core.setOutput('vm_uuid', vmUuid);

            // Monitor VM provisioning with progress notifications
            const startTime = Date.now();
            const maxDuration = 50 * 60 * 1000; // 50 minutes (buffer)
            let notification2Sent = false;
            let notification3Sent = false;

            while (true) {
              const elapsed = Date.now() - startTime;
              const elapsedMinutes = Math.floor(elapsed / 60000);

              // ========================================
              // NOTIFICATION 2: 15-minute update
              // ========================================
              if (elapsedMinutes >= 15 && !notification2Sent) {
                await sendNotification(
                  "⏱️ VM Building Progress",
                  "VM: **${{ inputs.vmName }}**\n\n" +
                  "Progress: ~33% complete\n" +
                  `Elapsed: ${elapsedMinutes} minutes\n\n` +
                  "_Still provisioning..._",
                  "normal"
                );
                notification2Sent = true;
                console.log('Sent 15-minute progress notification');
              }

              // ========================================
              // NOTIFICATION 3: 30-minute update
              // ========================================
              if (elapsedMinutes >= 30 && !notification3Sent) {
                await sendNotification(
                  "⏱️ VM Building Progress",
                  "VM: **${{ inputs.vmName }}**\n\n" +
                  "Progress: ~66% complete\n" +
                  `Elapsed: ${elapsedMinutes} minutes\n\n` +
                  "_Nearing completion..._",
                  "normal"
                );
                notification3Sent = true;
                console.log('Sent 30-minute progress notification');
              }

              // Check VM status
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
                console.error(`Failed to get VM status: ${statusResponse.status}`);
                await new Promise(resolve => setTimeout(resolve, 30000));
                continue;
              }

              const statusData = await statusResponse.json();
              const state = statusData.status?.state;
              const powerState = statusData.status?.resources?.power_state;
              const nicList = statusData.status?.resources?.nic_list || [];
              const ipAddress = nicList[0]?.ip_endpoint_list?.[0]?.ip;

              console.log(`VM Status - State: ${state}, Power: ${powerState}, IP: ${ipAddress || 'pending'}`);

              // Check if VM is fully provisioned (powered on with IP)
              if (state === 'COMPLETE' && powerState === 'ON' && ipAddress) {
                console.log('VM is fully provisioned!');
                core.setOutput('ip_address', ipAddress);
                core.setOutput('power_state', powerState);
                break;
              }

              // Timeout check
              if (elapsed > maxDuration) {
                throw new Error(`VM provisioning timeout after ${Math.floor(elapsed/60000)} minutes`);
              }

              // Wait 30 seconds before next check
              await new Promise(resolve => setTimeout(resolve, 30000));
            }

            console.log('VM provisioning complete!');
      
      # ========================================
      # REGISTER IN CATALOG (SUCCESS ONLY)
      # ========================================
      - name: Register in RHDH Catalog
        if: success()
        id: register
        uses: actions/github-script@v7
        env:
          RHDH_URL: ${{ secrets.RHDH_URL }}
          BACKSTAGE_TOKEN: ${{ secrets.BACKSTAGE_TOKEN }}
        with:
          script: |
            const entity = {
              apiVersion: "backstage.io/v1alpha1",
              kind: "Resource",
              metadata: {
                name: "${{ inputs.vmName }}".toLowerCase(),
                namespace: "default",
                title: "${{ inputs.vmName }}",
                description: "Nutanix VM - ${{ inputs.osType }}",
                labels: {
                  environment: "${{ inputs.environment }}",
                  "os-type": "${{ inputs.osType }}",
                  "provisioned-by": "rhdh"
                },
                annotations: {
                  "nutanix.com/vm-uuid": "${{ steps.provision.outputs.vm_uuid }}",
                  "nutanix.com/ip-address": "${{ steps.provision.outputs.ip_address }}",
                  "nutanix.com/cpu-cores": "${{ inputs.cpu }}",
                  "nutanix.com/memory-gb": "${{ inputs.memory }}",
                  "github.com/workflow-run": "${{ github.server_url }}/${{ github.repository }}/actions/runs/${{ github.run_id }}",
                  "backstage.io/managed-by-location": "url:https://github.com/${{ github.repository }}",
                  "provisioned-at": new Date().toISOString()
                },
                tags: ["vm", "nutanix", "${{ inputs.environment }}", "${{ inputs.osType }}"]
              },
              spec: {
                type: "virtual-machine",
                lifecycle: "${{ inputs.environment }}",
                owner: "${{ inputs.owner }}",
                system: "nutanix-cluster"
              }
            };

            const response = await fetch(`${process.env.RHDH_URL}/api/catalog/entities`, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${process.env.BACKSTAGE_TOKEN}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({ entity })
            });

            if (!response.ok) {
              const errorText = await response.text();
              throw new Error(`Failed to register in catalog: ${response.status} - ${errorText}`);
            }

            const result = await response.json();
            const catalogUrl = `${process.env.RHDH_URL}/catalog/default/resource/${entity.metadata.name}`;
            
            console.log('Successfully registered in RHDH catalog');
            console.log(`Catalog URL: ${catalogUrl}`);
            
            core.setOutput('catalog_url', catalogUrl);
      
      # ========================================
      # NOTIFICATION 4a: SUCCESS
      # ========================================
      - name: Notification 4 - Success
        if: success()
        uses: actions/github-script@v7
        env:
          RHDH_URL: ${{ secrets.RHDH_URL }}
          BACKSTAGE_TOKEN: ${{ secrets.BACKSTAGE_TOKEN }}
        with:
          script: |
            await fetch(`${process.env.RHDH_URL}/api/notifications`, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${process.env.BACKSTAGE_TOKEN}`,
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
                             "• IP Address: `${{ steps.provision.outputs.ip_address }}`\n" +
                             "• UUID: `${{ steps.provision.outputs.vm_uuid }}`\n" +
                             "• CPU: ${{ inputs.cpu }} cores\n" +
                             "• Memory: ${{ inputs.memory }}GB\n" +
                             "• OS: ${{ inputs.osType }}\n" +
                             "• Environment: ${{ inputs.environment }}\n\n" +
                             "[View in Catalog →](${{ steps.register.outputs.catalog_url }})",
                  link: "${{ steps.register.outputs.catalog_url }}",
                  severity: "high",
                  topic: "vm-provisioning",
                  scope: "${{ inputs.vmName }}"
                }
              })
            });
      
      # ========================================
      # NOTIFICATION 4b: FAILURE
      # ========================================
      - name: Notification 4 - Failure
        if: failure()
        uses: actions/github-script@v7
        env:
          RHDH_URL: ${{ secrets.RHDH_URL }}
          BACKSTAGE_TOKEN: ${{ secrets.BACKSTAGE_TOKEN }}
        with:
          script: |
            await fetch(`${process.env.RHDH_URL}/api/notifications`, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${process.env.BACKSTAGE_TOKEN}`,
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
                             "• CPU: ${{ inputs.cpu }} cores\n" +
                             "• Memory: ${{ inputs.memory }}GB\n" +
                             "• OS: ${{ inputs.osType }}\n" +
                             "• Environment: ${{ inputs.environment }}\n\n" +
                             "The VM was **not** added to the catalog.\n\n" +
                             "[View Logs →](${{ github.server_url }}/${{ github.repository }}/actions/runs/${{ github.run_id }})",
                  link: "${{ github.server_url }}/${{ github.repository }}/actions/runs/${{ github.run_id }}",
                  severity: "critical",
                  topic: "vm-provisioning",
                  scope: "${{ inputs.vmName }}"
                }
              })
            });
      
      # ========================================
      # SUMMARY
      # ========================================
      - name: Job Summary
        if: always()
        run: |
          if [ "${{ job.status }}" == "success" ]; then
            echo "## ✅ VM Provisioned Successfully" >> $GITHUB_STEP_SUMMARY
            echo "" >> $GITHUB_STEP_SUMMARY
            echo "| Property | Value |" >> $GITHUB_STEP_SUMMARY
            echo "|----------|-------|" >> $GITHUB_STEP_SUMMARY
            echo "| VM Name | ${{ inputs.vmName }} |" >> $GITHUB_STEP_SUMMARY
            echo "| UUID | ${{ steps.provision.outputs.vm_uuid }} |" >> $GITHUB_STEP_SUMMARY
            echo "| IP Address | ${{ steps.provision.outputs.ip_address }} |" >> $GITHUB_STEP_SUMMARY
            echo "| CPU | ${{ inputs.cpu }} cores |" >> $GITHUB_STEP_SUMMARY
            echo "| Memory | ${{ inputs.memory }}GB |" >> $GITHUB_STEP_SUMMARY
            echo "| OS | ${{ inputs.osType }} |" >> $GITHUB_STEP_SUMMARY
            echo "| Environment | ${{ inputs.environment }} |" >> $GITHUB_STEP_SUMMARY
            echo "" >> $GITHUB_STEP_SUMMARY
            echo "🔗 [View in RHDH Catalog](${{ steps.register.outputs.catalog_url }})" >> $GITHUB_STEP_SUMMARY
          else
            echo "## ❌ VM Provisioning Failed" >> $GITHUB_STEP_SUMMARY
            echo "" >> $GITHUB_STEP_SUMMARY
            echo "VM **${{ inputs.vmName }}** failed to provision." >> $GITHUB_STEP_SUMMARY
            echo "" >> $GITHUB_STEP_SUMMARY
            echo "Check the logs above for error details." >> $GITHUB_STEP_SUMMARY
          fi
```

-----

# 6. Testing & Validation

## 6.1 Pre-Deployment Testing

### Test 1: Validate Secrets

```bash
# Test Nutanix API connectivity
curl -u "$NUTANIX_USERNAME:$NUTANIX_PASSWORD" \
  "$NUTANIX_API_URL/api/nutanix/v3/clusters/list" \
  -H "Content-Type: application/json" \
  -d '{"kind":"cluster"}'

# Expected: JSON response with cluster list
```

### Test 2: Test RHDH Notification API

```bash
curl -X POST https://your-rhdh.com/api/notifications \
  -H "Authorization: Bearer $BACKSTAGE_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "recipients": {
      "type": "entity",
      "entityRef": ["user:default/your-username"]
    },
    "payload": {
      "title": "Test Notification",
      "description": "Testing notification system",
      "severity": "normal",
      "topic": "test"
    }
  }'

# Expected: 200 OK, notification appears in RHDH
```

### Test 3: Test GitHub Actions Manually

```bash
gh workflow run provision-vm.yml \
  -f vmName=test-vm-001 \
  -f environment=dev \
  -f cpu=2 \
  -f memory=4 \
  -f osType=rhel-9 \
  -f owner=group:default/platform-team \
  -f requestedBy=user:default/your-username
```

## 6.2 Post-Deployment Validation

**After deploying to production, validate:**

1. User can see template in RHDH “Create” page
1. Form validation works correctly
1. All 4 notifications are received
1. Successful VMs appear in catalog
1. Failed VMs do NOT appear in catalog
1. Catalog entities have correct metadata

-----

# 7. Production Deployment Checklist

## 7.1 Pre-Deployment Checklist

|Item                        |Status|Notes                   |
|----------------------------|------|------------------------|
|GitHub Secrets configured   |☐     |All 5 secrets added     |
|RHDH Service Account created|☐     |With correct permissions|
|Notifications plugin enabled|☐     |Test notification sent  |
|Nutanix API access verified |☐     |Test API call successful|
|Template registered in RHDH |☐     |Visible in Create page  |
|Workflow file in GitHub     |☐     |In main branch          |
|Test provisioning completed |☐     |End-to-end test passed  |

## 7.2 Post-Deployment Monitoring

- **GitHub Actions Logs:** Monitor workflow runs for failures
- **RHDH Catalog:** Verify VMs are being registered correctly
- **Notification Delivery:** Confirm users are receiving all 4 notifications
- **Nutanix API Rate Limits:** Monitor for API throttling

## 7.3 Common Issues & Solutions

|Issue                       |Cause                       |Solution                            |
|----------------------------|----------------------------|------------------------------------|
|Notifications not appearing |Wrong entity ref format     |Use `user:default/username` format  |
|Catalog registration fails  |Duplicate entity name       |Ensure VM names are unique          |
|Workflow timeout            |VM takes longer than 60 min |Increase timeout-minutes in workflow|
|GitHub Actions doesn’t start|Workflow dispatch permission|Check repository settings           |

## 7.4 Success Metrics

Track these metrics to measure success:

- **Provisioning Success Rate:** Target 95%+
- **Average Provisioning Time:** Target 45 minutes or less
- **Notification Delivery Rate:** Target 100%
- **User Adoption:** Number of VMs provisioned per week
- **Time Saved:** Compare to manual provisioning process

-----

# 8. Appendix

## 8.1 API Reference

### RHDH Notifications API

```
POST https://rhdh.company.com/api/notifications

Headers:
  Authorization: Bearer {token}
  Content-Type: application/json

Body:
{
  "recipients": {
    "type": "entity",
    "entityRef": ["user:default/username"]
  },
  "payload": {
    "title": "Notification Title",
    "description": "Notification body text",
    "link": "https://link-to-resource",
    "severity": "high",
    "topic": "vm-provisioning",
    "scope": "vm-name"
  }
}
```

### RHDH Catalog API

```
POST https://rhdh.company.com/api/catalog/entities

Headers:
  Authorization: Bearer {token}
  Content-Type: application/json

Body:
{
  "entity": {
    "apiVersion": "backstage.io/v1alpha1",
    "kind": "Resource",
    "metadata": {
      "name": "vm-name",
      "namespace": "default"
    },
    "spec": {
      "type": "virtual-machine",
      "owner": "team-name"
    }
  }
}
```

## 8.2 Severity Levels

|Severity  |When to Use                        |Example                       |
|----------|-----------------------------------|------------------------------|
|`critical`|Failures requiring immediate action|VM provisioning failed        |
|`high`    |Important status changes           |VM ready, provisioning started|
|`normal`  |Progress updates                   |VM building (33% complete)    |
|`low`     |Informational only                 |Workflow triggered            |

## 8.3 Support & Troubleshooting

**GitHub Actions Logs:**
View detailed logs at: `https://github.com/your-org/repo/actions`

**RHDH Backend Logs:**

```bash
kubectl logs -n rhdh deployment/backstage -f
```

**Test Nutanix Connectivity:**

```bash
curl -k -u "user:pass" https://nutanix-api:9440/api/nutanix/v3/vms/list \
  -H "Content-Type: application/json" \
  -d '{"kind":"vm","length":10}'
```

-----

## 🎉 Implementation Complete!

**Your production VM provisioning workflow is ready to deploy.**

This document contains everything needed to implement self-service VM provisioning with RHDH, including:

- Complete RHDH template configuration
- Full GitHub Actions workflow with 4 notifications
- Catalog registration for successful VMs only
- Testing procedures and production checklist

-----

**VM Provisioning with RHDH - Complete Production Guide**
Version 1.0 | © Your Organization