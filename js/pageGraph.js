
var GroupTypes = {
    MAIN : 'main',
    DEFAULT_CORRECT : 'defaultCorrect',
    MISCONCEPTION : 'altWrong',
    EXTRA : 'altCorrect',
    BRANCH : 'branch'
};


// A single page, with any number of child node groups
var Node = function (id, page, children) {
    this.pageId = id;
    this.page = page;
    this.groups = children || [];
    this.depth;

    this.addGroup = function (group) {
        this.groups.push(group);
    }

    this.hasGroups = function () {
        return this.groups && this.groups.length > 0;
    }

    this.hasDepth = function () {
        return this.depth != undefined;
    }

    this.setDepth = function (depth) {
        if (!this.hasDepth()) {
            this.depth = depth;
        }
    } 
};


// A single path of nodes of a particular group type
var NodeGroup = function (type, nodes) {
    this.groupType = type;
    this.nodePath = nodes || [];

    this.addNode = function (node) {
        this.nodePath.push(node);
    }

    this.hasNodes = function () {
        return this.nodePath && this.nodePath.length > 0;
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
            pathLog(node.pageId, groupType, depth);

            var extras = [];

            //Find any extra pathways and build the corresponding group type
            _.each(getExtra(node.page), function (id) {
                var subNode = this.getNodeByPageId(id);
                if (subNode.hasDepth()) {
                    return;
                } else {
                    subNode.setDepth(depth + 1);
                    extras.push(id);
                }
            }, this);

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
        var id;
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
            id = getNextPageId(page)[0];
            if ((parentPath && parentPath.indexOf(id) > -1) 
                || subPath.indexOf(id) > -1
                || id === pageId) {
                break;
            }
            subPath.push(id);
            page = _this.getPageById(id);
        }

        return subPath;
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
        var defaults = page[GroupTypes.DEFAULT_CORRECT];
        //if (!defaults || defaults.length === 0) {
        //    return true;
        //} else {
            return page.end;
        //}
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
        var defaults = page[GroupTypes.DEFAULT_CORRECT];

        if (defaults === undefined || defaults.length === 0) {
            defaults = getExtra(page);
        }

        if (defaults === undefined || defaults.length === 0) {
            defaults = getMisconceptions(page);
        }

        if (defaults && defaults.length > 0) {
            return defaults;
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
        var startingPageId;

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
};