'use strict';

const https = require('https');
const VERSION = require('./package').version;

/**
 * A class that exposes the core certificate checking functionality
 * @access public
 * @example
 * 	let checker = new CertExpiryCheck(); // Can pass an optional config object, see constructor docs for details
 */
class CertExpiryCheck {

  /**
   * Takes a config object, and merges with the default config
   * @param  {Object} [config = {}] an optional config object that defaults to an empty object if not present, overrides defaults
   * @param  {number} [config.timeout] HTTPS timeout integer in milliseconds, used for all connections
   * @param  {number} [config.defaultPort] The default HTTPS port used for all checks unless overridden by host specific config
   * @param  {number} [config.defaultAlertWindowDays] The number of days for the alerting window, used for all checks unles overridden by host
   * @return {Object}        The final config for this instance
   * @access public
   */
  constructor(config = {}) {
    this.config = Object.assign({
      timeout: 5000,
      defaultPort: 443,
      defaultAlertWindowDays: 30,
      userAgent: `SSL Certificate Expiry Checker ${VERSION}`
    }, config);
  }

  /**
   * Takes in an array of hosts and checks the certificates of each
   * @param  {object[]} hosts An array host objects to check
   * @param  {string} hosts.hostname Required: in the form 'www.google.com'
   * @param  {number} [hosts.port] Optional: an overridable port for this host
   * @param  {number} [hosts.alertWindowDays] Optional: an overridable number of days to alert for this host
   * @param  {string} [hosts.userAgent] Optional: an overridable user agent string to use when making requests
   * @access public
   * @return {function}       A promise that resolves to a final set of checks or an error
   */
  checkHosts(hosts) {
    return Promise.all(this.buildHostConfig(hosts).map(this.checkHost.bind(this)));
  }

  /**
   * Builds the canonical hosts config, which uses the default or a host specific override
   * @param  {object[]} hosts An array host objects to check
   * @param  {string} hosts.hostname Required: in the form 'www.google.com'
   * @param  {number} hosts.port Optional: an overridable port for this host
   * @param  {number} hosts.alertWindowDays Optional: an overridable number of days to alert for this host
   * @param  {number} hosts.userAgent Optional: an overridable user agent string to use when making requests
   * @access private
   * @return {object[]}       A new array of the final hosts config
   */
  buildHostConfig(hosts) {
    let _config = this.config;
    return hosts.map(function(host) {
      // This could be done in a more terse implementation via Object.assign, but making it more explicit is better imo
      host.port = host.port || _config.defaultPort;
      host.alertWindowDays = host.alertWindowDays || _config.defaultAlertWindowDays;
      host.headers = {};
      host.headers['User-Agent'] = host.userAgent || _config.userAgent;
      return host;
    });
  }

  /**
   * Check's a specific host for it's SSL config and returns a promise that is fullfilled with it
   * @param  {Object} host A host object
   * @param  {string} host.hostname The hostname to check SSL certs for
   * @param  {number} host.port The hostname port to check
   * @param  {number} host.alertWindowDays The alert window to check against
   * @param  {string} host.headers['User-Agent'] The user agent to use when making the hsot request
   * @access private
   * @return {function}      A promise that resolves or rejects the results
   */
  checkHost(host) {
    let _hydrate = this.hydrateResultObject.bind(this);
    let _config = this.config;
    return new Promise(function (resolve, reject) {
      host.method = 'GET';
      let req = https.request(host, function(res) {
        resolve(_hydrate(res.connection.getPeerCertificate(), host));
      });
      req.setTimeout(_config.timeout);
      req.on('error', reject);
      req.end();
    });
  }

  /**
   * Hydrates a final result object from the raw peerCertificate returned from the HTTPS request
   * @param  {object} raw  The raw PeerCertificate object received from the HTTPS request for a host
   * @param  {Object} host A host object
   * @param  {string} host.hostname The hostname to check SSL certs for
   * @param  {number} host.port The hostname port to check
   * @param  {number} host.alertWindowDays The alert window to check against
   * @param  {string} host.method The HTTP method used to make the HTTPS request
   * @param  {string} host.headers['User-Agent'] The user agent to use when making the hsot request
   * @access private
   * @return {Object}      The final hydrated object
   */
  hydrateResultObject(raw, host) {
    return {
      host,
      details: {
        subject: {
          org: raw.subject.O,
          commonName: raw.subject.CN,
          altName: raw.subjectaltname
        },
        issuer: {
          org: raw.issuer.O,
          commonName: raw.issuer.CN
        }
      },
      validFrom: this.parseDate(raw.valid_from),
      validTo: this.parseDate(raw.valid_to),
      expiry: this.getExpiry(this.parseDate(raw.valid_to), host)
    };
  }

  /**
   * A utilisty method that parses a date string into a native JS date
   * @param  {string} dateString A date Srtring
   * @access public
   * @return {object}            A JS date object
   */
  parseDate(dateString) {
    return new Date(Date.parse(dateString));
  }

  /**
   * A utility method to generate the expiry dates and window alerting periods
   * @param  {Object} then A JS date object that represents the expiry date for the current cert
   * @param  {Object} host A host object
   * @param  {string} host.hostname The hostname to check SSL certs for
   * @param  {number} host.port The hostname port to check
   * @param  {number} host.alertWindowDays The alert window to check against
   * @param  {string} host.method The HTTP method used to make the HTTPS request
   * @param  {string} host.headers['User-Agent'] The user agent to use when making the hsot request
   * @access private
   * @return {object}      The final expiry object
   */
  getExpiry(then, host) {
    let now = Date.now();
    let dayInMS = 86400000;
    let daysToExpiry = Math.round((then - now) / dayInMS);

    return {
      days: daysToExpiry,
      milliseconds: Math.round((then - now)),
      isExpired: (daysToExpiry <= 0),
      isInAlertWindow: (daysToExpiry <= host.alertWindowDays)
    };
  }

}

module.exports = CertExpiryCheck;
