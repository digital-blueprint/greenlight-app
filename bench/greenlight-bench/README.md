# Greenlight Bench

```bash
# install modules
npm install

# create sym-link to command
sudo npm link

# start permit post benchmark for http://api.domain.com with 100 requests with 10 concurrent requests
greenlight-bench permit-post -u http://api.domain.com -c 10 -r 100 --token eyJhbGciOiJ...

# start permit get benchmark for http://api.domain.com with 200 requests with 20 concurrent requests
greenlight-bench permit-get -u http://api.domain.com -c 20 -r 200 --token eyJhbGciOiJ...

# get help
greenlight-bench --help
```
