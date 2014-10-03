var LTGUtil = function (svgEl) {

    this.svgNS = 'http://www.w3.org/2000/svg';

    this.getErrorGroups = function (container) {
        return this.getChildGroups(container, 'error');
    }

    this.getExtraGroups = function (container) {
        return this.getChildGroups(container, 'extra');
    }

    this.isError = function (el) {
        return this.hasClass(el, 'error');
    }

    this.isExtraInfo = function (el) {
        return this.hasClass(el, 'extra');
    }

    this.isQuestion = function (el) {
        return this.hasClass(el, 'question');
    }

    this.isRoot = function (el) {
        return this.hasClass(el, 'root');
    }

    this.isMainPath = function (el) {
        return this.hasClass(el, 'main');
    }

    this.isContainer = function (el) {
        return this.hasClass(el, 'container');
    }

    this.isAlternativeQuestion = function (id) {
        var questionGroup = document.getElementById(id);
        var parent = questionGroup.parentNode;
        //return isExtraInfo(parent) || isError(parent);

        //on the right track (ish) but still flawed
        
        var children = this.getChildGroups(parent);
        if (children && children.indexOf(questionGroup) === 0) {
            return this.isExtraInfo(parent) || this.isError(parent);
        } else {
            return false;
        }

    }

    this.isErrorQuestion = function (id) {
        var questionGroup = document.getElementById(id);
        return this.isExtraInfo(questionGroup.parentNode);
    }

    this.isExtraQuestion = function (id) {
        var questionGroup = document.getElementById(id);
        return this.isError(questionGroup.parentNode);
    } 


    this.hasClass = function (el,className) {
        var classes = el.getAttribute('class');
        return classes && classes.indexOf(className) > -1;
    } 

    this.addClass = function (el, className) {
        var existingClasses = el.getAttribute('class');
        if (existingClasses === undefined || existingClasses === null) {
            el.setAttribute('class', className);
        } else if (!this.hasClass(el, className)) {
            el.setAttribute('class', existingClasses.trim() + ' ' + className);
        }
    }

    this.removeClass = function (el, className) {
        if (this.hasClass(el, className)) {
            el.setAttribute('class', el.getAttribute('class').replace(className, ''));
        }
    }

    this.getChildGroups = function (container, className) {
        var children,
            child,
            childGroups,
            numChildren;

        childGroups = [];
        children = container.childNodes;
        numChildren = children.length;
        for (var i=0; i < numChildren; i++) {
            child = children[i];
            //only measure groups
            if (child.nodeName === 'g' && (className === undefined || this.hasClass(child,className))) {
                childGroups.push(child);
            }
        }

        return childGroups;
    }


    this.addPadding = function (el, paddingX, paddingY) {
        if (paddingY === undefined) {
            paddingY = paddingX;
        }

        children = this.getChildGroups(el);
        numChildren = children.length;
        for (var i=0; i < numChildren; i++) {
            child = children[i];
            if (!this.hasClass(child, 'padding')) {
                this.positionEl(
                    child,
                    this.getElPosition(child).x + paddingX,
                    this.getElPosition(child).y + paddingY);
            }
        }

        return el;
    }


    this.getElPosition = function (el) {
        var pos = {
            x: 0,
            y: 0
        };

        var m = el.getCTM();
        pos.x += m.e;
        pos.y += m.f;

        return pos;
    }


    this.positionEl = function (el, x, y) {
        matrix = svgEl.createSVGMatrix();
        matrix = matrix.translate(x, y);
        transform = el.transform.baseVal;
        if (transform.numberOfItems === 0) {
            transform = svgEl.createSVGTransformFromMatrix(matrix);
            el.transform.baseVal.appendItem(transform);
        } else {
            transform.getItem(0).setMatrix(matrix);
        }

        return el;
    }


    this.newSVGGroup = function (cssClasses, id) {
        var g = document.createElementNS(this.svgNS, 'g');
        if (id) { 
            g.setAttribute('id', id);
        }
        if (cssClasses) {
            g.setAttribute('class', cssClasses);
        }
        return g;
    }


    this.getQuestionRect = function(id) {
        var questionGroup = document.getElementById(id);

        var children = questionGroup.childNodes;
        for (var i=0; i < children.length; i++) {
            var child = children[i];
            if (child.nodeName === "rect") {
                return child;
            }
        }

        return questionGroup;
    }


    this.isParentCollapsed = function(el) {
        //FIXME: inefficient!
        var parent = el.parentNode;
        if (!parent || parent.nodeName !== "g") {
            return false;
        } else if (this.hasClass(parent, "collapsed")) {
            return true;
        } else {
            return this.isParentCollapsed(parent);
        }
    }
}