// Generated by CoffeeScript 1.7.1
var Scanner, Table, utils;

utils = require('./utils');

Table = require('./table');


/*
Scanner operations
==================

Scanner are the most efficient way to retrieve multiple 
rows and columns from HBase.

Grab an instance of "Scanner"
-----------------------------

```javascript
var myScanner = hbase({}).getScanner('my_table');
var myScanner = hbase({}).getScanner('my_table','my_id');
```

Or

```javascript
var myScanner = hbase({}).getTable('my_table').getScanner();
var myScanner = hbase({}).getTable('my_table').getScanner('my_id');
```

Or

```javascript
var client = new hbase.Client({});
var myScanner = new hbase.Scanner(client, 'my_table');
var myScanner = new hbase.Scanner(client, 'my_table', 'my_id');
```

Using filter
------------

Filter are defined during the scanner creation. If you
are familiar with HBase filters, it will be real easy to
use them. Note, you should not worry about encoding the
values, the library will do it for you. When you create
a new scanner, just associate the `filter` property with  
your filter object. All filters are supported.   

Many examples are available in the tests but here's one
wich returns all rows starting by "my_key_" and whose
value is "here you are".   

```javascript
myScanner.create({
  filter: {
  "op":"MUST_PASS_ALL","type":"FilterList","filters":[{
      "op":"EQUAL",
      "type":"RowFilter",
      "comparator":{"value":"my_key_.+","type":"RegexStringComparator"}
    },{
      "op":"EQUAL",
      "type":"ValueFilter",
      "comparator":{"value":"here you are","type":"BinaryComparator"}
    }
  ]}
}, function(error, cells){
  assert.ifError(error);
});
```
 */

Scanner = function(client, table, id) {
  this.client = client;
  this.table = typeof table === 'string' ? table : table.name;
  this.id = id || null;
  return this.callback = null;
};


/*
`Scanner.create([params], callback)`
------------------------------------

Create a new scanner.

```javascript
myScanner.create([params], callback);
```

Params is an object for which all properties are optional. The
following properties are available:

-   startRow: First row returned by the scanner   
-   endRow: Row stopping the scanner, not returned by the scanner   
-   columns: Filter the scanner by columns (a string or an array of columns)   
-   batch: Number of cells returned on each iteration   
-   startTime   
-   endTime   
-   filter: see below for more informations
 */

Scanner.prototype.create = function(params, callback) {
  var args, encode, key, self;
  self = this;
  args = Array.prototype.slice.call(arguments);
  key = "/" + this.table + "/scanner";
  params = typeof args[0] === 'object' ? args.shift() : {};
  callback = args.shift();
  if (params.startRow) {
    params.startRow = utils.base64.encode(params.startRow);
  }
  if (params.endRow) {
    params.endRow = utils.base64.encode(params.endRow);
  }
  if (params.column) {
    if (typeof params.column === 'string') {
      params.column = utils.base64.encode(params.column);
    } else {
      params.column.forEach(function(column, i) {
        return params.column[i] = utils.base64.encode(column);
      });
    }
  }
  if (params.filter) {
    encode = function(obj) {
      var k, _results;
      _results = [];
      for (k in obj) {
        if (k === 'value' && (!obj['type'] || obj['type'] !== 'RegexStringComparator' && obj['type'] !== 'PageFilter')) {
          _results.push(obj[k] = utils.base64.encode(obj[k]));
        } else {
          if (typeof obj[k] === 'object') {
            _results.push(encode(obj[k]));
          } else {
            _results.push(void 0);
          }
        }
      }
      return _results;
    };
    encode(params.filter);
    params.filter = JSON.stringify(params.filter);
  }
  return this.client.connection.put(key, params, function(error, data, response) {
    var id;
    if (error) {
      return callback.apply(self, [error, null]);
    }
    id = /scanner\/(\w+)$/.exec(response.headers.location)[1];
    self.id = id;
    return callback.apply(self, [null, id]);
  });
};


/*
`Scanner.get(callback)`
-----------------------

Scanning records.

```javascript
myScanner.get(callback);
```

Retrieve the next cells from HBase. The callback is required
and receive two arguments, an error object if any and a array
of cells or null if the scanner is exhausted.

The number of cells depends on the `batch` option. It is your
responsibity to call `get` as long as more cells are expected.

```javascript
var callback = function(error, cells){
  assert.ifError(error);
  if(cells){
    // do something
    console.log(cells);
    // call the next iteration
    myScanner.get(callback)
  }else{
    // no more cells to iterate
  }
};
myScanner.get(callback);
```

Note, this is not very pretty. Alternatively, you could make
use of the scanner function `continue` inside your callback
to trigger a new iteration. Here's how:
  
```javascript
myScanner.get(function(error, cells){
  assert.ifError(error);
  if(cells){
    // do something
    console.log(cells);
    // call the next iteration
    this.continue()
  }else{
    // no more cells to iterate
    // delete the scanner
    this.delete();
  }
});
```
 */

Scanner.prototype.get = function(callback) {
  var key, self;
  self = this;
  key = "/" + this.table + "/scanner/" + this.id;
  if (callback) {
    this.callback = callback;
  } else {
    callback = this.callback;
  }
  return this.client.connection.get(key, function(error, data, response) {
    var cells;
    if (response && response.statusCode === 204) {
      return callback.apply(self, [null, null]);
    }
    if (error) {
      return callback.apply(self, [error, null]);
    }
    cells = [];
    data.Row.forEach(function(row) {
      key = utils.base64.decode(row.key);
      return row.Cell.forEach(function(cell) {
        data = {};
        data.key = key;
        data.column = utils.base64.decode(cell.column);
        data.timestamp = cell.timestamp;
        data.$ = utils.base64.decode(cell.$);
        return cells.push(data);
      });
    });
    return callback.apply(self, [null, cells]);
  });
};


/*
`Scanner.continue()`
--------------------
 */

Scanner.prototype["continue"] = function() {
  return this.get();
};


/*
`Scanner.delete(callback)`
--------------------------

Delete a scanner.

```javascript
myScanner.delete(callback);
```

Callback is optionnal and receive two arguments, an 
error object if any and a boolean indicating whether 
the scanner was removed or not.
 */

Scanner.prototype["delete"] = function(callback) {
  var key, self;
  self = this;
  key = "/" + this.table + "/scanner/" + this.id;
  return this.client.connection["delete"](key, function(error, success) {
    if (!callback) {
      if (error) {
        throw error;
      } else {
        return;
      }
    }
    return callback.apply(self, [error, error ? null : true]);
  });
};

module.exports = Scanner;
