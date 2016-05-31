'use strict';

const test = require('ava').test;
const https = require('https');
const sinon = require('sinon');
const moment = require('moment');

const httpsStub = require('./helpers/https.stub');
const CertExpiryCheck = require('../index');

const setStub = function(config = {}) {
  if (https.request.restore) https.request.restore();
  sinon.stub(https, 'request', httpsStub.getStub(Object.assign({
    certValidToOffset: 60,
    certValidFromOffset: 90,
    shouldSucceed: true
  }, config)));
};

test('should return the correct expiry information for a single entry', async t => {
  setStub();

  let checker = new CertExpiryCheck();

  try {
    let result = await checker.checkHosts([{
      hostname: 'www.google.com'
    }]);

    let validFrom = moment(result[0].validFrom);
    let validFromCompare = moment().subtract(90, 'days');
    let validTo = moment(result[0].validTo);
    let validToCompare = moment().add(60, 'days');

    t.is(validFrom.year(), validFromCompare.year());
    t.is(validFrom.month(), validFromCompare.month());
    t.is(validFrom.dayOfYear(), validFromCompare.dayOfYear());

    t.is(validTo.year(), validToCompare.year());
    t.is(validTo.month(), validToCompare.month());
    t.is(validTo.dayOfYear(), validToCompare.dayOfYear());

    t.is(result[0].expiry.days, 60);
    t.is(result[0].expiry.isExpired, false);
    t.is(result[0].expiry.isInAlertWindow, false);
  } catch(e) {
    t.fail();
  }

});

test('should return the correct expiry information for multiple entries', async t => {
  setStub();

  let checker = new CertExpiryCheck();

  try {
    let result = await checker.checkHosts([{
      hostname: 'www.google.com'
    }, {
      hostname: 'www.facebook.com'
    }]);

    t.is(result[0].host.hostname, 'www.google.com');
    t.is(result[0].expiry.days, 60);
    t.is(result[1].host.hostname, 'www.facebook.com');
    t.is(result[1].expiry.days, 60);

  } catch(e) {
    t.fail();
  }

});

test('should allow default options to be overidden', async t => {
  setStub();

  const checker = new CertExpiryCheck({
    timeout: 6000,
    defaultPort: 8080,
    defaultAlertWindowDays: 10,
    userAgent: 'My user agent'
  });

  t.is(checker.config.timeout, 6000);
  t.is(checker.config.defaultPort, 8080);
  t.is(checker.config.defaultAlertWindowDays, 10);
  t.is(checker.config.userAgent, 'My user agent');

  try {
    let result = await checker.checkHosts([{
      hostname: 'www.google.com'
    }]);

    t.is(result[0].host.port, 8080);
    t.is(result[0].host.alertWindowDays, 10);
    t.is(result[0].host.headers['User-Agent'], 'My user agent');

    t.is(httpsStub.accessors.setTimeoutStub.called, true);
    t.is(httpsStub.accessors.setTimeoutStub.calledWith(6000), true);

  } catch(e) {
    t.fail();
  }

});

test('should allow configs to be overridden per host', async t => {
  setStub();

  let checker = new CertExpiryCheck();

  try {
    let result = await checker.checkHosts([{
      hostname: 'www.google.com',
      port: 1234,
      alertWindowDays: 5,
      userAgent: 'Google user agent'
    }, {
      hostname: 'www.facebook.com'
    }]);

    t.is(result[0].host.hostname, 'www.google.com');
    t.is(result[0].host.port, 1234);
    t.is(result[0].host.alertWindowDays, 5);
    t.is(result[0].host.headers['User-Agent'], 'Google user agent');

    t.is(result[1].host.hostname, 'www.facebook.com');
    t.is(result[1].host.port, 443);
    t.is(result[1].host.alertWindowDays, 30);
    t.is(result[1].host.headers['User-Agent'], `SSL Certificate Expiry Checker ${require('../package').version}`);

  } catch(e) {
    t.fail();
  }

});

test('should mark expired certs', async t => {
  setStub({
    certValidToOffset: -5
  });
  let checker = new CertExpiryCheck();

  try {
    let result = await checker.checkHosts([{
      hostname: 'www.google.com'
    }]);

    t.is(result[0].expiry.days, -5);
    t.is(result[0].expiry.isExpired, true);

  } catch(e) {
    t.fail();
  }

});

test('should mark valid certs within alerting window', async t => {
  setStub();
  let checker = new CertExpiryCheck();

  try {
    let result = await checker.checkHosts([{
      hostname: 'www.google.com',
      alertWindowDays: 120
    }]);

    t.is(result[0].expiry.isInAlertWindow, true);

  } catch(e) {
    t.fail();
  }

});

test('should bubble up any HTTP errors', async t => {
  setStub({
    shouldSucceed: false
  });
  let checker = new CertExpiryCheck();

  try {
    await checker.checkHosts([{
      hostname: 'www.google.com'
    }]);
  } catch(e) {
    t.is(e, 'it failed yo');
  }

});
