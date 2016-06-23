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

var test = require('tape');
var Timer = require('time-mock');

var ReservoirBackend = require('../reservoir-backend');
var Record = require('../record');

var FakeBackend = require('./lib/fake-backend');

test('ReservoirBackend willSample is accurate', function t1(assert) {
    var time = 0;
    function fakeRangeRand(lo, hi) {
        time += 1;
        if (time === 1) {
            return 6;
        } else {
            return 0;
        }
    }

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

    var samplingDecisions = [];

    samplingDecisions[0] = reservoir.willSample('error');
    reservoir.slog(new Record('error', 'timed out', {}));
    samplingDecisions[1] = reservoir.willSample('error');
    reservoir.slog(new Record('error', 'timed out', {}));
    samplingDecisions[2] = reservoir.willSample('error');
    reservoir.slog(new Record('error', 'timed out', {}));
    samplingDecisions[3] = reservoir.willSample('error');
    reservoir.slog(new Record('error', 'timed out', {}));
    samplingDecisions[4] = reservoir.willSample('error');
    reservoir.slog(new Record('error', 'timed out', {}));
    samplingDecisions[5] = reservoir.willSample('error');
    reservoir.slog(new Record('warn', 'thing failed', {}));

    assert.deepEqual(samplingDecisions, [true, true, true, true, true, false]);

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
        {dropCount: {warn: 1}, flushInterval: 50, size: 5},
        'first log contains correct meta'
    );

    assert.ok(
        backend.logs[1].data.message === 'timed out',
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

test('ReservoirBackend slog throws without sampling decision', function t2(assert) {
    var backend = FakeBackend();
    var timer = Timer(0);

    var reservoir = ReservoirBackend({
        backend: backend,
        size: 5,
        timers: timer
    });

    assert.throws(function callSlog() {
        reservoir.slog('warn', 'message', {});
    }, /Reservoir backend `slog` method must be called after/);

    assert.end();
});

function noop() {}
