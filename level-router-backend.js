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
var collectParallel = require('collect-parallel/array');
var util = require('util');

var BaseBackend = require('./base-backend');
var Errors = require('./errors');
var Levels = require('./levels');

function LevelRouterBackend(options) {
    BaseBackend.call(this);

    this.backends = options.backends;
    assert(
        typeof this.backends === 'object',
        'options.backends must be object'
    );

    var levels = Object.keys(Levels.BY_NAME);
    var seen = levels.filter(function f(item) {
        return item in this.backends;
    }, this);

    assert(
        seen === levels.length ||
            (typeof this.backends.default === 'object' &&
            typeof this.backends.default.log === 'function'),
        'expected options.backends to have 1 backend per level or a default' +
            ' backend'
    );

    if (this.backends.default) {
        levels.forEach(function e(level) {
            if (!this.backends[level]) {
                this.backends[level] = this.backends.default;
            }
        }, this);
    }

    this.uniqueBackends = [];

    var i;
    for (i = 0; i < levels.length; i++) {
        if (this.uniqueBackends.indexOf(this.backends[levels[i]]) === -1) {
            this.uniqueBackends.push(this.backends[levels[i]]);
        }
    }
}

util.inherits(LevelRouterBackend, BaseBackend);

LevelRouterBackend.prototype.bootstrap = function bootstrap(cb) {
    var self = this;

    collectParallel(self.uniqueBackends, bootstrapBackend, bootstrapsDone);

    function bootstrapBackend(backend, i, backendCb) {
        backend.bootstrap(backendCb);
    }

    function bootstrapsDone(ignored, results) {
        if (typeof cb === 'function') {
            return cb(Errors.resultArrayToError(
                results,
                'larch.level-router-backend.bootstrap.many-errors'
            ));
        }
    }
};

LevelRouterBackend.prototype.destroy = function bootstrap(cb) {
    var self = this;

    collectParallel(self.uniqueBackends, destroyBackend, destroysDone);

    function destroyBackend(backend, i, backendCb) {
        backend.destroy(backendCb);
    }

    function destroysDone(ignored, results) {
        if (typeof cb === 'function') {
            return cb(Errors.resultArrayToError(
                results,
                'larch.level-router-backend.destroy.many-errors'
            ));
        }
    }
};

LevelRouterBackend.prototype.willSample = function willSample(level, msg) {
    return this.backends[level].willSample(level, msg);
};

LevelRouterBackend.prototype.slog = function slog(record, cb) {
    this.backends[record.data.level].slog(record, cb);
};

LevelRouterBackend.prototype.log = function log(record, cb) {
    var self = this;

    self.backends[record.data.level].log(record, cb);
};

module.exports = createLevelRouterBackend;

function createLevelRouterBackend(opts) {
    return new LevelRouterBackend(opts);
}
