## cert-expiry-check

A module to check the expiry of SSL/TLS certs.

### Usage

In it's most basic form, using the default configuration:

```javascript
const CertExpiryCheck = require('cert-expiry-check');
const checker = new CertExpiryCheck();
checker.checkHosts([{
  hostname: 'www.google.com'
}]).then((results) => {
  console.log(results);
}).catch((e) => {
  console.error(e); // bubbles up HTTP errors and invalid cert chains
});
```

There are two types of configurations that can be performed, first the 'global' defaults used for all checked domains:

```javascript
const checker = new CertExpiryCheck({
  timeout: 5000, // timeout used for HTTPS connections
  defaultPort: 443, // port used for all HTTPS connections
  defaultAlertWindowDays: 30, // default alert window to use for near expiry certs
  userAgent: 'SSL Certificate Expiry Checker 0.1.0' // default user agent to send with requests
});
```

Secondly, the per host configurations that override the defaults (above) for each host to check:

```javascript
checker.checkHosts([{
  hostname: 'www.google.com',
  port: 443,
  alertWindowDays: 30,
  userAgent: 'SSL Certificate Expiry Checker 0.1.0'
}]).then((results) => {
  console.log(results);
})
```

**Note:** There is currently no support for self-signed certs, as this was outside of the core use-case. Happy to accept pull requests for support however.

### Development

```
git clone https://github.com/Joe8Bit/cert-expiry-check
cd cert-expiry-check
npm install -g ava nyc eslint babel-eslint && npm install
npm test
```

### Contributing

All contributors agree to abide by the `CODE_OF_CONDUCT.md`

### License

MIT
