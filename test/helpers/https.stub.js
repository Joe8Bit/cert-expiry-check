'use strict';

const moment = require('moment');
const sinon = require('sinon');

const DATE_FORMAT = 'MMM D hh:mm:ss YYYY [GMT]';

const setTimeoutStub = sinon.stub();
const getOnStub = function(config) {
  if (config.shouldSucceed) {
    return sinon.stub();
  } else {
    return (evt, cb) => {
      cb('it failed yo');
    };
  }
};

const getStub = function(config) {
  return function(host, cb) {
    setTimeout(() => {
      cb({
        connection: {
          getPeerCertificate: sinon.stub().returns({
            subjectaltname: 'Alt name',
            subject: {
              'O': 'Org name',
              'CN': 'Common name'
            },
            issuer: {
              'O': 'Issuer org name',
              'CN': 'Issuer common name'
            },
            valid_to: moment().add(config.certValidToOffset, 'days').format(DATE_FORMAT),
            valid_from: moment().subtract(config.certValidFromOffset, 'days').format(DATE_FORMAT)
          })
        }
      });
    }, 1);
    return {
      setTimeout: setTimeoutStub,
      on: getOnStub(config),
      end: sinon.stub()
    };
  };

};

module.exports = {
  getStub,
  accessors: {
    setTimeoutStub
  }
};
