Building

To build lesson;

cd /projects/core/internal/lesson-analyser-utils/
mvn clean compile assembly:single
cd target/
java -cp spr-lesson-analyser-utils-jar-with-dependencies.jar -Dspr.env=prod -Dcached=false LessonGraph 25696 --graph-json


#Tasks

Goals for proof of concept:
a) Working ltg in all conditions. Every question is always shown once on the graph.
b) Proper Error & Extra question group handling (COMPLETE?)
c) Collapsable graph (prove basic usability & readability) 
d) Handling of multiple correct states (branching scenarios). Including disabled default states
e) Handling of question banks (prove extentions to framework)
f) Prove / test ltg editing 


Blockers for issue a: b, d, e

Solving d)

Practical Approach: find as many broken graphs as possible, design their ideal state and define the rules to get there.


#Notes

## Node build heirarchy (moving to breadth first)
Several issues were solved by changing the order in which groups were created (see createNodeGroup()). The order should be; 1. Define the group path (Where the group path is the linear sequence of nodes), 2. then for each node in the group path, find its branches / children (misconceptions or extra content) and for each, mark the starting node, 3. then go through the marked nodes build the groups (start back at 1.).

This ensures correct heirarchy of nodes for complex lessons where a single node can be references in many node groups. 