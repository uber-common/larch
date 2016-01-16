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

var FanoutRequest = require('./lib/unordered-fanout-request.js');
var Errors = require('./errors');

module.exports = BaseBackend;

function BaseBackend(options) {
    var self = this;

    assert(
        typeof self.log === 'function' &&
        self.log !== BaseBackend.prototype.log,
        '`log` method of BaseBackend must be overridden by function'
    );

    assert(
        typeof self.willSample === 'function',
        '`willSample` method of BaseBackend must be overridden by function'
    );

    assert(
        typeof self.slog === 'function',
        '`slog` method of BaseBackend must be overridden by function'
    );

    assert(
        typeof self.bootstrap === 'function',
        '`bootstrap` method of BaseBackend must be overridden by function'
    );

    assert(
        typeof self.destroy === 'function',
        '`destroy` method of BaseBackend must be overridden by function'
    );

    assert(
        typeof self.logMany === 'function',
        '`logMany` method of BaseBackend must be overriden by function'
    );
}

BaseBackend.prototype.log = function log(record, cb) {};

BaseBackend.prototype.slog = function slog(record, cb) {
    this.log(record, cb);
};

BaseBackend.prototype.willSample = function willSample(level, msg) {
    return true;
};

BaseBackend.prototype.bootstrap = function bootstrap(cb) {
    cb();
};

BaseBackend.prototype.destroy = function destroy(cb) {
    cb();
};

BaseBackend.prototype.logMany = function logMany(records, cb) {
    var self = this;

    var req = FanoutRequest.alloc(self, logEachRecord, onLogsDone);
    req.run(records, cb);
};

function logEachRecord(req, record, _, cb) {
    req.self.log(record, cb);
}

function onLogsDone(req, results, cb) {
    FanoutRequest.release(req);

    if (typeof cb === 'function') {
        return cb(Errors.resultArrayToError(
            results, 'larch.log-many.many-errors'
        ));
    }
}

