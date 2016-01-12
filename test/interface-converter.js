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
var createLarch = require('../interface-converter');
var Larch = require('../larch');
var FakeBackend = require('./lib/fake-backend');

test('uses a logtron backend when passed a logtron', function t1(a) {
    var fakeLogtron = {
        writeEntry: function () {}
    };

    var logger = createLarch({logger: fakeLogtron});

    a.ok(logger.backends.length === 1, 'created larch has 1 backend');
    a.ok(
        logger.backends[0].constructor.name === 'LogtronBackend',
        'larch backend is a logtron backend'
    );

    a.end();
});

test('just returns it when passed a larch', function t1(a) {
    var backend = new FakeBackend();
    var larch = new Larch({backends: [backend]});

    var logger = createLarch({logger: larch});

    a.ok(logger === larch, 'larch is returned');

    a.end();
});
