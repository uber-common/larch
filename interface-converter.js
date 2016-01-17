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

var LogtronBackend = require('./logtron-backend');
var Larch = require('./larch');

module.exports = createLarchWithLogger;

function createLarchWithLogger(config) {
    assert(config.logger, 'createLarchWithLogger requires a logger');

    var backendLogger = config.logger;
    // It's expected that loggers are rarely created, so using delete on an
    // object is okay here
    delete config.logger;

    if (isLogtronLogger(backendLogger)) {
        var logtronBackend = new LogtronBackend(backendLogger);
        config.backends = [logtronBackend];
        return new Larch(config);
    } else if (isLarchLogger(backendLogger)) {
        return backendLogger;
    }
}

function isLogtronLogger(logger) {
    return typeof logger === 'object' &&
        typeof logger.writeEntry === 'function';
}

function isLarchLogger(logger) {
    return logger.constructor.name === 'Larch';
}
