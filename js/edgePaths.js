var EdgePaths = function (svgEl, containerEl, nodeGraph) {

    var ltgUtil = new LTGUtil(svgEl);


    this.draw = function() {
        _.each(nodeGraph.nodes, function(node) {
            var edges = nodeGraph.getEdges(node);
            for (var i=0; i < edges.length; i++) {
                drawEdge(node.pageId, edges[i]);
            }
        }, this);
    }


    function createEdge(id) {
        var edge = document.createElementNS(ltgUtil.svgNS, "path");
        edge.setAttribute("id", id);
        //edge.setAttribute("stroke-width", Math.random() * 10);

        containerEl.appendChild(edge);
        return edge;
    }


    function drawEdge(fromId, toId) {
        if (fromId === toId) {
            return;
        } 

        var edgeId = fromId + ':' + toId;
        var edge = document.getElementById(edgeId);

        if (edge === null) {
            edge = createEdge(edgeId);
        }

        var from = ltgUtil.getQuestionRect(fromId);
        var to = ltgUtil.getQuestionRect(toId);

        /*
        Determine the nature of the edge. We get the left / right direction
        below so we don't care about the type of node (error or extra), which 
        should better support the ability to add types.

        In the future, the node nature could be substituted with edge metadata,
        but it may be not be a better approach. If the edge drawing can follow
        a set of rules based only on node positions, we don't have to include
        graph or business logic here.
        
        NOTE: This next bit is currently a flawed approach, because everything 
        outside the main path will be some type of alternate node. We'd need to 
        classify the node as alternate only if it's the first node of an alternate 
        container
        */
        var fromAlt = ltgUtil.isAlternativeQuestion(fromId); 
        var toAlt = ltgUtil.isAlternativeQuestion(toId);


        if ((ltgUtil.isParentCollapsed(to) || ltgUtil.isParentCollapsed(from))) {
            ltgUtil.addClass(edge, "hidden");
        } else {
            ltgUtil.removeClass(edge, "hidden");
        }

        var fromPoint = svgEl.createSVGPoint().matrixTransform(from.getCTM());
        var toPoint = svgEl.createSVGPoint().matrixTransform(to.getCTM());

        if (isNaN(fromPoint.x) || isNaN(fromPoint.y)) {
            throw new Error("Could not resolve CTM for " + fromId); 
        }
        if (isNaN(toPoint.x) || isNaN(toPoint.y)) {
            throw new Error("Could not resolve CTM for " + toId); 
        }

        //experimental
        var fromClientBoundRect = from.getBoundingClientRect();
        var toClientBoundRect = to.getBoundingClientRect();

        var fromBoundingBox = {
            x: fromPoint.x,
            y: fromPoint.y,
            w: fromClientBoundRect.width,//parseInt(from.getAttribute("width")),
            h: fromClientBoundRect.height//parseInt(from.getAttribute("height"))
        }

        var toBoundingBox = {
            x: toPoint.x,
            y: toPoint.y,
            w: toClientBoundRect.width,//parseInt(to.getAttribute("width")),
            h: toClientBoundRect.height//parseInt(to.getAttribute("height"))
        }

        edge.setAttribute("d", 
            getEdgePath(fromBoundingBox, toBoundingBox, fromAlt, toAlt));

        if (fromBoundingBox.y > toBoundingBox.y) {
            ltgUtil.addClass(edge, "shortcut");
        } else {
            ltgUtil.removeClass(edge, "shortcut");
        }
    }


    function getEdgePath(fromBox,toBox,fromAlternative,toAlternative) {
        var fromAlt = fromAlternative;
        var toAlt = toAlternative;

        var rectWidth = fromBox.w;

        // Determine the direction of the edge
        var down    = fromBox.y < toBox.y;
        var left    = fromBox.x - toBox.x > rectWidth;
        var right   = toBox.x - fromBox.x > rectWidth;
        
        // Set the to and from coordinates for the edge

        if (down) {
            // All downward edges should end at the top of the question node
            toBox.x += toBox.w / 2;
            toBox.y += 0;

            if (toAlt && right) {
                // Start from the left most side of the node when going to an alt
                fromBox.x += fromBox.w;
                fromBox.y += fromBox.h / 2;
            } else if (toAlt && left) {
                // Start from the right most side of the node when going to an alt
                fromBox.x += 0;
                fromBox.y += fromBox.h / 2;
            } else {
                // Everything else (alternate or not) starts at the bottom of the node
                fromBox.x += fromBox.w / 2;
                fromBox.y += fromBox.h;
            }
        } else {
            // End at just above the mid left or right edge (to make a distinction from the other direction)  
            toBox.x += left ? toBox.w: 0;
            toBox.y += toBox.h / 2 - 10;

            // Start at the centered bottom of the mod
            fromBox.x += fromBox.w / 2;
            fromBox.y += fromBox.h;
        }

        // Draw the path. The are currently four different path types:
        // straight, and curves with 1,2 & 3 corners.

        // Smoothing variables.
        // NOTE: in the future, these should be generated dynamically
        // based on the length of the curve, which should help keep the
        // corners consistent
        var yBuffer = 10;
        var xBuffer = left ? rectWidth/2 - 5 : -rectWidth /2 + 5;
        var xBuffer2 = xBuffer + xBuffer / 2;
        var yBuffer2 = yBuffer * 3;

        // Move to position
        var pathStart = "M" + fromBox.x + " " + fromBox.y + " "

        if (down && !left && !right) {

            // Straight line. Easy peasy
            return pathStart + "L" + toBox.x + " " + toBox.y;

        } else if (down && !toAlt) {
            // When coming down from an alt node into the top of
            // a node, we add another little curve at the very end
            // to smooth out the connection   

            yBuffer = -yBuffer;

            return pathStart + 
                curveToBy90(
                    fromBox.x,
                    toBox.x + xBuffer,
                    toBox.y + yBuffer,
                    true) + " " +

                curveToBy90(
                    toBox.y + yBuffer,
                    toBox.x,
                    toBox.y,
                    false);

        } else if (down) {

            // Simple curve with one corner from the start to the end
            // (majority of curves)
            return pathStart + 
                curveToBy90(
                        fromBox.y,
                        toBox.x,
                        toBox.y,
                        false);

        } else {

            // When backtracking up the graph we come out the bottom,
            // curve around the 'from' node, go straight up to the 'to'
            // node, then curve back in to its side.
            return pathStart + 
                curveToBy90(
                    fromBox.x,
                    fromBox.x + xBuffer,
                    fromBox.y + yBuffer,
                    true) + " " +

                curveToBy90(
                    fromBox.y + yBuffer,
                    fromBox.x + xBuffer2,
                    fromBox.y - yBuffer,
                    false) + " " +

                "L" + (fromBox.x + xBuffer2) + " " + (toBox.y + yBuffer2) + " " + 

                curveToBy90(
                    fromBox.x + xBuffer2,
                    toBox.x,
                    toBox.y,
                    true);
        }
    }


    /*
        Bezier curve helper. Returns a path curve string

        startWithY === true : Will start the curve in the y direction
        startWithY === false : Will start the curve in the x direction
    */
    function curveToBy90(from, toX, toY, startWithY) {
        if (startWithY) {
            return "C" +
                    from + " " + toY + " " +
                    from + " " + toY + " " +
                    toX + " " + toY;
        } else {
            return "C" +
                    toX + " " + from + " " +
                    toX + " " + from + " " +
                    toX + " " + toY;
        }
    }

};