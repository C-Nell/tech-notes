## API OpenShift Red Hat Developer Hub/Backstage Testing Examples

```
nslookup aap.company.com
```
```
dig aap.company.com
```

If DNS doesn’t resolve, OpenShift CoreDNS or /etc/resolv.conf might need attention.
<br>
<br>

### Test: basic connectivity to AAP (without TLS)
```
curl -v telnet://aap.company.com:443
```
<br>

### Test: Check If Token Header Is Actually Being Sent via Backstage
```
curl -v -H "Authorization: Bearer <BADTOKEN>" http://localhost:7007/api/proxy/aap-prod/job_templates/
```
See if the error response changes when you tamper the token → proves if the auth header is reaching AAP.
<br>
<br>


###  Test: AAP API Directly Using Your CA Cert
##### To confirm if your Backstage pod trusts the AAP certificate:
```
curl --cacert /opt/opt-apt/src/ca.crt \
  -H "Authorization: Bearer <YOUR_AAP_TOKEN>" \
  https://aap.company.com/api/v2/job_templates/
```
If it works, you’ll get:
200 OK → success<br>
401 Unauthorized → token is bad<br>
404 Not Found → API endpoint is wrong<br>
TLS error → cert mismatch or wrong CA
<br>
<br>

### Test via Backstage Proxy
```
curl --cacert /opt/opt-apt/src/ca.crt \
  -H "Authorization: Bearer <YOUR_AAP_TOKEN>" \
  http://localhost:7007/api/proxy/aap-prod/job_templates/

```
<br>

### Test: Verify chain manually
```
openssl s_client -connect aap.company.com:443 -CAfile /opt/opt-apt/src/ca.crt
```
Verify return code: 0 (ok) ✅
If not, the cert is missing or doesn't match AAP's chain.
<br>
<br>


### Test: Direct API Reachability from Backstage Pod

```
curl -v -k -H "Authorization: Bearer <YOUR_AAP_TOKEN>" https://aap.company.com/api/v2/<user_id>/
```
<br>

### Test: Backstage Proxy Is Routing Properly

```
curl -v -H "Authorization: Bearer <YOUR_AAP_TOKEN>" http://localhost:7007/proxy/aap-prod/job_templates/
```
🚦 What to Look For
Result	Interpretation<br>
200 OK	✅ Everything works as expected<br>
401 Unauthorized	❌ Invalid token or missing auth header<br>
403 Forbidden	❌ Valid token but insufficient permissions<br>
404 Not Found	❌ Invalid endpoint or bad proxy mapping<br>
Timeout / Could not resolve host	❌ DNS, network, or OpenShift config issue
<br>
