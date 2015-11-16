import networkx as nx

from math import log
from math import exp
from math import sqrt
from math import ceil
from math import floor

import lstUtils as utils

def low_stretch_tree(graph, x=None, y=None):
	# set up tree
	lst = nx.Graph()
	lst.add_nodes_from(graph.nodes())

	# assign parameter values
	n = graph.number_of_nodes()

	if x == None:
		x = exp(sqrt(log(n, 2) * log(log(n, 2), 2)))

	if y == None:
		rho = 1 if log(x) == 0 else ceil(3 * log(n) / log(x))
		mu = 9 * rho * log(n)
		y = x * mu

	# divide edges into weight classes
	WI = {}

	# get edges and weights
	all_edges = graph.edges(data=True)
	all_weights = nx.get_edge_attributes(graph, "weight")

	# find max i value needed to cover all weights
	max_weight = max(all_weights.itervalues())
	max_i = get_index_for_weight(max_weight, y, WI)

	# initialize E with empty lists
	E = { i: [] for i in xrange(0, max_i + 1) }

	# assign edges to E
	for (u,v,data) in all_edges:
		w = data["weight"]
		i = get_index_for_weight(w, y, WI)
		E[i].append((u,v))

	#### perform iterative rounds ####
	j = 1

	# convert to multigraph
	G = nx.MultiGraph(graph)

	Efull = [ e for i in E.values() for e in i ]
	while len(Efull) > 0:
		#pdb.set_trace()

		# get partition of vertices
		copy = nx.MultiGraph()#(G)
		copy.add_nodes_from(G.nodes())
		copy.add_edges_from(G.edges(data=True))

		partition = cluster(copy, E=E, x=x, y=y, j=j, WI=WI)

		# construct multigraph where each cluster is a vertex
		# and each intercluster edge is represented
		new_G = nx.MultiGraph()
		# add vertices
		for c in partition:
			c_i = partition.index(c)

			# vertices from our original graph which have been
			# "collapsed" into this cluster
			ov = []
			for v in c:
				if 'orig_verts' in G.node[v]:
					ov.extend(G.node[v]['orig_verts'])
				else:
					ov.append(v)

			new_G.add_node(c_i, orig_verts=ov)

		# find a spanning tree for each cluster
		for c in partition:
			c_i = partition.index(c)

			# get induced subgraph for cluster
			sub = G.subgraph(c)

			# get shortest-paths spanning tree
			spanner = utils.shortest_paths_spanner(sub)

			# add the edges from the spanning tree into low-stretch tree
			for (u,v,data) in spanner.edges(data=True):
				if 'orig_edge' in data:
					(orig_u, orig_v) = data['orig_edge']
				else:
					(orig_u, orig_v) = (u,v)

				lst.add_edge(orig_u, orig_v, attr_dict=data)

			# get all edges from this cluster
			c_edges = G.edges(c, data=True)

			# find and add intercluster edges
			for i in xrange(c_i + 1, len(partition)):
				c2 = partition[i]

				inter_edges = [ (u,v,data) for (u,v,data) in c_edges if u in c2 or v in c2 ]

				for (u,v,data) in inter_edges:
					if 'orig_edge' in data:
						oe = data['orig_edge']
					else:
						oe = (u,v)
					new_G.add_edge(c_i, i, weight=data['weight'], orig_edge=oe)

			# find and remove intracluster edges from E
			cset = set(c)
			intra_edges = set() #[]
			for (u,v,data) in c_edges:
				if u in cset and v in cset:
					if 'orig_edge' in data:
						intra_edges.add(data['orig_edge']) #intra_edges.append(data['orig_edge'])
					else:
						intra_edges.add((u,v)) # intra_edges.append((u,v))

			for i in E:
				E[i] = [ (u,v) for (u,v) in E[i] if (u,v) not in intra_edges
												and (v,u) not in intra_edges ]

		# update E
		Efull = [ e for i in E.values() for e in i ]

		G = new_G
		j += 1

	return lst

def cluster(G, E, x, y, j, WI):
	partition = []

	while len(G.nodes()) > 0:
		vertices = set(G.nodes()) # G.nodes()

		currDegs = G.degree(G.nodes())
		root = max(currDegs.iterkeys(), key=(lambda key: currDegs[key]))
		vertices.remove(root)

		V = { 0: [ root ] }
		El = { i: {} for i in E.keys() } # E_i[l]
		expanding = True
		l = 1
		while expanding and len(vertices) > 0:

			V[l] = set() # []
			for i in El.keys():
				El[i][l] = set() # []

			# find next layer of nodes
			for v in V[l-1]:
				for u in nx.all_neighbors(G, v):
					if u in vertices:
						V[l].add(u)
						vertices.remove(u)

			# find edges from V[l] to V[l] U v[l-1]
			for v in V[l]:
				for u in nx.all_neighbors(G, v):
					if u in V[l] or u in V[l-1]:
						# add edge to E_i[l]
						i = get_index_for_weight(G[u][v][0]['weight'], y, WI)
						El[i][l].add((u,v))

			# check expansion
			expanding = False
			for i in El.keys():
				if i > j: # ensure i <= j
					continue
				# index here by l (l+1 in paper)
				new_len = len(El[i][l])
				# find the length of E_i[1] U ... U E_i[l-1]
				curr_len = len([ e for ell in xrange(1,l) for e in El[i][ell] ])

				# if for any i, new_len > (1/x) * curr_len,
				# then we're still expanding
				if new_len > (1.0 / x) * curr_len:
					expanding = True
					break
			if expanding:
				l += 1

		# create cluster
		cluster_nodes = tuple([ e for ell in xrange(l) for e in V[ell] ])

		G.remove_nodes_from(cluster_nodes)
		partition.append(cluster_nodes)

	return partition

def get_index_for_weight(w, y, WI):
	if w in WI:
		return WI[w]

	myLog = log(w, y) # logW / logY
	i = int(floor(myLog)) + 1
	WI[w] = i
	return i

def round_to_power(x, eps):
	return (1.0 + eps) ** floor(log(x, (1.0 + eps)))
