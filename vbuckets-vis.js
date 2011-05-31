function BUG(msg) {
  alert(msg);
  debugger;
  throw new Error(msg);
}

function $need(value) {
  if (value === undefined) {
    BUG("value is undefined");
  }
  return value;
}

function createSimpleElement(name) {
  var dotpos = name.indexOf(".");
  if (dotpos >= 0) {
    var arr = name.split(".");
    var rv = document.createElement(arr[0] || "div");
    arr.shift();
    rv.setAttribute('class', arr.join(" "));
    return rv;
  }
  return document.createElement(name);
}

var buildSetters = {
  '@style': function (e, k, v) {
    Object.extend(e.style, v);
  },
  '@eval': function (e, k, v) {
    v(e);
  }
};

function buildHTML(data) {
  if (typeof(data) === "string")
    return document.createTextNode(data);
  if (data.nodeType !== undefined)
    return data;
  if (!(data instanceof Array)) {
    BUG("expected text or array");
  }
  if (data[0] instanceof Function) {
    return data[0].apply(null, data.slice(1));
  }
  var e = (data[0] instanceof Array) ? buildHTML(data[0]) : createSimpleElement(data[0]);
  var childIdx = 1;
  while (typeof(attrs = data[childIdx]) === 'object' && !(attrs instanceof Array)) {
    childIdx++;
    for (var k in attrs) {
      if (!attrs.hasOwnProperty(k))
        continue;
      var setter = buildSetters[k];
      if (setter) {
        setter(e, k, attrs[k]);
      } else {
        e.setAttribute(k, attrs[k]);
      }
    }
  }
  while (childIdx < data.length) {
    e.appendChild(buildHTML(data[childIdx++]));
  }
  return e;
}


