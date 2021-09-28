# Greenlight Bench

```bash
# install modules
npm install

# create sym-link to command
sudo npm link

# start permit post benchmark for 200 requests with 20 concurrent requests
greenlight-bench permit-post -c 20 -r 200 --token eyJhbGciOiJ...

# start permit get benchmark for http://api.domain.com
greenlight-bench permit-get -u http://api.domain.com --token eyJhbGciOiJ...

# get help
greenlight-bench --help
```
