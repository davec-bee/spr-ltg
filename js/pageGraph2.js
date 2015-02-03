
var GroupTypes = {
    MAIN : 'main',
    DEFAULT_CORRECT : 'defaultCorrect',
    MISCONCEPTION : 'altWrong',
    EXTRA : 'altCorrect',
    BRANCH : 'branch'
};


// A single page, with any number of child node groups
var Node = function (id, page, errorPaths) {
    this.pageId = id;
    this.page = page;
    this.errorPaths = errorPaths || [];
    this.depth;

    this.addErrorPath = function (group) {
        this.errorPaths.push(group);
    }

    this.hasErrors = function () {
        return this.errorPaths && this.errorPaths.length > 0;
    }

    this.hasDepth = function () {
        return false;

        return this.depth != undefined;
    }

    this.setDepth = function (depth) {
        if (!this.hasDepth()) {
            this.depth = depth;
        }
    }

    this.getChildren = function () {
        var children = [this.pageId];

        _.each (errorPaths, function (nodePath) {
            _.each (nodePath, function (node) {
                children.concat(node.getChildren());
            });
        });

        return children;
    }
};


// A single path of nodes of a particular group type
var NodeBranch = function (nodePaths, branchEnd) {
    this.nodePaths = nodePaths || [];
    this.branchEnd = branchEnd;

    this.addNodePath = function (node) {
        this.nodePaths.push(node);
    }

    this.hasNodePaths = function () {
        return this.nodePaths && this.nodePaths.length > 0;
    }

    this.getChildren = function () {
        var children = [this.pageId];

        _.each (nodePaths, function (nodePath) {
            _.each (nodePath, function (node) {
                children.concat(node.getChildren());
            });
        });

        return children;
    }
}


