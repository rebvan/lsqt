// creates {'source': s, 'target': t} edge list from nodes by id
function constructLinks(nodes_id, raw_links, type) {
    var links = [];
    raw_links.forEach(function(d) {
        var s = nodes_id[d.source];
        var t = nodes_id[d.target];

        var sParent = s.parent;
        var tParent = t.parent;

        // want the ids not the nodes
        if (sParent != null && typeof sParent !== 'number') {
            sParent = sParent.id;
        }
        if (tParent != null && typeof tParent !== 'number') {
            tParent = tParent.id;
        }

        if (type == "tree") {
            if (sParent == t.id || tParent == s.id) {
                links.push({
                    'source': s,
                    'target': t
                });
            }
        } else if (type == "graph") {
            if (sParent != t.id && tParent != s.id) {
                links.push({
                    'source': s,
                    'target': t
                });
            }
        }
    });

    return links;
}

// returns points in control polygon for spline for each edge in the graph
function bundleEdges(nodes_id, graph_edges) {
    var bundles = [];

    graph_edges.forEach(function(d) {
        var pathNodes = findPath(d.source, d.target, nodes_id, true);

        if (pathNodes.length > 2) {
            bundles.push(pathNodes);
        }
    });

    return bundles;
}

// returns points in control polygon for spline for each edge in the graph
function bundleEdgesCoords(nodes_id, graph_edges) {
    var bundles = [];

    graph_edges.forEach(function(d) {
        var pathNodes = findPath(d.source, d.target, nodes_id);

        if (pathNodes.length > 2) {
            var p = [];
            pathNodes.forEach(function(d) {
                p.push([d.x, d.y]);
            });
            bundles.push(p);
        }
    });

    return bundles;
}

// returns a list of node ids in the path from u to v
function findPath(u, v, nodes_id, include_lca) {
    include_lca = (include_lca == undefined ? false : include_lca);

    var path = [],
        marked = {};
        //depths = {};

    // want the ids not the nodes
    if (typeof u !== 'number') {
        u = u.id;
    }
    if (typeof v !== 'number') {
        v = v.id;
    }

    var path_length = 0;

    marked[u] = false;
    marked[v] = false;
    var curr_u = u, curr_v = v;
    while ((!marked[curr_u] && !marked[curr_v]) && curr_u != curr_v) {
        marked[curr_u] = true;
        marked[curr_v] = true;

        if (nodes_id[curr_u].parent != undefined) {
            curr_u = nodes_id[curr_u].parent;
        } else {
            marked[curr_u] = false;
        }

        if (nodes_id[curr_v].parent != undefined) {
            curr_v = nodes_id[curr_v].parent;
        } else {
            marked[curr_v] = false;
        }

        path_length += 2;
    }
    var lca = marked[curr_u] ? curr_u : curr_v;

    // append nodes to path from u to lca
    var curr_node = u;
    while (curr_node != lca) {
        path.push(nodes_id[curr_node]);
        curr_node = nodes_id[curr_node].parent;
    }

    // append LCA only if there are just two nodes in the path so far
    if (path.length <= 2 || include_lca) {
        path.push(nodes_id[lca]);
    }

    // append nodes to path from lca to v
    var reverse_path = [];
    var curr_node = v;
    while (curr_node != lca) {
        reverse_path.push(nodes_id[curr_node]);
        curr_node = nodes_id[curr_node].parent;
    }

    reverse_path.reverse();

    return path.concat(reverse_path);
}

// computes size of each bundle
function bundleSizes(nodes_id, link_dict, edge_dict) {
    var bundles = {};

    edge_dict.forEach(function(d) {
        pathNodes = findPath(d.source, d.target, nodes_id, true);

        var prev_node = null;
        for (var i in pathNodes) {
          node = pathNodes[i];
          if (prev_node == null) {
              prev_node = node;
              continue;
          }

          if (bundles[prev_node.id] == undefined) {
              bundles[prev_node.id] = {};
          }

          if (bundles[prev_node.id][node.id] == undefined) {
              bundles[prev_node.id][node.id] = [];
          }

          bundles[prev_node.id][node.id].push(pathNodes);

          prev_node = node;
        }
    });

    link_dict.forEach(function(d) {
        var myBundles = [];
        if (bundles[d.source.id] != undefined) {
            if (bundles[d.source.id][d.target.id] != undefined) {
                myBundles = myBundles.concat(bundles[d.source.id][d.target.id]);
            }
        }

        if (bundles[d.target.id] != undefined) {
            if (bundles[d.target.id][d.source.id] != undefined) {
                myBundles = myBundles.concat(bundles[d.target.id][d.source.id]);
            }
        }
        d["count"] = myBundles.length;
        d["bundles"] = myBundles;
    });
}