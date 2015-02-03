var LTG = function () {

    var svgEl = document.getElementsByTagName('svg')[0];
    var $graph = $('#graph');

    var questionVerticalGap = 15;
    var containerVerticalPadding = 15;
    var containerHorizontalPadding = 15;
    var qRectWidth = 120;
    var qRectHeight = 30;

    var containerCollapsedHeight = 15;
    var containerCollapsedWidth = qRectWidth + containerHorizontalPadding * 2;

    var _deafultOffsetX;

    var _this = this;

    var nodeGraph;
    var edgePaths;
    var edgeContainer;
    var rootContainer;

    var ltgUtil = new LTGUtil(svgEl);

    var groupTemplate = '<div class="container <%= classes %>"></div>';
    var screenTemplate = '<div id="<%= id %>" class="screenGroup <%= classes %>"><div class="screen"><h3><%= name %></h3><br/><%= id %></div></div>';

    this.setJson = function (jsonString) {
        var jsonData = $.parseJSON(jsonString);
        if (jsonData) {
            this.setData(jsonData);
        } else {
            throw new Error('could not parse json string');
        }
    }

    this.setData = function (data) {
        nodeGraph = new NodeGraph(data);

        // first set up the dom & graph structure
        buildSVG(nodeGraph, svgEl);

        //edgePaths = new EdgePaths(svgEl, edgeContainer, nodeGraph);

        // then perform measurement and visual layout on dom
 //       this.draw();
    };


    this.draw = function() {

        //layoutElement is recursive. This will layout and draw all children of root (aka everything)
        var totalSize = layoutElement(rootContainer);

        //includes offset
        //positionEl(root, -totalSize.x, -totalSize.y);

        //edgges are applied on top of everything else. They should be 'dumb'
        // such that they don't have any knowledge of the graph
        //edgePaths.draw();

        //reposition svg stage

        //hack: if the offset is less than the biggest offset, adjust it manually
        // to keep in the same position
        //svgEl.setAttribute('style', 'left:' + (totalSize.x - _deafultOffsetX) + 'px');
        svgEl.setAttribute('width', totalSize.w);
        svgEl.setAttribute('height', totalSize.h);
        //svgEl.setAttribute('viewBox', totalSize.x + ' 0 ' + (totalSize.w + ' ' + totalSize.h);
        svgEl.setAttribute('viewBox', '0 0 ' + totalSize.w + ' ' + totalSize.h);
    };


    this.getGraph = function () {
        return nodeGraph;
    };


    //----------------------- LAYOUT ------------------------// 


    function layoutElement(el) {
        if (ltgUtil.isRoot(el)) {
            return layoutRootElement(el);
        } else if (ltgUtil.isMainPath(el)) {
            return layoutMainPath(el);
        } else if (ltgUtil.isQuestion(el)) {
            return layoutQuestion(el);
        } else if (ltgUtil.isContainer(el)) {
            return layoutContainer(el);
        } else {
            return {
                w: 0,
                h: 0
            };
        }
    }


    function layoutQuestion(question) {
        //horizontally stacked

        //start with the default
        var bounds = {
            x: 0,
            y: 0,
            w: qRectWidth,
            h: qRectHeight
        };

        var children,
            numChildren,
            child,
            childBounds,
            childPos,
            nextErrorX,
            nextExtraX,
            isErrorChild,
            minX,
            isCollapsed;

        minX = 0;
        nextErrorX = bounds.w + containerHorizontalPadding; // errors are to the right
        nextExtraX = -containerHorizontalPadding; // extra is to the left
        children = ltgUtil.getChildGroups(question);
        numChildren = children.length;
        for (var i=0; i < numChildren; i++) {
            child = children[i];
            childBounds = layoutElement(child);

            isErrorChild = ltgUtil.isError(child);
            isCollapsed = ltgUtil.hasClass(child, 'collapsed');

            childPos = {
                x: (isErrorChild ? nextErrorX : nextExtraX - childBounds.w),
                y: qRectHeight / 2 + 10
            };

            ltgUtil.positionEl(child, childPos.x, childPos.y);
            
            if (isErrorChild) { 
                nextErrorX = childPos.x + childBounds.w + containerHorizontalPadding;
            } else {
                nextExtraX = childPos.x + containerHorizontalPadding;
            }

            bounds.h = Math.max(childBounds.h + childPos.y, bounds.h);
            bounds.w = bounds.w + childBounds.w + containerHorizontalPadding;

            minX = Math.min(childPos.x, minX);
        }

        bounds.x = minX;

        //for debugging via browser
        question.setAttribute('width', bounds.w);
        question.setAttribute('height', bounds.h);
        question.setAttribute('x', bounds.x);
        question.setAttribute('y', bounds.y);

        return bounds;
    }


    function layoutContainer(container) {
        //vertically stacked
        var bounds = {
            x: 0,
            y: 0,
            w: 0,
            h: 0
        };

        var children,
            numChildren,
            child,
            childBounds,
            childPos,
            nextY,
            minX,
            maxX;
        
        var isCollapsed = ltgUtil.hasClass(container, 'collapsed');

        if (isCollapsed) {
            var collapsedWidth = (ltgUtil.isError(container) || ltgUtil.isExtraInfo(container)) ? 15 : containerCollapsedWidth;

            bounds.h = containerCollapsedHeight;
            bounds.w = collapsedWidth;
        } else {
            maxX = minX = 0;
            nextY = containerVerticalPadding;
            children = ltgUtil.getChildGroups(container);
            numChildren = children.length;
            for (var i=0; i < numChildren; i++) {
                child = children[i];
                childBounds = layoutElement(child);

                childPos = {
                    x: containerHorizontalPadding,
                    y: nextY
                };

                ltgUtil.positionEl(child, childPos.x, childPos.y);
                nextY = childPos.y + childBounds.h + questionVerticalGap;

                bounds.h = Math.max(childBounds.h + childPos.y, bounds.h);
                
                maxX = Math.max(childBounds.w + childPos.x, maxX);
                minX = Math.min(minX, childBounds.x);
            }

            //padding
            bounds.h += containerVerticalPadding;
            bounds.w += maxX - minX + containerHorizontalPadding;
            bounds.x = minX;
        }

        bounds.w += containerHorizontalPadding;

        //for debugging via browser
        container.setAttribute('width', bounds.w);
        container.setAttribute('height', bounds.h);
        container.setAttribute('x', bounds.x);
        container.setAttribute('y', bounds.y);

        setContainerPadding(container, bounds.x, bounds.y, bounds.w, bounds.h);

        return bounds;
    }

    function layoutRootElement(rootEl) {
        var prevPathEl;
        var prevPathClientRect;
        var paths = rootEl.children;
        var pathCount = paths.length;
        var totalSize;
        var gap = 20;

        for (var i=0; i < pathCount; i++) {
            pathEl = rootEl.children[i];
            size = layoutElement(pathEl);
            if (!totalSize) {
                totalSize = size;
                ltgUtil.positionEl(pathEl, 0, 0);
            } else {
                ltgUtil.positionEl(pathEl, 0, totalSize.y + totalSize.h + gap);
                totalSize.x = Math.min(size.x, totalSize.x);
                totalSize.y += size.y;
                totalSize.w = Math.max(size.w, totalSize.w);
                totalSize.h += size.h + gap;
            }
        }

        //add negative offset        
        ltgUtil.addPadding(rootEl, -totalSize.x, 0);
        //totalSize.w += totalSize.x;

        //add padding to left & right
        ltgUtil.addPadding(rootEl, 20, 0);
        totalSize.w += 40;

        return totalSize;
    }

    function layoutMainPath(pathEl) {
        return layoutContainer(pathEl);
    }


    //----------------------- CREATE ------------------------// 


    function buildSVG() {
        clearSVG();

        //clear root nodes
        if (!rootContainer) {
            //build the first root node

            rootContainer = $(_.template(groupTemplate, { 
                classes: 'root nonCollapsable'
            }));

            $graph.append( rootContainer );

            //rootContainer = ltgUtil.newSVGGroup('root container nonCollapsable');
            //createContainer(rootContainer);
            //svgEl.appendChild(rootContainer);
        }

        createMainPaths(rootContainer);

        /*
        if (!edgeContainer) {
            edgeContainer = ltgUtil.newSVGGroup('edgeContainer');
            svgEl.insertBefore(edgeContainer,rootContainer);
        }
        */
    }


    function clearSVG() {
        clearEl(rootContainer);
        //clearEl(edgeContainer);
    }


    function clearEl(el) {
        if (el && el.html) {
            el.html('');
            return;
        }

        if (el && el.children) {
            while (el.children.length > 0) {
                el.removeChild(el.children[0]);
            }
        }
    }


    function createQuestion(parentGroup) {
        var parentId = parentGroup.getAttribute('id');

        var mainRect = document.createElementNS(ltgUtil.svgNS, 'rect');
        mainRect.setAttribute('width', qRectWidth);
        mainRect.setAttribute('height', qRectHeight);
        //mainRect.setAttribute('rx', 5);
        //mainRect.setAttribute('ry', 5);
        ltgUtil.addClass(mainRect,'questionRect');
        parentGroup.appendChild(mainRect);

        var questionText = document.createElementNS(ltgUtil.svgNS, 'text');
        questionText.setAttribute('x', qRectWidth / 2);
        questionText.setAttribute('y', qRectHeight / 2 + 4);
        questionText.setAttribute('text-anchor', 'middle');
        
        var page = nodeGraph.getPageById(parentId);
        if (page && page.name) {
            questionText.textContent = page.name;
        } else {
            questionText.textContent = parentId;
        }

        parentGroup.appendChild(questionText);

        if (nodeGraph.isStart(page)) {
            var startBar = document.createElementNS(ltgUtil.svgNS, 'rect');
            startBar.setAttribute('width', qRectWidth);
            startBar.setAttribute('height', 5);
            startBar.setAttribute('y', -5);
            ltgUtil.addClass(startBar,'endBar');
            parentGroup.appendChild(startBar);
        }

        if (nodeGraph.isEnd(page)) {
            var endBar = document.createElementNS(ltgUtil.svgNS, 'rect');
            endBar.setAttribute('width', qRectWidth);
            endBar.setAttribute('height', 5);
            endBar.setAttribute('y', qRectHeight);
            ltgUtil.addClass(endBar,'endBar');
            parentGroup.appendChild(endBar);
        }
    }


    function createContainer(parentGroup) {
        if (ltgUtil.hasClass(parentGroup, 'nonCollapsable')) {
            return;
        }

        var paddingRect = document.createElementNS(ltgUtil.svgNS, 'rect');
        ltgUtil.addClass(paddingRect, 'padding');
        parentGroup.insertBefore(paddingRect,parentGroup.firstChild);

        var collapseBtn = document.createElementNS(ltgUtil.svgNS, 'use');
        collapseBtn.setAttributeNS('http://www.w3.org/1999/xlink', 'href', '#collapseButton');
        collapseBtn.setAttribute('height', 16);
        collapseBtn.setAttribute('width', 16);
        collapseBtn.setAttribute('x', -8);
        collapseBtn.setAttribute('y', -8);
        ltgUtil.addClass(collapseBtn, 'collapse button');

        var expandBtn = document.createElementNS(ltgUtil.svgNS, 'use');
        expandBtn.setAttributeNS('http://www.w3.org/1999/xlink', 'href', '#expandButton');
        expandBtn.setAttribute('height', 16);
        expandBtn.setAttribute('width', 16);
        expandBtn.setAttribute('x', -8);
        expandBtn.setAttribute('y', -8  );
        ltgUtil.addClass(expandBtn, 'expand button');
        /*
        var collapseBtn = document.createElementNS(ltgUtil.svgNS, 'circle');
        collapseBtn.setAttribute('r', 7);
        collapseBtn.setAttribute('cx', 0);
        collapseBtn.setAttribute('cy', 0);
        ltgUtil.addClass(collapseBtn, 'collapse button');
        */
        collapseBtn.addEventListener('click', function () { toggleCollapseContainer(parentGroup); });
        expandBtn.addEventListener('click', function () { toggleCollapseContainer(parentGroup); });
        
        parentGroup.appendChild(collapseBtn);
        parentGroup.appendChild(expandBtn);
    }



    function toggleCollapseContainer (container) {
        var collapse = !ltgUtil.hasClass(container, 'collapsed');

        if (collapse) {
            ltgUtil.addClass(container, 'collapsed');
        } else {
            ltgUtil.removeClass(container, 'collapsed');
        }
        
        _this.draw();
    }


    function createQuestionGroup(container, node) {
        //skip if there already exists a group for this node
        var existingQuestionGroup = $('#' + node.pageId);
        if (existingQuestionGroup && existingQuestionGroup.length > 0) {
            return;
        }

        var newQuestion = $(_.template(screenTemplate, {
            classes: node.page.isStart ? 'start' : node.page.isEnd ? 'end' : '', 
            id: node.pageId,
            name: node.page.name
        }));
        container.append(newQuestion);

        /*
        if (node.hasGroups()) {
            createAlternateContainer(newQuestion, node)
        }
        */
    }

    function createAlternateContainer(question, node) {
        var errors = _.where(node.groups, {groupType: GroupTypes.MISCONCEPTION});
        var corrects = _.where(node.groups, {groupType: GroupTypes.EXTRA});

        var errorContainer;
        var correctContainer;

        _.each(node.groups, function (nodeGroup) {
            var newContainer = $(_.template(groupTemplate, { classes: ''}));
            if (nodeGroup.groupType === GroupTypes.MISCONCEPTION) {

                if (!errorContainer) {
                    errorContainer = $('<div>').addClass('errorContainer');
                    question.append(errorContainer);
                }
                errorContainer.append(newContainer);
            } else if (nodeGroup.groupType === GroupTypes.EXTRA) {
                appendType = 'extra';

                if (!correctContainer) {
                    correctContainer = $('<div>').addClass('correctContainer');
                    question.append(correctContainer);
                }
                correctContainer.append(newContainer);
            }

            var nodes = nodeGroup.nodePath;
            _.each(nodes, function (subNode) {
                if (subNode.pageId !== node.pageId) {
                    createQuestionGroup(newContainer, subNode);
                }
            });
            
        }, this);
    }


    function createQuestionBranch(parentGroup, nodeBranch) {
        var newBranch = $('<div class="branch"></div>');
        parentGroup.append(newBranch);

        _.each(nodeBranch.nodePaths, function (nodePath) {
            createNodePath(parentGroup, nodePath);
        });
    }

    function createNodePath(parentGroup, nodePath) {
        _.each(nodePath, function (node) {
            if (node.page) {
                createQuestionGroup(parentGroup, node);
            } else {
                createQuestionBranch(parentGroup, node);
            }
        });
    }


    function createMainPaths(rootEl) {
        var startPage = nodeGraph.getStartingPage();
        var startPageId = nodeGraph.getPageId(startPage);

        createMainPath(rootEl, startPageId);

        _.each(nodeGraph.nodes, function (node) {
            var nodeEl = $('#' + node.pageId);
            if (!nodeEl) {
                createMainPath(rootEl, node.pageId);
            }
        }, this);
    }


    function createMainPath(rootEl, startPageId) {
        var mainPathGroup = $(_.template(groupTemplate, {
            classes: 'main'
        }));
        
        rootEl.append(mainPathGroup);


        /*
        var nodeGroup = nodeGraph.createNodeGroupByPageId(startPageId);
        _.each(nodeGroup.nodePath, function (node) {
            createQuestionGroup(mainPathGroup, node);
        }, this);
        */

        var nodePath = nodeGraph.createNodePathByPageId(startPageId);
        createNodePath(mainPathGroup, nodePath);
    }


    function setContainerPadding (container, x, y, w, h) {
        var child;
        var children = container.childNodes;
        for (var i=0; i < children.length; i++) {
            child = children[i];
            if (child.nodeName === 'rect' && ltgUtil.hasClass(child, 'padding')) {
                child.setAttribute('x', x);
                child.setAttribute('y', y);
                child.setAttribute('width', w - 2);
                child.setAttribute('height', h - 2);
            }
        }
    }
}