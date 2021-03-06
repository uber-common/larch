// Copyright (c) 2016 Uber Technologies, Inc.
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
var collectParallel = require('collect-parallel/array');

var Record = require('./record');
var Errors = require('./errors');

module.exports = Larch;

function Larch(options) {
    if (!(this instanceof Larch)) {
        return new Larch(options);
    }

    var self = this;

    self.backends = options.backends;
    assert(Array.isArray(self.backends), 'options.backends must be array');
    self.enableDebug(true);

    self.disabledLogs = Object.create(null);

    if (self.backends.length === 1) {
        self.log = self.logSingleBackend;
        self.slog = self.slogSingleBackend;
        self.willSample = self.willSampleSingleBackend;
    } else {
        self.log = self.logMultiBackend;
        self.slog = self.slogMultiBackend;
        self.willSample = self.willSampleMultiBackend;
    }
}

Larch.prototype.enableDebug =
function enableDebug(enabled) {
    var self = this;

    if (enabled) {
        self.trace = Larch.prototype.trace;
        self.debug = Larch.prototype.debug;
    } else {
        self.trace = noopLog;
        self.debug = noopLog;
    }
};

Larch.prototype.disableLog = function disableLog(name) {
    this.disabledLogs[name] = true;
};

Larch.prototype.enableLog = function enableLog(name) {
    this.disabledLogs[name] = false;
};

Larch.prototype.logSingleBackend =
function logSingleBackend(level, msg, meta, cb) {
    var record = new Record(level, msg, meta, null);
    this.backends[0].log(record, cb);
};

Larch.prototype.slogSingleBackend =
function slogSingleBackend(level, msg, meta, cb) {
    var record = new Record(level, msg, meta, null);
    this.backends[0].slog(record, cb);
};

Larch.prototype.slogMultiBackend =
function slogMultiBackend(level, msg, meta, cb) {
    var self = this;

    var record = new Record(level, msg, meta, null);

    collectParallel(self.backends, writeBackend, writesDone);

    function writeBackend(backend, i, backendCb) {
        backend.slog(record, backendCb);
    }

    function writesDone(ignored, results) {
        if (typeof cb === 'function') {
            cb(Errors.resultArrayToError(
                results,
                'larch.log-multi-backend.many-errors'
            ));
        }
    }
};

Larch.prototype.logMultiBackend =
function logMultiBackend(level, msg, meta, cb) {
    var self = this;

    var record = new Record(level, msg, meta, null);

    collectParallel(self.backends, writeBackend, writesDone);

    function writeBackend(backend, i, backendCb) {
        backend.log(record, backendCb);
    }

    function writesDone(ignored, results) {
        if (typeof cb === 'function') {
            cb(Errors.resultArrayToError(
                results,
                'larch.log-multi-backend.many-errors'
            ));
        }
    }
};

Larch.prototype.willSampleSingleBackend =
function willSampleSingleBackend(level, msg) {
    return this.backends[0].willSample(level, msg);
};

Larch.prototype.willSampleMultiBackend =
function willSampleMultiBackend(level, msg) {
    var i;
    for (i = 0; i < this.backends.length; i++) {
        if (this.backends[i].willSample(level, msg)) {
            return true;
        }
    }

    return false;
};

Larch.prototype.bootstrap = function bootstrap(cb) {
    var self = this;

    collectParallel(self.backends, bootstrapBackend, bootstrapsDone);

    function bootstrapBackend(backend, i, backendCb) {
        backend.bootstrap(backendCb);
    }

    function bootstrapsDone(ignored, results) {
        if (typeof cb === 'function') {
            cb(Errors.resultArrayToError(results, 'larch.bootstrap.many-errors'));
        }
    }
};

Larch.prototype.destroy = function destroy(cb) {
    var self = this;

    collectParallel(self.backends, destroyBackend, destroysDone);

    function destroyBackend(backend, i, backendCb) {
        backend.destroy(backendCb);
    }

    function destroysDone(ignored, results) {
        if (typeof cb === 'function') {
            cb(Errors.resultArrayToError(results, 'larch.destroy.many-errors'));
        }
    }
};

Larch.prototype.logIsEnabled = function logIsEnabled(name) {
    return !this.disabledLogs[name];
};

Larch.prototype.tryLog = function tryLog(level, msg, meta, cb) {
    if (!this.logIsEnabled(msg)) {
        if (typeof cb === 'function') {
            cb();
        }
        return;
    }
    this.log(level, msg, meta, cb);
};

Larch.prototype.stryLog = function stryLog(level, msg, meta, cb) {
    if (!this.logIsEnabled(msg)) {
        if (typeof cb === 'function') {
            cb();
        }
        return;
    }
    this.slog(level, msg, meta, cb);
};

Larch.prototype.trace = function trace(msg, meta, cb) {
    this.tryLog('trace', msg, meta, cb);
};

Larch.prototype.debug = function debug(msg, meta, cb) {
    this.tryLog('debug', msg, meta, cb);
};

Larch.prototype.info = function info(msg, meta, cb) {
    this.tryLog('info', msg, meta, cb);
};

Larch.prototype.access = function access(msg, meta, cb) {
    this.tryLog('access', msg, meta, cb);
};

Larch.prototype.warn = function warn(msg, meta, cb) {
    this.tryLog('warn', msg, meta, cb);
};

Larch.prototype.error = function error(msg, meta, cb) {
    this.tryLog('error', msg, meta, cb);
};

Larch.prototype.fatal = function fatal(msg, meta, cb) {
    this.tryLog('fatal', msg, meta, cb);
};

Larch.prototype.strace = function strace(msg, meta, cb) {
    this.stryLog('trace', msg, meta, cb);
};

Larch.prototype.sdebug = function sdebug(msg, meta, cb) {
    this.stryLog('debug', msg, meta, cb);
};

Larch.prototype.sinfo = function sinfo(msg, meta, cb) {
    this.stryLog('info', msg, meta, cb);
};

Larch.prototype.saccess = function saccess(msg, meta, cb) {
    this.stryLog('access', msg, meta, cb);
};

Larch.prototype.swarn = function swarn(msg, meta, cb) {
    this.stryLog('warn', msg, meta, cb);
};

Larch.prototype.serror = function serror(msg, meta, cb) {
    this.stryLog('error', msg, meta, cb);
};

Larch.prototype.sfatal = function sfatal(msg, meta, cb) {
    this.stryLog('fatal', msg, meta, cb);
};

function noopLog() {
}
