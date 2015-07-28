import networkx as nx

import json
import random

from networkx.readwrite import json_graph

def read_txt(f):
	graph = nx.parse_adjlist(f)
	return process_graph(graph)

def read_json(f):
	data = json.load(f)
	graph = json_graph.node_link_graph(data)
	return process_graph(graph)

def process_graph(graph):
	for (n, data) in graph.nodes(data=True):
		data["orig_id"] = str(n)

	# get largest connected component
	sc = sorted(nx.connected_components(graph), key=len, reverse=True)
	lcc = graph.subgraph(sc[0])
	graph = lcc

	graph = nx.convert_node_labels_to_integers(graph)

	if hasattr(graph, 'pos'):
		pos = graph.pos
	else:
		x = nx.get_node_attributes(graph, 'x')
		y = nx.get_node_attributes(graph, 'y')
		if len(x) != 0 and len(y) != 0:
			pos = { n: [x[n], y[n]] for n in graph.nodes() }
		else:
			pos = nx.spring_layout(graph)

	#graph = nx.Graph(graph) # in case of di/multi graph
	graph.pos = pos

	if len(nx.get_edge_attributes(graph, 'weight')) == 0:
		for (u,v) in graph.edges():
			weight = 1
			graph[u][v]['weight'] = weight

	return graph

def get_tree_json(graph, tree):
	(parents, depth) = compute_search_tree(tree)

	for (n,data) in graph.nodes(data=True):
		data['parent'] = parents[n]
		data['children'] = get_children_in_tree(tree, n, parents[n])

		data['x'] = str(graph.pos[n][0])
		data['y'] = str(graph.pos[n][1])

	# OUTPUT GRAPH TO JSON
	node_link = json_graph.node_link_data(graph)
	json_data = json.dumps(node_link)

	return json_data

def compute_search_tree(T):
	parents = {}
	depth = {}

	# Choose arbitrary vertex u to be the root node
	u = random.choice(T.nodes())
	depth[u] = 0
	parents[u] = None

	# Build tree rooted at u
	curr_nodes = [ u ]
	while len(curr_nodes) > 0:
		# visit children and update parents
		next_nodes = []
		for node in curr_nodes:
			for child in get_children_in_tree(T, node, parents[node]):
				parents[child] = node
				depth[child] = depth[node] + 1
				next_nodes.append(child)

		curr_nodes = list(next_nodes)

	return (parents, depth)

def get_children_in_tree(T, v, parent):
	# get the children of node v (whose parent is parent) in tree T
	children = T.neighbors(v)
	if parent != None:
		children.remove(parent)
	# sort children so the order is always consistent
	return sorted(children)

def compute_tree_stretch(T, G):
	return compute_tree_stretch_for_edges(G.edges(data=True), T, G)

def compute_tree_stretch_for_edges(edges, T, G, weighted=True):
	#### Steps One & Two
	(parents, depth) = ebUtils.compute_search_tree(T)

	#### Step Three: Use the BBST to quickly compute u-v path length

	# Iterate over all edges in G
	stretch_sum = 0
	for (u,v,data) in edges:
		# Find the LCA of u and v in the BBST
		if weighted:
			g_dist = data['weight']
			t_dist = ebUtils.find_tree_distance(T, parents, depth, u, v)
		else:
			g_dist = 1.0
			t_dist = ebUtils.find_unweighted_tree_distance(T, parents, depth, u, v)

		stretch_sum += 1.0 * t_dist / g_dist

	stretch = 1.0 * stretch_sum / len(edges)
	return stretch

def shortest_paths_spanner(graph):
	G = nx.Graph(graph) # ensure no multigraph

	degs = nx.degree(G)
	root = max(degs, key=lambda x: degs[x])
	paths = nx.shortest_path(G, source=root, weight="weight")
	spanner = nx.Graph()
	for n in paths:
		path = paths[n]
		edges = zip(path[:-1], path[1:])
		edges = [ (u, v, G[u][v]) for (u,v) in edges ]
		spanner.add_edges_from(edges)

	return spanner