// A collection of nodes 
var NodeGraph = function (pages) {
    _this = this;

    this.nodes = [];
    _.each(pages, function (page, id) {
        this.nodes.push(new Node(id, page));
    }, this);

    var loggingEnabled = false;


    this.createNodeGroupByPageId = function (pageId) {
        var subPath = getSubPathFromPageId(pageId);
        var nodeGroup = this.createNodeGroup(subPath, GroupTypes.MAIN);
        return nodeGroup;
    };



    /*************** ATTEMPT 1 *****************/


    /*
        Build a particular node group based on a starting path.

        This will traverse through the given page path to create a base group, then 
        recursively build more groups as needed for each node   
    */
    this.createNodeGroup = function (path, groupType, depth) {
        var node,
            subPath,
            subGroup;

        var nodeGroup = new NodeGroup(groupType);

        if (depth === undefined) {
            depth = 0;
        }

        //Add all the nodes to the nodeGroup and assign them 
        // depths. If the node already has a depth stop adding 
        // nodes to the group (the path is linear so if you 
        // don't want to add a node, you can't just skip it)
        var pathLength = path.length
        for (var i=0; i < pathLength; i++) {
            node = this.getNodeByPageId(path[i]);

            //A better implementation would allow for comparing
            // depths, however if you do find that the new depth
            // is lower than the existing depth, you'd have to 
            // remove the node from its existing group and clean up
            // that groups path
            if (node.hasDepth() && i > 0) {
                break;
            } else {
                node.setDepth(depth);
            }

            nodeGroup.addNode(node);
        }

        //Traverse the new nodePath and build more nodeGroups for each
        // node as needed
        _.each(nodeGroup.nodePath, function (node) {
            //pathLog(node.pageId, groupType, depth);

            var extras = [];

            //Find any extra pathways and build the corresponding group type
            /*
            _.each(getExtra(node.page), function (id) {
                var subNode = this.getNodeByPageId(id);
                if (subNode.hasDepth()) {
                    return;
                } else {
                    subNode.setDepth(depth + 1);
                    extras.push(id);
                }
            }, this);
            */

            var misconceptions = [];

            //Find any misconceptions and build the corresponding group type
            _.each(getMisconceptions(node.page), function (id) {
                var subNode = this.getNodeByPageId(id);
                if (subNode.hasDepth()) {
                    return;
                } else {
                    subNode.setDepth(depth + 1);
                    misconceptions.push(id);
                }
            }, this);

            _.each(misconceptions, function (id) {
                subPath = getSubPathFromPageId(id, path);
                subGroup = this.createNodeGroup(subPath, GroupTypes.MISCONCEPTION, depth + 1);
                if (subGroup && subGroup.hasNodes()) {
                    node.addGroup(subGroup);
                }
            }, this);

            _.each(extras, function (id) {
                subPath = getSubPathFromPageId(id, path);
                subGroup = this.createNodeGroup(subPath, GroupTypes.EXTRA, depth + 1);
                if (subGroup && subGroup.hasNodes()) {
                    node.addGroup(subGroup);
                }
            }, this);

        }, this);

        return nodeGroup;
    }


    /*
        Build a pathway array through the graph from a starting page until one
        of the following 'end' scenarios is reached;
        a) end of the lesson
        b) path connects back to its parent
        c) path loops back in on itself (including the starting page)
    */
    function getSubPathFromPageId (pageId, parentPath) {
        var subPath = [];
        var ids;
        var page = _this.getPageById(pageId);
        subPath.push(pageId);

        while (!_this.isEnd(page)) {
            //Find the next pageId in the path. Note, at the moment this
            // is just picking up the first correct state, which should
            // always be the default correct state.
            
            //FIXME: Handle multiple correct states appropriately

            /*
            How?
            
            Use the default correct state by default. If disabled;
            a) get all the alt-correct states and run through them until 
             the end is reached (or any of the other end scenarios). Then 
             find the first common question and add this question to the 
             pathway. 
            b) get all the alt-correct states and run through them until
             the end is reached (or any of the other end scenarios). Then
             find the first question of the shortest sub-path and add that
             question to the pathway.

            Note: with both above scenarios, you'd need to account for 
             retracing your steps. Ideally this would be achieved with the
             depth value

            */

            /* OLD
            id = getNextPageId(page)[0];
            if ((parentPath && parentPath.indexOf(id) > -1) 
                || subPath.indexOf(id) > -1
                || id === pageId) {
                break;
            }
            subPath.push(id);
            page = _this.getPageById(id);
            */


            ids = getNextPageId(page);
            if (ids.length === 1) {
                //single correct path

                if ((parentPath && parentPath.indexOf(id) > -1) || 
                    subPath.indexOf(id) > -1 || 
                    id === pageId)
                    break;

                subPath.push(id);
                page = _this.getPageById(id);
            } else {
                //multiple correct paths

                var id, i;
                for (i=0; i < ids.length; i++) {
                    id = ids[i];


                }
            }
        }

        return subPath;
    }



    /*************** ATTEMPT 2 *****************/

    this.createNodePathByPageId = function (pageId) {
        return getPathToEndOfLoop(this.getPageById(pageId), 0);
    };


    function getPathToEndOfLoop(page, depth) {
        var id,
            ids,
            newPath = [];

        var parentPath; //TODO - this was used for stopping loops
        
        console.log('page: ' + page.name + ', d: ' + depth);

        if (depth > 5) return;

        newPath.push(_this.getNodeByPage(page));

        while (!_this.isEnd(page)) {

            ids = getNextPageId(page);
            if (ids.length === 1) {
                //single correct path
                id = ids[0];

                console.log('> page: ' + id);

                if ((parentPath && parentPath.indexOf(id) > -1) || 
                    newPath.indexOf(id) > -1)
                    break;

                var node = _this.getNodeByPageId(id);
                if (node.hasDepth()) {
                    //TODO A better implementation would allow for comparing
                    // depths, however if you do find that the new depth
                    // is lower than the existing depth, you'd have to 
                    // remove the node from its existing group and clean up
                    // that groups path
                    break;
                }
                node.setDepth(depth);
                newPath.push(node);
                page = node.page;
            
            } else {
                //multiple correct paths

                var logger = '';

                var page,
                    pages = [],
                    idCount = ids.length;
                for (var i=0; i < idCount; i++) {
                    node = _this.getNodeByPageId(ids[i]);

                    logger += ids[i] + '   ';
                    if (!node.hasDepth()) {
                        pages.push(node.page);
                    }
                }

                console.log('> pages: ' + logger);

                var nodeBranch = makeNodeBranch(pages, depth);
                newPath.push(nodeBranch);
                page = nodeBranch.branchEnd.page;
            }
        }

        return newPath;
    }


    function makeNodeBranch(pages, depth) {
        var paths = [];

        _.each(pages, function (page) {
            var newPath = getPathToEndOfLoop(page, depth + 1);
            paths.push(newPath);
        });

        //determine the end point of the branch by finding where all the nodes converge
        var branchEnd = findFirstCommonNode(paths);

        _.each(paths, function (path) {
            trimPath(path, branchEnd);
        });

        return new NodeBranch(paths, branchEnd);
    } 


    /*
    * Given a set of paths, find the node at which point they first converge.
    */
    function findFirstCommonNode(nodePaths) {
        //assume only one possible endnode

        /*
        var nodes,
            nodeCount,
            node,
            nodeIndex,
            firstPathNodes = flattenNodePath(nodePaths[0]);

        for (var i=1; i < nodePaths.length; i++) {
            nodes = flattenNodePath(nodePaths[i]);
            nodeCount = nodes.length;
            for (var j=0; j < nodeCount; j++) {
                node = nodes[j];

                if (firstPathNodes.indexOf(node) >= 0) {
                    nodeIndex = firstPathNodes.indexOf(node);
                    //might have to trim here directly
                    break;
                }
            }
        }
        */

        var logPath = '';

        var path,
            node,
            newIndex,
            nodeCount,
            nodeIndex = 0,
            firstPath = nodePaths[0];
        for (var i=1; i < nodePaths.length; i++) {
            logPath = '';
            path = nodePaths[i];
            nodeCount = path.length;
            for (var j=0; j < nodeCount; j++) {
                node = path[j];
                newIndex = firstPath.indexOf(node);

                logPath += node.pageId + ',';

                if (newIndex >= 0) {
                    //always keep the largest common index
                    nodeIndex = Math.max(newIndex, nodeIndex);

                    //TODO: might have to trim the paths here directly before 
                    //      breaking otherwise the paths that meet before the 
                    //      common node will have duplicate nodes

                    break;
                }
            }

            console.log(logPath);
        }

        return firstPath[nodeIndex];
    }


    function flattenNodePath(nodePath) {
        var nodes = [];
        _.each(nodePath, function (node) {
            nodes.concat(node.getChildren());
        });
        return nodes;
    }


    //Cut the path at a given node
    function trimPath(nodePath, node) {
        nodePath.splice(nodePath.indexOf(node), nodePath.length);
    }



    this.toggleLogging = function (enableLogging) {
        loggingEnabled = enableLogging;
    }


    function pathLog(pageId, groupType, depth) {
        if (!loggingEnabled) {
            return;
        }

        var indent = '';
        var x = depth;
        while (x-- > 0) { 
            indent += '-';
        }

        var shorthand = '';
        switch (groupType) {
            case GroupTypes.MISCONCEPTION: shorthand = 'M'; break;
            case GroupTypes.EXTRA: shorthand = 'E'; break;
        }

        var pref = indent + shorthand + ' ';
        console.log(((pref.length > 1) ? pref : '') + pageId);
    }


    this.isEnd = function (page) {
        return page.end;
    }


    this.isStart = function (page) {
        return page.start;
    }


    this.getEdges = function (node) {
        return getEdges(node.page);
    }

    function getEdges(page) {
        return getNextPageId(page)
                .concat(getMisconceptions(page),
                        getExtra(page));
    }

    function getMisconceptions(page) {
        var misc = page[GroupTypes.MISCONCEPTION];
        if (misc && misc.length > 0) {
            return misc;
        } else {
            return [];
        }
    }

    function getExtra(page) {
        var extra = page[GroupTypes.EXTRA];
        if (extra && extra.length > 0) {
            return extra;
        } else {
            return [];
        }
    }

    function getNextPageId (page) {
        //FIXME: Include ALT_CORRECT / EXTRA groupTypes here in 
        // the case that default correct is disabled, or when 
        // dealing with branching scenarios

        var nextIds = [];
        var corrects = page[GroupTypes.DEFAULT_CORRECT];
        var defaults = page[GroupTypes.EXTRA];

        if (corrects && corrects.length > 0) {
            nextIds = nextIds.concat(corrects);
        }

        if (defaults && defaults.length > 0) {
            nextIds = nextIds.concat(defaults);
        }

        /*
        if (defaults === undefined || defaults.length === 0) {
            defaults = getMisconceptions(page);
        }
        */

        if (nextIds && nextIds.length > 0) {
            return nextIds;
        } else if (page && _this.isEnd(page)) {
            return [];
        } else {
            throw new Error ('Data Error: defaults not found for page ' + page);
        }
    }


    this.getPageById = function (id) {
        var page = pages[id];
        if (!page) {
            throw new Error('Data Error: page id ' + id + ' not found');
        } else {
            return page;
        }
    };

    this.getPageId = function (page) {
        for (var pageId in pages) {
            if (pages[pageId] === page) {
                return pageId;
            }
        }
        return undefined;
    };

    this.getStartingPage = function () {
        var page = _.find(pages, function (page) {
            return this.isStart(page);
        }, this);

        if (page) {
            return page;
        } else {
            //default to first
            for (page in pages) {
                return pages[page];
            }
        }
    };

    this.getNodeByPageId = function (id) {
        var foundNode;
        _.each(this.nodes, function (node) {
            if (node && node.pageId === id) {
                foundNode = node;
            }
        }, this);
        return foundNode;
    }

    this.getNodeByPage = function (page) {
        var foundNode;
        _.each(this.nodes, function (node) {
            if (node && node.page === page) {
                foundNode = node;
            }
        }, this);
        return foundNode;
    }
};