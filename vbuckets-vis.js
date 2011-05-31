function BUG(msg) {
  alert(msg);
  debugger;
  throw new Error(msg);
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

Object.extend = function (obj, attrs) {
  for (var k in attrs) {
    if (!attrs.hasOwnProperty(k))
      continue;
    obj[k] = attrs[k];
  }
  return obj;
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
  console.log("pong!");

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

function updateData() {
  var body = document.body;
  InjectionController.slaveGet("/diag/vbuckets?bucket=" + encodeURIComponent(bucketName), function (data) {
    body.innerHTML = '';
    body.removeAttribute("style");
    body.appendChild(buildHTML(["div.buttons",
                                ["button", {"onclick": "less.refresh();"}, "refresh styles"],
                                ["button", {"onclick": "updateData();"}, "refresh data"],
                                ["button", {"onclick": "InjectionController.reloadPage();"}, "reload page"]]));
    renderVBuckets(data);
  })
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

var perNodeStates;
var vbucketsNum;
var copies;
var bucketMap;

function renderVBuckets(data) {
  bucketMap = data.bucketMap;
  perNodeStates = data.perNodeStates;
  vbucketsNum = bucketMap.length;
  copies = bucketMap[0].length;

  var squareSize = bestSquareSize(vbucketsNum);

  var nodes = Object.keys(perNodeStates).sort();

  knownProperties = perNodeStates[nodes[0]]; // this is in fact vb -> stats mapping
  knownProperties = Object.keys(knownProperties[Object.keys(knownProperties)[0]]);

  nodes.forEach(function (node) {
    function vbucketTD(n) {
      if (!stats[n]) {
        // vbucket is missing
        return ["td.missing"];
      }
      var state = stats[n].state;
      var pos = bucketMap[n].indexOf(node);
      var attrs = {
        '@style': {'backgroundColor': colorLinear([0, 255, 0], (copies - pos) / copies)},
        "data-vb": n
      };
      var classes = (function () {
        switch (state) {
        case 'active':
          if (pos !== 0) {
            // active but map differs
            return "active.bad";
          } else {
            return "active";
          }
        case 'replica':
        case 'pending':
          if (pos <= 0) {
            // replica but map differs
            return "replica.bad";
          } else {
            return "replica";
          }
        case 'dead':
          return "dead";
        default:
          return "bad.missing";
        }
      })();
      return ["td." + classes, attrs];
    }
    var stats = perNodeStates[node];
    var tds = [];
    for (var i = 0; i < vbucketsNum; i++) {
      tds.push(vbucketTD(i));
    }
    var trs = [];
    while (tds.length) {
      trs.push(["tr"].concat(tds.slice(0, squareSize)));
      tds = tds.slice(squareSize);
    }
    var nodeElement = buildHTML([nodeTable(node)].concat(trs));
    document.body.appendChild(nodeElement);
  });

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
        Array.prototype.forEach.call(el.querySelectorAll('td[data-property-name]'), function (td) {
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
