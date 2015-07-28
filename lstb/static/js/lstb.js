//// SETUP ////

// vis div
var visDiv      = document.getElementById('vis');
var width       = visDiv.clientWidth,
    height      = (width / 6) * 5;
visDiv.style.height = height;

// tooltips
var tip         = d3.tip()
                    .attr('class', 'd3-tip')
                    .offset([-10, 0])
                    .html(function(d) { return getTooltip(d); });

// vis svg
var visSVG      = setUpSVG(width, height);

// svg groups
var treeLinkGroup, bundleGroup, linkGroup, hoverGroup, nodeGroup;

// graph data structures
var edges, tree_edges;
var nodes_id;

// encodings
var showBundles, showEdges, hover, showLabels;
var showTop = "bundles";

// drawing options
var nodeRadius = 3;
var min_bundle_width = 2;
var max_bundle_width = 20;

function setUpSVG(width, height) {
    // dimensions
    var radius = width / 2,
        innerRadius = radius - 120;

    var svg = d3.select("#vis").append("svg")
        .attr('id', 'svg')
        .attr('width', width)
        .attr('height', height)
        .attr('style',
                'border-width:1px; border-style:solid; border-color:#aaaaaa;')
        .call(tip);

    return svg.append('svg:g');
}

//// DATA HANDLING ////

$('#fileForm').on('submit', function(event){
    event.preventDefault();
    upload_file();
});

function upload_file() {
    var fUpload = document.getElementById('graphFile');

    if (fUpload.files.length == 0)
        return;

    var myFile = fUpload.files[0];

    var formData = new FormData();
    formData.append("graphFile", myFile, myFile.name);

    $.ajaxSetup({
        beforeSend: function(xhr, settings) {
            if (!csrfSafeMethod(settings.type) && !this.crossDomain) {
                xhr.setRequestHeader("X-CSRFToken", getCookie('csrftoken'));
            }
        }
    });
    $.ajax({
        url : "/",
        type : "POST",
        data : formData,
        processData: false,
        contentType: false,

        success : function(json) {
            var graphData = processData(json, width, height);
            draw(graphData);
        },

        error : function(xhr, errmsg, err) {
            console.log(xhr.status + ": " + xhr.responseText);
        }
    });
}

function csrfSafeMethod(method) {
    // these HTTP methods do not require CSRF protection
    return (/^(GET|HEAD|OPTIONS|TRACE)$/.test(method));
}

// using jQuery
function getCookie(name) {
    var cookieValue = null;
    if (document.cookie && document.cookie != '') {
        var cookies = document.cookie.split(';');
        for (var i = 0; i < cookies.length; i++) {
            var cookie = jQuery.trim(cookies[i]);
            // Does this cookie string begin with the name we want?
            if (cookie.substring(0, name.length + 1) == (name + '=')) {
                cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
                break;
            }
        }
    }
    return cookieValue;
}

function processData(data, width, height) {
    var raw_nodes = clone(data.nodes);
    var raw_links = clone(data.links);

    var padding = 50;
    scaleCoordinates(raw_nodes, width, height, padding);

    // sort nodes by id
    var nodes_id = {};
    raw_nodes.forEach(function(d) {
        nodes_id[d.id] = d;
    });

    return { nodes: raw_nodes, nodes_id: nodes_id, links: raw_links };
}

//// DATA PROCESSING AND DRAWING ////

function draw(data) {
    visSVG.selectAll("*").remove();

    // get visual encoding checkbox options
    var encoding = {};
    var boxes = document.getElementById("encoding-boxes").children;
    for (var i = 0; i < boxes.length; i++) {
        encoding[boxes[i].value] = boxes[i].checked;

        boxes[i].addEventListener('change', boxChangeHandler);
    }
    encoding.showTop = document.getElementById("top-select").value;

    drawLSTB(data, encoding);
}

function drawLSTB(data, encoding) {
    showTop = encoding.showTop;

    if (showTop == "edges") {
        bundleGroup = visSVG.append("g").attr("id", "bundleGroup");
        treeLinkGroup = visSVG.append("g").attr("id", "treeLinkGroup");
        linkGroup = visSVG.append("g").attr("id", "linkGroup");
    } else {
        treeLinkGroup = visSVG.append("g").attr("id", "treeLinkGroup");
        linkGroup = visSVG.append("g").attr("id", "linkGroup");
        bundleGroup = visSVG.append("g").attr("id", "bundleGroup");
    }
    hoverGroup = visSVG.append("g");
    nodeGroup = visSVG.append("g");

    showBundles = encoding.bundles;
    showEdges = encoding.edges;
    hover = encoding.hover;
    showLabels = encoding.labels;

    nodes_id = data.nodes_id;
    edges = constructLinks(data.nodes_id, data.links, "graph");
    tree_edges = constructLinks(data.nodes_id, data.links, "tree");

    forceLayout(data);

}

