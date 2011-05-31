// javascript:(function(d,url,injectURL,fIn,f,s,n){n=Date.parse(Date());f=fIn?fIn:window.open(url+'?v='+n,url,'');s=d.createElement('SCRIPT');s.setAttribute('src',injectURL+'?'+n);s.onload=function(){injectIntoMembase(url,f);};d.body.appendChild(s);})(document,'http://lh:4567/vbuckets-vis.html','http://lh:4567/inject.js',window.reinjectThis);
// javascript:(function(d,url,injectURL,fIn,f,s,n){n=Date.parse(Date());f=fIn?fIn:window.open(url+'?v='+n,url,'');s=d.createElement('SCRIPT');s.setAttribute('src',injectURL+'?'+n);s.onload=function(){injectIntoMembase(url,f);};d.body.appendChild(s);})(document,'http://lh:4567/ec2-public-ips.html','http://lh:4567/inject.js',window.reinjectThis);

// javascript:(function(d,url,injectURL,fIn,f,s,n){n=Date.parse(Date());f=fIn?fIn:window.open(url+'?v='+n,url,'');s=d.createElement('SCRIPT');s.setAttribute('src',injectURL+'?'+n);s.onload=function(){injectIntoMembase(url,f);};d.body.appendChild(s);})(document,'http://alk.github.com/membase-vbucket-vis/vbuckets-vis.html','http://alk.github.com/membase-vbucket-vis/inject.js',window.reinjectThis);

// javascript:(function(d,url,injectURL,fIn,f,s,n){n=Date.parse(Date());f=fIn?fIn:window.open(url+'?v='+n,url,'');s=d.createElement('SCRIPT');s.setAttribute('src',injectURL+'?'+n);s.onload=function(){injectIntoMembase(url,f);};d.body.appendChild(s);})(document,'http://alk.github.com/membase-vbucket-vis/ec2-public-ips.html','http://alk.github.com/membase-vbucket-vis/inject.js',window.reinjectThis);

function injectIntoMembase(frameURL, frame) {
  var initialTStamp = (new Date()).valueOf();

  window.addEventListener("message", recvMessage, false);

  var initialInterval = setInterval(function () {
    console.log("posting initial message");
    frame.postMessage("initial", frameURL);

    var now = (new Date()).valueOf();
    if (initialTStamp + 60000 < now) {
      console.log("No reply for 60 secs. Aborting activity");
      service.cancel();
    }
  }, 500);

  var service = {
    "eval": function () {
      frame.postMessage(eval(arguments[0]), frameURL);
    },
    "cancel": function () {
      if (initialInterval != null) {
        clearInterval(initialInterval);
        initialInterval = null;
      }
      window.removeEventListener("message", recvMessage, false);
      injectIntoMembase.activeServices = injectIntoMembase.activeServices.filter(function (e) {return e !== service});
    },
    "eval2": function () {
      (function (f, args) {
        var id = args[1];
        function postMsg() {
          var arr = Array.prototype.slice.call(arguments, 0);
          frame.postMessage({args: arr, id: id}, frameURL);
        }
        f.apply(null, [postMsg].concat(Array.prototype.slice.call(args, 2)));
      })(eval("("+arguments[0]+")"), arguments);
    },
    "xhr": function (openArgs, sendArg, headers, responseHeaders) {
      var xhr = new XMLHttpRequest();
      xhr.onreadystatechange = function () {
        if (xhr.readyState != 4)
          return;
        var reply = [xhr.status,
                     xhr.text,
                     (responseHeaders || []).map(function (h) {
                       return xhr.getResponseHeader(h);
                     })];
        frame.postMessage(reply, frameURL);
      }
      xhr.open.apply(xhr, openArgs);
      for (var k in (headers || {})) {
        xhr.setRequestHeader(k, headers[k]);
      }
      xhr.send();
    }
  };

  function recvMessage(event) {
    if (event.source != frame)
      return;

    if (initialInterval !== undefined) {
      clearInterval(initialInterval);
      initialInterval = undefined;
    }

    var data = event.data;
    if (!(data instanceof Array)) {
      return;
    }
    console.log("obeying command from master: ", data);
    service[data[0]].apply(service, data.slice(1));
  }

  injectIntoMembase.activeServices.push(service);

  return service;
};
injectIntoMembase.activeServices = [];
