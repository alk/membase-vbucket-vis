InjectionController.onConnected = reloadData;

InjectionController.init();

function reloadData() {
  $('status-box').textContent = 'Ready!'
  InjectionController.slaveApply(onResult, function (reply) {
    // unfortunately due to bug in /diag/eval implementation we have to call eval from inside eval :(, thus extra escaping
    var code = 'S = "{json, [rpc:call(N, erlang, apply, [fun () -> {struct, [{nodeName, N}, {masterNode, (try rpc:call(N, mb_master, master_node, []) catch _:_ -> unknown end)}, {publicIP, list_to_binary(os:cmd(\\"curl -s http://169.254.169.254/latest/meta-data/public-ipv4\\"))}]} end, []]) || N <- [node() | nodes()]]}.",' +
      '{value, V, _} = eshell:eval(S,[]), V.';
    $.post("/diag/eval", code, function (data, status) {
      reply(data, status);
    }, "json");
  });

  function onResult(data, status) {
    console.log("data:", data);
    console.log("status:", status);

    var container = $('address-list');
    container.empty();
    if (status !== 'success') {
      alert('crap: ' + status);
      return;
    }

    data.each(function (row) {
      row.privateIP = (row.nodeName || '').replace(/.*@/,'');
    });

    var template = $('address-list-template').textContent;
    container.innerHTML = Mustache.to_html(template, {pairs: data});
  }
}
