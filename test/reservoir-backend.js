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

var test = require('tape');
var Timer = require('time-mock');
var NullStatsd = require('uber-statsd-client/null');

var ReservoirBackend = require('../reservoir-backend');
var Record = require('../record');

var FakeBackend = require('./lib/fake-backend');

function fakeRangeRand(lo, hi) {
    return 0;
}

test('reservoirbackend correctly limits logs', function t1(assert) {
    var backend = FakeBackend();
    var timer = Timer(0);

    var reservoir = ReservoirBackend({
        backend: backend,
        size: 5,
        timers: timer,
        rangeRand: fakeRangeRand
    });

    reservoir.bootstrap(noop);

    assert.ok(backend.bootstrapped, 'backend was bootstrapped');

    reservoir.log(new Record('error', 'timed out', {}));
    reservoir.log(new Record('error', 'timed out', {}));
    reservoir.log(new Record('error', 'timed out', {}));
    reservoir.log(new Record('error', 'timed out', {}));
    reservoir.log(new Record('error', 'timed out', {}));
    reservoir.log(new Record('warn', 'thing failed', {}));

    timer.advance(50);

    assert.ok(reservoir.records.length === 0, 'reservoir was flushed');
    assert.ok(backend.logs.length === 6, 'only 6 logs got through to backend');

    assert.ok(
        backend.logs[0].data.message === 'dropped logs' &&
        backend.logs[0].data.level === 'warn',
        'first log is dropped log warn'
    );

    assert.deepEquals(
        backend.logs[0].meta,
        {dropCount: {error: 1}, flushInterval: 50, size: 5},
        'first log contains correct meta'
    );

    assert.ok(
        backend.logs[1].data.message === 'thing failed',
        'logs[1] is right'
    );
    assert.ok(
        backend.logs[2].data.message === 'timed out',
        'logs[2] is right'
    );
    assert.ok(
        backend.logs[3].data.message === 'timed out',
        'logs[3] is right'
    );
    assert.ok(
        backend.logs[4].data.message === 'timed out',
        'logs[4] is right'
    );
    assert.ok(
        backend.logs[5].data.message === 'timed out',
        'logs[5] is right'
    );

    reservoir.destroy(noop);

    assert.end();
});

test('reservoirbackend uses statsd client correctly', function t1(assert) {
    var backend = FakeBackend();
    var timer = Timer(0);
    var statsd = new NullStatsd();
    var clusterStatsd = new NullStatsd();

    var reservoir = ReservoirBackend({
        backend: backend,
        size: 5,
        timers: timer,
        rangeRand: fakeRangeRand,
        statsd: statsd,
        clusterStatsd: clusterStatsd
    });

    reservoir.bootstrap(noop);

    assert.ok(backend.bootstrapped, 'backend was bootstrapped');

    reservoir.log(new Record('error', 'timed out', {}));
    reservoir.log(new Record('error', 'timed out', {}));
    reservoir.log(new Record('error', 'timed out', {}));
    reservoir.log(new Record('error', 'timed out', {}));
    reservoir.log(new Record('error', 'timed out', {}));
    reservoir.log(new Record('warn', 'thing failed', {}));

    timer.advance(50);

    assert.ok(reservoir.records.length === 0, 'reservoir was flushed');
    assert.ok(backend.logs.length === 6, 'only 6 logs got through to backend');

    assert.ok(
        backend.logs[0].data.message === 'dropped logs' &&
        backend.logs[0].data.level === 'warn',
        'first log is dropped log warn'
    );

    assert.deepEquals(
        backend.logs[0].meta,
        {dropCount: {error: 1}, flushInterval: 50, size: 5},
        'first log contains correct meta'
    );

    assert.ok(
        backend.logs[1].data.message === 'thing failed',
        'logs[1] is right'
    );
    assert.ok(
        backend.logs[2].data.message === 'timed out',
        'logs[2] is right'
    );
    assert.ok(
        backend.logs[3].data.message === 'timed out',
        'logs[3] is right'
    );
    assert.ok(
        backend.logs[4].data.message === 'timed out',
        'logs[4] is right'
    );
    assert.ok(
        backend.logs[5].data.message === 'timed out',
        'logs[5] is right'
    );

    delete statsd._buffer._elements[3].time;
    delete statsd._buffer._elements[4].time;

    assert.deepEqual(
        statsd._buffer._elements.slice(0, 5),
        [{
            type: 'c',
            name: 'larch.dropped.error',
            value: null,
            delta: 1,
            time: null
        },
        {
            type: 'c',
            name: 'larch.logged.warn',
            value: null,
            delta: 1,
            time: null
        },
        {
            type: 'c',
            name: 'larch.logged.error',
            value: null,
            delta: 4,
            time: null
        },
        {
            type: 'ms',
            name: 'larch.flushTime',
            value: null,
            delta: null
        },
        {
            type: 'ms',
            name: 'larch.sync.flushTime',
            value: null,
            delta: null
        }],
        'correct statsd records'
    );

    delete clusterStatsd._buffer._elements[0].time;
    assert.deepEqual(clusterStatsd._buffer._elements[0], {
        type: 'ms',
        name: 'larch.flushTime',
        value: null,
        delta: null
    });

    reservoir.destroy(noop);

    assert.end();
});

function noop() {}