var bucketName;
function initialize() {
  var body = document.body;
  body.setAttribute("style", "white-space:pre;");
  body.textContent = "ready!";
  bucketName = "default";
  (function () {
    var match = /\?(.*?)(?:$|#)/.exec(window.location.href);
    if (!match)
      return;
    var params = String(match[1]).toQueryParams();
    if (params.bucket)
      bucketName = params.bucket;
  })();
  updateData();
}

InjectionController.onConnected = initialize;
InjectionController.init();

var hasButtons;
var mainContainer;
function updateData() {
  var body = document.body;
  InjectionController.slaveGet("/diag/vbuckets?bucket=" + encodeURIComponent(bucketName), function (data) {
    if (!hasButtons) {
      body.innerHTML = '';
      body.removeAttribute("style");
      body.appendChild(buildHTML(["div.buttons",
                                  ["button", {"onclick": "less.refresh();"}, "refresh styles"],
                                  ["button", {"onclick": "updateData();"}, "refresh data"],
                                  ["button", {"onclick": "reloadPage();"}, "reload page"]]));
      body.appendChild(buildHTML(["div#mainContainer"]));
      mainContainer = $('mainContainer');
      hasButtons = true;
    }
    renderVBuckets(data);
  })
}

function reloadPage() {
  var secret = String((new Date()).valueOf()) + "_" + String(Math.random());
  var c = InjectionController;

  c.slaveApply(armed, slaveBody, secret);

  function slaveBody(armed, secret) {
    function handler(event) {
      if (event.data != secret)
        return;
      window.removeEventListener("message", handler, false);
      setTimeout(function () {
        injectIntoMembase(frameURL, frame);
      }, 100);
    }
    window.addEventListener("message", handler, false)
    armed();
  }

  function armed() {
    window.addEventListener("unload", function () {
      c.slaveFrame.postMessage(secret, c.slaveOrigin);
    }, false);
    document.location.reload();
  }
}

function bestSquareSize(vbucketsNum) {
  var maxAspect = 1.5;
  var width = Math.ceil(Math.sqrt(vbucketsNum));
  var bestRest = vbucketsNum;
  var bestWidth;
  var height;
  // find best width so that 'packing' is tightest but within
  // acceptable aspect
  while (width/(height = Math.ceil(vbucketsNum / width)) <= maxAspect) {
    var rest = vbucketsNum - height * width;
    if (rest < bestRest) {
      bestWidth = width;
      bestRest = rest;
    }
    if (rest == 0)
      break;
    width++;
  }
  return bestWidth;
}


function colorLinear(rgb1, a1/*, rgb2, a2, ...*/) {
  var i = 2;
  var r=rgb1[0]*a1,g=rgb1[1]*a1,b=rgb1[2]*a1;
  while (i < arguments.length) {
    rgb1 = arguments[i++];
    a1 = arguments[i++];
    r += rgb1[0] * a1;
    g += rgb1[1] * a1;
    b += rgb1[2] * a1;
  }
  return "rgb(" + (r >> 0) + "," + (g>>0) + "," + (b>>0)+")";
}

var knownProperties = [];

function nodeTable(name) {
  return function (/*childs...*/) {
    return buildHTML([
      'p.node', {'data-node': name},
      ['em', name],
      ['table.node-table'].concat([].slice.call(arguments, 0)),
      ['table.props-table'].concat((function () {
        var props = knownProperties.slice(0).sort();
        return [["tr", ["th", "property"], ["th", "value"]],
                ["tr", ["td", "number"], ["td", {'data-property-name': 'number'}]]
               ].concat(props.map(function (propertyName) {
                 return ["tr", ["td", propertyName],
                         ["td", {'data-property-name': propertyName}]]
               }));
      })())
    ]);
  }
}

var NodeState = Class.create({
  initialize: function (master, node) {
    this.master = master;
    this.node = node;
    this.createTable();
  },
  setMaster: function (master) {
    this.master = master;
  },
  setStats: function (bucketStats) {
    this.bucketStats = bucketStats;
    this.applyStats();
  },
  nodeTable: function(name) {
    var self = this;
    return function (/*childs...*/) {
      return buildHTML([
        'p.node', {'data-node': name, 'data-state': self},
        ['em', name],
        ['table.node-table'].concat([].slice.call(arguments, 0)),
        ['table.props-table'].concat((function () {
          var props = knownProperties.slice(0).sort();
          return [["tr", ["th", "property"], ["th", "value"]],
                  ["tr", ["td", "number"], ["td", {'data-property-name': 'number'}]]
                 ].concat(props.map(function (propertyName) {
                   return ["tr", ["td", propertyName],
                           ["td", {'data-property-name': propertyName}]]
                 }));
        })())
      ]);
    }
  },
  createTable: function () {
    var self = this;
    var master = self.master
    var squareSize = master.getSquareSize();
    var vbucketsNum = master.getVBucketMap().length;

    self.byId = [];
    self.byId.length = vbucketsNum;

    function vbucketTD(n) {
      var td = new Element("TD");
      td.vbucketId = n;
      self.byId[n] = td;
      return td;
    }

    var tds = [];
    for (var i = 0; i < vbucketsNum; i++) {
      tds.push(vbucketTD(i));
    }
    var trs = [];
    while (tds.length) {
      trs.push(["tr"].concat(tds.slice(0, squareSize)));
      tds = tds.slice(squareSize);
    }
    var nodeElement = buildHTML([self.nodeTable(node)].concat(trs));
    this.nodeElement = nodeElement;
  },
  applyStats: function () {
    var stats = this.bucketStats;
    var map = this.master.getVBucketMap();
    var node = this.node;
    var byId = this.byId;
    byId.each(function (td, vbucketId) {
      var chain = map[vbucketId];
      var nodePos = chain.indexOf(node);
      var mapState = (nodePos < 0) ? 'missing' : (nodePos == 0) ? 'active' : 'replica';
      var futureState = mapState; // TODO: grab forward map
      var actualState = stats[vbucketId].state;
      var classList = $A(td.classList).reject(function (className) {return className.startsWith("vb-")});
      classList.push("vb-map-" + mapState);
      classList.push("vb-future-" + futureState);
      classList.push("vb-actual-" + actualState);
      if (nodePos >= 0) {
        classList.push("vb-pos-" + nodePos);
      }
      td.className = classList.join(' ');
    });
  }
});

var BucketState = Class.create({
  initialize: function (data, cachedNodeStates) {
    cachedNodeStates = cachedNodeStates || {};
    this.bucketMap = $need(data.bucketMap);
    this.name = $need(data.name);
    this.perNodeStates = $need(data.perNodeStates);
    this.nodeStates = {};
    for (var node in this.perNodeStates) {
      if (!this.perNodeStates.hasOwnProperty(node))
        continue;
      var value;
      if ((value = cachedNodeStates[node])) {
        this.nodeStates[node] = value;
        value.setMaster(this);
      }
      value = this.nodeStates[node] = new NodeState(this, node);
      value.setStats(this.perNodeStates[node]);
    }
  },
  getVBucketMap: function () {
    return this.bucketMap;
  },
  computeBestSquareSize: function(vbucketsNum) {
    var maxAspect = 1.5;
    var width = Math.ceil(Math.sqrt(vbucketsNum));
    var bestRest = vbucketsNum;
    var bestWidth;
    var height;
    // find best width so that 'packing' is tightest but within
    // acceptable aspect
    while (width/(height = Math.ceil(vbucketsNum / width)) <= maxAspect) {
      var rest = vbucketsNum - height * width;
      if (rest < bestRest) {
        bestWidth = width;
        bestRest = rest;
      }
      if (rest == 0)
        break;
      width++;
    }
    return bestWidth;
  },
  getSquareSize: function () {
    if (this.squareSize !== undefined) {
      return this.squareSize;
    }
    this.squareSize = this.computeBestSquareSize(this.bucketMap.length);
    return this.squareSize;
  }
});

var setCopiesStyle = (function () {
  return setCopiesStyle;

  var copiesStylesheet;
  var prevCopies;

  function setCopiesStyle(copies) {
    if (prevCopies === copies) {
      return;
    }
    if (!copiesStylesheet) {
      copiesStylesheet.remove();
    }
    copiesStylesheet = new Element("script");
    var sheet = copiesStylesheet.sheet = document.implementation.createCSSStyleSheet("", "screen");
    for (var i = 0; i <= copies; i++) {
      var idx = sheet.cssRules.length;
      sheet.insertRule(".vb-pos-" + i + " {}", idx);
      var rule = sheet.cssRules[idx];
      rule.style.backgroundColor = colorLinear([0, 255, 0], (copies - i) / copies);
    }
    document.body.insert({top: copiesStylesheet});
    prevCopies = copies;
  }

})();

var prevBucketState;
var perNodeStates;
function renderVBuckets(data) {
  knownProperties = data.perNodeStates[nodes[0]]; // this is in fact vb -> stats mapping
  knownProperties = Object.keys(knownProperties[Object.keys(knownProperties)[0]]);

  setCopiesStyle(data.bucketMap[0].length);

  var prevNodeStates = (prevBucketState && prevBucketState.nodeStates) || {};
  var bucketState = new BucketState(data, prevNodeStates);
  var newNodeStates = bucketState.nodeStates;
  mainContainer.empty();
  Object.keys(newNodeStates).sort().each(function (node) {
    mainContainer.appendChild(newNodeStates[node].nodeElement);
  });

  prevBucketState = bucketState;
}

(function () {
  function filteringVB(body) {
    return function (e) {
      if (!('vb' in e.target.dataset))
        return;
      body(e, e.target.dataset.vb);
    }
  }

  var delayedOnMouseBody;

  function onMouse(e, vb) {
    var method = (e.type == 'mouseover') ? 'add' : 'remove';

    function body() {
      var nodeList = document.querySelectorAll('.node-table td[data-vb="'+vb+'"]');
      Array.prototype.forEach.call(nodeList, function (el) {
        el.classList[method]('vb-current');
      });

      nodeList = Array.prototype.slice.call(document.querySelectorAll('.node'), 0);
      nodeList.forEach(function (el) {
        var nodeName = el.dataset.node;
        if (!nodeName) BUG();
        var stats = perNodeStates[nodeName][vb] || {};
        stats.number = vb;
        $A(el.select('td[data-property-name]')).each(function (td) {
          td.textContent = (method === 'add') ? stats[td.dataset.propertyName] : '';
        });
      });
    }

    if (method == 'add') {
      if (delayedOnMouseBody) {
        delayedOnMouseBody();
        delayedOnMouseBody = null;
      }
      body();
    } else {
      if (!delayedOnMouseBody)
        delayedOnMouseBody = body;
    }
  }
  onMouse = filteringVB(onMouse);
  document.body.addEventListener('mouseover', onMouse, false);
  document.body.addEventListener('mouseout', onMouse, false);
})();
