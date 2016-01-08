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
var util = require('util');
var timers = require('timers');
var NullStatsd = require('uber-statsd-client/null');
var extend = require('xtend');
var typedError = require('error/typed');

var BaseBackend = require('./base-backend');
var Record = require('./record');

module.exports = ReservoirBackend;

var DO_NOT_SAMPLE = -1;
var APPEND_TO_ARRAY = -2;

var SampledLogWithoutSamplingDecision = typedError({
    type: 'larch.reservoir-backend.sampled-log-without-sampling-decision',
    message: 'Reservoir backend `slog` method must be called after a call ' +
        'to ReservoirBackend#willSample'
});

function ReservoirBackend(options) {
    if (!(this instanceof ReservoirBackend)) {
        return new ReservoirBackend(options);
    }

    var self = this;

    BaseBackend.call(self);

    self.backend = options.backend;
    assert(
        typeof self.backend === 'object' &&
        typeof self.backend.logMany === 'function',
        'options.backend must be object with `logMany` method'
    );

    self.statsd = options.statsd || NullStatsd();
    assert(
        typeof self.statsd === 'object' &&
        typeof self.statsd.gauge === 'function',
        'options.statsd must be object with `gauge` method'
    );

    self.size = options.size || 100;
    assert(
        typeof self.size === 'number' &&
        self.size >= 5 && self.size < 1000000000,
        'options.size must be number 5 >= n > 1000000000'
    );

    self.rangeRand = options.rangeRand || ReservoirBackend.rangeRand;
    assert(
        typeof self.rangeRand === 'function',
        'options.rangeRand must be function'
    );

    self.flushInterval = options.flushInterval || 50;
    assert(
        typeof self.flushInterval === 'number' &&
        self.flushInterval > 1 && self.flushInterval < 1000000,
        'options.flushInterval must be number 1 > n > 1000000'
    );

    self.timers = options.timers || timers;
    assert(
        typeof self.timers === 'object' &&
        typeof self.timers.setTimeout === 'function',
        'options.timers must be object with setTimeout function'
    );

    self.now = options.now || Date.now;
    assert(
        typeof self.now === 'function',
        'options.now must be function'
    );

    self.timer = null;
    self.count = 0;
    self.records = [];
    self.dropCount = {};
    self.logCount = {};
    self.samplingDecision = null;
}

util.inherits(ReservoirBackend, BaseBackend);

ReservoirBackend.rangeRand = function rand(lo, hi) {
    return Math.floor(Math.random() * (hi - lo) + lo);
};

ReservoirBackend.prototype.setSize = function setSize(size) {
    var self = this;

    var i;
    if (size < self.size) {
        var removed = self.records.splice(size, self.size - size);

        for (i = 0; i < removed.length; i++) {
            self.countDrop(removed[i].data.level);
        }
    }

    self.size = size;
};

ReservoirBackend.prototype.setFlushInterval = function setFlushInterval(time) {
    var self = this;

    self.flushInterval = time;

    if (self.timer) {
        self.timers.clearTimeout(self.timer);
        self.setupTimer();
    }
};

ReservoirBackend.prototype.flush = function flush() {
    var self = this;

    var start = self.now();

    if (self.count > self.size) {
        self.backend.log(new Record(
            'warn',
            'dropped logs',
            {
                dropCount: extend(self.dropCount),
                flushInterval: self.flushInterval,
                size: self.size
            }
        ));
    }

    var i;
    var keys = Object.keys(self.dropCount);
    for (i = 0; i < keys.length; i++) {
        self.statsd.increment('larch.dropped.' + keys[i], self.dropCount[keys[i]]);
        self.dropCount[keys[i]] = 0;
    }

    for (i = 0; i < self.records.length; i++) {
        self.countLog(self.records[i].data.level);
    }

    keys = Object.keys(self.logCount);
    for (i = 0; i < keys.length; i++) {
        self.statsd.increment('larch.logged.' + keys[i], self.logCount[keys[i]]);
        self.logCount[keys[i]] = 0;
    }

    var copy = self.records.slice(0);
    self.backend.logMany(copy, onLoggingDone);

    function onLoggingDone(err) {
        // TODO: what to do when flush fails? Generate a log message?
        if (err) {
            var count = 1;
            if (err.count) {
                count = err.count;
            }

            self.statsd.increment('larch.errors', count);
        }

        self.statsd.timing('larch.flushTime', self.now() - start);
    }

    self.records.length = 0;
    self.count = 0;
};

ReservoirBackend.prototype.willSample = function willSample(msg, level) {
    this.samplingDecision = this._makeSamplingDecision(level);
    if (this.samplingDecision !== DO_NOT_SAMPLE) {
        return true;
    } else {
        return false;
    }
};

ReservoirBackend.prototype._makeSamplingDecision =
function _makeSamplingDecision(level) {
    if (this.records.length < this.size) {
        return APPEND_TO_ARRAY;
    }

    var probability = this.rangeRand(0, this.count);
    if (probability < this.size) {
        return probability;
    } else {
        return DO_NOT_SAMPLE;
    }
};

ReservoirBackend.prototype.log = function log(record, cb) {
    // If we don't already have a sampling decision, make one
    this.samplingDecision = this._makeSamplingDecision(record.data.level);

    this.slog(record, cb);
};

ReservoirBackend.prototype.slog = function slog(record, cb) {
    if (this.samplingDecision === null) {
        // Invalid to call this method without a sampling decision already made
        throw SampledLogWithoutSamplingDecision();
    }

    this.count += 1;

    if (this.samplingDecision !== DO_NOT_SAMPLE) {
        if (this.samplingDecision === APPEND_TO_ARRAY) {
            this.records.push(record);
        } else if (this.records[this.samplingDecision]) {
            this.countDrop(this.records[this.samplingDecision].data.level);
            this.records[this.samplingDecision] = record;
        }
    } else {
        this.countDrop(record.data.level);
    }

    this.samplingDecision = null;

    if (typeof cb === 'function') {
        cb();
    }
};

ReservoirBackend.prototype.countDrop = function countDrop(level) {
    var self = this;

    if (!self.dropCount[level]) {
        self.dropCount[level] = 1;
    } else {
        self.dropCount[level] += 1;
    }
};

ReservoirBackend.prototype.countLog = function countLog(level) {
    var self = this;

    if (!self.logCount[level]) {
        self.logCount[level] = 1;
    } else {
        self.logCount[level] += 1;
    }
};

ReservoirBackend.prototype.destroy = function destroy(cb) {
    var self = this;

    if (self.records.length) {
        self.flush();
    }
    self.timers.clearTimeout(self.timer);
    self.backend.destroy(cb);
};

ReservoirBackend.prototype.bootstrap = function bootstrap(cb) {
    var self = this;

    assert(
        typeof cb === 'function',
        'bootstrap must be called with a callback'
    );

    self.setupTimer();

    self.backend.bootstrap(cb);
};

ReservoirBackend.prototype.setupTimer = function setupTimer() {
    var self = this;

    if (!self.timer) {
        self.timer = self.timers.setTimeout(onTimer, self.flushInterval);
    }

    function onTimer() {
        self.flush();

        self.timer = self.timers.setTimeout(onTimer, self.flushInterval);
    }
};
