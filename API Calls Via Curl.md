## AAP OpenShift Red Hat Developer Hub/Backstage Testing Examples

### Test: basic connectivity to AAP (without TLS)
```
curl -v telnet://aap.company.com:443

```

#### Test: Direct API Reachability from Backstage Pod

```
curl -v -k -H "Authorization: Bearer <YOUR_AAP_TOKEN>" https://aap.company.com/api/v2/<user_id>/
```

#### Test: Backstage Proxy Is Routing Properly

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
