import lst.lowStretchTree as lsTree
import lst.lstUtils as utils

def runLST(f):
	fn = f.name
	fn = fn.split(".")
	ext = fn[len(fn) - 1]
	
	if ext == "json":
		graph = utils.read_json(f)

	elif ext == "txt":
		graph = utils.read_txt(f)

	else:
		return False

	tree = lsTree.low_stretch_tree(graph)
	
	return utils.get_tree_json(graph, tree)
