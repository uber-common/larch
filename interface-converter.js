// Copyright (c) 2015 Uber Technologies, Inc.
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in
// all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
// THE SOFTWARE.

'use strict';

var assert = require('assert');
var TypedError = require('error/typed');

var LogtronBackend = require('./logtron-backend');
var Larch = require('./larch');

module.exports = createLarchWithLogger;

var UnrecognizedLoggerError = new TypedError({
    type: 'larch.unrecognized-logger',
    message: 'Unrecognized logger type; don\'t know how to convert logger ' +
        'of type {constructor} to Larch logger. Please provide a Logtron, ' +
        'DebugLogtron (^5.2.0), or Larch instance.'
});

function createLarchWithLogger(config) {
    assert(config.logger, 'createLarchWithLogger requires a logger');

    var backendLogger = config.logger;
    // It's expected that loggers are rarely created, so using delete on an
    // object is okay here
    delete config.logger;

    if (isLarchLogger(backendLogger)) {
        return backendLogger;
    } else if (isDebugLogtron(backendLogger)) {
        var logtronBackend = new LogtronBackend(backendLogger);
        config.backends = [logtronBackend];
        var larch = new Larch(config);
        // Just lol forward these methods
        larch.whitelist = backendLogger.whitelist.bind(backendLogger);
        larch.items = backendLogger.items.bind(backendLogger);
        return larch;
    } else if (isLogtronLogger(backendLogger)) {
        var logtronBackend = new LogtronBackend(backendLogger);
        config.backends = [logtronBackend];
        return new Larch(config);
    } else {
        var consName = typeof backendLogger;
        if (typeof backendLogger === 'object') {
            consName = backendLogger.constructor.name;
            if (backendLogger.constructor === Object) {
                consName = '(anonymous object)';
            } else if (backendLogger.constructor === Function) {
                consName = 'Function (name: ' + backendLogger.name + ')';
            }
        }
        throw new UnrecognizedLoggerError({
            constructor: consName
        });
    }
}

function isLogtronLogger(logger) {
    return typeof logger === 'object' && typeof logger.writeEntry === 'function';
}

function isDebugLogtron(logger) {
    return isLogtronLogger(logger) && typeof logger.whitelist === 'function';
}

function isLarchLogger(logger) {
    return logger.constructor.name === 'Larch';
}
