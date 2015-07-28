function clone(obj) {
    if (null == obj || "object" != typeof obj) return obj;
    var copy = obj.constructor();
    for (var attr in obj) {
        if (obj.hasOwnProperty(attr)) copy[attr] = clone(obj[attr]);
    }
    return copy;
}

function getTooltip(d) {
    if (d.hasOwnProperty("tooltip")) {
        return d.tooltip;
    } else if (d.hasOwnProperty("name")) {
        return d.name;
    } else if (d.hasOwnProperty("orig_id")) {
        return d.orig_id;
    } else { 
        return d.id;
    }
}

// scale node positions to fit within width, height
function scaleCoordinates(nodes, width, height, padding) {
    padding = typeof padding !== "undefined" ? padding : 25;

    // find min and max x and y
    x = [], y = [];
    nodes.forEach(function(d) {
        x.push(d.x);
        y.push(d.y);
    });

    min_x = Math.min.apply(null, x);
    max_x = Math.max.apply(null, x);
    min_y = Math.min.apply(null, y);
    max_y = Math.max.apply(null, y);

    // create scale
    var new_scale_x = d3.scale.linear()
        .domain([min_x, max_x])
        .range([padding, width - padding]);
    var new_scale_y = d3.scale.linear()
        .domain([min_y, max_y])
        .range([padding, height - padding]);

    // scale all node coordinates
    nodes.forEach(function(d) {
        d.x = new_scale_x(d.x);
        d.y = new_scale_y(d.y);
    });
}