function addEncoding() {
    changeBundleShow();

    if (showEdges) {
        changeEdgeShow();
    }

    hoverChange();
}

function forceLayout(data) {
    var line = d3.svg.line()
        .interpolate("bundle")
        .tension(.99)
        .x(function(d) { return d.x; })
        .y(function(d) { return d.y; });

    var force = d3.layout.force()
        .size([width, height])
        .nodes(data.nodes)
        .links(tree_edges)
        .gravity(0.1)
        .charge(-20)
        .linkDistance(5)
        .start();

    var drag = force.drag()
        .on("dragstart", dragstart);

    // draw tree edges
    var tree_links = treeLinkGroup.selectAll(".tree-link")
        .data(tree_edges)
        .enter().append("line")
        .attr("class", "default-tree-link");

    // draw nodes
    var node = nodeGroup.selectAll(".node")
        .data(data.nodes)
        .enter().append("g");
    node.append("text")
        .attr("id", "label")
        .text(function(d) { return getTooltip(d); })
        .attr("class", "label")
        .style('display', 'none');
    node.append("circle")
        .attr("class", "node")
        .attr("r", nodeRadius)
        .on("mouseover", tip.show)
        .on("mouseout", tip.hide)
        .on("dblclick", dblclick)
        .call(drag);

    force.on("start", function() {
        linkGroup.selectAll("*").remove();
        bundleGroup.selectAll("*").remove();
        treeLinkGroup.selectAll("*").style("display", "inline");
    });

    force.on("tick", function() {
        tree_links.attr("x1", function(d) { return d.source.x; })
            .attr("y1", function(d) { return d.source.y; })
            .attr("x2", function(d) { return d.target.x; })
            .attr("y2", function(d) { return d.target.y; });

            node.attr("transform", function(d) { 
                d.x = Math.max(nodeRadius, Math.min(width - nodeRadius, d.x));
                d.y = Math.max(nodeRadius, Math.min(height - nodeRadius, d.y));
                return 'translate(' + [d.x, d.y] + ')'; 
                });

        // check if we're close enough to stop
        if (force.alpha() < 0.01) {
            force.stop();
        }
    });

    // wait until force layout is done
    force.on("end", function() {
        // draw remainder edges
        var bundles = bundleEdges(data.nodes_id, edges);
        var links = linkGroup.selectAll(".link")
            .data(bundles)
            .enter().append("path")
            .attr("d", line)
            .attr("class", "default-link")
            .style('display', 'none');

        // get bundles
        bundleSizes(nodes_id, tree_edges, edges);
        
        var min_b = 0;
        var max_b = 0;
        tree_edges.forEach(function(d) {
            if (d.count > max_b)
                max_b = d.count;
        });

        var sc = d3.scale.linear()
                    .domain([min_b,max_b])
                    .range([min_bundle_width,max_bundle_width])
                    .clamp(true);
                    
        // draw bundles
        bundleGroup.selectAll(".bundle")
            .data(tree_edges)
            .enter().append("path")
            .attr("class", "default-bundle")
            .attr("d", function(d) { return drawBundle(d, sc(d.count)); });

        addEncoding();
    });
}

function boxChangeHandler(evt) {
    var name = evt.srcElement.value;
    var checked = evt.srcElement.checked;

    if (name == "bundles") {
        showBundles = checked;
        changeBundleShow();
    } else if (name == "edges") {
        showEdges = checked;
        changeEdgeShow();
    } else if (name == "hover") {
        hover = checked;
    } else if (name == "labels") {
        showLabels = checked;
        changeLabelShow();
    }

    hoverChange();
}

function hoverChange() {
    if (showBundles && hover) {
        bundleGroup.selectAll("*").on('mouseenter', mouseOverBundle)
            .on('mouseleave', mouseOutBundle);
    } else {
        bundleGroup.selectAll("*").on('mouseenter', "")
            .on('mouseleave', "");
    }

    if (showEdges && hover) {
        linkGroup.selectAll("*").on('mouseover', mouseOverEdge)
            .on('mouseout', mouseOutEdge);
    } else {
        linkGroup.selectAll("*").on('mouseover', "")
            .on('mouseout', "");
    }
}

