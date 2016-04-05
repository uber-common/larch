# Larch

It's a logging framework. Currently it's main use is to reservoir sample logs
and forward them to [Logtron](http://github.com/uber/logtron). In the long
term, it may replace Logtron. It can be used like this:

```javascript
var Logtron = require('logtron');

var Larch = require('larch');
var LogtronBackend = require('larch/logtron-backend');
var ReservoirBackend = require('larch/reservoir-backend');

var clients = ...
var logtronLogger = Logtron({...});

var logger = Larch({
    backends: [ReservoirBackend({
        backend: LogtronBackend(logtronLogger),
        statsd: clients.statsd,
        clusterStatsd: clients.clusterStatsd,
        size: 100,
        flushInterval: 50
    })]
});
logger.bootstrap();

logger.warn('warn string', {meta: 'object'});
```

## Docs

## `Larch({ backends: Array })`

`Larch` is a constructor that takes a list of backends.

Generally you want to use the `ReservoirBackend`

### `larch.bootstrap()`

Remember to call `bootstrap()` on larch to start the reservoir.

## `ReservoirBackend(opts)`

`ReservoirBackend` takes a set of options including:

 - `backend`; what to write to if we sample the log call
 - `statsd`; where to emit stats.
 - `clusterStatsd`; where to emit cluster-wide latency stats.
 - `size`; The amount of records that can be logged per interval
 - `flushInterval`; How often we should flush the reservoir

The reservoir will log (1000 / `flushInterval`) * `size` records per second.

This means by default it will log `2000` records per second.

## Using `willSample($level, $msg)`

The top level Larch object, as well as each backend, has a method `willSample`.
This method returns `true` if any backend after this backend in the object tree
is interested in taking a log with level `$level`. This can be used to avoid
allocating space for large meta objects, like so:

```javascript
if (larch.willSample('warn', 'thing failed!')) {
    larch.swarn('thing failed!', {
        count: this.count,
        length: this.length,
        largeArrayOfThings: this.bigArray,
        hugeAmountOfUsefulDebuggingInfo: this.stuff
    });
}
```

This way, we can do less work when we have a lot of logs because we don't have
to allocate the large meta object.

Regular log methods (`.log`, `.error`, etc) will first compute a sampling
decision. Log methods prefixed with an `s` (`.slog`, `.serror`, etc) will use
a previously computed sampling decision. Calling an `s` method without first
calling `.willSample($level, $msg)` will throw.

# Contributors

* [Russ Frank](http://github.com/rf)
* [Mark Yen](http://github.com/markyen)

# License

MIT.