function changeBundleShow() {
    if (showBundles) {
        if (!showEdges) {
            treeLinkGroup.selectAll("*").style("display", "none");
        }
        bundleGroup.selectAll("*").style("display", "inline");
    } else {
        treeLinkGroup.selectAll("*").style("display", "inline");
        bundleGroup.selectAll("*").style("display", "none");
    }
}

function changeEdgeShow() {
    if (showEdges) {
        treeLinkGroup.selectAll("*").style("display", "inline");
        linkGroup.selectAll("*").style('display', "inline");
    } else {
        linkGroup.selectAll("*").style('display', "none");
        if (showBundles) {
            treeLinkGroup.selectAll("*").style("display", "none");
        }
    }
}

function changeLabelShow() {
    if (showLabels) {
        d3.selectAll("#label").style('display', 'inline');
    } else {
        d3.selectAll("#label").style('display', 'none');
    }
}

function dblclick(d) {
    d3.select(this).classed("fixed", d.fixed = false);
}

function dragstart(d) {
    d3.select(this).classed("fixed", d.fixed = true);
}

function mouseOverEdge(d) {
    linkGroup.selectAll("*").classed('fade-link', true);
    bundleGroup.selectAll("*").classed('fade-bundle', true);
    treeLinkGroup.selectAll("*").classed('fade-link', true);

    d3.select(this).classed('fade-link', false)
                    .classed('hover-link', true);
}

function mouseOutEdge(d) {
    linkGroup.selectAll("*").classed('fade-link', false);
    bundleGroup.selectAll("*").classed('fade-bundle', false);
    treeLinkGroup.selectAll("*").classed('fade-link', false);

    d3.select(this).classed('hover-link', false);
}

function mouseOverBundle(d) {
    // hide all edges
    if (showEdges) {
        linkGroup.selectAll("*").classed('fade-link', true);
    }
    treeLinkGroup.selectAll("*").classed('fade-link', true);
    bundleGroup.selectAll("*").classed('fade-bundle', true);

    var line = d3.svg.line()
        .interpolate("bundle")
        .tension(.99)
        .x(function(d) { return d.x; })
        .y(function(d) { return d.y; });

    // draw bundle edges
    hoverGroup.selectAll(".link")
        .data(d.bundles)
        .enter().append("path")
        .attr("d", line)
        .attr("class", "hover-link");
}

function mouseOutBundle(d) {
    // remove bundle edges
    hoverGroup.selectAll("*").remove();

    // show links again
    if (showEdges) {
        linkGroup.selectAll("*").classed('fade-link', false);
    }
    treeLinkGroup.selectAll("*").classed('fade-link', false);
    bundleGroup.selectAll("*").classed('fade-bundle', false);
}

function drawBundle(d, sw) {
    if (d.count == 0) {
        return;
    }

    var d3LineLinear = d3.svg.line().interpolate("linear");

    var angle = 15;

    var sX = +d.source.x;
    var sY = +d.source.y;
    var tX = +d.target.x;
    var tY = +d.target.y;

    var diff = Math.sqrt( Math.pow((tX-sX),2) + Math.pow((tY-sY),2) );
    var l = (sw / 2.0) / Math.tan(angle);
    var eps = Math.abs(2 * l / diff);

    var msX = sX + (tX - sX) * eps;
    var msY = sY + (tY - sY) * eps;

    var mtX = tX - (tX - sX) * eps;
    var mtY = tY - (tY - sY) * eps;

    var ps1X = msX + (1.0/Math.sqrt(3)) * (-(sY-msY));
    var ps1Y = msY + (1.0/Math.sqrt(3)) * (sX-msX);

    var ps2X = msX - (1.0/Math.sqrt(3)) * (-(sY-msY));
    var ps2Y = msY - (1.0/Math.sqrt(3)) * (sX-msX);

    var pt1X = mtX + (1.0/Math.sqrt(3)) * (-(tY-mtY));
    var pt1Y = mtY + (1.0/Math.sqrt(3)) * (tX-mtX);

    var pt2X = mtX - (1.0/Math.sqrt(3)) * (-(tY-mtY));
    var pt2Y = mtY - (1.0/Math.sqrt(3)) * (tX-mtX);

    var points = [];
    points.push([sX,sY]);
    points.push([ps1X,ps1Y]);
    points.push([pt2X,pt2Y]);
    points.push([tX,tY]);
    points.push([pt1X,pt1Y]);
    points.push([ps2X,ps2Y]);

    return d3LineLinear(points) + "Z";
}
